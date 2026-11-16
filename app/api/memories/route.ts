import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { bucketName, getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
const allowedMedia = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

export async function GET(request: Request) {
  const user = await getSession();
  const publicOnly = new URL(request.url).searchParams.get('scope') === 'public' || !user;
  const sql = database();
  const rows = publicOnly
    ? await sql`SELECT m.id, m.title, m.location, m.happened_on, m.is_public, m.created_by, u.display_name AS creator_name, mc.user_id AS contributor_id, mc.body AS contribution, cu.display_name AS contributor_name, mm.id AS media_id, mm.object_key, mm.file_name, mm.content_type FROM memories m JOIN users u ON u.id = m.created_by LEFT JOIN memory_contributions mc ON mc.memory_id = m.id LEFT JOIN users cu ON cu.id = mc.user_id LEFT JOIN memory_media mm ON mm.memory_id = m.id WHERE m.is_public = true ORDER BY m.happened_on DESC, m.id DESC, mm.id`
    : await sql`SELECT m.id, m.title, m.location, m.happened_on, m.is_public, m.created_by, u.display_name AS creator_name, mc.user_id AS contributor_id, mc.body AS contribution, cu.display_name AS contributor_name, mm.id AS media_id, mm.object_key, mm.file_name, mm.content_type FROM memories m JOIN users u ON u.id = m.created_by LEFT JOIN memory_contributions mc ON mc.memory_id = m.id LEFT JOIN users cu ON cu.id = mc.user_id LEFT JOIN memory_media mm ON mm.memory_id = m.id ORDER BY m.happened_on DESC, m.id DESC, mm.id`;
  const grouped = new Map<number, { id: number; title: string; location: string; happened_on: string; is_public: boolean; created_by: string; creator_name: string; contributions: { user_id: string; name: string; body: string }[]; media: { id: number; key: string; name: string; type: string }[] }>();
  for (const row of rows) {
    const id = Number(row.id);
    let memory = grouped.get(id);
    if (!memory) {
      memory = { id, title: String(row.title), location: String(row.location ?? ''), happened_on: String(row.happened_on).slice(0, 10), is_public: Boolean(row.is_public), created_by: String(row.created_by), creator_name: String(row.creator_name), contributions: [], media: [] };
      grouped.set(id, memory);
    }
    if (row.contributor_id && !memory.contributions.some(item => item.user_id === String(row.contributor_id))) memory.contributions.push({ user_id: String(row.contributor_id), name: String(row.contributor_name), body: String(row.contribution ?? '') });
    if (row.media_id && !memory.media.some(item => item.id === Number(row.media_id))) memory.media.push({ id: Number(row.media_id), key: String(row.object_key), name: String(row.file_name), type: String(row.content_type) });
  }
  const memories = await Promise.all([...grouped.values()].map(async memory => ({ ...memory, media: await Promise.all(memory.media.map(async media => ({ id: media.id, name: media.name, type: media.type, url: await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: media.key }), { expiresIn: 15 * 60 }) }))) })));
  return NextResponse.json({ memories, me: publicOnly ? null : user?.id ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to save a memory.' }, { status: 401 });
  const data = await request.json();
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const location = typeof data.location === 'string' ? data.location.trim() : '';
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  const date = String(data.happened_on ?? '');
  const items = Array.isArray(data.media) ? data.media : [];
  if (!title || title.length > 120 || location.length > 180 || story.length > 1200 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || items.length > 8) return NextResponse.json({ error: 'Check the memory details and attach no more than 8 photos or videos.' }, { status: 400 });
  for (const item of items) if (typeof item.key !== 'string' || !item.key.startsWith(`memories/${user.id}/`) || typeof item.name !== 'string' || !allowedMedia.has(item.type)) return NextResponse.json({ error: 'One of the selected files is not supported.' }, { status: 400 });
  const sql = database();
  const rows = await sql`INSERT INTO memories (title, location, happened_on, is_public, created_by) VALUES (${title}, ${location}, ${date}, ${Boolean(data.is_public)}, ${user.id}) RETURNING id`;
  const id = Number(rows[0].id);
  if (story) await sql`INSERT INTO memory_contributions (memory_id, user_id, body) VALUES (${id}, ${user.id}, ${story})`;
  for (const item of items) await sql`INSERT INTO memory_media (memory_id, object_key, file_name, content_type) VALUES (${id}, ${item.key}, ${item.name.slice(0, 255)}, ${item.type})`;
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
