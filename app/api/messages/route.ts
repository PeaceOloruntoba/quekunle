import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { bucketName, getStorage } from '@/lib/storage';
import { publishRealtime } from '@/lib/realtime';
export const dynamic = 'force-dynamic';
function withUrl<T extends { id: unknown; attachment_key?: string | null; reply_to_id?: unknown }>(row: T) {
  const { attachment_key, ...rest } = row;
  const attachment_url = attachment_key ? `/api/media/${attachment_key.split('/').map(encodeURIComponent).join('/')}` : null;
  return { ...rest, id: Number(rest.id), reply_to_id: rest.reply_to_id == null ? null : Number(rest.reply_to_id), attachment_url };
}
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const rows = await sql`SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.attachment_key, m.attachment_name, m.attachment_type, m.reply_to_id, rm.body AS reply_body, ru.display_name AS reply_sender_name, COALESCE((SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) AS reactions, m.created_at, m.read_at FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN messages rm ON rm.id = m.reply_to_id LEFT JOIN users ru ON ru.id = rm.sender_id ORDER BY m.created_at DESC LIMIT 100`;
  const marked = await sql`UPDATE messages SET read_at = now() WHERE sender_id <> ${me.id} AND read_at IS NULL RETURNING id, read_at`;
  if (marked.length) {
    try { await publishRealtime({ type: 'read', ids: marked.map(row => Number(row.id)), read_at: String(marked[0].read_at) }); }
    catch (error) { console.error('[chat] receipt broadcast failed', error); }
  }
  return NextResponse.json({ messages: rows.reverse().map(row => withUrl(row)), me: me.id });
}
export async function POST(request: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const body = typeof data.body === 'string' ? data.body.trim().slice(0, 5000) : '';
  const attachment = data.attachment;
  if (!body && !attachment) return NextResponse.json({ error: 'Write a message or attach a file.' }, { status: 400 });
  if (attachment && (typeof attachment.key !== 'string' || !attachment.key.startsWith('chat/') || typeof attachment.name !== 'string' || typeof attachment.type !== 'string' || attachment.name.length > 180 || attachment.type.length > 100)) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 });
  const replyToId = data.reply_to_id == null ? null : Number(data.reply_to_id);
  if (replyToId !== null && (!Number.isSafeInteger(replyToId) || replyToId < 1)) return NextResponse.json({ error: 'That reply is no longer available.' }, { status: 400 });
  const sql = database();
  let reply: { body: string; sender_name: string } | undefined;
  if (replyToId !== null) {
    const replied = await sql`SELECT m.body, u.display_name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ${replyToId} LIMIT 1`;
    reply = replied[0] as typeof reply;
    if (!reply) return NextResponse.json({ error: 'That reply is no longer available.' }, { status: 404 });
  }
  const rows = await sql`INSERT INTO messages (sender_id, body, attachment_key, attachment_name, attachment_type, reply_to_id) VALUES (${me.id}, ${body}, ${attachment?.key ?? null}, ${attachment?.name ?? null}, ${attachment?.type ?? null}, ${replyToId}) RETURNING id, sender_id, ${me.display_name}::text AS sender_name, body, attachment_key, attachment_name, attachment_type, reply_to_id, created_at, read_at`;
  const message = { ...withUrl(rows[0]), reply_body: reply?.body ?? null, reply_sender_name: reply?.sender_name ?? null, reactions: [] };
  try { await publishRealtime({ type: 'message', message }); }
  catch (error) { console.error('[chat] message saved but realtime publish failed', error); }
  return NextResponse.json({ ok: true, message }, { status: 201 });
}
