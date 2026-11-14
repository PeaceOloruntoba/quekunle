import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
export async function GET() { return NextResponse.json({ authenticated: Boolean(await getSession()) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
