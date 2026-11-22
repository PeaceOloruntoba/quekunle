import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dateOnly, isDateOnly } from "@/lib/date-only";
import { schedulePush } from "@/lib/push";
import { publishRealtime } from "@/lib/realtime";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to edit the story." },
      { status: 401 },
    );
  const id = Number((await params).id);
  const data = await request.json();
  const date = String(data.happened_on ?? "");
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const story = typeof data.story === "string" ? data.story.trim() : "";
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !isDateOnly(date) ||
    !title ||
    title.length > 120 ||
    story.length > 800
  )
    return NextResponse.json(
      { error: "Check the date, title, and short note." },
      { status: 400 },
    );
  const sql = database();
  const rows =
    await sql`UPDATE timeline_events SET happened_on = ${date}, title = ${title}, story = ${story} WHERE id = ${id} RETURNING id, happened_on, title, story`;
  if (rows.length) {
    const recipientId =
      user.id === "queen-moyosore" ? "peace-adekunle" : "queen-moyosore";
    try {
      await publishRealtime({
        type: "activity",
        category: "timeline",
        actor_id: user.id,
        title: "A timeline moment was updated",
        body: title,
        url: "/#our-timeline",
      });
    } catch (error) {
      console.error("[timeline] realtime broadcast failed", error);
    }
    await schedulePush(recipientId, "timeline", user.id, {
      title: "A timeline moment was updated",
      body: title,
      url: "/#our-timeline",
      tag: `quekunle-timeline-${id}`,
    });
  }
  return rows.length
    ? NextResponse.json({
        event: { ...rows[0], happened_on: dateOnly(rows[0].happened_on) },
      })
    : NextResponse.json(
        { error: "That story moment no longer exists." },
        { status: 404 },
      );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to remove a story moment." },
      { status: 401 },
    );
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json(
      { error: "Invalid story moment." },
      { status: 400 },
    );
  const sql = database();
  const rows =
    await sql`DELETE FROM timeline_events WHERE id = ${id} RETURNING title`;
  if (rows.length) {
    const recipientId =
      user.id === "queen-moyosore" ? "peace-adekunle" : "queen-moyosore";
    try {
      await publishRealtime({
        type: "activity",
        category: "timeline",
        actor_id: user.id,
        title: "A timeline moment was removed",
        body: String(rows[0].title),
        url: "/#our-timeline",
      });
    } catch (error) {
      console.error("[timeline] realtime broadcast failed", error);
    }
    await schedulePush(recipientId, "timeline", user.id, {
      title: "A timeline moment was removed",
      body: String(rows[0].title),
      url: "/#our-timeline",
      tag: `quekunle-timeline-${id}`,
    });
  }
  return NextResponse.json({ ok: true });
}
