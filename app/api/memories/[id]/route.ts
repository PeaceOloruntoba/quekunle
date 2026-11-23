import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { database } from "@/lib/db";
import { schedulePush } from "@/lib/push";
import { publishRealtime } from "@/lib/realtime";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to update this memory." },
      { status: 401 },
    );
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid memory." }, { status: 400 });
  const data = await request.json();
  const story = typeof data.story === "string" ? data.story.trim() : "";
  if (story.length > 1200)
    return NextResponse.json(
      { error: "Keep your note under 1,200 characters." },
      { status: 400 },
    );
  const sql = database();
  const rows =
    await sql`UPDATE memories SET is_public = ${Boolean(data.is_public)} WHERE id = ${id} RETURNING id`;
  if (!rows.length)
    return NextResponse.json(
      { error: "That memory could not be found." },
      { status: 404 },
    );
  if (story)
    await sql`INSERT INTO memory_contributions (memory_id, user_id, body) VALUES (${id}, ${user.id}, ${story}) ON CONFLICT (memory_id, user_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`;
  else
    await sql`DELETE FROM memory_contributions WHERE memory_id = ${id} AND user_id = ${user.id}`;
  const recipientId =
    user.id === "queen-moyosore" ? "peace-adekunle" : "queen-moyosore";
  try {
    await publishRealtime({
      type: "activity",
      category: "memories",
      actor_id: user.id,
      title: "A memory was updated",
      body: "A memory note or gallery setting changed.",
      url: "/memories",
    });
  } catch (error) {
    console.error("[memories] realtime broadcast failed", error);
  }
  await schedulePush(recipientId, "memories", user.id, {
    title: "A memory was updated",
    body: story
      ? story.slice(0, 120)
      : "A memory note or gallery setting changed.",
    url: "/memories",
    tag: `twofold-memory-${id}`,
  });
  return NextResponse.json({ ok: true });
}
