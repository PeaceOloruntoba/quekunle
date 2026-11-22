import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { bucketName, getStorage } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sql = database();
  const rows =
    await sql`SELECT profile_image_key, display_name FROM users WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return new Response(null, { status: 404 });
  const key = rows[0].profile_image_key;
  if (!key) {
    const letter = String(rows[0].display_name).slice(0, 1).toUpperCase();
    const color =
      id === "queen-moyosore" ? ["#e4f1e5", "#367c4c"] : ["#e5edf5", "#466b91"];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${color[0]}"/><text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="42" fill="${color[1]}">${letter}</text></svg>`;
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  }
  const url = await getSignedUrl(
    getStorage(),
    new GetObjectCommand({ Bucket: bucketName(), Key: String(key) }),
    { expiresIn: 15 * 60 },
  );
  return NextResponse.redirect(url, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
