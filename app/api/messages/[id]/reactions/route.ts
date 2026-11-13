import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { publishRealtime } from '@/lib/realtime';
export const runtime = 'nodejs';
const allowed = new Set(['❤️', '🥰', '😂', '😊', '😍', '💕', '✨', '🌿', '🤗', '🥹', '💙', '👍']);
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });
  const { emoji } = await request.json();
  if (typeof emoji !== 'string' || !allowed.has(emoji)) return NextResponse.json({ error: 'That reaction is not supported.' }, { status: 400 });
  const sql = database();
  const exists = await sql`SELECT id FROM messages WHERE id = ${id} LIMIT 1`;
  if (!exists.length) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  const removed = await sql`DELETE FROM reactions WHERE message_id = ${id} AND user_id = ${me.id} AND emoji = ${emoji} RETURNING message_id`;
  const active = removed.length === 0;
  if (active) await sql`INSERT INTO reactions (message_id, user_id, emoji) VALUES (${id}, ${me.id}, ${emoji}) ON CONFLICT DO NOTHING`;
  try { await publishRealtime({ type: 'reaction', message_id: id, user_id: me.id, emoji, active }); }
  catch (error) { console.error('[chat] reaction saved but realtime publish failed', error); }
  return NextResponse.json({ ok: true, active, message_id: id, user_id: me.id, emoji });
}
