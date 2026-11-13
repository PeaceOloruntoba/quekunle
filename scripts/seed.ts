import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';
import { database } from '../lib/db';

loadEnvConfig(process.cwd());
const users = [
  { id: 'queen-moyosore', username: 'Quenzsome', display_name: 'Queen Moyosore', password: process.env.QUEEN_PASSWORD },
  { id: 'peace-adekunle', username: 'Adekunle', display_name: 'Peace Adekunle', password: process.env.PEACE_PASSWORD },
];
async function seed() {
  if (users.some((u) => !u.password)) throw new Error('Set QUEEN_PASSWORD and PEACE_PASSWORD in .env.local before seeding.');
  const sql = database();
  for (const user of users) {
    const hash = await bcrypt.hash(user.password!, 12);
    await sql`INSERT INTO users (id, username, display_name, password_hash) VALUES (${user.id}, ${user.username}, ${user.display_name}, ${hash}) ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name`;
  }
  console.log('Seeded the two Quekunle accounts. Existing password hashes are left unchanged.');
}
seed().catch((err) => { console.error(err); process.exit(1); });
