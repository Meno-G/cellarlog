// Ferments: which entries belong to which, the curves, and the form.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setStoreForTests } = require('../.test-build/storage.js');
const i18n = require('../.test-build/i18n/index.js');
const {
  activeFerment,
  elapsedDays,
  fermentDay,
  entriesInFerment,
  fermentCurves,
  compareAtDay,
} = require('../.test-build/fermentCurves.js');
const { validateFermentForm, parseDay, dayString, newFermentForm, fermentToForm } = require('../.test-build/fermentForm.js');
const { fermentsCache, saveOfflineCopy, clearCache, removeTankFromCache } = require('../.test-build/cache.js');
const { validateTankForm, emptyTankForm } = require('../.test-build/tankForm.js');
const { chartableMeasures } = require('../.test-build/fermentCurves.js');

beforeEach(() => {
  const map = new Map();
  setStoreForTests({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  });
  i18n.setLang('en');
});

const d = (iso) => new Date(iso).toISOString();
const ferment = (id, name, startedAt, endedAt = null) => ({ id, tankId: 't1', name, startedAt: d(startedAt), endedAt: endedAt && d(endedAt), createdAt: d(startedAt) });
const reading = (at, name, value, unit = null, type = 'lab_analysis') => ({
  type,
  createdAt: d(at),
  parsed: { items: [{ name, value, unit }] },
});

const f2025 = ferment('f25', 'Saperavi 2025', '2025-10-01T00:00:00Z', '2025-10-21T23:59:59Z');
const f2026 = ferment('f26', 'Saperavi 2026', '2026-10-01T00:00:00Z');

test('the running ferment is the one without an end date (newest if several)', () => {
  assert.equal(activeFerment([f2025, f2026]).id, 'f26');
  assert.equal(activeFerment([f2025]), undefined);
  assert.equal(activeFerment([f2026, ferment('f27', 'Newer', '2026-10-05T00:00:00Z')]).id, 'f27');
});

test('days since the start: fractional for charts, "day 1" on the start day for display', () => {
  assert.equal(elapsedDays(f2026.startedAt, '2026-10-03T12:00:00Z'), 2.5);
  assert.equal(fermentDay(f2026.startedAt, '2026-10-01T08:00:00Z'), 1);
  assert.equal(fermentDay(f2026.startedAt, '2026-10-12T08:00:00Z'), 12);
});

test('entries belong to a ferment by date: from the start to the end (or now while running)', () => {
  const entries = [
    reading('2025-09-30T10:00:00Z', 'Density', 1.09),
    reading('2025-10-02T10:00:00Z', 'Density', 1.08),
    reading('2026-10-02T10:00:00Z', 'Density', 1.085),
  ];
  assert.equal(entriesInFerment(entries, f2025).length, 1);
  assert.equal(entriesInFerment(entries, f2026, new Date('2026-10-10T00:00:00Z')).length, 1);
  assert.equal(entriesInFerment(entries, f2026, new Date('2026-10-01T12:00:00Z')).length, 0, 'not yet recorded at that moment');
});

test('curves: one series per ferment in days since its own start; this ferment first', () => {
  const entries = [
    reading('2025-10-02T00:00:00Z', 'Density', 1.08),
    reading('2025-10-06T00:00:00Z', 'Density', 1.04),
    reading('2026-10-02T00:00:00Z', 'Density', 1.085),
    reading('2026-10-04T12:00:00Z', 'Density', 1.07),
    reading('2026-10-04T12:00:00Z', 'Temperature', 24, '°C'),
  ];
  const curves = fermentCurves(entries, [f2025, f2026], 'density', new Date('2026-10-05T00:00:00Z'));
  assert.deepEqual(curves.series.map((s) => [s.ferment.id, s.current]), [['f26', true], ['f25', false]]);
  assert.deepEqual(curves.series[0].points.map((p) => p.day), [1, 3.5]);
  assert.deepEqual(curves.series[1].points.map((p) => p.day), [1, 5]);
  assert.equal(curves.unit, null);
  assert.equal(curves.min, 1.04);
  assert.equal(curves.max, 1.085);
  assert.equal(curves.maxDay, 5);
  const temp = fermentCurves(entries, [f2025, f2026], 'Temperature', new Date('2026-10-05T00:00:00Z'));
  assert.equal(temp.unit, '°C');
  assert.equal(temp.series.length, 1, 'ferments without readings of that value are left out');
});

test('curves: only the most common unit is drawn; text and other units are counted as skipped', () => {
  const entries = [
    reading('2026-10-02T00:00:00Z', 'Temperature', 22, '°C'),
    reading('2026-10-03T00:00:00Z', 'Temperature', 24, '°C'),
    reading('2026-10-04T00:00:00Z', 'Temperature', 75, '°F'),
    reading('2026-10-05T00:00:00Z', 'Temperature', 'warm'),
  ];
  const curves = fermentCurves(entries, [f2026], 'Temperature', new Date('2026-10-10T00:00:00Z'));
  assert.equal(curves.unit, '°C');
  assert.equal(curves.series[0].points.length, 2);
  assert.equal(curves.skipped, 2);
});

