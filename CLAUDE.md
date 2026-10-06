# CellarLog

A winemaker's cellar log. The user speaks or types a short note ("Tank 12, added 20 g/hl SO2, temp 22°C"). The phone turns speech into text and a rule-based parser turns the text into structured data, all on the device: no n8n, no AI service. The user confirms or corrects it, and it is saved as an entry on that tank.

Stack: Expo SDK 57 (React Native 0.86), TypeScript (strict), Expo Router, Supabase (Postgres + email/password auth), expo-speech-recognition (the phone's own speech recognizer), EAS Build (development build).

## Commands

```bash
npm install                 # install dependencies
npx expo start --clear      # dev server (Metro); the CellarLog dev build loads the app from it
npm test                    # unit tests for lib/ (parser, normaliser, validation, tank matching, offline cache + outbox)
npm run typecheck           # tsc --noEmit
npm run lint                # expo lint
npx expo install <package>  # ALWAYS use this to add packages (picks SDK-compatible versions)
npx expo install --fix      # repair incompatible versions
npx expo-doctor             # diagnose dependency and config issues
npx eas-cli@latest build --profile development --platform android   # new dev build (only after native changes)
npm run start:tunnel        # dev server over an ngrok tunnel, when the phone can't reach the PC on the LAN
```

Run `npm test`, `npm run typecheck` and `npm run lint` before declaring any task done. All must be clean.

## Development build (not Expo Go)

Speech recognition is a native module that Expo Go doesn't include, so CellarLog runs as its own **development build** (`eas.json` profile `development`, Android package `com.cellarlog.app`).
- JavaScript/TypeScript changes reload instantly from Metro. No rebuild needed.
- **Rebuild only after native changes**: adding or removing a package with native code, or editing plugins or permissions in `app.json`.
- In Expo Go the app still runs; the voice button is replaced by a "needs the CellarLog app build" note (`SPEECH_AVAILABLE` in `hooks/useSpeechToText.ts`).
- Metro picks up newly installed packages only after a restart (`npx expo start --clear`).

## Expo changes fast: check the docs, not memory

Expo ships breaking changes every SDK. Before touching an Expo or React Native API, check the versioned docs for SDK 57 (`https://docs.expo.dev/versions/v57.0.0/`) or `https://docs.expo.dev/llms.txt`.

## Project layout

```
app/            Expo Router routes. Screens only: UI + calling hooks. No fetch / Supabase calls here.
  (auth)/       Signed-out screens
  (app)/        Signed-in screens (Stack)
components/     Reusable UI (AppText, Button, Screen, RecordButton, EntryReview, ...)
hooks/          React hooks: session, data loading (useFocusQuery + cache), outbox, speech, network status
lib/            All API and business logic: Supabase, parser, env, errors, types
  parser/       normalize.ts (spoken -> compact text), rules.ts (text -> entry), schema.ts (zod)
theme/          Color tokens (light/dark), spacing, font sizes, touch sizes, useTheme()
supabase/migrations/  SQL migrations, run in order
tests/          Unit tests (node:test) for the pure lib/ modules; run with `npm test`
scripts/        test.mjs: compiles the pure lib/ modules and runs tests/
```

## Conventions

- **Strict TypeScript, no `any`.** ESLint enforces `@typescript-eslint/no-explicit-any`. Use `unknown` and narrow it, or validate it with zod at the boundaries.
- **API logic lives in `lib/`.** Screens never import `supabase` or call `fetch` directly. Loading data goes through `hooks/` (`useFocusQuery` refetches when a screen regains focus); actions (save, sign in) call `lib/` functions directly.
- **Pure logic in separate files.** Parsing and validation that don't touch the network live apart from data access (`lib/tanks.ts`, `lib/entries.ts`), so they can be unit-tested. When adding one, list it in `PURE_MODULES` in `scripts/test.mjs`, and keep its runtime imports pure too.
- **lib/ returns camelCase domain types** (`Tank`, `Entry`), not raw database rows. Mapping happens in `lib/` (`fromRow` / `toRow`).
- **Errors:** `lib/` functions throw a typed `AppError` (kinds: network, permission, server, invalid_response, auth, validation, config, not_found; optional `field`). Screens show `error.message` (already human-readable) and offer a retry.
- **Every async UI has loading, error and empty states.**
- **Large touch targets:** at least `touch.minHeight` (56 pt) for anything tappable; the record button is `touch.recordButton`. Body text is at least 18 pt. People use the app with wet or gloved hands.
- **Dark mode:** never hard-code colors in components; use `useTheme().colors`. Add new colors to both palettes in `theme/colors.ts`.
- **Imports:** use the `@/` alias (maps to the repo root) in app code; inside `lib/` use relative imports, so `npm test` can compile it.
- **Navigation:** typed routes are on. Use object hrefs for dynamic routes: `router.push({ pathname: '/tanks/[id]', params: { id } })`.
- **Secrets:** only in `.env` (gitignored). Every variable must be listed in `.env.example`. Anything prefixed `EXPO_PUBLIC_` ends up in the app bundle, so never put private server secrets there.
- **Scope:** build only what the plan covers. No extra features without asking.
  Build order: (1) setup + navigation, (2) Supabase + auth, (3) tanks CRUD, (4) text entry + review, (5) voice, (6) on-device speech recognition + rule-based parser (replaced the planned n8n integration at the user's request), (7) offline mode: tanks/timelines viewable from the last sync, and new entries queued on the phone, then synced when back online.
  All 7 steps are built. Added on request: editing and deleting a timeline entry (tap entry → Edit / Delete; delete asks twice). Editing keeps the original note (`raw_text`). Still not included: deleting tanks.

## Offline mode

- **Reading**: `useFocusQuery(load, cache)` shows the cached copy at once (`lib/cache.ts`), refreshes from Supabase, and writes successful results back. When the refresh fails, the cached data stays on screen and `CachedNote` says when it was saved.
  - Tanks and timelines are cached per user. Cache adapters must be memoized (`useMemo`).
  - Whenever the app is online (on start, when the connection returns, on foreground), `OutboxProvider` uploads the queue and then runs `refreshOfflineCopy()`. That's two requests, which save **every** tank's timeline, not just the ones opened (`saveOfflineCopy` in `lib/cache.ts`).
- **Speech:** Android's on-device recognizer often ends a session with `ERROR_CLIENT`. After words were recognised, that counts as a normal end (`useSpeechToText`).
- **Writing new entries**: `useOutbox().saveEntry()` → `lib/sync.ts` `saveOrQueue()`.
  - Online, it saves directly. Offline, or on a network error, the entry goes into the outbox (`lib/outbox.ts`, localStorage, per user) and shows on the timeline as "waiting to upload".
  - `OutboxProvider` (in `app/(app)/_layout.tsx`) uploads when the connection returns, when the app comes to the foreground, and on "Upload now".
  - Each queued entry carries its own UUID and recording time. The upload sends them as `id` / `created_at`, so retries are idempotent: `23505` means "already uploaded". The timeline also keeps the moment the entry was recorded.
  - Losing the connection or an expired login pauses the upload. Any other error flags only that entry, which the user can retry or delete.
- **Only new entries** work offline. Creating or editing tanks and editing or deleting saved entries need internet, and show the "No internet" error.
- **Session**: offline with an expired access token, supabase-js reports no session but keeps the login. `useSession` then restores the user from the saved login (`getStoredUser`, `offline: true`), and supabase-js refreshes the token once online.
- **Sign-out** clears the cache. Queued entries stay and upload at the next sign-in of the same account on that phone, and the sign-out dialog warns about them.
- All Supabase requests time out after 15 s (`lib/supabase.ts`), so weak signal falls back to cache and outbox instead of hanging.
- Storage goes through `lib/storage.ts`; tests swap in an in-memory store.

## Entry flow (speech/text → parser → review → save)

- **Speech** (`hooks/useSpeechToText.ts`): the phone's recognizer, English, continuous, with live partial results.
  - It uses on-device recognition when English is installed (works offline), otherwise Google's online recognition, and offers "Download English for offline".
  - It is primed with tank names and wine terms (`contextualStrings`).
  - Tap to start / tap to stop, with a 2-minute limit; it stops when the app is backgrounded.
  - Mic permission states: granted / denied / blocked. When blocked, only Settings can fix it.
  - When it stops, the transcript fills the note and opens review.
- **Parser** (`lib/parser/index.ts` `parseNote()`, synchronous, on the phone):
  - `normalize.ts` rewrites spoken forms ("twenty grams per hectoliter of sulfur dioxide" → "20 g/hl of SO2", "p h three point four five" → "pH 3.45", "bricks" → "brix").
  - Then `rules.ts` extracts the tank, lab values, temperature, additions and transfers, and picks the entry type.
  - The result is validated with the zod schema in `schema.ts`, the same shape stored in `entries.parsed`.
  - `transcript` / `raw_text` is always the note exactly as spoken or typed.
- **To improve recognition of a new phrasing**, add a case to `tests/normalize.test.cjs` or `tests/parser.test.cjs` first, then adjust `normalize.ts` / `rules.ts`.
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

- `expo-speech-recognition` is loaded with `requireOptionalNativeModule` in `hooks/useSpeechToText.ts`. Only its types are imported, because importing the package directly crashes Expo Go.
- `@expo/ngrok` is a local devDependency. Expo CLI fails to find a globally installed copy on Windows ("Install @expo/ngrok@^4.1.0 and try again").
- If `expo start` prints "Networking has been disabled", one request to api.expo.dev failed at startup and the CLI stays offline (no tunnel) for that run. Just restart it.
- `react-dom` is pinned to the same version as `react` (19.2.3). `expo-router` pulls in `react-dom` as a peer, and without the pin npm installs a newer one that conflicts with `react`.
