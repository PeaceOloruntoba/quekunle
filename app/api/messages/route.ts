import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { bucketName, getStorage } from '@/lib/storage';
import { publishRealtime } from '@/lib/realtime';
import { schedulePush } from '@/lib/push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function withUrl(row: Record<string, unknown>) {
  const { id, attachment_key, reply_to_id, ...rest } = row;
  const path = typeof attachment_key === 'string' ? `/api/media/${attachment_key.split('/').map(encodeURIComponent).join('/')}` : null;
  const attachment_url = path ? `${path}${typeof rest.attachment_name === 'string' ? `?filename=${encodeURIComponent(rest.attachment_name)}` : ''}` : null;
  return { ...rest, id: Number(id), reply_to_id: reply_to_id == null ? null : Number(reply_to_id), attachment_url };
}
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const rows = await sql`SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.attachment_key, m.attachment_name, m.attachment_type, m.reply_to_id, rm.body AS reply_body, ru.display_name AS reply_sender_name, COALESCE((SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id)) FROM reactions r WHERE r.message_id = m.id), '[]'::json) AS reactions, m.created_at, m.read_at FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN messages rm ON rm.id = m.reply_to_id LEFT JOIN users ru ON ru.id = rm.sender_id ORDER BY m.created_at DESC LIMIT 100`;
  const marked = await sql`UPDATE messages SET read_at = now() WHERE sender_id <> ${me.id} AND read_at IS NULL RETURNING id, sender_id, read_at`;
  if (marked.length) {
    try { await publishRealtime({ type: 'read', ids: marked.map(row => Number(row.id)), read_at: String(marked[0].read_at) }); }
    catch (error) { console.error('[chat] receipt broadcast failed', error); }
    const senders = new Set(marked.map(row => String(row.sender_id)));
    await Promise.all([...senders].map(senderId => schedulePush(senderId, 'receipts', me.id, { title: 'Message read', body: 'Your message has been read.', url: '/chat', tag: 'quekunle-read-receipt' })));
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
  const senderRows = await sql`SELECT display_name FROM users WHERE id = ${me.id} LIMIT 1`;
  const senderName = String(senderRows[0]?.display_name ?? me.display_name);
  let reply: { body: string; sender_name: string } | undefined;
  if (replyToId !== null) {
    const replied = await sql`SELECT m.body, u.display_name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ${replyToId} LIMIT 1`;
    reply = replied[0] as typeof reply;
    if (!reply) return NextResponse.json({ error: 'That reply is no longer available.' }, { status: 404 });
  }
  const rows = await sql`INSERT INTO messages (sender_id, body, attachment_key, attachment_name, attachment_type, reply_to_id) VALUES (${me.id}, ${body}, ${attachment?.key ?? null}, ${attachment?.name ?? null}, ${attachment?.type ?? null}, ${replyToId}) RETURNING id, sender_id, ${senderName}::text AS sender_name, body, attachment_key, attachment_name, attachment_type, reply_to_id, created_at, read_at`;
  const message = { ...withUrl(rows[0]), reply_body: reply?.body ?? null, reply_sender_name: reply?.sender_name ?? null, reactions: [] };
  try { await publishRealtime({ type: 'message', message }); }
  catch (error) { console.error('[chat] message saved but realtime publish failed', error); }
  const recipientId = me.id === 'queen-moyosore' ? 'peace-adekunle' : 'queen-moyosore';
  const preview = body || (attachment?.type?.startsWith('image/') ? 'Sent a photo' : attachment?.type?.startsWith('video/') ? 'Sent a video' : attachment?.type?.startsWith('audio/') ? 'Sent a voice note' : 'Sent a document');
  await schedulePush(recipientId, 'messages', me.id, { title: senderName, body: preview.slice(0, 120), url: '/chat', tag: `quekunle-message-${Number(rows[0].id)}` });
  return NextResponse.json({ ok: true, message }, { status: 201 });
}
