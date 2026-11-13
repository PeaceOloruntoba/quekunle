import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getStorage, bucketName } from '@/lib/storage';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';
const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(webm|mpeg|mp4|ogg)|application\/(pdf|msword|vnd.openxmlformats-officedocument\..+)|text\/(plain|csv))$/;
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await request.json();
  if (typeof data.name !== 'string' || data.name.length > 180 || typeof data.type !== 'string' || typeof data.size !== 'number' || data.size <= 0 || data.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Choose a file under 50 MB.' }, { status: 400 });
  if (!allowed.test(data.type)) return NextResponse.json({ error: 'That file type is not supported.' }, { status: 415 });
  const name = data.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `chat/${crypto.randomUUID()}-${name}`;
  const uploadUrl = await getSignedUrl(getStorage(), new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: data.type }), { expiresIn: 60 });
  return NextResponse.json({ key, name: data.name, type: data.type, uploadUrl }, { status: 201 });
}
