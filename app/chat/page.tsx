import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { bucketName, getStorage } from '@/lib/storage';
import Chat from './Chat';
export const dynamic = 'force-dynamic';
export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const sql = database();
  const people = await sql`SELECT id, display_name FROM users ORDER BY CASE id WHEN 'queen-moyosore' THEN 1 ELSE 2 END`;
  const self = people.find(person => person.id === session.id);
  const other = people.find(person => person.id !== session.id);
  let rows: Record<string, unknown>[];
  try {
    rows = await sql`SELECT theme, wallpaper, wallpaper_image_key FROM chat_settings WHERE id = 1 LIMIT 1` as Record<string, unknown>[];
  } catch (error) {
    // Keep existing chat deployments working while the additive wallpaper
    // columns are waiting for the seed/migration script to be run.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42703') {
      console.error('[chat] wallpaper columns missing; run npm run db:seed to apply the schema update.');
      rows = await sql`SELECT theme FROM chat_settings WHERE id = 1 LIMIT 1` as Record<string, unknown>[];
    } else throw error;
  }
  const theme = String(rows[0]?.theme ?? 'garden');
  const wallpaper = String(rows[0]?.wallpaper ?? 'garden');
  let wallpaperUrl: string | null = null;
  if (rows[0]?.wallpaper_image_key) {
    try { wallpaperUrl = await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: String(rows[0].wallpaper_image_key) }), { expiresIn: 15 * 60 }); }
    catch (error) { console.error('[chat] unable to sign shared wallpaper URL', error); }
  }
  return <Chat me={{ id: session.id, name: String(self?.display_name ?? session.display_name) }} other={{ id: String(other?.id ?? ''), name: String(other?.display_name ?? (session.id === 'queen-moyosore' ? 'Peace Adekunle' : 'Queen Moyosore')), avatarUrl: other ? `/api/profiles/${other.id}/avatar` : '' }} initialTheme={theme} initialWallpaper={wallpaper} initialWallpaperUrl={wallpaperUrl} />;
}
