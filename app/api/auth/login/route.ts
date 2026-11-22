import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { database } from "@/lib/db";
import { createSession } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 60 ||
    password.length > 200
  )
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  const sql = database();
  const rows =
    await sql`SELECT id, username, display_name, password_hash FROM users WHERE lower(username) = lower(${username.trim()}) LIMIT 1`;
  const user = rows[0] as
    | {
        id: string;
        username: string;
        display_name: string;
        password_hash: string;
      }
    | undefined;
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return NextResponse.json(
      { error: "That username and password don’t match." },
      { status: 401 },
    );
  await createSession(user);
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        Vary: "Cookie",
      },
    },
  );
}
