import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const password = process.env.PILOT_DEFAULT_PASSWORD;
if (!password || password.length < 8 || password.length > 72) {
  throw new Error('PILOT_DEFAULT_PASSWORD must be configured with 8-72 characters');
}

const databasePath = resolve(process.argv[2] || 'data/curio.db');
const db = new Database(databasePath);

try {
  const columns = db.query('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const ensureColumn = (name: string, definition: string) => {
    if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  };
  ensureColumn('password_hash', 'TEXT');
  ensureColumn('must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('password_updated_at', 'TEXT');

  const accounts = db.query(`
    SELECT id FROM users
    WHERE phone IS NOT NULL AND TRIM(phone) <> ''
      AND (password_hash IS NULL OR password_hash = '')
      AND (pin_hash IS NULL OR pin_hash = '')
  `).all() as Array<{ id: string }>;
  if (accounts.length === 0) {
    console.log('DEFAULT_PASSWORD_MIGRATION: no eligible accounts');
    process.exit(0);
  }

  const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
  const now = new Date().toISOString();
  const update = db.query(`
    UPDATE users
    SET password_hash = ?, must_change_password = 1, password_updated_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `);
  db.transaction(() => {
    for (const account of accounts) update.run(passwordHash, now, now, account.id);
  })();
  console.log(`DEFAULT_PASSWORD_MIGRATION: initialized ${accounts.length} account(s); password change required on next login`);
} finally {
  db.close();
}
