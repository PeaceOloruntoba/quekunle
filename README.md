# Quekunle

A small, private two-person chat for Queen Moyosore and Peace Adekunle, built with Next.js, Neon Postgres, and Vercel Blob.

## Setup

1. Create a Neon database and run [`db/schema.sql`](db/schema.sql) in its SQL editor.
2. Copy `.env.example` to `.env.local`. Set `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, and passwords for `QUEEN_PASSWORD` and `PEACE_PASSWORD`. Set `BLOB_READ_WRITE_TOKEN` from a Vercel Blob store for attachments and voice notes.
3. Install dependencies with `npm install`.
4. Seed the two accounts with `npm run db:seed`.
5. Start locally with `npm run dev`; import the repository into Vercel and add the same environment variables to deploy.

The seeded usernames are `Quenzsome` (Queen Moyosore) and `Adekunle` (Peace Adekunle). The seed script hashes passwords with bcrypt. Set the respective secret env values to the passwords you provided before running it. On conflict, seeding updates the display name but does not reset an existing password hash.

The chat refreshes every 2.5 seconds and updates read receipts when the chat is open. It supports image, video, audio/voice-note and common document uploads up to 50 MB. Uploads use public Vercel Blob URLs, so only share files suitable for access by anyone who obtains the link. Voice recording requires browser microphone permission. Call buttons are intentionally absent until calls are implemented.

## SEO and deployment

The app includes metadata, Open Graph details, a page title and description, and a configurable `NEXT_PUBLIC_SITE_URL`. The landing page is indexable; `/chat` redirects unauthenticated visitors to login.
