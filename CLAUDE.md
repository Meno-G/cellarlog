# CellarLog

A winemaker's cellar log. The user speaks or types a short note ("Tank 12, added 20 g/hl SO2, temp 22°C"), an n8n workflow turns it into structured JSON, the user confirms it, and it is saved as an entry on that tank.

Stack: Expo SDK 57 (React Native 0.86), TypeScript (strict), Expo Router, Supabase (Postgres + email/password auth), expo-audio, n8n webhook for transcription and extraction.

## Commands

```bash
npm install                 # install dependencies
npx expo start              # dev server; scan the QR code with Expo Go
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
- **API logic lives in `lib/`.** Screens never import `supabase` or call `fetch` directly; they use `lib/` functions through `hooks/`.
- **Errors:** `lib/` functions throw a typed `AppError` (kinds: network, permission, server, invalid_response, auth, validation). Screens show `error.message` (already human-readable) and offer a retry.
- **Every async UI has loading, error and empty states.**
- **Large touch targets:** at least `touch.minHeight` (56 pt) for anything tappable; the record button is `touch.recordButton`. Body text is at least 18 pt. People use the app with wet or gloved hands.
- **Dark mode:** never hard-code colors in components; use `useTheme().colors`. Add new colors to both palettes in `theme/colors.ts`.
- **Imports:** use the `@/` alias (maps to the repo root), e.g. `import { Button } from '@/components/Button'`.
- **Navigation:** typed routes are on. Use object hrefs for dynamic routes: `router.push({ pathname: '/tanks/[id]', params: { id } })`.
- **Secrets:** only in `.env` (gitignored). Every variable must be listed in `.env.example`. Anything prefixed `EXPO_PUBLIC_` ends up in the app bundle, so never put private server secrets there.
- **Scope:** build only the MVP described in the plan. No extra features without asking.

## Environment variables

See `.env.example`. After changing `.env`, restart with `npx expo start --clear`.

## Dependency notes

- `react-dom` is pinned to the same version as `react` (19.2.3). `expo-router` pulls in `react-dom` as a peer, and without the pin npm installs a newer one that conflicts with `react`.
