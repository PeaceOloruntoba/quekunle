import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { loadEnvConfig } from '@next/env';
import { database } from '../lib/db';
import { bucketName, getStorage } from '../lib/storage';

loadEnvConfig(process.cwd());
const CONFIRM_FLAG = '--confirm-clear-quekunle';
const confirmed = process.argv.includes(CONFIRM_FLAG);

async function listAllObjectKeys() {
  const client = getStorage();
  const bucket = bucketName();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function clearBucket(keys: string[]) {
  const client = getStorage();
  const bucket = bucketName();
  for (let offset = 0; offset < keys.length; offset += 1000) {
    const batch = keys.slice(offset, offset + 1000);
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true },
    }));
    if (result.Errors?.length) {
      const errors = result.Errors.map(error => `${error.Key ?? '(unknown key)'}: ${error.Message ?? error.Code ?? 'delete failed'}`).join('; ');
      throw new Error(`Neon Object Storage could not delete every object: ${errors}`);
    }
  }
}

async function main() {
  const sql = database();
  const endpoint = new URL(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL!).hostname;
  const [users, messages, reactions, objects] = await Promise.all([
    sql`SELECT count(*)::int AS count FROM users`,
    sql`SELECT count(*)::int AS count FROM messages`,
    sql`SELECT count(*)::int AS count FROM reactions`,
    listAllObjectKeys(),
  ]);

  console.log(`Target database: ${endpoint}`);
  console.log(`Target bucket: ${bucketName()}`);
  console.log(`Will preserve users: ${users[0].count}`);
  console.log(`Messages: ${messages[0].count}; reactions: ${reactions[0].count}; bucket objects: ${objects.length}`);
  console.log('Other tables in the current schema, if any, will also be emptied.');

  if (!confirmed) {
    console.log(`Dry run only. To clear this database and bucket, run: npm run db:clear -- ${CONFIRM_FLAG}`);
    return;
  }

  if (objects.length) await clearBucket(objects);
  await sql`DO $$ DECLARE table_list text; BEGIN SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO table_list FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'users'; IF table_list IS NOT NULL THEN EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE'; END IF; END $$`;
  console.log(`Cleared ${objects.length} bucket objects and all table data except users.`);
}

main().catch(error => {
  console.error('Clear operation stopped. Some earlier deletions may already have completed.');
  console.error(error);
  process.exit(1);
});
