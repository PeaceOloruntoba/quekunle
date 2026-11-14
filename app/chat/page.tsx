import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { database } from '@/lib/db';
import Chat from './Chat';
export const dynamic = 'force-dynamic';
export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const sql = database();
  const rows = await sql`SELECT theme FROM chat_settings WHERE id = 1 LIMIT 1`;
  return <Chat me={{ id: session.id, name: session.display_name }} initialTheme={String(rows[0]?.theme ?? 'garden')} />;
}