test('curves: a bare SO2 in an addition is not a reading; a reading inside an addition is', () => {
  const entries = [
    reading('2026-10-02T00:00:00Z', 'Temperature', 22, '°C', 'addition'),
    reading('2026-10-02T00:00:00Z', 'SO2', 20, 'g/hL', 'addition'),
  ];
  assert.equal(fermentCurves(entries, [f2026], 'Temperature', new Date('2026-10-10T00:00:00Z')).series.length, 1);
  assert.equal(fermentCurves(entries, [f2026], 'SO2', new Date('2026-10-10T00:00:00Z')).series.length, 0);
});

test('compare: this ferment\'s newest reading beside earlier ferments around the same day', () => {
  const entries = [
    reading('2025-10-05T00:00:00Z', 'Density', 1.05), // day 4
    reading('2025-10-12T00:00:00Z', 'Density', 1.01), // day 11
    reading('2026-10-05T06:00:00Z', 'Density', 1.06), // day 4.25
  ];
  const curves = fermentCurves(entries, [f2025, f2026], 'Density', new Date('2026-10-06T00:00:00Z'));
  const cmp = compareAtDay(curves);
  assert.equal(cmp.day, 5);
  assert.equal(cmp.now.value, 1.06);
  assert.deepEqual(cmp.earlier.map((e) => [e.ferment.id, e.point.value]), [['f25', 1.05]]);

  const far = fermentCurves([reading('2025-10-12T00:00:00Z', 'Density', 1.01), reading('2026-10-05T06:00:00Z', 'Density', 1.06)], [f2025, f2026], 'Density', new Date('2026-10-06T00:00:00Z'));
  assert.deepEqual(compareAtDay(far).earlier, [], 'nothing within a day of day 4');
  assert.equal(compareAtDay(fermentCurves([], [f2026], 'Density')), null);
});

test('form: dates are real calendar days, local time; the end date includes its whole day', () => {
  assert.ok(parseDay('2026-10-04'));
  assert.equal(parseDay('2026-02-31'), null);
  assert.equal(parseDay('04.10.2026'), null);
  assert.equal(dayString(new Date(2026, 9, 4, 15, 30)), '2026-10-04');

  const result = validateFermentForm({ name: ' Rkatsiteli 2026 ', startDate: '2026-10-04', endDate: '2026-10-04' }, []);
  assert.ok(result.ok);
  assert.equal(result.input.name, 'Rkatsiteli 2026');
  assert.equal(new Date(result.input.startedAt).getHours(), 0);
  assert.equal(new Date(result.input.endedAt).getHours(), 23);
  assert.ok(new Date(result.input.endedAt) > new Date(result.input.startedAt));
});

test('form: errors for name, dates, end before start; empty end = still running', () => {
  const bad = validateFermentForm({ name: '', startDate: 'soon', endDate: '' }, []);
  assert.ok(!bad.ok);
  assert.equal(bad.errors.name, 'Give the ferment a name, e.g. "Saperavi 2026".');
  assert.ok(bad.errors.startDate);

  const reversed = validateFermentForm({ name: 'X', startDate: '2026-10-10', endDate: '2026-10-09' }, []);
  assert.ok(!reversed.ok);
  assert.ok(reversed.errors.endDate);

  const running = validateFermentForm({ name: 'X', startDate: '2026-10-10', endDate: '' }, []);
  assert.ok(running.ok);
  assert.equal(running.input.endedAt, null);
});

test('form: two ferments in one vessel may not overlap (a running one blocks a new one)', () => {
  const blocked = validateFermentForm({ name: 'New', startDate: '2026-10-05', endDate: '' }, [f2026]);
  assert.ok(!blocked.ok);
  assert.match(blocked.errors.form, /Saperavi 2026/);

  const afterEnd = validateFermentForm({ name: 'New', startDate: '2026-11-02', endDate: '' }, [f2025]);
  assert.ok(afterEnd.ok);

  const past = validateFermentForm({ name: 'Old', startDate: '2024-10-01', endDate: '2024-10-20' }, [f2025, f2026]);
  assert.ok(past.ok, 'past ferments can be added');

  const inside = validateFermentForm({ name: 'Inside', startDate: '2025-10-05', endDate: '2025-10-08' }, [f2025]);
  assert.ok(!inside.ok);
});

