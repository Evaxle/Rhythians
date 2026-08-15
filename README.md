# Rhythians Community Website

A full-stack Discord community platform built with Next.js, TypeScript, Tailwind CSS, Prisma, and Supabase.

## Features

- Discord OAuth login
- Knowledge base / wiki
- Clip submission, browsing, playback
- Clip likes and comments
- Direct messaging and group chats
- Rules management
- Announcements and notifications
- Role-based access control
- Admin dashboard and moderation tools
- Supabase storage integration
- Responsive dark UI with accessibility support

## Requirements

- Node.js 20+
- PostgreSQL
- Supabase project for storage
- Discord application and bot

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy environment variables

   ```bash
   cp .env.example .env
   ```

3. Configure your `.env` values

4. Run database migrations

   ```bash
   npm run db:migrate
   ```

5. Seed development data

   ```bash
   npm run db:seed
   ```

6. Start the development server

   ```bash
   npm run dev
   ```

## Direct Messaging

Authenticated users can message each other directly and create group chats.

- Access messages via the **Messages** link in the top navigation (beside Community).
- Start a direct message or group chat from the **New** button inside the Messages page.
- Message another user from their profile page via the **Message** button.
- Groups support adding and removing members (owner-only), unread counts, and per-user read receipts.

Messages are polled every few seconds for near real-time updates. The relevant API routes live under `app/api/messages/`, and the database tables (`Conversation`, `ConversationMember`, `Message`) are created by the `20260814070000_add_messaging` migration.

## Discord Setup

### Discord OAuth App

1. Create an application at the Discord Developer Portal.
2. Add an OAuth2 redirect URI:
   - `http://localhost:3000/api/auth/callback`
3. Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to `.env`.
4. Use the `login with Discord` button to authenticate.

### Discord Bot

1. Create a bot user in the Developer Portal.
2. Enable the **Server Members Intent** under Bot → Privileged Gateway Intents (required for role sync).
3. Add the bot to your server with `bot` and `applications.commands` scopes.
4. Give it permissions to read server members and send messages.
5. Add `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` to `.env`.

### Role → Tag Sync

Website tags stay in sync with the Discord roles a member holds:

1. Run the bot so it can push role changes in real time: `npm run bot:start`.
2. Sign in as the owner and open **Admin → Discord → Integration**.
3. Map each Discord role to a website tag using the dropdowns.
4. When a member joins the server and picks roles (or changes them later), the bot updates their website tags automatically. Tags assigned through the admin panel are kept as manual overrides and are never removed by sync.

Users can also force a re-sync from **Settings**.

**Automatic full sync:** the site runs the full member sync every minute, so tags stay correct even if the bot is briefly offline.

- On Vercel this is handled by a cron job (`vercel.json`) hitting `/api/internal/discord/sync` every minute. For extra security, set a `CRON_SECRET` env var — the cron URL then needs `?secret=<CRON_SECRET>`.
- The bot also runs the same full sync on startup and every 60 seconds as a fallback.

### Post-Reviewer Approval Panel

An approval team can review and moderate submitted clips without full admin access:

1. Create a **post-reviewer** role in the Discord server and map it to the **post-reviewer** website tag in **Admin → Discord → Integration**.
2. Members with the `post-reviewer` tag (plus the site owner) can access **/approval**, where they approve or reject pending clips and attach feedback on rejections.
3. The panel is protected server-side: pages redirect, and API routes return `403` for anyone without the tag or owner status — never trust client-side hiding.

### Notifications

When a submission is approved or rejected, the uploader is notified:

- Approvals link to the live clip.
- Rejections include the reviewer's reason and a prompt to adjust and resubmit.

Notifications appear in the bell icon in the header and on **/notifications**.

## Accounts

Users can sign in with Discord **or** create a local account with username, email, and password.

- Local accounts are stored in the same `User` table — nothing behaves differently for Discord users.
- On first sign-up, local users complete **onboarding** (`/onboarding`), which mirrors your Discord server's onboarding questions. Answers are mapped to tags (experience level, mentor/veteran, camera mode, etc.) via the same Discord role → tag mappings, so Discord and local users end up with the same tags.
- **Settings → Roles & tags** lets users change their answers and tags anytime.
- **Settings → Profile picture** lets users upload a profile picture (stored in a public `avatars` Supabase bucket, created automatically).

## Reports

Users can report other users and posts (clips) with a reason and optional detail.

- Report buttons appear on profile pages and clip pages.
- The owner reviews them in **Admin → Reports**, split into **Users** and **Posts** tabs, with a search box to find reports by user.
- A **Banned users** tab lists suspended accounts with one-click **Unban**.
- Actions on reports: **Warn** (sends the user a notification), **Ban** (suspends the account, kills their sessions, and blocks login/access), **Resolve**, or **Dismiss**.

## Clips

- Clips record a **camera mode** (Lock / Spin / VR) chosen at submission and shown as a badge on the thumbnail and clip page.
- Thumbnails are **auto-generated** from a random frame of the uploaded video (client-side capture), so posts never have blank thumbnails. A manual thumbnail upload still overrides it.

## Supabase Setup

1. Create a Supabase project.
2. Create a storage bucket named `media`.
3. Set bucket permissions and storage policies.
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
