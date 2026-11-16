import { NextResponse } from 'next/server';
import { database } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const sql = database();
  const events = await sql`SELECT id, happened_on, title, story FROM timeline_events ORDER BY happened_on, id`;
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to add a story moment.' }, { status: 401 });
  const data = await request.json();
  const date = String(data.happened_on ?? '');
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  if (!datePattern.test(date) || !title || title.length > 120 || story.length > 800) return NextResponse.json({ error: 'Add a valid date, a title (up to 120 characters), and a short note (up to 800 characters).' }, { status: 400 });
  const sql = database();
  const rows = await sql`INSERT INTO timeline_events (happened_on, title, story, created_by) VALUES (${date}, ${title}, ${story}, ${user.id}) RETURNING id, happened_on, title, story`;
  return NextResponse.json({ event: rows[0] }, { status: 201 });
}
