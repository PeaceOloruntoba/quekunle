import { NextResponse } from 'next/server';
import { database } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dateOnly, isDateOnly } from '@/lib/date-only';
import { schedulePush } from '@/lib/push';
import { publishRealtime } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = database();
  const rows = await sql`SELECT id, happened_on, title, story FROM timeline_events ORDER BY happened_on, id`;
  const events = rows.map(row => ({ ...row, happened_on: dateOnly(row.happened_on) }));
  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to add a story moment.' }, { status: 401 });
  const data = await request.json();
  const date = String(data.happened_on ?? '');
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  if (!isDateOnly(date) || !title || title.length > 120 || story.length > 800) return NextResponse.json({ error: 'Add a valid date, a title (up to 120 characters), and a short note (up to 800 characters).' }, { status: 400 });
  const sql = database();
  const rows = await sql`INSERT INTO timeline_events (happened_on, title, story, created_by) VALUES (${date}, ${title}, ${story}, ${user.id}) RETURNING id, happened_on, title, story`;
  const event = { ...rows[0], happened_on: dateOnly(rows[0].happened_on) };
  try { await publishRealtime({ type: 'activity', category: 'timeline', actor_id: user.id, title: 'A timeline moment was added', body: title, url: '/#our-timeline' }); } catch (error) { console.error('[timeline] realtime broadcast failed', error); }
  const recipientId = user.id === 'queen-moyosore' ? 'peace-adekunle' : 'queen-moyosore';
  await schedulePush(recipientId, 'timeline', user.id, { title: 'A timeline moment was added', body: title, url: '/#our-timeline', tag: `quekunle-timeline-${Number(rows[0].id)}` });
  return NextResponse.json({ event }, { status: 201 });
}
