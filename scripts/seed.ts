import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';
import { database } from '../lib/db';

loadEnvConfig(process.cwd());
const users = [
  { id: 'queen-moyosore', username: 'Quenzsome', display_name: 'Queen Moyosore', password: process.env.QUEEN_PASSWORD },
  { id: 'peace-adekunle', username: 'Adekunle', display_name: 'Peace Adekunle', password: process.env.PEACE_PASSWORD },
];
async function ensureSchema() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, profile_image_key TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_key TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL DEFAULT '', attachment_key TEXT, attachment_name TEXT, attachment_type TEXT, reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ)`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS reactions (message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (message_id, user_id, emoji))`;
  await sql`CREATE INDEX IF NOT EXISTS reactions_message_id_idx ON reactions(message_id)`;
  await sql`CREATE TABLE IF NOT EXISTS chat_settings (id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), theme TEXT NOT NULL DEFAULT 'garden', wallpaper TEXT NOT NULL DEFAULT 'garden', wallpaper_image_key TEXT, updated_by TEXT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE chat_settings ADD COLUMN IF NOT EXISTS wallpaper TEXT NOT NULL DEFAULT 'garden'`;
  await sql`ALTER TABLE chat_settings ADD COLUMN IF NOT EXISTS wallpaper_image_key TEXT`;
  await sql`INSERT INTO chat_settings (id, theme, wallpaper) VALUES (1, 'garden', 'garden') ON CONFLICT (id) DO NOTHING`;
  return sql;
}
async function seed() {
  if (users.some((u) => !u.password)) throw new Error('Set QUEEN_PASSWORD and PEACE_PASSWORD in .env.local before seeding.');
  const sql = await ensureSchema();
  for (const user of users) {
    const hash = await bcrypt.hash(user.password!, 12);
    await sql`INSERT INTO users (id, username, display_name, password_hash) VALUES (${user.id}, ${user.username}, ${user.display_name}, ${hash}) ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name`;
  }
  console.log('Database schema is ready and both Quekunle accounts are seeded. Existing password hashes are left unchanged.');
}
seed().catch((err) => { console.error(err); process.exit(1); });
