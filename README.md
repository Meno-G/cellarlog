# EnoLog

A winemaker's cellar log for Android (and iOS). Speak or type a note like
"Tank 12, added 20 g/hl SO2, temp 22°C" and EnoLog saves it as a structured
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

5. **Install the EnoLog development build on your phone** (once, and again only after native changes).
   Speech recognition isn't part of Expo Go, so EnoLog runs as its own app:

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

   With the phone plugged in over USB, in a second terminal:

   ```bash
   npm run phone
   ```

   It connects the phone to Metro over the cable and opens EnoLog. Run it again after
   replugging the phone. It needs Android platform-tools (adb) in
   `%LOCALAPPDATA%\Android\Sdk\platform-tools` or `ANDROID_HOME`.

7. **Standalone app for daily use** (no PC needed): `npx eas-cli@latest build --profile preview --platform android`.
   Set the two `EXPO_PUBLIC_SUPABASE_*` values for it first with `npx eas-cli@latest env:set --environment preview`.

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
