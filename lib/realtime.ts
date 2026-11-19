import Redis from 'ioredis';

type RealtimeEvent =
  | { type: 'message'; message: Record<string, unknown> }
  | { type: 'read'; ids: number[]; read_at: string }
  | { type: 'reaction'; message_id: number; user_id: string; emoji: string; active: boolean }
  | { type: 'profile'; user_id: string; display_name: string; avatar_url: string | null }
  | { type: 'activity'; category: 'timeline' | 'memories'; actor_id: string; title: string; body: string; url: string }
  | { type: 'wallpaper'; wallpaper: string; wallpaper_image_url?: string | null; theme?: string };
type Socket = { send: (data: string) => void; readyState: number };
type State = { sockets: Set<Socket>; publisher?: Redis; subscriber?: Redis; starting?: Promise<void> };
const shared = globalThis as typeof globalThis & { __quekunleRealtime?: State };
const state = shared.__quekunleRealtime ??= { sockets: new Set() };
const CHANNEL = 'quekunle:chat:v1';

async function ensureRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return;
  if (state.starting) return state.starting;
  state.starting = (async () => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'rediss:' && !parsedUrl.port) parsedUrl.port = '6379';
    const redisOptions = {
      maxRetriesPerRequest: 2,
      retryStrategy: (n: number) => Math.min(n * 250, 3000),
      ...(parsedUrl.protocol === 'rediss:' ? { tls: { servername: parsedUrl.hostname } } : {}),
    };
    state.publisher ??= new Redis(parsedUrl.toString(), redisOptions);
    state.subscriber ??= state.publisher.duplicate();
    if (state.subscriber.status !== 'ready' && state.subscriber.status !== 'connect') await state.subscriber.connect().catch(() => undefined);
    await state.subscriber.subscribe(CHANNEL);
    state.subscriber.removeAllListeners('message');
    state.subscriber.on('message', (channel, payload) => {
      if (channel === CHANNEL) broadcast(payload);
    });
  })().finally(() => { state.starting = undefined; });
  return state.starting;
}
function broadcast(payload: string) {
  for (const socket of state.sockets) {
    if (socket.readyState === 1) { try { socket.send(payload); } catch { state.sockets.delete(socket); } }
    else state.sockets.delete(socket);
  }
}
export function addSocket(socket: Socket) { state.sockets.add(socket); void ensureRedis().catch(err => console.error('[chat] realtime subscriber failed', err)); }
export function removeSocket(socket: Socket) { state.sockets.delete(socket); }
export async function publishRealtime(event: RealtimeEvent) {
  const payload = JSON.stringify(event);
  if (!process.env.REDIS_URL) { broadcast(payload); return; }
  await ensureRedis();
  if (!state.publisher) throw new Error('REDIS_URL is required for realtime delivery.');
  await state.publisher.publish(CHANNEL, payload);
}
