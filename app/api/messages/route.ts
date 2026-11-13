import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { bucketName, getStorage } from '@/lib/storage';
import { publishRealtime } from '@/lib/realtime';
export const dynamic = 'force-dynamic';
function withUrl<T extends { attachment_key?: string | null }>(row: T) {
  const { attachment_key, ...rest } = row;
  const attachment_url = attachment_key ? `/api/media/${attachment_key.split('/').map(encodeURIComponent).join('/')}` : null;
  return { ...rest, id: Number((rest as { id?: unknown }).id), attachment_url };
}
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const rows = await sql`SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.attachment_key, m.attachment_name, m.attachment_type, m.created_at, m.read_at FROM messages m JOIN users u ON u.id = m.sender_id ORDER BY m.created_at DESC LIMIT 100`;
  const marked = await sql`UPDATE messages SET read_at = now() WHERE sender_id <> ${me.id} AND read_at IS NULL RETURNING id, read_at`;
  if (marked.length) {
    try { await publishRealtime({ type: 'read', ids: marked.map(row => Number(row.id)), read_at: String(marked[0].read_at) }); }
    catch (error) { console.error('[chat] receipt broadcast failed', error); }
  }
  const messages = rows.reverse().map(row => withUrl(row));
  return NextResponse.json({ messages, me: me.id });
}
export async function POST(request: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const body = typeof data.body === 'string' ? data.body.trim().slice(0, 5000) : '';
  const attachment = data.attachment;
  if (!body && !attachment) return NextResponse.json({ error: 'Write a message or attach a file.' }, { status: 400 });
  if (attachment && (typeof attachment.key !== 'string' || !attachment.key.startsWith('chat/') || typeof attachment.name !== 'string' || typeof attachment.type !== 'string' || attachment.name.length > 180 || attachment.type.length > 100)) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 });
  const sql = database();
  const rows = await sql`INSERT INTO messages (sender_id, body, attachment_key, attachment_name, attachment_type) VALUES (${me.id}, ${body}, ${attachment?.key ?? null}, ${attachment?.name ?? null}, ${attachment?.type ?? null}) RETURNING id, sender_id, ${me.display_name}::text AS sender_name, body, attachment_key, attachment_name, attachment_type, created_at, read_at`;
  const message = withUrl(rows[0]);
  try { await publishRealtime({ type: 'message', message }); }
  catch (error) { console.error('[chat] message saved but realtime publish failed', error); }
  return NextResponse.json({ ok: true, message }, { status: 201 });
}



