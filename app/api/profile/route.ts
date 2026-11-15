import { NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { publishRealtime } from '@/lib/realtime';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { bucketName, getStorage } from '@/lib/storage';
export const dynamic = 'force-dynamic';
const wallpapers = new Set(['garden', 'sky', 'petals', 'night', 'custom']);
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const [users, preferences] = await Promise.all([
    sql`SELECT id, username, display_name, profile_image_key FROM users ORDER BY CASE id WHEN 'queen-moyosore' THEN 1 ELSE 2 END`,
    sql`SELECT theme, wallpaper, wallpaper_image_key FROM chat_settings WHERE id = 1 LIMIT 1`,
  ]);
  const wallpaperImageUrl = preferences[0]?.wallpaper_image_key ? await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: String(preferences[0].wallpaper_image_key) }), { expiresIn: 15 * 60 }) : null;
  return NextResponse.json({ me: me.id, users: users.map(user => ({ id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.profile_image_key ? `/api/profiles/${user.id}/avatar` : null })), theme: preferences[0]?.theme ?? 'garden', wallpaper: preferences[0]?.wallpaper ?? 'garden', wallpaper_image_url: wallpaperImageUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PUT(request: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const sql = database();
  const result: { profile?: { id: string; username: string; display_name: string; avatar_url: string | null }; theme?: string; wallpaper?: string; wallpaper_image_url?: string | null } = {};
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
    const theme = data.theme;
    if (typeof theme !== 'string' || !new Set(['garden', 'ocean', 'blossom', 'night']).has(theme)) return NextResponse.json({ error: 'Choose a supported chat colour theme.' }, { status: 400 });
    await sql`INSERT INTO chat_settings (id, theme) VALUES (1, ${theme}) ON CONFLICT (id) DO UPDATE SET theme = EXCLUDED.theme, updated_by = ${me.id}, updated_at = now()`;
    result.theme = theme;
    const current = await sql`SELECT wallpaper, wallpaper_image_key FROM chat_settings WHERE id = 1 LIMIT 1`;
    const imageUrl = current[0]?.wallpaper_image_key ? await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: String(current[0].wallpaper_image_key) }), { expiresIn: 15 * 60 }) : null;
    try { await publishRealtime({ type: 'wallpaper', theme, wallpaper: String(current[0]?.wallpaper ?? 'garden'), wallpaper_image_url: imageUrl }); } catch (error) { console.error('[chat] theme broadcast failed', error); }
  }
  if (data.wallpaper !== undefined || data.wallpaper_image_key !== undefined) {
    const wallpaper = data.wallpaper;
    const imageKey = data.wallpaper_image_key ?? null;
    if (typeof wallpaper !== 'string' || !wallpapers.has(wallpaper)) return NextResponse.json({ error: 'Choose a supported wallpaper.' }, { status: 400 });
    if (wallpaper === 'custom' && (typeof imageKey !== 'string' || !imageKey.startsWith(`wallpapers/${me.id}/`))) return NextResponse.json({ error: 'Choose a wallpaper image first.' }, { status: 400 });
    if (wallpaper !== 'custom' && imageKey !== null) return NextResponse.json({ error: 'Preset wallpapers cannot include an image.' }, { status: 400 });
    await sql`INSERT INTO chat_settings (id, theme, wallpaper, wallpaper_image_key, updated_by, updated_at) VALUES (1, 'garden', ${wallpaper}, ${imageKey}, ${me.id}, now()) ON CONFLICT (id) DO UPDATE SET wallpaper = EXCLUDED.wallpaper, wallpaper_image_key = EXCLUDED.wallpaper_image_key, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    result.wallpaper = wallpaper;
    result.wallpaper_image_url = imageKey ? await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: imageKey }), { expiresIn: 15 * 60 }) : null;
    try { await publishRealtime({ type: 'wallpaper', wallpaper, wallpaper_image_url: result.wallpaper_image_url }); } catch (error) { console.error('[chat] wallpaper broadcast failed', error); }
  }
  return NextResponse.json({ ok: true, ...result });
}
