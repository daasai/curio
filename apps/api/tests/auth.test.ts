import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createTestDb } from './test-utils';
import { schema } from 'curio-db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from 'curio-db';
import { assertSecurityConfig, normalizePhone } from '../src/auth';

const app = new Hono();

describe('Auth Module Integration Tests', () => {
  let dbPathInfo: any;
  let db: ReturnType<typeof createDb>;
  let testUserPhone = '13812345678';
  let testInviteCode = '123456';
  let testUserId = 'test_user_auth';
  let validSessionCookie = '';
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllowHttpCookies = process.env.ALLOW_HTTP_COOKIES;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_HTTP_COOKIES = 'true';
    dbPathInfo = createTestDb();
    db = createDb(dbPathInfo.dbPath);

    const authModule = await import('../src/auth');
    app.route('', authModule.authRoutes);

    await db.insert(schema.users).values({
      id: testUserId,
      email: 'testauth@example.com',
      phone: testUserPhone,
      inviteCode: testInviteCode,
      status: 'invited',
      createdAt: new Date().toISOString(),
      streak: 0,
      diagnosticLevel: 'basic'
    });
  });

  afterAll(() => {
    dbPathInfo.cleanup();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAllowHttpCookies === undefined) delete process.env.ALLOW_HTTP_COOKIES;
    else process.env.ALLOW_HTTP_COOKIES = previousAllowHttpCookies;
  });

  it('GET /api/me returns 401 if unauthenticated', async () => {
    const res = await app.request('/api/me');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('normalizes supported dirty phone formats and rejects invalid numbers', () => {
    expect(normalizePhone('  +86 138-0000-0000 ')).toBe('13800000000');
    expect(normalizePhone('138 0000 0000')).toBe('13800000000');
    expect(normalizePhone('+8613800000000')).toBe('13800000000');
    expect(normalizePhone('23800000000')).toBeNull();
    expect(normalizePhone('1380000000')).toBeNull();
  });

  it('fails fast when the session signing secret is missing or too short', () => {
    expect(() => assertSecurityConfig({})).toThrow('JWT_SECRET');
    expect(() => assertSecurityConfig({ JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });

  it('POST /api/auth/pilot/activate successfully activates user and sets cookie', async () => {
    const res = await app.request('/api/auth/pilot/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, inviteCode: testInviteCode, password: 'first-pass8' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const cookies = res.headers.get('set-cookie');
    expect(cookies).toBeTruthy();
    expect(cookies).toContain('curio_session=');
    expect(cookies).not.toContain('Secure');

    validSessionCookie = cookies!.split('curio_session=')[1].split(';')[0];
    
    // Check DB
    const user = await db.select().from(schema.users).where(eq(schema.users.id, testUserId)).get();
    expect(user?.status).toBe('active');
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.pinHash).toBeNull();
  });

  it('GET /api/me returns user info when authenticated and omits sensitive fields', async () => {
    const res = await app.request('/api/me', {
      headers: { 'Cookie': `curio_session=${validSessionCookie}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(testUserId);
    expect(body.user.phone).toBeUndefined();
    expect(body.user.pinHash).toBeUndefined();
  });

  it('POST /api/auth/login successfully logs in and sets cookie', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, password: 'first-pass8' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.headers.get('set-cookie')).toContain('curio_session=');
  });

  it('keeps Secure on HTTPS even when temporary HTTP cookie support is enabled', async () => {
    const res = await app.request('/api/auth/pilot/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({ phone: testUserPhone, password: 'first-pass8' })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Secure');
  });

  it('POST /api/auth/pilot/login fails 5 times and then locks account', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/auth/pilot/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testUserPhone, password: 'wrong-pass8' })
      });
      if (i < 4) {
        expect(res.status).toBe(400); // INVALID_CREDENTIALS
      } else {
        expect(res.status).toBe(403); // ACCOUNT_LOCKED on 5th attempt
      }
    }

    // 6th attempt should return locked even with correct pin
    const res6 = await app.request('/api/auth/pilot/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, password: 'first-pass8' })
    });
    expect(res6.status).toBe(403);
    const body6 = await res6.json();
    expect(body6.error.code).toBe('ACCOUNT_LOCKED');
    const lock = await db.select().from(schema.authLockouts).where(eq(schema.authLockouts.phone, testUserPhone)).get();
    expect(lock?.failedCount).toBe(5);
    expect(lock?.lockedUntil).toBeTruthy();
  });

  it('clears an expired persistent lock before counting a new failure', async () => {
    await db.update(schema.authLockouts).set({
      failedCount: 5,
      lockedUntil: new Date(Date.now() - 60_000).toISOString(),
    }).where(eq(schema.authLockouts.phone, testUserPhone));
    const response = await app.request('/api/auth/pilot/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, password: 'wrong-pass8' }),
    });
    expect(response.status).toBe(400);
    const lock = await db.select().from(schema.authLockouts).where(eq(schema.authLockouts.phone, testUserPhone)).get();
    expect(lock?.failedCount).toBe(1);
  });

  it('changes a session user password and invalidates the old password', async () => {
    const change = await app.request('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `curio_session=${validSessionCookie}` },
      body: JSON.stringify({ currentPassword: 'first-pass8', newPassword: 'second-pass9' }),
    });
    expect(change.status).toBe(200);
    expect((await change.json()).success).toBe(true);

    const reused = await app.request('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `curio_session=${validSessionCookie}` },
      body: JSON.stringify({ currentPassword: 'second-pass9', newPassword: 'second-pass9' }),
    });
    expect(reused.status).toBe(400);
    expect((await reused.json()).error.code).toBe('PASSWORD_REUSED');

    const oldLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, password: 'first-pass8' }),
    });
    expect(oldLogin.status).toBe(400);

    const newLogin = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserPhone, password: 'second-pass9' }),
    });
    expect(newLogin.status).toBe(200);
  });

  it('POST /api/auth/pilot/login returns ACCOUNT_DISABLED for disabled user', async () => {
    await db.update(schema.users).set({ status: 'disabled' }).where(eq(schema.users.id, testUserId));
    
    // We also need to use a different phone number because testUserPhone is currently locked in memory
    const disabledUserPhone = '13900000000';
    await db.insert(schema.users).values({
      id: 'disabled_user',
      phone: disabledUserPhone,
      status: 'disabled',
      createdAt: new Date().toISOString(),
      streak: 0,
    });

    const res = await app.request('/api/auth/pilot/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: disabledUserPhone, pin: '123456' })
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
