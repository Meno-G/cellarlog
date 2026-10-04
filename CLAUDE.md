# CellarLog

A winemaker's cellar log. The user speaks or types a short note ("Tank 12, added 20 g/hl SO2, temp 22°C"), an n8n workflow turns it into structured JSON, the user confirms it, and it is saved as an entry on that tank.

Stack: Expo SDK 57 (React Native 0.86), TypeScript (strict), Expo Router, Supabase (Postgres + email/password auth), expo-audio, n8n webhook for transcription and extraction.

## Commands

```bash
npm install                 # install dependencies
npx expo start              # dev server; scan the QR code with Expo Go
npm run start:tunnel        # dev server over an ngrok tunnel, when the phone can't reach the PC on the LAN
npx expo start --clear      # same, with Metro cache cleared (after env or config changes)
npm run typecheck           # tsc --noEmit
npm run lint                # expo lint
npx expo install <package>  # ALWAYS use this to add packages (picks SDK-compatible versions)
npx expo install --fix      # repair incompatible versions
npx expo-doctor             # diagnose dependency and config issues
```

Run `npm run typecheck` and `npm run lint` before declaring any task done. Both must be clean.

## Expo changes fast: check the docs, not memory

Expo ships breaking changes every SDK. Before touching an Expo or React Native API, check the versioned docs for SDK 57 (`https://docs.expo.dev/versions/v57.0.0/`) or `https://docs.expo.dev/llms.txt`.

## Project layout

```
app/            Expo Router routes. Screens only: UI + calling hooks. No fetch / Supabase calls here.
  (auth)/       Signed-out screens
  (app)/        Signed-in screens (Stack)
components/     Reusable UI (AppText, Button, Screen, HeaderButton, ...)
hooks/          React hooks that wrap lib/ calls with loading / error state
lib/            All API and business logic: Supabase, n8n parser, env, errors, types
theme/          Color tokens (light/dark), spacing, font sizes, touch sizes, useTheme()
supabase/migrations/  SQL migrations, run in order
docs/           n8n contract and other docs
```

## Conventions

- **Strict TypeScript, no `any`.** ESLint enforces `@typescript-eslint/no-explicit-any`. Use `unknown` and narrow it, or validate it with zod at the boundaries (network responses).
- **API logic lives in `lib/`.** Screens never import `supabase` or call `fetch` directly. Loading data goes through `hooks/` (`useFocusQuery` refetches when a screen regains focus); actions (save, sign in) call `lib/` functions directly.
- **Pure logic in separate files.** Form parsing and validation that doesn't touch the network (e.g. `lib/tankForm.ts`) lives apart from data access (`lib/tanks.ts`), so it can be tested without Supabase.
- **lib/ returns camelCase domain types** (`Tank`), not raw database rows. Mapping happens in `lib/` (`fromRow` / `toRow`).
- **Errors:** `lib/` functions throw a typed `AppError` (kinds: network, permission, server, invalid_response, auth, validation). Screens show `error.message` (already human-readable) and offer a retry.
- **Every async UI has loading, error and empty states.**
- **Large touch targets:** at least `touch.minHeight` (56 pt) for anything tappable; the record button is `touch.recordButton`. Body text is at least 18 pt. People use the app with wet or gloved hands.
- **Dark mode:** never hard-code colors in components; use `useTheme().colors`. Add new colors to both palettes in `theme/colors.ts`.
- **Imports:** use the `@/` alias (maps to the repo root), e.g. `import { Button } from '@/components/Button'`.
- **Navigation:** typed routes are on. Use object hrefs for dynamic routes: `router.push({ pathname: '/tanks/[id]', params: { id } })`.
- **Secrets:** only in `.env` (gitignored). Every variable must be listed in `.env.example`. Anything prefixed `EXPO_PUBLIC_` ends up in the app bundle, so never put private server secrets there.
- **Scope:** build only the MVP described in the plan. No extra features without asking.
  Build order: (1) setup + navigation, (2) Supabase + auth, (3) tanks CRUD, (4) text entry + mock parser + review, (5) voice recording, (6) real n8n connection, (7) offline mode: tanks/timelines viewable from the last sync, and new entries queued on the phone, then synced and parsed when back online.
  Until step 7, being offline shows a clear "No internet" message and never loses what the user typed.
  Added on request: deleting a timeline entry (tap entry, confirm). Still not included: deleting tanks, editing saved entries.

## Entry flow (note → parser → review → save)

- `lib/parser/index.ts` `parseNote()` is the only entry point. It picks the mock (`lib/parser/mock.ts`) or n8n by `EXPO_PUBLIC_PARSER_MODE`, and validates every result with the zod schema in `lib/parser/schema.ts`. The same shape is used by the n8n response, the review screen and `entries.parsed`.
- Mock parser test hooks: a note containing `#fail` simulates a server error; `#offline` simulates no internet.
- `lib/entryDraft.ts` turns a parse result into an editable draft, and validates it into a `ValidEntry`. `lib/tankMatch.ts` resolves "tank 12" / "T12" to a tank.
- Item values that look like numbers ("3,4") are saved as numbers; anything else stays text.

## Environment variables

See `.env.example`. After changing `.env`, restart with `npx expo start --clear`.
`lib/env.ts` validates them with zod; if anything is missing the app shows a "Setup needed" screen listing the problems instead of crashing.

## Supabase

- Schema changes go in a **new** file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`. Never edit a migration that has already been run.
- Every table gets RLS enabled, with policies limited to `authenticated` and `(select auth.uid()) = user_id`. `user_id` defaults to `auth.uid()`, so the app never sends it.
- Keep `lib/database.types.ts` in sync with the migrations. Same shape as `supabase gen types typescript`.
- Get the client with `getSupabase()` from `lib/supabase.ts`. It's created lazily and throws `AppError('config')` if `.env` is incomplete.
- Auth is email + password only. The session is stored with `expo-sqlite`'s localStorage, and the root layout gates `(app)` and `(auth)` with `Stack.Protected`.

## Dependency notes

- `@expo/ngrok` is a local devDependency. Expo CLI fails to find a globally installed copy on Windows ("Install @expo/ngrok@^4.1.0 and try again").
- If `expo start` prints "Networking has been disabled", one request to api.expo.dev failed at startup and the CLI stays offline (no tunnel) for that run. Just restart it.
- `react-dom` is pinned to the same version as `react` (19.2.3). `expo-router` pulls in `react-dom` as a peer, and without the pin npm installs a newer one that conflicts with `react`.
