# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # production build
npm run preview   # preview production build locally
```

No linter or test runner is configured.

## Architecture

**Stack:** React 18 + Vite PWA → Supabase (auth + Postgres + Realtime) → Vercel

**Auth flow (App.jsx):**
```
session === undefined  → loading spinner
session === null       → <Login />
profile === null       → <Onboarding /> (creates profile row)
else                   → <Canvas /> (main app)
```

App.jsx wraps everything with `MusicPlayerProvider` and `ToastProvider`. `ThemeProvider` (light/dark mode, persisted to localStorage, toggled via `data-theme` attribute) lives in `main.jsx`.

**Two-view layout (pages/Canvas.jsx):**
- `activeCanvasId === null` → `<Dashboard>` (canvas list + friends + session panel)
- `activeCanvasId !== null` → `<CanvasBoard>` (infinite pan/zoom canvas)
- When a Vinki-Vinki session is active, `<SessionView>` wraps `<CanvasBoard>`

**Data layer (`src/lib/`):** All Supabase queries live in custom hooks. Components never import `supabase` directly except through these hooks.

| Hook | Manages |
|------|---------|
| `useSession` | Supabase auth state |
| `useProfile` | `profiles` row for current user (keyed on user id, not the session object — token refreshes must not trigger a refetch/remount) |
| `useCanvases` | User's canvases (hard limit: `MAX_CANVASES = 5`) |
| `useCards` | Cards for active canvas + Realtime subscription (hard limit: 40 cards). Deck cards cascade-delete their `decks`/`flashcards` rows |
| `useDecks` / `useFlashcards` | Leitner flashcard system |
| `useFriends` | Friend requests via `friendships` table |
| `useVinkiSession` / `useSessionPresence` / `useSessionChannel` | Co-study session. Invites broadcast + recoverable from DB (`getPendingInvitations`); `setMyCanvas` keeps my participant row pointing at my open canvas; `updateActivity` pinged every 10 min from Canvas.jsx |
| `useViewport` | Pan/zoom state for the canvas (no external library) |

**Utility files in `src/lib/`:** `linkPreview.js` (YouTube ID + domain extraction), `effects.js` (audio chime + confetti), `compressImage.js` (resize before Supabase Storage upload).

**Canvas component tree:**
```
CanvasBoard
  useViewport  (pan: 1-finger drag, pinch-zoom, Ctrl+wheel)
  CardNode[]   (positioned absolutely in world space; drag + resize commit to DB on pointerup only)
    NoteCard / LinkCard / ImageCard / PdfCard / TimerCard / DeckCard (previews)
  AddBlockMenu
  CardEditPanel (slide-up panel when a card is tapped)
    deck cards render decks/DeckEditPanel (flashcard CRUD + ReviewSession)
```

**Card drag pattern — critical:** Never call `setState` inside another `setState` functional updater. Use `useRef` for mutable drag state:
```js
const isDragging = useRef(false)
// long-press (400ms) sets isDragging.current = true, setIsMoving(true)
// pointermove checks isDragging.current + 6px move threshold, calls setLocalPos directly
// pointerup calls onMove prop, then isDragging.current = false, setIsMoving(false)
```

**Realtime:** `useCards` subscribes to `postgres_changes` on the `cards` table filtered by `canvas_id`. `useSessionChannel` uses Supabase Broadcast on channel `vinki-session-{id}` for session events.

**Flashcard system:** Leitner algorithm, 4 levels. Intervals: `[0, 1, 3, 7]` days. Level resets to 0 on wrong answer, increments (max 3) on correct. Lives in `useDecks.js` → `recordResult()`.

## Database

Supabase project: `hvdwnqageoavegmauhqg`

Tables: `profiles`, `canvases`, `cards`, `decks`, `flashcards`, `friendships`, `sessions`, `session_participants`

`public.users` is a compatibility VIEW over `profiles` (kept for backwards-compat with old deployed code).

RLS policies use a PostgreSQL function `current_vinki_user_id()` to resolve the current user's `profiles.id` from `auth.uid()`. Profile search uses `profiles_search` policy (`USING (true)`) so any authenticated user can search by username.

## Component organization

All components live in subfolders of `src/components/` (the old flat legacy layer was deleted):

- `auth/` — Login, Onboarding
- `canvas/` — CanvasBoard, CardNode, CardEditPanel, AddBlockMenu (+ CanvasMinimap, SelectionToolbar: built but not mounted)
- `cards/` — NoteCard, LinkCard, ImageCard, PdfCard, TimerCard, DeckCard (canvas previews)
- `dashboard/` — Dashboard, CanvasCard, FriendsPanel, ReviewHub (flashcards due today, one-tap review)
- `decks/` — DeckEditPanel, ReviewSession (reached via CardEditPanel for deck cards, and via ReviewHub)
- `icons/` — SVG icon components (single export file)
- `music/` — GlobalMusicPlayer (YouTube embed, collapsed pill; play/pause/volume via iframe postMessage — never remount the iframe to pause)
- `session/` — SessionView, PresenceBar, ReactionBubble, SessionInviteModal, WaitingRoomModal (+ SessionEntrance: unmounted)
- `ui/` — Avatar, Modal, SettingsPanel, Toast (`useToast` is the standard error/success surface — no `alert()`)
- `ShareCapture.jsx` — handles PWA share_target query params (pick a canvas → saves a link/note card)

`src/ds-entry.js` is a re-export barrel for the design-sync converter only — not part of the app, but keep its imports resolvable.

`src/contexts/ThemeContext.jsx` provides light/dark mode. `src/lib/MusicPlayerContext.jsx` provides global music player state.

## Styles

All CSS lives in `src/styles/`. No CSS-in-JS or preprocessor — plain CSS with custom properties.

- `global.css` — design tokens (spacing, color, typography), light/dark theme variables, base component styles
- `canvas.css` — board layout, world-space transform, dot-grid background
- `cards.css` — per-card-type styles
- `session.css` — presence indicators, reactions, session UI
- `animations.css` — transitions, pop effects, confetti

Design tokens use CSS custom properties: green primary (`#2E7D52`), orange accent (`#E07240`), cream background (`#F5F1EB`). Dark mode overrides via `[data-theme="dark"]`.

## Deployment

- **Production:** merging to `main` triggers Vercel auto-deploy
- **Dev branch:** `claude/practical-heisenberg-intd7q`
- Git remote proxy is read-only in CCR sessions — pushing requires a GitHub PAT provided by the user

## PWA

`vite.config.js` configures `vite-plugin-pwa` with `registerType: 'prompt'` (no silent auto-update). The manifest includes a GET `share_target` on `/` — shared `title/text/url` query params are handled by `src/components/ShareCapture.jsx`.
