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
  const rows = await sql`SELECT theme, wallpaper, wallpaper_image_key FROM chat_settings WHERE id = 1 LIMIT 1`;
  const theme = String(rows[0]?.theme ?? 'garden');
  const wallpaper = String(rows[0]?.wallpaper ?? 'garden');
  const wallpaperUrl = rows[0]?.wallpaper_image_key ? await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: String(rows[0].wallpaper_image_key) }), { expiresIn: 15 * 60 }) : null;
  return <Chat me={{ id: session.id, name: session.display_name }} initialTheme={theme} initialWallpaper={wallpaper} initialWallpaperUrl={wallpaperUrl} />;
}
