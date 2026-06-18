# Vinki design-sync notes

## Repo shape
- App (not a library) — no `dist/`, no `.d.ts`. Uses a manually maintained `src/ds-entry.js` that re-exports all active components as named exports.
- Must pass `--entry ./src/ds-entry.js` on every build. Without it, the converter falls back to `node_modules/vinki` which doesn't exist (app, not self-installed).
- CSS is compiled separately via esbuild before the main build (see Pre-build steps below).

## Pre-build steps (run before `package-build.mjs`)
```bash
# 1. Bundle the CSS (source files use @import, converter needs compiled CSS)
node -e "import('./.ds-sync/node_modules/esbuild/lib/main.js').then(({build})=>build({entryPoints:['src/styles/index.css'],bundle:true,outfile:'dist-css/styles.css',logLevel:'warning'}))" 

# 2. Run the converter
node .ds-sync/package-build.mjs \
  --config .design-sync/config.json \
  --node-modules ./node_modules \
  --entry ./src/ds-entry.js \
  --out ./ds-bundle
```

## Active vs legacy components
- Top-level `src/components/*.jsx` are LEGACY (unused by the app per CLAUDE.md). Active components live in subfolders: `auth/`, `canvas/`, `cards/`, `dashboard/`, `decks/`, `music/`, `session/`, `ui/`.
- The legacy `src/components/SessionView.jsx` imports a missing `./SendToVropDialog` — would break the synth bundle. Avoided by using explicit `--entry ./src/ds-entry.js` instead of synth mode.
- `componentSrcMap` nulls out all legacy names so they don't get component cards.

## Supabase client
- Several components import `../../lib/supabaseClient` which calls `createClient(import.meta.env.VITE_SUPABASE_URL, ...)`.
- The `common.mjs` lib override injects placeholder Supabase env vars into the IIFE define so the client initializes without throwing. API calls from these components will fail silently in previews (expected — no real auth context).
- Components that make Supabase calls on mount (DeckCard, ImageCard, PdfCard, Dashboard, FriendsPanel, Login, Onboarding, SessionView, DeckEditPanel, ReviewSession) will show loading/empty states in previews.

## Fonts
- DM Sans and Outfit are loaded from Google Fonts via `<link>` in `index.html` — no `@font-face` in CSS.
- Configured as `runtimeFontPrefixes` — previews render with system fonts (fallback). For faithful font rendering in the DS pane, set up Google Fonts in the preview environment.

## DTS (TypeScript types)
- All components are `.jsx` (no TypeScript). The DTS extractor emits stub prop bodies.
- `[DTS_REACT]` warning is expected and non-blocking — no @types/react needed since there are no generic React types to resolve.
- Prop documentation comes from JSDoc comments in the component source files.

## Toast component
- Toast has no `export default`. The component to sync is `ToastProvider` (mapped from `src/components/ui/Toast.jsx`). It wraps the app and renders notifications.

## ThemeProvider
- Included in `src/ds-entry.js` as a named re-export from `src/contexts/ThemeContext.jsx`.
- Used as `cfg.provider.component` — wraps all preview renders.

## Render check
- Playwright was NOT installed. Previews were not visually verified.
- On next re-sync from a local session: install playwright (`npx playwright install chromium`) and run the full validate without `--no-render-check`.

## Known render warns (to expect on next sync)
- `[DTS_REACT]` — expected, non-blocking (no TypeScript in this codebase)

## Re-sync command (one-shot from repo root)
```bash
# Pre-step: re-bundle CSS if styles changed
node -e "import('./.ds-sync/node_modules/esbuild/lib/main.js').then(({build})=>build({entryPoints:['src/styles/index.css'],bundle:true,outfile:'dist-css/styles.css',logLevel:'warning'}))"

node .ds-sync/resync.mjs \
  --config .design-sync/config.json \
  --node-modules ./node_modules \
  --entry ./src/ds-entry.js \
  --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```

## Re-sync risks
- `src/ds-entry.js` must be kept in sync when new active components are added or old ones removed. It won't auto-discover new components.
- `dist-css/styles.css` must be regenerated whenever `src/styles/` files change (see pre-build step above). It is gitignored — regenerate on each clone.
- Supabase placeholder values in `common.mjs` override are stable. If `@supabase/supabase-js` upgrades to validate key format on init, the override may need real (dummy-but-validly-formatted) credentials.
- Components with heavy Supabase deps (Dashboard, Login, Onboarding, FriendsPanel, SessionView, DeckEditPanel, ReviewSession) render as loading/empty states in previews. Verify by eye in `.review.html`.
- `[DTS_REACT]` will keep printing (expected — no TypeScript).

## Upload environment
- DesignSync tool is not available in remote CCR sessions. Run `/design-sync` from a local Claude Code session (claude.ai/code web, desktop app, or VS Code extension) to do the upload.
- All local build artifacts are committed. A local session just needs to: fetch `_ds_sync.json` from the project → run resync → upload.
