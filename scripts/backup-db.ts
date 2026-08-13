import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const dbPath = join(process.cwd(), 'data', 'curio.db');
const backupsDir = join(process.cwd(), 'data', 'backups');

if (!existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

if (!existsSync(backupsDir)) {
  mkdirSync(backupsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = join(backupsDir, `curio-${timestamp}.db`);

copyFileSync(dbPath, backupPath);

const fileBuffer = readFileSync(dbPath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const hex = hashSum.digest('hex');

console.log(`Backup created at: ${backupPath}`);
console.log(`SHA-256 of original DB: ${hex}`);
