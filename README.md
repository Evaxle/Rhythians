# Rhythians

Rhythians is the community site for Rhythia players. It includes maps, player profiles, rankings, messages, paths, and ranked score tracking.

The website and API are built with Next.js, React, TypeScript, Prisma, and Supabase.

## Development

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local address shown by Next.js.

## Main parts

- `app` — website pages and API routes
- `components` — shared UI components
- `lib` — server and application helpers
- `prisma` — database schema and migrations
- `public` — public website assets

## RhythKit

Rhythians also provides the API used by RhythKit. RhythKit handles the local game integration and sends qualified ranked completions to the API. The server checks the map, score data, installation token, and other requirements before a completion is recorded.

## Related projects

- `Evaxle/RhythKit` — game integration
- `Evaxle/Rhythians-Desktop` — desktop application

## License

Rhythians is proprietary software. See `LICENSE` and `TERMS_OF_USE.md` before using or distributing any part of the project.

Copyright (c) 2026 Evan Strong Canter. All rights reserved.
