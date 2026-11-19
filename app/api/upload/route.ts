import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getStorage, bucketName } from '@/lib/storage';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';
const allowed = /^(image\/(jpeg|png|gif|webp|heic|heif|avif)|video\/(mp4|webm|quicktime)|audio\/(webm|mpeg|mp4|ogg|aac|wav|x-m4a|3gpp|3gpp2)|application\/(pdf|msword|vnd.openxmlformats-officedocument\..+)|text\/(plain|csv))$/;
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  if (typeof data.name !== 'string' || data.name.length > 180 || typeof data.type !== 'string' || typeof data.size !== 'number' || data.size <= 0 || data.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Choose a file under 50 MB.' }, { status: 400 });
  const contentType = data.type.split(';', 1)[0].trim().toLowerCase();
  if (!allowed.test(contentType)) return NextResponse.json({ error: 'That file type is not supported.' }, { status: 415 });
  const name = data.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `chat/${crypto.randomUUID()}-${name}`;
  const uploadUrl = await getSignedUrl(getStorage(), new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }), { expiresIn: 60 });
  return NextResponse.json({ key, name: data.name, type: contentType, uploadUrl }, { status: 201 });
}
