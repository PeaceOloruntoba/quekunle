import { NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Cookie' };
export async function GET() {
  const session = await getSession();
  if (session) await createSession(session);
  return NextResponse.json({ authenticated: Boolean(session) }, { headers });
}
export async function POST() {
  const session = await getSession();
  if (session) await createSession(session);
  return NextResponse.json({ authenticated: Boolean(session) }, { headers });
}
