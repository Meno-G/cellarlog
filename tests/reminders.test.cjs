// Measurement reminders: when the next ones fall, and which vessels get them.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../.test-build/storage.js');
const { REMINDER_HOURS, readReminders, setReminder, lastMeasuredAt, daytime, reminderTimes, planReminders } = require('../.test-build/reminders.js');

const memory = new Map();
beforeEach(() => {
  memory.clear();
  storage.setStoreForTests({ getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) });
});

const local = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

test('settings are kept per user and vessel; only the offered intervals count', () => {
  assert.deepEqual(readReminders('u1'), {});
  setReminder('u1', 't1', 24);
  setReminder('u1', 't2', 6);
  assert.deepEqual(readReminders('u1'), { t1: 24, t2: 6 });
  assert.deepEqual(readReminders('u2'), {}, 'another user has none');
  setReminder('u1', 't1', null);
  assert.deepEqual(readReminders('u1'), { t2: 6 });
  memory.set('cellarlog:v1:u1:reminders', JSON.stringify({ t3: 5, t4: 12 }));
  assert.deepEqual(readReminders('u1'), { t4: 12 }, '5 h is not offered');
  assert.deepEqual([...REMINDER_HOURS], [6, 12, 24, 48]);
});

test('night time moves to the morning', () => {
  assert.equal(daytime(local(2026, 10, 20, 12)).getTime(), local(2026, 10, 20, 12).getTime());
  assert.equal(daytime(local(2026, 10, 20, 3)).getTime(), local(2026, 10, 20, 7).getTime());
  assert.equal(daytime(local(2026, 10, 20, 22)).getTime(), local(2026, 10, 21, 7).getTime());
  assert.equal(daytime(local(2026, 10, 20, 21)).getTime(), local(2026, 10, 21, 7).getTime());
});

test('reminder times: every interval after the last reading, only ahead, never at night', () => {
  const last = local(2026, 10, 20, 9).toISOString();
  const times = reminderTimes(last, 24, local(2026, 10, 20, 10), 3);
  assert.deepEqual(times.map((t) => t.getTime()), [local(2026, 10, 21, 9), local(2026, 10, 22, 9), local(2026, 10, 23, 9)].map((t) => t.getTime()));
  // overdue: the slots already past are skipped
  const overdue = reminderTimes(last, 24, local(2026, 10, 22, 12), 2);
  assert.deepEqual(overdue.map((t) => t.getTime()), [local(2026, 10, 23, 9), local(2026, 10, 24, 9)].map((t) => t.getTime()));
  // a 6-hour slot at night moves to the morning, and two slots never land on the same time
  const night = reminderTimes(local(2026, 10, 20, 15).toISOString(), 6, local(2026, 10, 20, 16), 4);
  assert.ok(night.every((t) => t.getHours() >= 7 && t.getHours() < 21));
  assert.equal(new Set(night.map((t) => t.getTime())).size, night.length);
  assert.deepEqual(reminderTimes('garbage', 24, new Date()), []);
});

const reading = (at, type = 'lab_analysis') => ({ type, createdAt: new Date(at).toISOString(), parsed: { items: [{ name: 'Density', value: 1.05, unit: null }] } });
const note = (at) => ({ type: 'tasting', createdAt: new Date(at).toISOString(), parsed: { items: [{ name: 'Taste', value: 'ok', unit: null }] } });

test('the last measurement: a reading since the ferment began, else its start', () => {
  const start = '2026-10-10T08:00:00.000Z';
  assert.equal(lastMeasuredAt([], start), start);
  assert.equal(lastMeasuredAt([note('2026-10-12T08:00:00Z')], start), start, 'a note is not a measurement');
  assert.equal(lastMeasuredAt([reading('2026-10-09T08:00:00Z')], start), start, 'before the ferment');
  assert.equal(lastMeasuredAt([reading('2026-10-11T08:00:00Z'), reading('2026-10-13T08:00:00Z'), note('2026-10-14T08:00:00Z')], start), '2026-10-13T08:00:00.000Z');
});

test('the plan: vessels with a reminder and a running ferment only', () => {
  const now = new Date('2026-10-20T10:00:00');
  const plan = planReminders({
    settings: { a: 24, b: 12, c: 24 },
    tanks: [{ id: 'a', name: 'Tank A' }, { id: 'b', name: 'Tank B' }, { id: 'c', name: 'Tank C' }, { id: 'd', name: 'Tank D' }],
    runningSince: (id) => (id === 'a' || id === 'd' ? '2026-10-18T09:00:00' : null),
    timeline: () => [],
    now,
  });
  assert.ok(plan.length > 0);
  assert.ok(plan.every((p) => p.tankId === 'a'), 'b has no running ferment, c neither, d has no reminder');
  assert.equal(plan[0].id, 'cellarlog-reminder:a:0');
  assert.equal(plan[0].tankName, 'Tank A');
  assert.ok(plan.every((p) => p.at.getTime() > now.getTime()));
});
