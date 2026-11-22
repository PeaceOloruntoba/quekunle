import { experimental_upgradeWebSocket } from "@vercel/functions";
import { getSession } from "@/lib/auth";
import { addSocket, removeSocket } from "@/lib/realtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return experimental_upgradeWebSocket((socket) => {
    addSocket(socket);
    socket.send(JSON.stringify({ type: "ready" }));
    const cleanup = () => removeSocket(socket);
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
}
