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
  await sql`CREATE TABLE IF NOT EXISTS timeline_events (id BIGSERIAL PRIMARY KEY, happened_on DATE NOT NULL, title TEXT NOT NULL, story TEXT NOT NULL DEFAULT '', created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS timeline_events_happened_on_idx ON timeline_events(happened_on, id)`;
  await sql`CREATE TABLE IF NOT EXISTS memories (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', happened_on DATE NOT NULL, is_public BOOLEAN NOT NULL DEFAULT false, created_by TEXT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS memories_happened_on_idx ON memories(happened_on DESC, id DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS memory_contributions (memory_id BIGINT NOT NULL REFERENCES memories(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (memory_id, user_id))`;
  await sql`CREATE TABLE IF NOT EXISTS memory_media (id BIGSERIAL PRIMARY KEY, memory_id BIGINT NOT NULL REFERENCES memories(id) ON DELETE CASCADE, object_key TEXT NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS memory_media_memory_id_idx ON memory_media(memory_id, id)`;
  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, preferences JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id)`;
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
