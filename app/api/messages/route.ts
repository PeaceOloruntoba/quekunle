import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const rows = await sql`SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.attachment_url, m.attachment_name, m.attachment_type, m.created_at, m.read_at FROM messages m JOIN users u ON u.id = m.sender_id ORDER BY m.created_at DESC LIMIT 100`;
  await sql`UPDATE messages SET read_at = now() WHERE sender_id <> ${me.id} AND read_at IS NULL`;
  return NextResponse.json({ messages: rows.reverse(), me: me.id });
}
export async function POST(request: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  const body = typeof data.body === 'string' ? data.body.trim().slice(0, 5000) : '';
  const attachment = data.attachment;
  if (!body && !attachment) return NextResponse.json({ error: 'Write a message or attach a file.' }, { status: 400 });
  if (attachment && (typeof attachment.url !== 'string' || typeof attachment.name !== 'string' || typeof attachment.type !== 'string')) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 });
  const sql = database();
  await sql`INSERT INTO messages (sender_id, body, attachment_url, attachment_name, attachment_type) VALUES (${me.id}, ${body}, ${attachment?.url ?? null}, ${attachment?.name ?? null}, ${attachment?.type ?? null})`;
  return NextResponse.json({ ok: true }, { status: 201 });
}
