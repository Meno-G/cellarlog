// Last-loaded copies of tanks and timelines, so they stay readable offline.
// Pure apart from the key-value store (see ./storage.ts).
import { z } from 'zod';

import type { Entry } from './entries';
import { ENTRY_TYPES } from './entryTypes';
import { parsedEntrySchema } from './parser/schema';
import { readJson, removeKey, userKey, writeJson } from './storage';
import type { Tank } from './tanks';

export type Cached<T> = { data: T; savedAt: string };

/** What a data hook needs to show cached data first and keep it up to date. */
export type CacheAdapter<T> = {
  read: () => Cached<T> | null;
  write: (data: T) => void;
};

const tankSchema = z.object({
  id: z.string(),
  name: z.string(),
  volumeLiters: z.number(),
  variety: z.string().nullable(),
  vintage: z.number().nullable(),
  createdAt: z.string(),
}) satisfies z.ZodType<Tank>;

const entrySchema = z.object({
  id: z.string(),
  tankId: z.string(),
  type: z.enum(ENTRY_TYPES),
  rawText: z.string(),
  parsed: parsedEntrySchema,
  createdAt: z.string(),
}) satisfies z.ZodType<Entry>;

const cachedTanksSchema = z.object({ data: z.array(tankSchema), savedAt: z.string() });
const cachedEntriesSchema = z.object({ data: z.array(entrySchema), savedAt: z.string() });

const tanksKey = (userId: string) => userKey(userId, 'tanks');
const entriesKey = (userId: string, tankId: string) => userKey(userId, `entries:${tankId}`);

const now = () => new Date().toISOString();

export function tanksCache(userId: string): CacheAdapter<Tank[]> {
  return {
    read: () => readJson(tanksKey(userId), cachedTanksSchema),
    write: (data) => {
      writeJson(tanksKey(userId), { data, savedAt: now() });
    },
  };
}

/** One tank, read from (and written back into) the cached tank list. */
export function tankCache(userId: string, tankId: string): CacheAdapter<Tank> {
  const list = tanksCache(userId);
  return {
    read: () => {
      const cached = list.read();
      const tank = cached?.data.find((candidate) => candidate.id === tankId);
      return cached && tank ? { data: tank, savedAt: cached.savedAt } : null;
    },
    write: (tank) => {
      const cached = list.read();
      if (!cached) return;
      const exists = cached.data.some((candidate) => candidate.id === tank.id);
      const data = exists
        ? cached.data.map((candidate) => (candidate.id === tank.id ? tank : candidate))
        : [...cached.data, tank];
      writeJson(tanksKey(userId), { data, savedAt: cached.savedAt });
    },
  };
}

export function entriesCache(userId: string, tankId: string): CacheAdapter<Entry[]> {
  return {
    read: () => readJson(entriesKey(userId, tankId), cachedEntriesSchema),
    write: (data) => {
      writeJson(entriesKey(userId, tankId), { data, savedAt: now() });
    },
  };
}

/** Removes this user's cached tanks and timelines (on sign out). */
export function clearCache(userId: string): void {
  const tanks = tanksCache(userId).read();
  for (const tank of tanks?.data ?? []) removeKey(entriesKey(userId, tank.id));
  removeKey(tanksKey(userId));
}
