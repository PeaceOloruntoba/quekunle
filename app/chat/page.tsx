import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Chat from './Chat';
export const dynamic = 'force-dynamic';
export default async function ChatPage() { const session = await getSession(); if (!session) redirect('/login'); return <Chat me={{ id: session.id, name: session.display_name }} />; }
