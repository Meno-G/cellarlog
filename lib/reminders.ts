// Measurement reminders: while a vessel's ferment is running, a notification on
// this phone when it is time to measure again, counted from the last reading
// recorded. Which vessels have one is kept on the phone (per user). The planning
// is pure; scheduling is in ./notifications.ts.
import { z } from 'zod';

import type { EntryType } from './entryTypes';
import { isReading } from './latestValues';
import type { ParsedItem } from './parser/schema';
import { readJson, userKey, writeJson } from './storage';

/** The intervals offered, in hours. */
export const REMINDER_HOURS = [6, 12, 24, 48] as const;

/** Reminders are not sent at night: earlier than this hour moves to it, from the evening hour on to it next day. */
const MORNING = 7;
const EVENING = 21;
/** How many reminders ahead are scheduled (the app plans again whenever it is opened). */
const AHEAD = 6;
const HOUR = 3_600_000;

const settingsSchema = z.record(z.string(), z.number());
const settingsKey = (userId: string) => userKey(userId, 'reminders');

/** The interval in hours per vessel id; vessels without a reminder are absent. */
export function readReminders(userId: string): Record<string, number> {
  const saved = readJson(settingsKey(userId), settingsSchema) ?? {};
  const valid = (hours: number) => (REMINDER_HOURS as readonly number[]).includes(hours);
  return Object.fromEntries(Object.entries(saved).filter(([, hours]) => valid(hours)));
}

/** Sets (or, with null, removes) a vessel's reminder. */
export function setReminder(userId: string, tankId: string, hours: number | null): void {
  const next = { ...readReminders(userId) };
  if (hours === null) delete next[tankId];
  else next[tankId] = hours;
  writeJson(settingsKey(userId), next);
}

type EntryLike = { type: EntryType; createdAt: string; parsed: { items: readonly ParsedItem[] } };

/** The newest reading recorded since the ferment started, or its start when there is none. */
export function lastMeasuredAt(entries: readonly EntryLike[], fermentStart: string): string {
  let last = fermentStart;
  for (const entry of entries) {
    if (entry.createdAt > last && entry.parsed.items.some((item) => isReading(entry.type, item.name))) last = entry.createdAt;
  }
  return last;
}

/** Moves a time out of the night (local time): before 7:00 to 7:00, from 21:00 to 7:00 next day. */
export function daytime(date: Date): Date {
  const hour = date.getHours();
  if (hour >= MORNING && hour < EVENING) return date;
  const moved = new Date(date);
  if (hour >= EVENING) moved.setDate(moved.getDate() + 1);
  moved.setHours(MORNING, 0, 0, 0);
  return moved;
}

/** The next reminder times: every `everyHours` after the last reading, the ones still ahead of `now`. */
export function reminderTimes(last: string, everyHours: number, now: Date, count: number = AHEAD): Date[] {
  const start = new Date(last).getTime();
  const step = everyHours * HOUR;
  if (!Number.isFinite(start) || step <= 0) return [];
  const times: Date[] = [];
  for (let k = 1; times.length < count && k < 10_000; k++) {
    const due = daytime(new Date(start + k * step));
    // A slot is kept only if it is still ahead, and later than the one before it (the night shift can merge two).
    const previous = times.at(-1);
    if (due.getTime() > now.getTime() + 60_000 && (!previous || due.getTime() > previous.getTime())) times.push(due);
  }
  return times;
}

export type PlannedReminder = { id: string; tankId: string; tankName: string; at: Date };

/** Every reminder to schedule: for each vessel with a reminder and a running ferment. */
export function planReminders(input: {
  settings: Record<string, number>;
  tanks: readonly { id: string; name: string }[];
  /** The running ferment's start for a vessel, if one is running. */
  runningSince: (tankId: string) => string | null;
  timeline: (tankId: string) => readonly EntryLike[];
  now: Date;
}): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const tank of input.tanks) {
    const hours = input.settings[tank.id];
    const since = input.runningSince(tank.id);
    if (hours === undefined || since === null) continue;
    const last = lastMeasuredAt(input.timeline(tank.id), since);
    reminderTimes(last, hours, input.now).forEach((at, index) => {
      planned.push({ id: `cellarlog-reminder:${tank.id}:${index}`, tankId: tank.id, tankName: tank.name, at });
    });
  }
  return planned;
}
