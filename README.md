# Quekunle

A small, private two-person chat for Queen Moyosore and Peace Adekunle, built with Next.js, Neon Postgres, Neon Object Storage, and WebSockets.

## Configure

Copy `.env.example` to `.env.local`, then set:

- `DATABASE_URL` and preferably `DATABASE_URL_POOLED` from Neon.
- `SESSION_SECRET` to a random string of at least 32 characters.
- `QUEEN_PASSWORD` and `PEACE_PASSWORD` to the two account passwords.
- `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET` from Neon Object Storage.
- `REDIS_URL` from a Redis provider such as the Vercel Marketplace Upstash integration. Redis provides cross-instance WebSocket fan-out; Postgres remains the durable source of truth.

Create the private `quekunle` bucket in Neon Object Storage if it does not already exist. The app uploads through the S3 API and serves media through 15-minute signed URLs after checking the session.

Run the SQL in [`db/schema.sql`](db/schema.sql) in the Neon SQL Editor. Then run `npm install`, `npm run db:seed`, and `npm run dev`. Deploy the repository to Vercel and set the same variables in the project settings. Set `NEXT_PUBLIC_SITE_URL` to the production origin.

The seeded usernames are `Quenzsome` (Queen Moyosore) and `Adekunle` (Peace Adekunle). Passwords are read only from environment variables and stored as bcrypt hashes. Realtime uses Vercel's WebSocket Function support and Redis pub/sub to deliver messages between function instances. Clients reconnect with backoff and reload the latest message history from Postgres. Without `REDIS_URL`, same-instance development delivery works, but cross-instance delivery is unavailable.

Uploads support images, videos, audio/voice notes, PDF, Word and text/CSV documents up to 50 MB. Voice recording needs browser microphone permission. Voice and video calling are not included yet.
