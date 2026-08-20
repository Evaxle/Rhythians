# Rhythians Production Setup Checklist

## What I set up in the repo
- Added `.env.example` with all required env vars.
- Confirmed backend uses:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DISCORD_REDIRECT_URI`
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_GUILD_ID`
  - `DISCORD_INVITE_URL`
  - `STORAGE_BUCKET`
  - `SESSION_COOKIE_NAME`
  - `SESSION_EXPIRES_DAYS`
- Verified the upload flow is server-driven via `/api/clip-upload`.

## Manual tasks you must complete

### 1. Supabase
1. Create a new Supabase project.
2. Use its PostgreSQL database and copy the project URL.
3. Create a storage bucket named `media`.
4. Make the bucket private so uploads require signed URLs.
   - Do not allow anonymous public uploads.
   - Profile pictures use a separate public `avatars` bucket that is created automatically on first upload.
5. Add the following env vars in your deployment and local `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
6. Run migrations:
   - `npm run db:migrate`
7. Run seed only if you want baseline categories, roles, rules, and settings:
   - `npm run db:seed`
8. The database bootstrap endpoint `/api/setup` is now locked. To use it, set a long random `SETUP_SECRET` and call `/api/setup?secret=<SETUP_SECRET>`.

### 2. Discord OAuth
1. Create or select a Discord app in the Developer Portal.
2. Set the OAuth2 redirect URI to:
   - `https://YOUR-DOMAIN.com/api/auth/callback`
3. Add these env vars:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
4. Keep `DISCORD_CLIENT_SECRET` server-only.

### 3. Discord Bot
1. Create/configure a Discord bot in the same Developer Portal app.
2. Enable the **Server Members Intent** under Bot → Privileged Gateway Intents (required for role → tag sync).
3. Invite it to your server with at least `bot` and member read/send permissions.
4. Configure these env vars:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `DISCORD_INVITE_URL`
5. `DISCORD_INVITE_URL` must be a valid invite users can use to join the Rhythians server.
6. Run the bot so role changes sync in real time: `npm run bot:start`
   (host it on a server/VPS that stays online).
7. Configure role → tag mappings at **Admin → Discord → Integration** as the owner.
8. Also collect channel IDs for:
   - clip submissions
   - clip moderation
   - announcements

### 4. Vercel Deployment
1. Push the repository to GitHub.
2. Create a Vercel project and import this repository. The project **must be named `rhythians`** so the production URL is `https://rhythians.vercel.app`.
   - Every deployment also gets a unique deployment URL (e.g. `rhythians-<hash>-evans-projects-<id>.vercel.app`). That is normal Vercel behavior — the canonical production URL `https://rhythians.vercel.app` always points to the latest production deployment.
   - To deploy from the CLI instead: `vercel link --project rhythians --scope evans-projects-edff1a37`, then `vercel --prod`.
3. Add production env vars in Vercel exactly as below:
   - `NEXT_PUBLIC_SITE_URL=https://rhythians.vercel.app`
   - `OWNER_DISCORD_ID=<your Discord user ID>`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `DISCORD_CLIENT_ID=...`
   - `DISCORD_CLIENT_SECRET=...`
   - `DISCORD_BOT_TOKEN=...`
   - `DISCORD_GUILD_ID=...`
   - `DISCORD_INVITE_URL=<your Discord invite URL>`
   - `DISCORD_REDIRECT_URI=https://YOUR-DOMAIN.com/api/auth/callback`
   - `DATABASE_URL=...`
   - `STORAGE_BUCKET=media`
   - `SESSION_COOKIE_NAME=rhythians_session`
   - `SESSION_EXPIRES_DAYS=30`
   - `CRON_SECRET=<random string>`
   - `SETUP_SECRET=<long random string>`
4. Deploy the app.

> The scheduled Discord sync runs automatically via the cron job in `vercel.json`.

### 5. Verification
1. Visit `/login` and test Discord login.
2. Confirm session persists and logout works.
3. Visit `/clips/submit` and submit a test clip.
4. Verify a clip record is created with status `pending`.
5. In **Admin → Alerts**, use **Send tag setup alert** and verify it targets only users with zero tags.
6. Open the notification, join Discord if necessary, return to `/setup-tags`, and confirm the page rechecks membership and displays the onboarding questions.

## Notes
- The `service role key` is only used server-side in `lib/supabase.ts`.
- The frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for public Supabase access.
