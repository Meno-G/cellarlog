# CellarLog

A winemaker's cellar log for Android (and iOS). Speak or type a note like
"Tank 12, added 20 g/hl SO2, temp 22°C" and CellarLog saves it as a structured
entry on that tank. Speech recognition and parsing run on the phone: no AI
service or extra backend, and voice works offline once English is downloaded.

Built with Expo (React Native), TypeScript, Expo Router and Supabase.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the database.** In your Supabase project, open **SQL Editor -> New query**,
   paste the contents of [`supabase/migrations/20261004120000_init.sql`](supabase/migrations/20261004120000_init.sql)
   and click **Run**.

3. **Configure auth (for testing).** In **Authentication -> Sign In / Providers -> Email**,
   keep Email enabled. Turning **Confirm email** off lets you sign up and sign in right away.

4. **Environment variables.** Copy `.env.example` to `.env` and fill in the
   project URL and publishable key from **Project Settings -> API Keys**.

5. **Install the CellarLog development build on your phone** (once, and again only after native changes).
   Speech recognition isn't part of Expo Go, so CellarLog runs as its own app:

   ```bash
   npx eas-cli@latest login
   ```

   ```bash
   npx eas-cli@latest build --profile development --platform android
   ```

   Open the link from the build on your phone and install the APK.

6. **Run**

   ```bash
   npx expo start --clear
   ```

   Open **CellarLog** on the phone and connect to the dev server (scan the QR code,
   or over USB with `adb reverse tcp:8081 tcp:8081` and `exp+cellarlog://expo-development-client/?url=http://127.0.0.1:8081`).

## Checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

See [CLAUDE.md](CLAUDE.md) for project conventions and all commands.