test('form: a new ferment starts from the vessel\'s grape and vintage; editing shows the saved dates', () => {
  const now = new Date(2026, 9, 16, 12);
  assert.deepEqual(newFermentForm({ variety: 'Saperavi', vintage: 2026 }, now), { name: 'Saperavi 2026', startDate: '2026-10-16', endDate: '' });
  assert.equal(newFermentForm({ variety: null, vintage: null }, now).name, '');
  const form = fermentToForm(f2026);
  assert.equal(form.endDate, '');
  assert.match(form.startDate, /^2026-10-0[12]$/, 'local date of the start (time zone dependent)');
});

test('form messages follow the language', () => {
  i18n.setLang('ka');
  const bad = validateFermentForm({ name: '', startDate: '2026-10-04', endDate: '' }, []);
  assert.equal(bad.errors.name, 'მიეცით დუღილს სახელი, მაგ. „საფერავი 2026“.');
});

test('cache: ferments are saved per vessel with the offline copy, and leave with the vessel or the user', () => {
  const tanks = [
    { id: 't1', name: 'Tank 1', kind: 'qvevri', volumeLiters: 800, variety: null, vintage: null, createdAt: d('2026-01-01T00:00:00Z') },
    { id: 't2', name: 'Tank 2', kind: 'tank', volumeLiters: 800, variety: null, vintage: null, createdAt: d('2026-01-01T00:00:00Z') },
  ];
  saveOfflineCopy('u1', tanks, [], 200, [f2026, { ...f2025, id: 'other', tankId: 't2' }]);
  assert.deepEqual(fermentsCache('u1', 't1').read().data.map((f) => f.id), ['f26']);
  assert.deepEqual(fermentsCache('u1', 't2').read().data.map((f) => f.id), ['other']);

  removeTankFromCache('u1', 't1');
  assert.equal(fermentsCache('u1', 't1').read(), null);
  clearCache('u1');
  assert.equal(fermentsCache('u1', 't2').read(), null, 'this user\'s copy is gone after sign-out');
});

test('vessel type: saved with the tank, plain tank by default', () => {
  const ok = validateTankForm({ ...emptyTankForm, name: 'Qvevri 3', kind: 'qvevri', volume: '800' });
  assert.ok(ok.ok);
  assert.equal(ok.input.kind, 'qvevri');
  const plain = validateTankForm({ ...emptyTankForm, name: 'T1', volume: '800' });
  assert.equal(plain.input.kind, 'tank');
});

test('a saved copy or queued tank from before vessel types still loads, as a plain tank', () => {
  const { tanksCache } = require('../.test-build/cache.js');
  const { enqueueTankCreate, listOutbox } = require('../.test-build/outbox.js');
  const { userKey } = require('../.test-build/storage.js');
  const { getStore } = require('../.test-build/storage.js');
  getStore().setItem(
    userKey('u1', 'tanks'),
    JSON.stringify({ savedAt: '2026-10-01T00:00:00Z', data: [{ id: 'a', name: 'Old', volumeLiters: 100, variety: null, vintage: null, createdAt: '2026-01-01T00:00:00Z' }] }),
  );
  assert.equal(tanksCache('u1').read().data[0].kind, 'tank');

  getStore().setItem(
    userKey('u1', 'outbox'),
    JSON.stringify([{ kind: 'tank-create', tank: { name: 'Queued', volumeLiters: 50, variety: null, vintage: null }, localId: 'q', createdAt: '2026-10-01T00:00:00Z', status: 'pending', error: null }]),
  );
  assert.equal(listOutbox('u1')[0].tank.kind, 'tank');
  void enqueueTankCreate;
});

test('chartableMeasures lists every numeric value in a ferment, density and Brix first', () => {
  const f = { id: 'f', name: 'F', startedAt: '2026-10-01T00:00:00.000Z', endedAt: null };
  const entry = (at, type, items) => ({ type, createdAt: at, parsed: { items } });
  const entries = [
    entry('2026-10-02T08:00:00.000Z', 'lab_analysis', [{ name: 'Residual sugar', value: 120, unit: 'g/L' }, { name: 'Density', value: 1.05, unit: null }, { name: 'Note', value: 'sweet', unit: null }]),
    entry('2026-10-03T08:00:00.000Z', 'lab_analysis', [{ name: 'Density', value: 1.04, unit: null }, { name: 'VA', value: 0.3, unit: 'g/L' }, { name: 'My own value', value: 7, unit: null }]),
    entry('2026-09-01T08:00:00.000Z', 'lab_analysis', [{ name: 'Alcohol', value: 5, unit: '%' }]),
    entry('2026-10-04T08:00:00.000Z', 'addition', [{ name: 'SO2', value: 20, unit: 'g/hL' }]),
  ];
  const list = chartableMeasures(entries, [f], new Date('2026-10-10T00:00:00Z'));
  assert.deepEqual(list.map((m) => [m.name, m.count]), [['Density', 2], ['Residual sugar', 1], ['VA', 1], ['My own value', 1]]);
  assert.deepEqual(chartableMeasures([], [f]), []);
});
