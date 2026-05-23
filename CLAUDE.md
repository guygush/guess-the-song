# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # type-check + build
npm start        # run production build
```

No test suite exists. Deploy by pushing to GitHub — Vercel auto-deploys on push.

**IMPORTANT — deploy workflow:** After every code change, commit and `git push origin main`. Never run `vercel --prod` or `vercel` directly. Vercel is connected to GitHub and deploys automatically on every push to main.

## Project Overview

Two Hebrew party games in a single Next.js 15 app:

1. **זהה את השיר (Guess the Song)** — A song-guessing game. A player picks a song, plays a short snippet via YouTube IFrame API, and others try to guess it. Supports solo, "test yourself" (random Israeli chart songs), and group modes with scoring.

2. **במילה אחת (One Word)** — A multiplayer word-guessing game. One player (guesser) must guess a word from single-word hints submitted by others. Organizer reviews/rejects duplicate hints before they're shown to the guesser.

## Architecture

### Navigation Model

The entire app is a single client component at `app/page.tsx`. Navigation is a `Screen` discriminated union type managed with `useState`. There's no routing — screens are rendered conditionally. Browser back button is handled manually via `history.pushState` / `popstate`.

### Guess the Song Flow

`SearchScreen` → `LoadingScreen` → `PlayScreen` → (next song loop or `SummaryScreen`)

- Song data comes from the **iTunes Search API** (`lib/itunes.ts`) or from `public/data/israeli-charts.json` (static JSON of Israeli chart hits, used for "test yourself" and group modes)
- YouTube video ID is fetched via the **YouTube Data API v3** (`lib/youtube.ts` → `findVideoId`), then played via the **YouTube IFrame Player API** (dynamically injected script)
- `PlayScreen` embeds a hidden 1×1 YouTube player; the visible UI shows snippet duration controls, a progress ring, and start-offset scrubber
- Group mode tracks `scores: Record<string, number>` and passes `groupPlayers` through the screen stack; at `onFinish` it navigates to `SummaryScreen`
- `hideMetadata` flag hides song name/artist until the user reveals the song (used in test/group modes)

### One Word (במילה אחת) Flow

`OneWordScreen` manages four sub-screens (`join` → `lobby` → `game` → `summary`) with all state in a single component. Real-time sync uses **two parallel channels**:

- **Pusher** (`lib/pusher-client.ts` + `lib/pusher-server.ts`): pub/sub events trigger UI state updates. `publish()` posts to `/api/pusher` which calls `pusherServer.trigger()`, passing `socketId` to exclude the sender. Channel name: `ow-{roomId}`.
- **Supabase** (`lib/supabase.ts`): persistent storage for rooms/players/hints/guesses. Supabase Realtime is NOT used (replaced by Pusher).

Supabase tables: `ow_rooms`, `ow_players`, `ow_hints`, `ow_guesses`. All room logic (create, join, start, hint, guess, next turn, end) lives in `lib/oneword-rooms.ts`. Rooms use 2-digit numeric codes. Old rooms (ended or >4h) are cleaned up on each `createRoom` call.

Words are drawn from `lib/oneword-words.ts` via `pickWord()`.

### Pusher Event Pattern

The organizer's `handleBroadcast` callback in `OneWordScreen` both updates local state and publishes to Pusher (so other clients receive the event). Remote clients receive the same event via Pusher subscription and apply identical state updates. This means the organizer applies changes locally (optimistically) while others receive them via Pusher.

## Environment Variables

```
NEXT_PUBLIC_YOUTUBE_API_KEY      # YouTube Data API v3
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # JWT anon key (not sb_publishable_ format — breaks Realtime)
SUPABASE_SECRET_KEY
NEXT_PUBLIC_PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER
PUSHER_APP_ID
PUSHER_SECRET
```

## UI Conventions

- Dark theme: `bg-gray-950` base, `bg-gray-800/700` cards, `bg-indigo-600` primary actions
- RTL Hebrew UI. Use `dir="rtl"` or default; add `dir="ltr"` explicitly on numeric/LTR elements
- Tailwind only — no CSS modules or styled-components
- `h-dvh` (dynamic viewport height) used on full-screen containers to handle mobile browser chrome
- `min-w-0` on flex children with `truncate` text; `flex-shrink-0` on fixed-size elements
