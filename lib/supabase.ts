import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { getEnv } from './env';

let client: SupabaseClient<Database> | null = null;

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * With one bar of signal in a cellar, requests can hang for minutes. Give up
 * after 15 s instead, so the app falls back to cached data and the outbox.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/** Where supabase-js keeps the login on the phone (its default key). */
export function sessionStorageKey(): string {
  return `sb-${new URL(getEnv().supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

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
    global: { fetch: fetchWithTimeout },
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
