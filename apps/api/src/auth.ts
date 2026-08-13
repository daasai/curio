import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { createDb, schema } from 'curio-db';
import { join } from 'path';
import { eq } from 'drizzle-orm';

const authRoutes = new Hono();

function getDb() {
  const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/curio.db');
  return createDb(dbPath);
}

const JWT_SECRET_MIN_BYTES = 32;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < JWT_SECRET_MIN_BYTES) {
    throw new Error('JWT_SECRET is required and must contain at least 32 bytes');
  }
  return secret;
}

type SecurityEnvironment = Record<string, string | undefined>;

export function assertSecurityConfig(env: SecurityEnvironment = process.env): void {
  const secret = env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < JWT_SECRET_MIN_BYTES) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes');
  }
  if (env.NODE_ENV === 'production' && env.ALLOW_HTTP_COOKIES === 'true') {
    throw new Error('ALLOW_HTTP_COOKIES must not be enabled in production');
  }
}

async function signSession(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getJwtSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(userId));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${userId}.${hexSignature}`;
}

async function verifySession(cookieValue: string): Promise<string | null> {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const userId = parts[0];
  const expectedCookie = await signSession(userId);
  if (cookieValue === expectedCookie) {
    return userId;
  }
  return null;
}

function useSecureSessionCookie(c: any): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedProto === 'https') return true;
  if (process.env.ALLOW_HTTP_COOKIES === 'true') return false;

  return true;
}

function passwordFromBody(body: Record<string, unknown>): string | null {
  const value = typeof body.password === 'string' ? body.password : body.pin;
  return typeof value === 'string' ? value : null;
}

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

function storedPasswordHash(user: { passwordHash?: string | null; pinHash?: string | null }): string {
  return user.passwordHash || user.pinHash || '';
}

async function setSession(c: any, userId: string): Promise<void> {
  const sessionCookie = await signSession(userId);
  setCookie(c, 'curio_session', sessionCookie, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800,
    secure: useSecureSessionCookie(c),
  });
}

export function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const compact = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  const withoutCountryCode = compact.replace(/^\+86/, '');
  return /^1\d{10}$/.test(withoutCountryCode) ? withoutCountryCode : null;
}

authRoutes.post('/api/auth/pilot/activate', async (c) => {
  try {
    const db = getDb();
    const body = await c.req.json();
    const phone = normalizePhone(body.phone);
    const inviteCode = body.inviteCode;
    const password = passwordFromBody(body);

    if (!phone || typeof inviteCode !== 'string' || !password || !isValidPassword(password)) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Missing fields', retryable: false } }, 400);
    }

    const user = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).get();

    if (!user || user.status !== 'invited' || user.inviteCode !== inviteCode) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or invite code', retryable: false } }, 400);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10,
    });

    const now = new Date().toISOString();
    await db.update(schema.users).set({
      passwordHash,
      pinHash: null,
      status: 'active',
      mustChangePassword: 0,
      passwordUpdatedAt: now,
      updatedAt: now,
    }).where(eq(schema.users.id, user.id));

    await setSession(c, user.id);

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: true } }, 500);
  }
});

const loginHandler = async (c: any) => {
  try {
    const db = getDb();
    const body = await c.req.json();
    const phone = normalizePhone(body.phone);
    const password = passwordFromBody(body);

    if (!phone || !password) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Missing fields', retryable: false } }, 400);
    }

    const now = new Date();
    const lockInfo = await db.select().from(schema.authLockouts).where(eq(schema.authLockouts.phone, phone)).get();
    const lockedUntil = lockInfo?.lockedUntil ? new Date(lockInfo.lockedUntil) : null;
    let failureCount = lockInfo?.failedCount || 0;
    if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
      const waitMin = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
      return c.json({ error: { code: 'ACCOUNT_LOCKED', message: `Too many attempts. Locked for ${waitMin} minutes.`, retryable: true } }, 403);
    }
    if (lockInfo && lockedUntil && lockedUntil.getTime() <= now.getTime()) {
      await db.update(schema.authLockouts).set({ failedCount: 0, lockedUntil: null }).where(eq(schema.authLockouts.phone, phone));
      failureCount = 0;
    }

    const user = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).get();

    if (!user || user.status === 'invited') {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password', retryable: false } }, 400);
    }

    if (user.status === 'disabled') {
      return c.json({ error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled', retryable: false } }, 403);
    }

    const isValid = await Bun.password.verify(password, storedPasswordHash(user));

    if (!isValid) {
      const count = failureCount + 1;
      const nextLockedUntil = count >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
      await db.insert(schema.authLockouts).values({
        phone,
        failedCount: count,
        lockedUntil: nextLockedUntil,
        lastFailedAt: now.toISOString(),
      }).onConflictDoUpdate({
        target: schema.authLockouts.phone,
        set: { failedCount: count, lockedUntil: nextLockedUntil, lastFailedAt: now.toISOString() },
      });
      if (count >= 5) {
        return c.json({ error: { code: 'ACCOUNT_LOCKED', message: 'Too many attempts. Locked for 15 minutes.', retryable: true } }, 403);
      }
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password', retryable: false } }, 400);
    }

    await db.delete(schema.authLockouts).where(eq(schema.authLockouts.phone, phone));

    await setSession(c, user.id);

    return c.json({ success: true, mustChangePassword: Boolean(user.mustChangePassword) });
  } catch (err) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: true } }, 500);
  }
};

authRoutes.post('/api/auth/login', loginHandler);
authRoutes.post('/api/auth/pilot/login', loginHandler);

authRoutes.post('/api/auth/password', async (c) => {
  const db = getDb();
  const cookieValue = getCookie(c, 'curio_session');
  const userId = cookieValue ? await verifySession(cookieValue) : null;
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated', retryable: false } }, 401);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid request', retryable: false } }, 400);
  }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!isValidPassword(newPassword)) {
    return c.json({ error: { code: 'INVALID_PASSWORD', message: `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`, retryable: false } }, 400);
  }
  if (currentPassword === newPassword) {
    return c.json({ error: { code: 'PASSWORD_REUSED', message: 'New password must differ from current password', retryable: false } }, 400);
  }
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  const currentPasswordValid = user ? await Bun.password.verify(currentPassword, storedPasswordHash(user)) : false;
  if (!user || !currentPasswordValid) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect', retryable: false } }, 400);
  }

  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(newPassword, { algorithm: 'bcrypt', cost: 10 });
  await db.update(schema.users).set({
    passwordHash,
    pinHash: null,
    mustChangePassword: 0,
    passwordUpdatedAt: now,
    updatedAt: now,
  }).where(eq(schema.users.id, userId));
  return c.json({ success: true });
});

authRoutes.post('/api/auth/logout', async (c) => {
  setCookie(c, 'curio_session', '', {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
    secure: useSecureSessionCookie(c),
  });
  return c.json({ success: true });
});

authRoutes.get('/api/me', async (c) => {
  const db = getDb();
  const cookieValue = getCookie(c, 'curio_session');
  if (!cookieValue) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  const userId = await verifySession(cookieValue);
  if (!userId) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid session' } }, 401);
  }

  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user || user.status === 'disabled') {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Account disabled or not found' } }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      diagnosticLevel: user.diagnosticLevel,
      storyGenrePreferences: user.storyGenrePreferences ? user.storyGenrePreferences.split(',') : [],
      intensity: user.intensity,
      streak: user.streak,
      mustChangePassword: Boolean(user.mustChangePassword),
    }
  });
});

export { authRoutes, verifySession, signSession };
