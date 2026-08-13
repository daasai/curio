import { Database } from 'bun:sqlite';
import { join } from 'path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: bun scripts/create-pilot-user.ts <phone>');
  process.exit(1);
}

let rawPhone = args[0];
// Normalize phone: remove spaces, +86 prefix, keep only digits
let phone = rawPhone.replace(/\s+/g, '').replace(/^\+86/, '').replace(/\D/g, '');

if (phone.length !== 11) {
  console.error(`Error: Invalid phone number length after normalization. Expected 11 digits, got ${phone.length} (${phone})`);
  process.exit(1);
}

const dbPath = process.env.DB_PATH || join(__dirname, '../data/curio.db');
const db = new Database(dbPath);

// Generate random 6-digit invite code
const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();

// Generate user id
const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const todayStr = new Date().toISOString().split('T')[0];
const createdAt = new Date().toISOString();

try {
  const dummyEmail = `pilot_${phone}@example.com`;
  db.run(
    `INSERT INTO users (id, email, phone, status, invite_code, created_at, diagnostic_level, streak, last_active_date) 
     VALUES (?, ?, ?, 'invited', ?, ?, 'basic', 0, ?)`,
    [userId, dummyEmail, phone, inviteCode, createdAt, todayStr]
  );
  console.log(`Phone: ${phone}, InviteCode: ${inviteCode}, UserId: ${userId}`);
} catch (error: any) {
  if (error.message.includes('UNIQUE constraint failed')) {
    console.error('Error: Phone number already exists.');
  } else {
    console.error('Database error:', error);
  }
} finally {
  db.close();
}
