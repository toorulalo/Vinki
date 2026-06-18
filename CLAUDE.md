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
| `useProfile` | `profiles` row for current user |
| `useCanvases` | User's canvases (hard limit: `MAX_CANVASES = 5`) |
| `useCards` | Cards for active canvas + Realtime subscription (hard limit: 40 cards) |
| `useDecks` / `useFlashcards` | Leitner flashcard system |
| `useFriends` | Friend requests via `friendships` table |
| `useVinkiSession` / `useSessionPresence` / `useSessionChannel` | Co-study session |
| `useViewport` | Pan/zoom state for the canvas (no external library) |
| `useHistory` | Undo/redo stack for canvas operations |

**Utility files in `src/lib/`:** `linkPreview.js` (YouTube ID + domain extraction), `effects.js` (audio chime + confetti), `compressImage.js` (resize before Supabase Storage upload).

**Canvas component tree:**
```
CanvasBoard
  useViewport  (pan: 1-finger drag, pinch-zoom, Ctrl+wheel)
  CardNode[]   (positioned absolutely in world space)
    NoteCard / LinkCard / ImageCard / PdfCard / TimerCard / DeckCard
  AddBlockMenu
  CardEditPanel (slide-up panel when a card is tapped)
  SelectionToolbar (multi-select operations)
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

`src/components/` has two layers — the **legacy** flat components at the top level are unused by the current app. The **active** components are in subfolders:

- `auth/` — Login, Onboarding
- `canvas/` — CanvasBoard, CardNode, CardEditPanel, AddBlockMenu, SelectionToolbar
- `cards/` — NoteCard, LinkCard, ImageCard, PdfCard, TimerCard, DeckCard
- `dashboard/` — Dashboard, CanvasCard, FriendsPanel
- `decks/` — DeckEditPanel, ReviewSession
- `icons/` — SVG icon components (single export file)
- `music/` — GlobalMusicPlayer (YouTube embed, collapsed pill by default)
- `session/` — SessionView, SessionEntrance, PresenceBar, ReactionBubble, SessionInviteModal, WaitingRoomModal
- `ui/` — Avatar, Modal, SettingsPanel, Toast

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

`vite.config.js` configures `vite-plugin-pwa` with `registerType: 'prompt'` (no silent auto-update). The manifest includes a `share_target` at `/share` for "Send to Vinki" (not yet wired up as a route).
