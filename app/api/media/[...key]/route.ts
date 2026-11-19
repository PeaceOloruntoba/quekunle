import { NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSession } from '@/lib/auth';
import { bucketName, getStorage } from '@/lib/storage';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { key } = await params;
  const objectKey = key.join('/');
  if (!objectKey.startsWith('chat/')) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const download = new URL(request.url).searchParams.get('download') === '1';
  const filename = (new URL(request.url).searchParams.get('filename') || objectKey.split('/').pop() || 'quekunle-attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
  const url = await getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: bucketName(), Key: objectKey, ...(download ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}) }), { expiresIn: 15 * 60 });
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } });
}
