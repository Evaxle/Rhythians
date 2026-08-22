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
  - `AUTH_SECRET`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- Added email verification and email 2FA for local username/password accounts.
- Added account security notices for local accounts without email 2FA.
- Added origin checks, rate limits, secure cookies, and security response headers.
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
8. The database bootstrap endpoint `/api/setup` is locked. To use it, set a long random `SETUP_SECRET` and call `/api/setup?secret=<SETUP_SECRET>`.

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

### 4. Email 2FA
1. Create a Resend account and verify the domain you will use as the sender.
2. Create a Resend API key with sending access only when possible.
3. Add these Vercel environment variables:
   - `RESEND_API_KEY=<sending API key>`
   - `RESEND_FROM_EMAIL=Rhythians <security@YOUR-VERIFIED-DOMAIN>`
4. Generate a long random `AUTH_SECRET` and add it to Vercel.
5. Keep `RESEND_API_KEY` and `AUTH_SECRET` server-only.
6. Local username/password users can add their email from **Settings → Email two-factor authentication**.
7. The user must enter their current password before the verification email is sent.
8. After the six-digit code is verified, email 2FA is enabled automatically.
9. Future local-account logins require the email security code before a session is created.

### 5. Vercel Deployment
1. Push the repository to GitHub.
2. Create a Vercel project and import this repository. The project **must be named `rhythians`** so the production URL is `https://rhythians.vercel.app`.
   - Every deployment also gets a unique deployment URL. That is normal Vercel behavior — the canonical production URL `https://rhythians.vercel.app` always points to the latest production deployment.
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
   - `AUTH_SECRET=<long random secret>`
   - `RESEND_API_KEY=<sending API key>`
   - `RESEND_FROM_EMAIL=Rhythians <security@YOUR-VERIFIED-DOMAIN>`
   - `CRON_SECRET=<random string>`
   - `SETUP_SECRET=<long random string>`
4. Deploy the app.

> The scheduled Discord sync runs automatically via the cron job in `vercel.json`.

### 6. Verification
1. Visit `/login` and test Discord login.
2. Confirm session persists and logout works.
3. Create or use a local username/password account.
4. Open `/settings`, add an email, and verify the emailed code.
5. Sign out and sign in again with the local account.
6. Confirm the second-factor screen appears and the emailed code is required before a session is created.
7. Confirm an incorrect code is rejected and the challenge locks after repeated failures.
8. Confirm the account security notice disappears after email 2FA is enabled.
9. Visit `/clips/submit` and submit a test clip.
10. Verify a clip record is created with status `pending`.

## Notes
- The `service role key` is only used server-side in `lib/supabase.ts`.
- The frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for public Supabase access.
- Email is intentionally used only for local-account 2FA; Discord accounts continue to use Discord authentication.
- Email 2FA is weaker than authenticator-app or passkey MFA because the security of the factor depends on the user's email account. It is still a substantial improvement over password-only authentication. 
