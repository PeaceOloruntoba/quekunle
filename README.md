# TwoFold

A small, private two-person chat for Queen Moyosore and Peace Adekunle, built with Next.js, Neon Postgres, Neon Object Storage, and WebSockets.

## Configure

Copy `.env.example` to `.env.local`, then set:

- `DATABASE_URL` and preferably `DATABASE_URL_POOLED` from Neon.
- `SESSION_SECRET` to a random string of at least 32 characters.
- `QUEEN_PASSWORD` and `PEACE_PASSWORD` to the two account passwords.
- `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET` from Neon Object Storage.
- `REDIS_URL` from a Redis provider such as Layerbase or the Vercel Marketplace Upstash integration. Redis provides cross-instance WebSocket fan-out; Postgres remains the durable source of truth. For Layerbase, use the TLS connection string and include port 6379; the app sets the required TLS SNI hostname automatically.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` for Web Push. Generate a key pair with `npm run push:keys`, then set the output in local and Vercel environment variables. Keep the private key secret and stable after users subscribe.

The current Neon Object Storage bucket is named `quekunle`; keep `S3_BUCKET` pointed at that bucket to retain existing uploads. To rename the storage bucket too, create a `twofold` bucket, copy the objects, then update `S3_BUCKET`. Uploads go directly from the browser to Neon using short-lived, single-object signed URLs, so large media does not pass through Vercel Functions. The app serves downloads through an authenticated endpoint that issues short-lived read URLs.

The seed script loads `.env.local` and creates or updates the idempotent schema before inserting users, so `QUEEN_PASSWORD` and `PEACE_PASSWORD` are read there when you run `npm run db:seed`. You can also apply [`db/schema.sql`](db/schema.sql) manually in the Neon SQL Editor; it is safe to rerun after schema updates. Then run `npm install`, `npm run db:seed`, and `npm run dev`. Deploy the repository to Vercel and set the same variables in the project settings. Set `NEXT_PUBLIC_SITE_URL` to the production origin.

The seeded usernames are `Quenzsome` (Queen Moyosore) and `Adekunle` (Peace Adekunle). Passwords are read only from environment variables and stored as bcrypt hashes. Realtime uses Vercel's WebSocket Function support and Redis pub/sub to deliver messages between function instances. Clients reconnect with backoff and reload the latest message history from Postgres. WebSockets on Vercel Functions are currently in public beta; Redis is required for delivery across function instances. Local WebSocket testing should use `vercel dev`, since the upgrade route relies on Vercel's WebSocket adapter.

Web push is configured from Settings on each device. Run `npm run db:seed` after pulling to create the push subscription table. Generate one VAPID key pair with `npm run push:keys`, set that same pair in `.env.local` and the Vercel project, and keep it stable; changing it requires users to subscribe again. Then open Settings on each device, allow notifications, and enable push. Notification categories can be enabled individually, including new messages, timeline and memory changes, profile and wallpaper updates, and read receipts. Add TwoFold to the home screen for an app-like experience; iPhone and iPad require the installed home screen app for web push. Push notifications require HTTPS and the VAPID environment variables above.

Messages can quote a specific message and each message supports persistent emoji reactions. Uploads support images, videos, audio/voice notes, PDF, Word and text/CSV documents up to 50 MB. Voice recording needs browser microphone permission. Voice and video calling are not included yet.

## Clear chat data

`npm run db:clear` previews the current user, message, reaction, and object counts without deleting anything. To empty every table in the current schema except `users` and delete every object in the configured bucket, run `npm run db:clear -- --confirm-clear-twofold`. This action cannot be undone.
Persistent sessions last 90 days in a secure, HTTP-only cookie. The landing page stays public after sign-in, with a direct chat link for logged-in users. Settings lets either person update their profile photo and display name, shared chat colors and wallpaper, and edit the public-facing relationship timeline. The `/memories` page requires sign-in and lets either person save a place/date, add their own note, attach up to eight photos or videos, and choose whether to share a memory. The public `/gallery` page only displays memories marked public. Media is stored in Neon Object Storage behind short-lived signed URLs. Run `npm run db:seed` after pulling schema changes to add the timeline and memory tables; this migration preserves existing users and messages.
