# World Cup 2026 Tracker

A fast, clean tracker for the official Panini FIFA World Cup 2026 sticker album. Sign in, mark what you own, and see what's still missing — synced across all your devices.

Live at [worldcup.fullsendcode.com](https://worldcup.fullsendcode.com)

---

## What it does

- 980 stickers across 48 national teams — tap any card to mark it owned
- Progress bar and missing-sticker count update instantly, no page reload
- Jump-to-section nav, search by player or team, filter by owned / missing
- "Top missing teams" sidebar so you know where to focus your next swap
- Collection syncs the moment you sign in — works on phone, tablet, desktop
- Public REST API to query the full sticker catalog (no auth required)

---

## Album structure

| Section | Stickers |
|---|---|
| Cover | 4 |
| Tournament history | 24 |
| Host nations (CAN / MEX / USA) | 36 |
| 48 national teams x 20 each | 960 |
| **Total** | **980** |

Each team page contains: 1 country crest, 18 player stickers, 1 team photo.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | [Astro 4](https://astro.build) + React + TypeScript |
| Auth + DB | [Supabase](https://supabase.com) (Google OAuth, RLS, Postgres) |
| Hosting | [Vercel](https://vercel.com) (serverless, Node 20) |
| Styles | Vanilla CSS (no framework) |
| Data | Extracted from the official Panini FIFA World Cup 2026 checklist |

All user data is stored in a `user_stickers` table protected by Supabase Row Level Security — only you can read or write your own rows. No server middleware sits between the browser and the database.

---

## Run it yourself

### Prerequisites

- Node.js 18 or later
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/cal5barton/world-cup-2026-tracker
cd world-cup-2026-tracker
npm install
```

### 2. Create the database table

Open the SQL Editor in your Supabase project and run `supabase/schema.sql`. This creates the `user_stickers` table and the four RLS policies (SELECT, INSERT, UPDATE, DELETE).

No seed file needed — the full 980-sticker catalog lives in `src/data/stickers.ts` and is served statically at build time.

### 3. Set environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the two values from your Supabase project under **Settings > API**:

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in your Vercel project under **Settings > Environment Variables**, then redeploy.

---

## Contributing

The sticker catalog (`src/data/stickers.ts`) is the source of truth for all 980 entries. If you spot a wrong player name, missing number, or want to add image URLs — pull requests are welcome.

---

## License

[MIT](LICENSE)
