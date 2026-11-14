import { NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { publishRealtime } from '@/lib/realtime';
export const dynamic = 'force-dynamic';
const themes = new Set(['garden', 'ocean', 'blossom', 'night']);
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const [users, preferences] = await Promise.all([
    sql`SELECT id, username, display_name, profile_image_key FROM users ORDER BY CASE id WHEN 'queen-moyosore' THEN 1 ELSE 2 END`,
    sql`SELECT theme FROM chat_settings WHERE id = 1 LIMIT 1`,
  ]);
  return NextResponse.json({ me: me.id, users: users.map(user => ({ id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.profile_image_key ? `/api/profiles/${user.id}/avatar` : null })), theme: preferences[0]?.theme ?? 'garden' }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PUT(request: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const sql = database();
  const result: { profile?: { id: string; username: string; display_name: string; avatar_url: string | null }; theme?: string } = {};
  if (data.display_name !== undefined || data.profile_image_key !== undefined) {
    const name = typeof data.display_name === 'string' ? data.display_name.trim() : me.display_name;
    const key = data.profile_image_key;
    if (name.length < 1 || name.length > 80) return NextResponse.json({ error: 'Name must be between 1 and 80 characters.' }, { status: 400 });
    if (key !== undefined && key !== null && (typeof key !== 'string' || !key.startsWith(`profiles/${me.id}/`))) return NextResponse.json({ error: 'Invalid profile photo.' }, { status: 400 });
    const rows = key === undefined
      ? await sql`UPDATE users SET display_name = ${name} WHERE id = ${me.id} RETURNING id, username, display_name, profile_image_key`
      : await sql`UPDATE users SET display_name = ${name}, profile_image_key = ${key} WHERE id = ${me.id} RETURNING id, username, display_name, profile_image_key`;
    const user = rows[0];
    await createSession({ id: user.id, username: user.username, display_name: user.display_name });
    result.profile = { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.profile_image_key ? `/api/profiles/${user.id}/avatar?v=${Date.now()}` : null };
  }
  if (data.theme !== undefined) {
    if (typeof data.theme !== 'string' || !themes.has(data.theme)) return NextResponse.json({ error: 'Choose a supported chat theme.' }, { status: 400 });
    await sql`INSERT INTO chat_settings (id, theme, updated_by, updated_at) VALUES (1, ${data.theme}, ${me.id}, now()) ON CONFLICT (id) DO UPDATE SET theme = EXCLUDED.theme, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    result.theme = data.theme;
    try { await publishRealtime({ type: 'theme', theme: data.theme }); } catch (error) { console.error('[chat] theme broadcast failed', error); }
  }
  return NextResponse.json({ ok: true, ...result });
}
