import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bucketName, getStorage } from '@/lib/storage';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to upload memory photos and videos.' }, { status: 401 });
  const data = await request.json();
  const type = String(data.type ?? '');
  const size = Number(data.size);
  if (!extensions[type] || !Number.isFinite(size) || size < 1 || size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Choose JPEG, PNG, WebP, HEIC, MP4, WebM, or MOV files up to 50 MB.' }, { status: 400 });
  const key = `memories/${user.id}/${crypto.randomUUID()}.${extensions[type]}`;
  const uploadUrl = await getSignedUrl(getStorage(), new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: type }), { expiresIn: 5 * 60 });
  return NextResponse.json({ key, uploadUrl, type });
}
