# CellarLog

A winemaker's cellar log for iOS and Android. Speak or type a note like
"Tank 12, added 20 g/hl SO2, temp 22°C" and CellarLog saves it as a structured
entry on that tank.

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

5. **Run**

   ```bash
   npx expo start --clear
   ```

   Scan the QR code with **Expo Go** (same Wi-Fi as your computer), or use
   `npm run start:tunnel` if your phone can't reach your computer.

See [CLAUDE.md](CLAUDE.md) for project conventions and all commands.
