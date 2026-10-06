// Small synchronous key-value store for offline data (cache + outbox).
// In the app this is expo-sqlite's localStorage (installed in app/_layout.tsx),
// which persists on the phone. Tests swap in an in-memory store.
import type { z } from 'zod';

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let override: KeyValueStore | null = null;

export function getStore(): KeyValueStore {
  return override ?? localStorage;
}

/** Tests only: replace the store. Pass null to go back to localStorage. */
export function setStoreForTests(store: KeyValueStore | null): void {
  override = store;
}

/** Reads JSON and validates it; anything missing, corrupt or from an older shape reads as null. */
export function readJson<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const text = getStore().getItem(key);
    if (text === null) return null;
    const parsed = schema.safeParse(JSON.parse(text) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Best effort: a full or broken store must never break saving to the server. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    getStore().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    getStore().removeItem(key);
  } catch {
    // ignore
  }
}

/** Every key belongs to one user, so a shared phone never shows someone else's cellar. */
export function userKey(userId: string, name: string): string {
  return `cellarlog:v1:${userId}:${name}`;
}
