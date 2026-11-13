import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { getStorage, bucketName } from '@/lib/storage';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Choose a file under 50 MB.' }, { status: 400 });
  const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(webm|mpeg|mp4|ogg)|application\/(pdf|msword|vnd.openxmlformats-officedocument\..+)|text\/(plain|csv))$/;
  if (!allowed.test(file.type)) return NextResponse.json({ error: 'That file type is not supported.' }, { status: 415 });
  const key = `chat/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await getStorage().send(new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: new Uint8Array(await file.arrayBuffer()), ContentType: file.type }));
  return NextResponse.json({ key, name: file.name, type: file.type }, { status: 201 });
}
