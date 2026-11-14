import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bucketName, getStorage } from '@/lib/storage';
export const runtime = 'nodejs';
const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, size } = await request.json();
  if (typeof type !== 'string' || !types[type] || typeof size !== 'number' || size <= 0 || size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Choose a JPEG, PNG, WebP, or GIF under 8 MB.' }, { status: 400 });
  const key = `profiles/${user.id}/${crypto.randomUUID()}.${types[type]}`;
  const uploadUrl = await getSignedUrl(getStorage(), new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: type }), { expiresIn: 60 });
  return NextResponse.json({ key, uploadUrl, type }, { status: 201 });
}
