import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { getEnv } from './env';

let client: SupabaseClient<Database> | null = null;

/**
 * Lazily created so a missing .env shows a readable config error
 * instead of crashing at import time. Throws AppError('config').
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const env = getEnv();
  client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Only refresh tokens while the app is in the foreground.
  const supabase = client;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });

  return client;
}
