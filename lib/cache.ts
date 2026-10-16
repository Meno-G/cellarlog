// Last-loaded copies of tanks and timelines, so they stay readable offline.
// Pure apart from the key-value store (see ./storage.ts).
import { z } from 'zod';

import type { Entry } from './entries';
import type { Ferment } from './ferments';
import { ENTRY_TYPES } from './entryTypes';
import { parsedEntrySchema } from './parser/schema';
import { readJson, removeKey, userKey, writeJson } from './storage';
import type { Tank } from './tanks';
import { VESSEL_KINDS } from './vesselKinds';

export type Cached<T> = { data: T; savedAt: string };

/** What a data hook needs to show cached data first and keep it up to date. */
export type CacheAdapter<T> = {
  read: () => Cached<T> | null;
  write: (data: T) => void;
};

const tankSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Copies saved before vessel kinds existed read as plain tanks.
  kind: z.enum(VESSEL_KINDS).catch('tank'),
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

const fermentSchema = z.object({
  id: z.string(),
  tankId: z.string(),
  name: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
}) satisfies z.ZodType<Ferment>;

const cachedFermentsSchema = z.object({ data: z.array(fermentSchema), savedAt: z.string() });
const cachedTanksSchema = z.object({ data: z.array(tankSchema), savedAt: z.string() });
const cachedEntriesSchema = z.object({ data: z.array(entrySchema), savedAt: z.string() });

const tanksKey = (userId: string) => userKey(userId, 'tanks');
const entriesKey = (userId: string, tankId: string) => userKey(userId, `entries:${tankId}`);
const fermentsKey = (userId: string, tankId: string) => userKey(userId, `ferments:${tankId}`);

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

/** One entry, read from (and written back into) its tank's saved timeline. */
export function entryCache(userId: string, tankId: string, entryId: string): CacheAdapter<Entry> {
  const list = entriesCache(userId, tankId);
  return {
    read: () => {
      const cached = list.read();
      const entry = cached?.data.find((candidate) => candidate.id === entryId);
      return cached && entry ? { data: entry, savedAt: cached.savedAt } : null;
    },
    write: (entry) => {
      const cached = list.read();
      if (!cached || entry.tankId !== tankId) return;
      writeJson(entriesKey(userId, tankId), {
        data: cached.data.map((candidate) => (candidate.id === entry.id ? entry : candidate)),
        savedAt: cached.savedAt,
      });
    },
  };
}

/** One vessel's ferments, newest first. */
export function fermentsCache(userId: string, tankId: string): CacheAdapter<Ferment[]> {
  return {
    read: () => readJson(fermentsKey(userId, tankId), cachedFermentsSchema),
    write: (data) => {
      writeJson(fermentsKey(userId, tankId), { data, savedAt: now() });
    },
  };
}

/**
 * Saves the tank list and every tank's timeline at once, from the user's
 * recent entries (newest first), so all of them open offline, not only the
 * ones visited while online. Tanks with no recent entries get an empty timeline.
 */
export function saveOfflineCopy(
  userId: string,
  tanks: Tank[],
  recentEntries: Entry[],
  perTank: number,
  ferments?: Ferment[],
): void {
  tanksCache(userId).write(tanks);
  const byTank = new Map<string, Entry[]>();
  for (const entry of recentEntries) {
    const list = byTank.get(entry.tankId) ?? [];
    if (list.length < perTank) list.push(entry);
    byTank.set(entry.tankId, list);
  }
  for (const tank of tanks) entriesCache(userId, tank.id).write(byTank.get(tank.id) ?? []);
  if (ferments) {
    for (const tank of tanks) {
      fermentsCache(userId, tank.id).write(ferments.filter((ferment) => ferment.tankId === tank.id));
    }
  }
}

/** Drops a deleted tank and its timeline from the saved copy. */
export function removeTankFromCache(userId: string, tankId: string): void {
  const cached = tanksCache(userId).read();
  if (cached) {
    writeJson(tanksKey(userId), {
      data: cached.data.filter((tank) => tank.id !== tankId),
      savedAt: cached.savedAt,
    });
  }
  removeKey(entriesKey(userId, tankId));
  removeKey(fermentsKey(userId, tankId));
}

/** Drops a deleted entry from its tank's saved timeline. */
export function removeEntryFromCache(userId: string, tankId: string, entryId: string): void {
  const cached = entriesCache(userId, tankId).read();
  if (!cached) return;
  writeJson(entriesKey(userId, tankId), {
    data: cached.data.filter((entry) => entry.id !== entryId),
    savedAt: cached.savedAt,
  });
}

/** Removes this user's cached tanks and timelines (on sign out). */
export function clearCache(userId: string): void {
  const tanks = tanksCache(userId).read();
  for (const tank of tanks?.data ?? []) {
    removeKey(entriesKey(userId, tank.id));
    removeKey(fermentsKey(userId, tank.id));
  }
  removeKey(tanksKey(userId));
}
