# EnoLog

A winemaker's cellar log. The user speaks or types a short note ("Tank 12, added 20 g/hl SO2, temp 22°C"). The phone turns speech into text and a rule-based parser turns the text into structured data, all on the device: no n8n, no AI service. The user confirms or corrects it, and it is saved as an entry on that tank.

Stack: Expo SDK 57 (React Native 0.86), TypeScript (strict), Expo Router, Supabase (Postgres + email/password auth), expo-speech-recognition (the phone's own speech recognizer), EAS Build (development build).

## Name

The app is called **EnoLog** (Play Store title "EnoLog: Winery Notes"; it was CellarLog until 21 Oct 2026). What deliberately kept the old name, because changing it would break something installed or linked:
- the web address **cellarlog.vercel.app** (rename the Vercel project in its dashboard to get another; then update `lib/links.ts`, `public/privacy.html`, `docs/play-store/listing.md` and the GitHub "About" website),
- the GitHub repo name, the EAS slug `cellarlog` (the EAS project is matched by it), and the Supabase project name,
- the development and preview Android ids `com.cellarlog.app.dev` / `.preview` and the schemes `cellarlog*` (they are installed on the phone with their own signing keys),
- the storage keys `cellarlog:v1:…` and the reminder ids `cellarlog-reminder:…` (renaming them would orphan the saved copy and the queued changes on every phone).
The **production** id is `com.enolog.app` (not uploaded to Play yet, so it could still change).

## Commands

```bash
npm install                 # install dependencies
npx expo start --clear      # dev server (Metro); the EnoLog dev build loads the app from it
npm run phone               # then: connect the phone over USB (adb reverse) and open the dev build on Metro
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

Speech recognition is a native module that Expo Go doesn't include, so EnoLog runs as its own **development build** (`eas.json` profile `development`, Android package `com.cellarlog.app.dev`, name "EnoLog Dev").
- **App ids** (`app.config.ts`): development `com.cellarlog.app.dev`, preview `com.cellarlog.app.preview`, and production (Play Store) `com.cellarlog.app`, which is permanent once uploaded. All three install side by side.
  - Dev builds made before the Play Store setup still carry `com.cellarlog.app`; `npm run phone` accepts either until the Dev app is rebuilt.
- JavaScript/TypeScript changes reload instantly from Metro. No rebuild needed.
- **Rebuild only after native changes**: adding or removing a package with native code, or editing plugins or permissions in `app.json`.
- In Expo Go the app still runs; the voice button is replaced by a "needs the EnoLog app build" note (`SPEECH_AVAILABLE` in `hooks/useSpeechToText.ts`).
- Metro picks up newly installed packages only after a restart (`npx expo start --clear`).
- **Connecting the phone**: the dev network isolates devices (no LAN, ngrok unreliable), so the phone reaches Metro over USB.
  - `npm run phone` (`scripts/phone.mjs`) checks Metro and the phone, waits for "Allow USB debugging", runs `adb reverse tcp:8081 tcp:8081`, and reopens the dev build on `http://127.0.0.1:8081`.
  - Re-run it after replugging the cable or restarting the PC.
  - adb is in `%LOCALAPPDATA%\Android\Sdk\platform-tools`, the standard SDK path that Expo CLI's `a` key also uses.
  - Start Metro **without** `--localhost`: that binds IPv6 only, and adb's forward is IPv4.

## Preview build (standalone, for the cellar)

`npx eas-cli@latest build --profile preview --platform android` builds an APK with its own code inside: no PC, cable or Metro needed.
- `app.config.ts` gives it its own package id `com.cellarlog.app.preview` and scheme `cellarlog-preview`, so it installs **next to** the development build.
- The Supabase URL and publishable key for it come from **EAS environment variables** (environment `preview`), because `.env` is never uploaded. Change them with `npx eas-cli@latest env:set --environment preview ...`.
- Code changes reach the preview app only through a new preview build.

## Google Play (production)

- **Store material:** `docs/play-store/` has the listing texts (English and Georgian), the Data safety and content-rating answers, the release steps, `icon-512.png` and `feature-graphic.png`.
- **Build:** `npx eas-cli@latest build --profile production --platform android` makes an `.aab`, with EAS-managed signing and `autoIncrement` versionCode.
  - It needs the Supabase variables in the EAS environment `production`.
- **Privacy policy:** `public/privacy.html`, static and bilingual, served at https://cellarlog.vercel.app/privacy. The app links to it from sign-in and Account (`lib/links.ts`).
- **Account deletion** (Google requires it): Account screen (`app/(app)/account.tsx`) → `deleteAccount()` in `lib/auth.ts` → RPC `delete_my_account()` (migration `20261009120000_delete_my_account.sql`).
  - The RPC is a security-definer function that deletes only `auth.uid()`'s login; tanks and entries go by cascade. The phone's outbox is cleared, then the user is signed out locally.
  - **Warning:** in a shared Supabase project, every other table with a cascading foreign key to `auth.users` loses that user's rows too.

## Web version (browser)

The same app runs in a browser (`react-native-web`, `web.output` "single" = single-page app). It's live at **https://cellarlog.vercel.app**, the Vercel project `cellarlog` on account menognishviligiorgi-7173.
- `npm run build:web` exports to `dist/` (gitignored).
  - Test the real build locally with `npx expo serve --port 8090` (`.claude/launch.json` "web-build").
- `npm run deploy:web` (`vercel deploy --prod`) uploads the source and Vercel builds it with `vercel.json` (`expo export -p web` → `dist`, every path rewritten to `/`).
  - `.vercelignore` keeps `.env`, `node_modules` and the native folders out of the upload.
- **Environment:** the Supabase URL and publishable key come from the Vercel project's environment variables (Production). They're public by design.
  - Change them with `npx vercel@latest env`, then redeploy.
- **Automatic deploys:** the Vercel project is connected to `Meno-G/cellarlog`.
  - Every push to `main` builds and deploys production. Other branches get preview URLs.
  - `npm run deploy:web` still deploys straight from this folder.
- **Dialogs:** React Native's `Alert` does nothing on the web. Always use `useDialog()` (`hooks/useDialog.tsx`): on Android it calls `Alert.alert`, and in the browser it draws its own modal. Never call `Alert.alert` directly.
- **Storage:** `expo-sqlite/localStorage/install` is a no-op on the web, so the browser's own localStorage holds the login, cache and outbox (offline works per browser).
- **No voice in the browser:** the speech module is native only (`SPEECH_AVAILABLE` false). The record tab shows `voiceInApp` and points to typing and the Analysis tab.
- **Layout:** `Screen` / `HeroBand` keep content in a centred column (max 720 px) on wide windows. There's no effect on phones.

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
- **Buttons:** `Button`'s `onPress` may return a promise; repeat taps are ignored until it settles, so a double tap can't save twice. Pass the async handler (`onPress={handleSave}`) rather than wrapping it in `void`.
- **Large touch targets:** at least `touch.minHeight` (56 pt) for anything tappable; the record button is `touch.recordButton`. Body text is at least 18 pt. People use the app with wet or gloved hands.
- **Dark mode:** never hard-code colors in components; use `useTheme().colors`. Add new colors to both palettes in `theme/colors.ts`.
  - Section headings on the page use `colors.heading`, not `colors.header`: `header` is the band's background and is near-black in the dark palette.
- **Design: wine-cellar premium.** The mockups are at https://claude.ai/artifact/4aDtWqAJBUweKYw3iju42D.
  - **Colours:** cellar-burgundy header band (`colors.header`), Saperavi primary, barrel-gold accent (rings and marks only, never body text), parchment ground, plus a "dim cellar" dark palette.
  - **Type:** `AppText` variants `display` / `heading` / `title` use Cormorant Garamond. `body` / `label` / `caption` use Source Sans 3. `quote` (serif italic) is for what the user said.
  - Use `fonts.*` family names rather than `fontWeight`: each weight is its own family on Android. Import fonts per weight (`@expo-google-fonts/<family>/<weight>`), never the package root, which would bundle every weight.
  - **Icons:** `components/Icon` (MaterialCommunityIcons, decorative only). `EntryTypeIcon` / `ENTRY_TYPE_ICONS` map each entry type to its icon.
  - **Layout:** `Screen`'s `hero` prop + `HeroBand` continue the burgundy header band down the screen. The status bar is always light.
  - **App icon / splash:** made from the canvas's glass mark, rendered to `assets/*.png` (1024 px; Android foreground in the inner 50%). The splash is set in the `expo-splash-screen` plugin. Both appear only after a new native build.
- **Imports:** use the `@/` alias (maps to the repo root) in app code; inside `lib/` use relative imports, so `npm test` can compile it.
- **Navigation:** typed routes are on. Use object hrefs for dynamic routes: `router.push({ pathname: '/tanks/[id]', params: { id } })`.
- **Secrets:** only in `.env` (gitignored). Every variable must be listed in `.env.example`. Anything prefixed `EXPO_PUBLIC_` ends up in the app bundle, so never put private server secrets there.
- **Scope:** build only what the plan covers. No extra features without asking.
  Build order: (1) setup + navigation, (2) Supabase + auth, (3) tanks CRUD, (4) text entry + review, (5) voice, (6) on-device speech recognition + rule-based parser (replaced the planned n8n integration at the user's request), (7) offline mode: tanks/timelines viewable from the last sync, and new entries queued on the phone, then synced when back online.
  All 7 steps are built. Added on request: editing and deleting a timeline entry (tap entry → Edit / Delete; delete asks twice). Editing keeps the original note (`raw_text`).
  Also added on request: deleting a tank (Edit tank → Delete tank, asked twice, showing how many entries go with it). The database deletes its entries via ON DELETE CASCADE.

## Languages (English / Georgian)

- Every text is in `lib/i18n/en.ts` (source of truth) and `lib/i18n/ka.ts`, typed `Strings`: a missing Georgian text is a type error, and `tests/i18n.test.cjs` checks the shape too.
- **Adding or changing text:** put it in both files. Never hard-code a visible string in a screen or component.
- **In components**, use `useT()` / `useLanguage()` (`hooks/useLanguage.ts`, `useSyncExternalStore`). Every component that shows text must call it, so a switch re-renders it.
- **In `lib/`**, messages come from `strings().messages` at the moment they're created, so `AppError.message` is already in the current language.
- **Language state:** `lib/i18n/index.ts` (`getLang` / `setLang` / `chooseLang`).
  - It's saved per phone (`cellarlog:v1:language`). On first start the phone's language decides (`loadLang`, called in `app/_layout.tsx`).
- **The switch** is `components/LanguageSwitch.tsx` (EN | KA), in the header of the tanks screen and the sign-in band.
- **Georgian wording:** "tank" is **ცისტერნა**, and the address is formal (თქვენ). Nouns stay singular after numbers ("5 ცისტერნა").
- **Data stays English:** stored value names ("TA", "Free SO2") and units ("g/L") don't change.
  - `itemName()` / `unitName()` (and `formatItemValue`) show them in Georgian (`items` / `units` maps in ka.ts).
- **Dates:** `lib/format.ts` uses the language's words and Georgian month abbreviations (`time.months`).
- **Fonts:** Cormorant and Source Sans have no Georgian letters.
  - In Georgian, `AppText` maps each family to Noto Serif / Noto Sans Georgian (`georgianFamily`). It scales serif sizes by 0.8 and keeps line height at least 1.35×.
  - `TextField` and the Analysis inputs do the same. Pass `lang="en"` for Latin-only labels ("EnoLog", "EN").
- **Voice and typed notes are English only** (the user's decision: Georgian speech recognition isn't reliable enough). In Georgian, the record tab says so and points to the Analysis tab.
  - `tankKey` understands "ცისტერნა 12" / "ც12", so an English "tank 12" finds a Georgian-named tank.

## Offline mode

- **Reading**: `useFocusQuery(load, cache)` shows the cached copy at once (`lib/cache.ts`), refreshes from Supabase, and writes successful results back. When the refresh fails, the cached data stays on screen and `CachedNote` says when it was saved.
  - Tanks and timelines are cached per user. Cache adapters must be memoized (`useMemo`).
  - Whenever the app is online (on start, when the connection returns, on foreground), `OutboxProvider` uploads the queue and then runs `refreshOfflineCopy()`. That's four requests (tanks, entries, ferments, alert rules), which save **every** tank's timeline and ferments, not just the ones opened (`saveOfflineCopy` in `lib/cache.ts`).
- **Speech:** Android's on-device recognizer often ends a session with `ERROR_CLIENT`. After words were recognised, that counts as a normal end (`useSpeechToText`).
- **Writing new entries**: `useOutbox().saveEntry()` → `lib/sync.ts` `saveOrQueue()`.
  - Online, it saves directly. Offline, or on a network error, the entry goes into the outbox (`lib/outbox.ts`, localStorage, per user) and shows on the timeline as "waiting to upload".
  - `OutboxProvider` (in `app/(app)/_layout.tsx`) uploads when the connection returns, when the app comes to the foreground, and on "Upload now".
  - Each queued entry carries its own UUID and recording time. The upload sends them as `id` / `created_at`, so retries are idempotent: `23505` means "already uploaded". The timeline also keeps the moment the entry was recorded.
  - Losing the connection or an expired login pauses the upload. Any other error flags only that entry, which the user can retry or delete.
- **Tanks offline**: the outbox holds nine kinds of change: `entry`, `entry-update`, `entry-delete`, `tank-create`, `tank-update`, `tank-delete`, `ferment-save`, `ferment-delete` and `rule-save` (`lib/outbox.ts`).
  - A tank created offline gets its database id on the phone, so entries queued for it already point at the right tank. Upload is oldest first: the tank goes before its entries.
  - Entries and edits for a tank that hasn't been created on the server yet *wait*; they are not marked failed.
  - Editing a tank that is still waiting to be created changes the queued tank. A second edit of the same tank replaces the first.
  - `lib/tankOverlay.ts` shows queued tank changes on top of the server or cached list (`useTanks` / `useTank`), and checks duplicate names on the phone (`findDuplicateName`).
  - When `23505` comes back on a tank insert, `tanks_pkey` means "already uploaded" and `tanks_user_name_key` means a real name clash. A clash is marked failed, and the user fixes it with Edit.
  - Old outbox items without `kind` load as entries. Items are parsed one by one, so a bad item can't hide the rest.
  - **Deleting a tank** (`deleteTankOrQueue`): a tank that never uploaded is discarded with its queued entries.
    - A server tank is deleted now, or queued as `tank-delete`. Either way, queued changes for it are dropped and it leaves the saved copy (`removeTankFromCache`).
    - The overlay hides a pending delete at once. A delete that failed for good shows the tank again, marked "Couldn't delete".
    - `deleteTank` is idempotent: 0 rows means already gone.
- **Editing and deleting entries** works offline too (`useOutbox().updateEntry / deleteEntry` → `updateEntryOrQueue` / `deleteEntryOrQueue`).
  - The outbox has `entry-update` and `entry-delete` items. An edit of an entry that never uploaded changes the queued entry; deleting it just removes it. A second edit replaces the first.
  - While changes to an entry are still queued, new ones queue behind them (`hasQueuedEntryChanges`), even online, so they upload in order.
  - `lib/entryOverlay.ts` (`applyEntryChanges`, `applyChangesToEntry`) shows queued changes on the timeline, on tank cards and in the edit screen.
  - Edit opens offline from the saved timeline (`useEntry(id, tankId)`, `entryCache`).
  - Deleting an entry that's already gone counts as done (`deleteEntryIfThere`).
  - Timeline menus differ per state (Android dialogs hold at most 3 buttons): Edit / Delete; a failed edit offers Undo edit / Edit / Try again; a failed delete offers Keep entry / Try again.
- **Session**: offline with an expired access token, supabase-js reports no session but keeps the login. `useSession` then restores the user from the saved login (`getStoredUser`, `offline: true`), and supabase-js refreshes the token once online.
- **Sign-out** clears the cache. Queued entries stay and upload at the next sign-in of the same account on that phone, and the sign-out dialog warns about them.
- All Supabase requests time out after 15 s (`lib/supabase.ts`), so weak signal falls back to cache and outbox instead of hanging.
- Storage goes through `lib/storage.ts`; tests swap in an in-memory store.
- **How much is kept offline:** the last **1000 entries per tank** (`TIMELINE_LIMIT`, also what the timeline shows) and at most **10 000 across all tanks** (`listRecentEntries` reads them page by page, because Supabase answers 1000 rows per request). Older entries need a connection. Saving is best effort: a full store (the browser's localStorage is about 5 MB) leaves that tank's older copy.

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
- **Analysis tab** (New entry → "Analysis", `components/AnalysisFormView.tsx`): one labelled field per analysis, no parser and no review step.
  - The fields are `ANALYSIS_FIELDS` in `lib/analysisForm.ts`: Free/Total SO2, temperature, pH, TA, VA, alcohol, Brix, residual sugar, density, volume (L/hL).
  - Item names match the parser's ("TA", "Free SO2"), so typed and spoken values line up.
  - "Add field" adds a row where the user types name, value and unit (`ValueRowEditor`, shared with the review screen).
  - Empty fields are skipped; a trailing unit ("13%") is accepted. Saved as `lab_analysis` (or `temperature` if that's the only value).
  - `raw_text` is just the typed note (may be empty). It saves through the same outbox as notes, so it works offline.
  - **Editing**: `lab_analysis` and `temperature` entries open in this form (`editsAsAnalysis`, `analysisFormFromSaved`).
    - A value whose name or unit doesn't fit a field (ppm, °F, a second pH) becomes an added field, so nothing is lost.
    - A spoken entry keeps its transcript as `raw_text`.
- **Tank list**: each card shows up to three latest readings (`cardReadings`: temperature, Brix, density, free SO2…) from the saved timelines plus queued changes (`useTankSummaries`), so it works offline.
  - **Delete several or all** (tanks screen): above the list, **Select** turns on selection mode (a checkbox on each card, "Select all", "Delete selected (N)" in the footer) and **Delete all** deletes every tank. Both ask twice (the names, then "Delete for good?") because the entries, ferments and alert rules go with the tanks. Each tank is deleted through `outbox.deleteTank` at the same time (offline they disappear at once and the deletions upload later); a failure is reported with how many failed.
  - A search box ("Find a tank") appears from 6 tanks (`searchTanks`: name incl. "t12", grape, vintage; every word must match).
- **Value history** (`app/(app)/tanks/[id]/history.tsx`, opened by tapping a latest value): every reading of that value with latest / change / lowest / highest and a bar chart (`HistoryChart`, plain Views, no chart library).
  - `valueHistory` uses the same "what counts as a reading" rule as latest values. It compares only the most common unit; others (°F among °C, text) are counted and mentioned.
- **Latest values** (tank screen, `lib/latestValues.ts`): the newest reading of each value across the timeline, including entries waiting to upload.
  - Analysis entries count in full.
  - Other entries count only real readings: temperature, pH, Free/Total SO2… A bare "SO2" in an addition is an amount added, and "Volume" in a transfer is volume moved, so they don't count.

## Vessels and ferments (fermentation tracking)

- **Capacity and wine in it:** `volumeLiters` is the vessel's **capacity** (10 t tank); `contentLiters` is the **wine in it now** (5 t), optional (null = not recorded, as for every vessel made before migration `20261019120000_tank_content_liters.sql`). The tank form checks that the wine doesn't exceed the capacity; the card, tank screen and report show "5 000 / 10 000 L" (`formatFill`). Old saved copies and queued tanks read as null (`.nullable().catch(null)`).
- **Blends:** a vessel's wine is its `variety` and `vintage`, or, for a blend, `blend` (migration `20261019130000_tank_blend.sql`): a list of parts `{variety, vintage, liters}` (`lib/blend.ts`, pure, tested). For a blend `variety` holds the grapes joined by " + " and `vintage` the shared year (null when the parts differ). `describeWine` is the text shown everywhere (card, tank screen, report): "Saperavi 2025 (60%) + Ojaleshi 2024 (40%)", with shares only when every part's liters are known. The tank form has a **Blend** section (rows of grape, vintage, liters; at least two parts): with two or more parts the parts decide `variety` / `vintage` (`summary`), with none the vessel is one wine.
- **Vessel type:** every tank has a `kind`: tank, qvevri (ქვევრი) or barrel (კასრი) (`lib/vesselKinds.ts`, picked in the tank form). The tank card names the type unless it's a plain tank. Old saved copies and queued tanks without `kind` read as "tank" (`.catch('tank')` in the zod schemas).
- **Ferment** = a vessel plus a start date and an optional end date (`ferments` table, migration `20261016120000_vessel_kinds_and_ferments.sql`). **Entries belong to a ferment by date**: the ones recorded on that vessel between start and end (no link column). So past ferments can be added later, and old entries fall into them.
  - Two ferments in one vessel can't overlap (`validateFermentForm`), and a running one (no end) blocks a new one until it's ended.
  - The end date includes its whole day (end of the local day).
- **Pure logic:** `lib/fermentCurves.ts` (active ferment, day counting, entries in a ferment, `fermentCurves`, `compareAtDay`) and `lib/fermentForm.ts`. Data access: `lib/ferments.ts`.
  - A curve is one value (Density or Temperature) against **days since that ferment's start**, so ferments of different years line up. Only the most common unit is drawn; the rest is counted as skipped. "What counts as a reading" is `isReading` from `lib/latestValues.ts`.
- **Any value can be charted:** the chart screen (`curve.tsx`) has a **drop-down list** (`components/Dropdown.tsx`: a field that opens a sheet of large rows) of every value that has numbers in some ferment (`chartableMeasures`: Density and Brix first, then temperature, alcohol, residual sugar, VA, pH, TA, SO2, then any others; each with its reading count). It opens on the first one.
- **Screens:** the tank screen's `FermentPanel` (running ferment and day, End, Chart, All ferments), `tanks/[id]/ferments.tsx` (list), `ferment-form.tsx` (start/edit/end/delete) and `curve.tsx`.
  - The chart (`components/CurveChart.tsx`) draws with plain Views and rotated Views for lines, with no chart library and no native module. It estimates its width from the window until measured, because a hidden browser pane never delivers layout events.
  - Below the chart, "On day N" puts this ferment's newest reading beside each earlier ferment's reading within a day of it.
- **Offline:** ferments are read from the saved copy (`fermentsCache`, saved by `refreshOfflineCopy`), so the panel, list and chart work offline. **Starting, editing, ending and deleting a ferment work offline too** (`useOutbox().saveFerment / deleteFerment` → `saveFermentOrQueue` / `deleteFermentOrQueue`): the outbox keeps one `ferment-save` per ferment (the id is chosen on the phone, `isNew` while it isn't on the server; a second change replaces the first) and a `ferment-delete`; a ferment of a vessel that is still waiting to be created waits for it. `lib/fermentOverlay.ts` (`applyFermentChanges`) shows the queued changes on the panel, list, chart, tank cards and reminders (`useFerments`, `useTankSummaries`, `useReminders`). Upload: `createFerment` with the id; the same id already there means update.
- **"My decision"** is a new entry type (`decision`): what the winemaker decided (re-tested, cooled), kept apart from measurements. It's in the type picker and counts as a plain note, not as a reading.
- **Typed routes:** after adding a screen, `tsc` complains until `.expo/types/router.d.ts` is regenerated. Starting `npx expo start` once rewrites it.

## Transferring wine between vessels

- **Tank screen → "Transfer wine"** (`tanks/[id]/transfer.tsx`): pick the receiving vessel, optionally the liters and a note.
- `lib/transfer.ts` (pure, tested): `planTransfer` builds **one `transfer` entry in each vessel**. The source's has items `Destination` (the other vessel's name) and `Volume` (L); the receiver's has `Source` and `Volume`. The note is saved on both. `receive` updates the receiving vessel (wine in it + the liters moved; with the toggle on, the wine is recorded in it: an empty vessel takes the source's grape and vintage, a vessel that already holds wine becomes a **blend** of the two, `mergeParts`; the screen previews the result); `sendOut` updates the source (wine in it − liters moved). The **source keeps its grape and vintage** (same wine) unless it is now empty (then 0 L, no grape, no vintage). A transfer must fit: no more than the source holds, no more than the receiver has room for (a vessel with nothing recorded and no grape counts as empty, `contentBefore`; unknown content is not checked or changed).
- Optional steps on the same screen: **end the running ferment** (`outbox.saveFerment`, queues offline) **give the receiver the same grape and vintage**, and **"Is the source now empty?"** (`outbox.updateTank`, queues offline like any tank edit). When it is empty the user chooses **Delete the vessel** (default; a dialog first says how many entries go with it; its own transfer entry and ferment are not kept, the receiver's entry stays; `outbox.deleteTank`, then back to the list) or **Keep it empty**. The follow-up steps run at the same time (`Promise.allSettled`) and a line under the button says which step is running.
- **Empty detection** (`litersLeft` / `isEmptyLeft`): with the wine in it recorded, simply what it holds − liters now moving. Without it: capacity − liters already moved out since the vessel was last filled (the later of its newest incoming transfer or its latest ferment start) − liters now moving. At 1 L or less the question defaults to Yes (e.g. 3 t then 2 t out of 5 t); the user can always answer. Unknown liters never suggest it. It assumes the vessel's volume is what it held.
- The entries go through `outbox.saveEntry`, so the transfer itself works offline. A step that fails afterwards (e.g. offline when ending the ferment) is reported in a dialog; the entries are not undone. A ref remembers which entry was already saved, so retrying never duplicates one.
- **Into a vessel that doesn't exist yet:** the destination list ends with **"+ New vessel"** (the only choice when there is no other vessel). It asks for a name, a type and a **required capacity** (it follows the liters moved until typed by hand; it can't be smaller than the wine moved). The wine moved becomes the wine in it, with the same checks as the tank form plus no duplicate name (`NEW_TANK` in `lib/transfer.ts`).
  - On save the vessel is created first (`outbox.createTank`, which queues offline), then both entries (the receiver's `tankId` is filled in with the new id; entries for a not-yet-uploaded tank wait for it).
  - If the grape is given, the new vessel is **created with** the source's grape and vintage; the source is emptied only when it is now empty.
  - A ref keeps the created id and which entries were saved, so a retry after a failure never makes a second vessel or entry.
- **The wine's history follows it:** `entriesToCarry` takes the source's entries since it was last filled (newest incoming transfer or latest ferment start), without transfers, and copies them into the receiving vessel with their **original times** (`saveEntry(entry, { createdAt })`), so its latest values, history and exports show them. `parsed.tank_name` keeps the source's name. Default Yes for a new or empty receiver, No when it already holds other wine (the user can choose). Copies are made before the source is deleted; a ref remembers which were saved, so a retry never duplicates. Only the loaded timeline (the last 1000 entries) is copied. **The ferment is copied too** (`fermentToCarry`: the source's latest ferment, unless wine came in after it began; `carriedFerment`: same name and start, running unless this transfer ends it; skipped with a message when it would overlap a ferment already in the receiver, `fermentFits`), so the receiving vessel's chart continues.
- There is no stored link between the two vessels: the two entries name each other by name.

## SO2 calculator and fill level

- **Tank screen → "SO2 calculator"** (`tanks/[id]/so2.tsx`, pure logic in `lib/so2.ts`, tested): from the pH, the free SO2 and a target molecular SO2 it shows the molecular SO2 now, the free SO2 needed, what to add (mg/L and g/hL) and the grams of KMBS for the volume. pH, free SO2 and the volume start from the tank's latest readings and the wine in it, and every field can be changed. Molecular share = 1 / (1 + 10^(pH − 1.81)); KMBS is taken as 57% SO2. The target (default 0.8, often cited range 0.5–0.8) is the winemaker's choice; the screen states it is a calculation only and bound SO2 changes the real result. Never turn it into a recommendation.
- **Fill level:** a tank card shows a bar of wine in it / capacity when the wine in it is recorded (`TankCard`).

## Lineage and potential alcohol

- **Tank screen → "Where this wine came from"** (`tanks/[id]/lineage.tsx`, `lib/lineage.ts`, pure, tested): follows the transfer entries the vessels keep about each other (`Source` / `Destination` items) back through the vessels (up to 4 steps, each step only before the one after it, so it can't loop) and lists where wine went. Vessels are matched **by name** using every vessel's saved timeline, so a deleted or renamed vessel ends the chain.
- **Potential alcohol** (`lib/alcohol.ts`, pure, tested): on the history screen of Brix or Density, the first reading gives an estimated range of % vol (0.55–0.60 per °Brix; density is converted with a cubic fit). It is an estimate and says so.

## Measurement reminders (local notifications)

- **Tank screen → "Measurement reminder"** (`components/ReminderPanel.tsx`, shown only while the vessel has a running ferment and only where notifications exist): Off / every 6 / 12 / 24 / 48 h. The setting is kept **on the phone** per user (`lib/reminders.ts`, localStorage), not in the database. Turning one on asks for the notification permission once; if refused, a banner says to allow it in the phone settings.
- **Planning** (`planReminders`, `reminderTimes`, `lastMeasuredAt`, `daytime`: pure, tested): the next 6 reminders, every N hours counted from the **last reading** recorded since the ferment started (a note is not a reading), only ahead of now, and never at night (before 7:00 or from 21:00 they move to 7:00). `hooks/useReminders.ts` `useReminderSync` (mounted in `app/(app)/_layout.tsx`) plans again from the saved copy plus queued entries whenever the app starts, comes to the foreground, an entry is saved or a setting changes, so it works offline and a new reading pushes the next reminder back.
- **Scheduling** (`lib/notifications.ts`): `expo-notifications` local notifications (DATE triggers, Android channel `reminders`), with the monochrome icon set in the plugin in `app.json`. It is loaded with a guarded `require`, so a build without the native module (older builds) and the browser simply show no reminder panel and nothing breaks. **Needs a new native build**; there is no remote push and no server.

## Alert rules

- **Two rules per vessel, set by the winemaker** (`alert_rules` table, migration `20261017120000_alert_rules.sql`, one row per kind per vessel):
  - `density_stall`: the density must fall by at least `minDrop` within `hours`; at or below `dryBelow` the ferment counts as finished (no alert).
  - `temperature_range`: the newest temperature must be within `minC`..`maxC` (°C only; other units are not guessed).
- **Checked on the phone** (`lib/alertRules.ts`, `evaluateRules`, pure) against the **running ferment's** readings, from the saved copy plus changes waiting to upload, so alerts work offline. No running ferment: nothing is checked. Rules start switched off; defaults are labelled as defaults, not winemaking advice (`densityDefaults` follows the user's density scale: 1.060 or 1060).
- **Density comparison:** the newest reading is compared with the newest reading that is at least `hours` old. No such reading ("too-early") or nothing newer ("no-new-reading") is reported as "cannot check yet", never as an alert.
- **Wording:** an alert says only what was **observed** and which **rule** tripped. Never a diagnosis or advice. A "Record my decision" button opens a new entry (type "My decision").
- **UI:** `AlertPanel` on the tank screen, a badge on the tank card (`useTankSummaries`), and the rules screen `tanks/[id]/alerts.tsx`. Saving rules works offline too (`useOutbox().saveRule` → `saveRuleOrQueue`): one queued `rule-save` per kind per vessel (the newest wins; it waits for a vessel that isn't uploaded yet), shown at once by `lib/ruleOverlay.ts` (`applyRuleChanges`) in `useRules` and on the tank cards; upload is the same upsert. Reading works offline (`rulesCache`).
- **Alerts are not pushed** (a rule is only checked when the app is open). The phone does send **measurement reminders** (next section).
- **Numbers:** `parseNumber` reads "0,003" as a decimal (a comma after a leading 0 is never a thousands separator).

## Exports (CSV and PDF report)

- **Tank screen → "Export data (CSV)"** exports the vessel's timeline (with changes still waiting to upload). If the vessel has ferments, a dialog offers the whole vessel or its running (else newest) ferment.
- `lib/exportCsv.ts` (pure, tested): one row per measured value (long format) with vessel, type, ferment name, day of the ferment, local and UTC time, entry type, name, value, unit, note and what was said. Headers are always English. An entry without values (tasting, note, decision) is one row.
  - Text starting with = + - @ gets a leading apostrophe (spreadsheet formula injection); numbers are written bare. Delimiter is a comma, decimals use a point.
- `lib/shareFile.ts`: on the **web** it downloads a file (UTF-8 with a byte order mark, so Excel reads Georgian text); on the **phone** it opens the share menu with the CSV as text. That needs no native module (a real file would need expo-file-system and expo-sharing, so a rebuild).
- The ferment name is part of the file name; letters of any script are kept (`csvFilename`).
- **Batch report (PDF)** (tank screen, same whole-vessel / ferment choice): `lib/reportHtml.ts` (pure, tested) builds one HTML page: facts, latest value of each measurement, and every entry oldest first with the day of the ferment. Everything typed is HTML-escaped. It restates records only, with no judgement or advice.
  - **Phone:** `expo-print` makes an A4 PDF file and `expo-sharing` opens the share menu. **These are native modules: they need a new build** (the web works without).
  - **Web:** `expo-print` can only print the *current page* there, so `lib/shareFile.ts` prints the report through a hidden iframe (the browser's print dialog: "Save as PDF").

## Georgian voice test

- **Account → "Georgian voice test"** (`app/(app)/voice-test.tsx`): the winemaker reads 30 cellar sentences in Georgian and the phone's recognizer (`ka-GE`, online only) is scored. Nothing is saved or sent; the results can be shared as CSV.
- `lib/voiceTest.ts` (pure, tested) holds the sentences and the scoring: word recall (words in order, extra words don't count against it, endings one letter off are accepted), numbers right (digits only; "6,5" or "6 მთელი 5" count as 6.5), whether numbers came as digits or words, and a plain verdict (`verdictOf`: none / words / reliable / mixed / poor).
- `useSpeechToText({ language })` takes a language; anything but English skips the offline English model and its download.
- **Purpose:** decide with data whether Georgian voice notes are worth building (they would also need a Georgian parser). Voice notes themselves stay English-only for now.
- **Result (18 Oct 2026, Samsung Galaxy S25):** Georgian is **not available** in the phone's speech recognition. Both the app (`ka-GE`) and the Gboard microphone returned English words, and Georgian is not in Google's voice-language list. So Georgian voice notes are not possible with the phone's own recognizer. The only route would be a separate cloud speech service (e.g. Google Cloud Speech-to-Text), which costs money, sends audio to a third party and changes the privacy policy. Decision: **voice stays English-only**; the test screen stays for re-testing on other phones or after Google adds Georgian.

## "Record my decision"

An alert's button opens `entries/new` with `decision=1`: it goes straight to the review form with the **My decision** type chosen and the vessel preselected; a note is required.

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
- **Held-back patch updates**: `npx expo install --fix` (expo 57.0.27…) makes `expo-modules-core` want `react-native-worklets` 0.10 while reanimated wants 0.13. The lock file then fails `npm ci` on EAS. So expo-doctor's one version warning is expected until Expo fixes the peer range.
- `react-dom` is pinned to the same version as `react` (19.2.3). `expo-router` pulls in `react-dom` as a peer, and without the pin npm installs a newer one that conflicts with `react`.
