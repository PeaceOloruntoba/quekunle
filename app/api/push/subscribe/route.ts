import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { pushCategories } from '@/lib/push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const defaults = Object.fromEntries(pushCategories.map(category => [category, true]));
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = database();
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  const rows = endpoint === null
    ? await sql`SELECT preferences FROM push_subscriptions WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1`
    : endpoint ? await sql`SELECT preferences FROM push_subscriptions WHERE user_id = ${user.id} AND endpoint = ${endpoint} LIMIT 1` : [];
  const preferences = { ...defaults, ...(rows[0]?.preferences ?? {}) };
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null, enabled: rows.length > 0, preferences });
}
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: 'Web push keys are not configured on the server yet.' }, { status: 503 });
  const body = await request.json();
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return NextResponse.json({ error: 'Invalid browser push subscription.' }, { status: 400 });
  const host = new URL(sub.endpoint).hostname.toLowerCase();
  const knownPushService = host === 'fcm.googleapis.com' || host.endsWith('.push.services.mozilla.com') || host === 'updates.push.services.mozilla.com' || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com');
  if (!knownPushService) return NextResponse.json({ error: 'Unsupported push service endpoint.' }, { status: 400 });
  const preferences = Object.fromEntries(pushCategories.map(category => [category, typeof body.preferences?.[category] === 'boolean' ? body.preferences[category] : true]));
  const sql = database();
  await sql`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, preferences, updated_at) VALUES (${user.id}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${JSON.stringify(preferences)}::jsonb, now()) ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, preferences = EXCLUDED.preferences, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
export async function PUT(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const preferences = Object.fromEntries(pushCategories.map(category => [category, typeof body.preferences?.[category] === 'boolean' ? body.preferences[category] : true]));
  const sql = database();
  await sql`UPDATE push_subscriptions SET preferences = ${JSON.stringify(preferences)}::jsonb, updated_at = now() WHERE user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
export async function DELETE(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const sql = database();
  if (typeof body.endpoint === 'string') await sql`DELETE FROM push_subscriptions WHERE user_id = ${user.id} AND endpoint = ${body.endpoint}`;
  else await sql`DELETE FROM push_subscriptions WHERE user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
