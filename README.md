# Rhythians Community Website

A full-stack Discord community platform built with Next.js, TypeScript, Tailwind CSS, Prisma, and Supabase.

## Features

- Discord OAuth login
- Knowledge base / wiki
- Clip submission, browsing, playback
- Clip likes and comments
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

## Discord Setup

### Discord OAuth App

1. Create an application at the Discord Developer Portal.
2. Add an OAuth2 redirect URI:
   - `http://localhost:3000/api/auth/callback`
3. Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to `.env`.
4. Use the `login with Discord` button to authenticate.

### Discord Bot

1. Create a bot user in the Developer Portal.
2. Add the bot to your server with `bot` and `applications.commands` scopes.
3. Give it permissions to read server members and send messages.
4. Add `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` to `.env`.

## Supabase Setup

1. Create a Supabase project.
2. Create a storage bucket named `media`.
3. Set bucket permissions and storage policies.
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## Admin Bootstrapping

The application bootstraps the first admin from the Discord user who signs in first if there are no existing roles configured. A full admin must be created through the admin dashboard afterward.

## Deployment

- Deploy the Next.js app to Vercel.
- Use Supabase for the database and storage.
- Use environment variables for all credentials.

## Commands

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:seed`
- `npm run bot:start`
