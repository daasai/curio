import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const dbPath = resolve(process.argv[2] || process.env.DB_PATH || 'data/curio.db');
const db = new Database(dbPath);

type DuplicatePhone = { phone: string; userIds: string; count: number };

function hasUniquePhoneIndex(db: Database): boolean {
  const indexes = db.query(`PRAGMA index_list('users')`).all() as Array<{ name: string; unique: number }>;
  return indexes.some((index) => {
    if (index.unique !== 1) return false;
    const columns = db.query(`PRAGMA index_info('${index.name.replace(/'/g, "''")}')`).all() as Array<{ name: string }>;
    return columns.length === 1 && columns[0]?.name === 'phone';
  });
}

try {
  const duplicates = db.query(`
    SELECT phone, GROUP_CONCAT(id, ',') AS userIds, COUNT(*) AS count
    FROM users
    WHERE phone IS NOT NULL AND TRIM(phone) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
    ORDER BY phone
  `).all() as DuplicatePhone[];

  if (duplicates.length > 0) {
    console.error('PHONE_UNIQUENESS_BLOCKED: 发现重复手机号，未创建索引。');
    for (const duplicate of duplicates) {
      console.error(`phone=${duplicate.phone} users=${duplicate.userIds} count=${duplicate.count}`);
    }
    process.exitCode = 2;
  } else if (hasUniquePhoneIndex(db)) {
    console.log(`PHONE_UNIQUENESS_READY: ${dbPath} (existing index)`);
  } else {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL`);
    console.log(`PHONE_UNIQUENESS_READY: ${dbPath}`);
  }
} finally {
  db.close();
}
