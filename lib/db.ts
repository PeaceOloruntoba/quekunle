import { neon } from '@neondatabase/serverless';

export function database() {
  const url = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_POOLED or DATABASE_URL must be configured.');
  return neon(url);
}
