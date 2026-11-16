import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to update this memory.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid memory.' }, { status: 400 });
  const data = await request.json();
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  if (story.length > 1200) return NextResponse.json({ error: 'Keep your note under 1,200 characters.' }, { status: 400 });
  const sql = database();
  const rows = await sql`UPDATE memories SET is_public = ${Boolean(data.is_public)} WHERE id = ${id} RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: 'That memory could not be found.' }, { status: 404 });
  if (story) await sql`INSERT INTO memory_contributions (memory_id, user_id, body) VALUES (${id}, ${user.id}, ${story}) ON CONFLICT (memory_id, user_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`;
  else await sql`DELETE FROM memory_contributions WHERE memory_id = ${id} AND user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
