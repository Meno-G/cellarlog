// Alert rules: what trips, what stays quiet, and the rule forms.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const {
  evaluateRules,
  trippedAlerts,
  parseRule,
  densityDefaults,
  TEMPERATURE_DEFAULTS,
  validateDensityForm,
  validateTemperatureForm,
  densityToForm,
} = require('../.test-build/alertRules.js');

beforeEach(() => i18n.setLang('en'));

const d = (iso) => new Date(iso).toISOString();
const ferment = { id: 'f', name: 'Saperavi 2026', startedAt: d('2026-10-01T00:00:00Z'), endedAt: null };
const read = (at, name, value, unit = null) => ({ type: 'lab_analysis', createdAt: d(at), parsed: { items: [{ name, value, unit }] } });
const density = { kind: 'density_stall', enabled: true, params: { hours: 48, minDrop: 0.002, dryBelow: 0.998 } };
const temperature = { kind: 'temperature_range', enabled: true, params: { minC: 18, maxC: 30 } };
const now = new Date('2026-10-10T12:00:00Z');

test('density: no drop over the chosen hours trips the rule, and says what was observed', () => {
  const entries = [read('2026-10-07T08:00:00Z', 'Density', 1.06), read('2026-10-09T08:00:00Z', 'Density', 1.059)];
  const [result] = evaluateRules([density], entries, [ferment], now);
  assert.equal(result.status, 'tripped');
  assert.equal(result.from.value, 1.06);
  assert.equal(result.latest.value, 1.059);
});

test('density: a drop of at least the minimum is fine (also at exactly the limit, despite float noise)', () => {
  const fine = evaluateRules([density], [read('2026-10-07T08:00:00Z', 'Density', 1.06), read('2026-10-09T08:00:00Z', 'Density', 1.04)], [ferment], now);
  assert.equal(fine[0].status, 'ok');
  const exact = evaluateRules([density], [read('2026-10-07T08:00:00Z', 'Density', 1.062), read('2026-10-09T08:00:00Z', 'Density', 1.06)], [ferment], now);
  assert.equal(exact[0].status, 'ok');
});

test('density: nothing old enough to compare with, or nothing newer than it, says so instead of alarming', () => {
  const young = evaluateRules([density], [read('2026-10-09T08:00:00Z', 'Density', 1.06)], [ferment], now);
  assert.deepEqual([young[0].status, young[0].reason], ['no-data', 'too-early']);
  const stale = evaluateRules([density], [read('2026-10-05T08:00:00Z', 'Density', 1.06)], [ferment], now);
  assert.deepEqual([stale[0].status, stale[0].reason], ['no-data', 'no-new-reading']);
  const none = evaluateRules([density], [], [ferment], now);
  assert.deepEqual([none[0].status, none[0].reason], ['no-data', 'no-readings']);
});

test('density: a finished (dry) ferment does not alarm', () => {
  const entries = [read('2026-10-06T08:00:00Z', 'Density', 0.996), read('2026-10-09T08:00:00Z', 'Density', 0.996)];
  const [result] = evaluateRules([density], entries, [ferment], now);
  assert.deepEqual([result.status, result.reason], ['ok', 'dry']);
});

test('density: the comparison uses the newest reading that is old enough', () => {
  const entries = [
    read('2026-10-03T08:00:00Z', 'Density', 1.09),
    read('2026-10-07T08:00:00Z', 'Density', 1.07), // 53 h ago: the comparison
    read('2026-10-09T08:00:00Z', 'Density', 1.068), // 28 h ago: too recent to compare with
    read('2026-10-10T08:00:00Z', 'Density', 1.069),
  ];
  const [result] = evaluateRules([density], entries, [ferment], now);
  assert.equal(result.from.value, 1.07);
  assert.equal(result.latest.value, 1.069);
  assert.equal(result.status, 'tripped');
});

test('temperature: outside the range trips, inside is fine, other units are not guessed', () => {
  const hot = evaluateRules([temperature], [read('2026-10-10T08:00:00Z', 'Temperature', 31, '°C')], [ferment], now);
  assert.equal(hot[0].status, 'tripped');
  assert.equal(hot[0].latest.value, 31);
  const cold = evaluateRules([temperature], [read('2026-10-10T08:00:00Z', 'Temperature', 17.5, '°C')], [ferment], now);
  assert.equal(cold[0].status, 'tripped');
  const ok = evaluateRules([temperature], [read('2026-10-10T08:00:00Z', 'Temperature', 24, '°C')], [ferment], now);
  assert.equal(ok[0].status, 'ok');
  const edge = evaluateRules([temperature], [read('2026-10-10T08:00:00Z', 'Temperature', 30, '°C')], [ferment], now);
  assert.equal(edge[0].status, 'ok', 'the limits themselves are inside');
  const fahrenheit = evaluateRules([temperature], [read('2026-10-10T08:00:00Z', 'Temperature', 75, '°F')], [ferment], now);
  assert.deepEqual([fahrenheit[0].status, fahrenheit[0].reason], ['no-data', 'unit']);
});

test('temperature: only the running ferment\'s readings count, and the newest one decides', () => {
  const entries = [
    read('2026-09-20T08:00:00Z', 'Temperature', 40, '°C'), // before the ferment started
    read('2026-10-04T08:00:00Z', 'Temperature', 33, '°C'),
    read('2026-10-09T08:00:00Z', 'Temperature', 26, '°C'),
  ];
  const [result] = evaluateRules([temperature], entries, [ferment], now);
  assert.equal(result.status, 'ok');
  assert.equal(result.latest.value, 26);
});

test('rules only check a running ferment; disabled rules are skipped; ended ferments are not checked', () => {
  const entries = [read('2026-10-10T08:00:00Z', 'Temperature', 40, '°C')];
  const ended = { ...ferment, endedAt: d('2026-10-09T23:59:59Z') };
  const [noFerment] = evaluateRules([temperature], entries, [ended], now);
  assert.deepEqual([noFerment.status, noFerment.reason], ['no-data', 'no-ferment']);
  assert.deepEqual(evaluateRules([{ ...temperature, enabled: false }], entries, [ferment], now), []);
  assert.equal(trippedAlerts(evaluateRules([temperature, density], entries, [ferment], now)).length, 1);
});

test('stored rules are read strictly: bad parameters are dropped, not guessed', () => {
  assert.deepEqual(parseRule('temperature_range', true, { minC: 18, maxC: 30 }), temperature);
  assert.equal(parseRule('temperature_range', true, { minC: 30, maxC: 18 }), null);
  assert.equal(parseRule('density_stall', true, { hours: 0, minDrop: 0.002, dryBelow: 0.998 }), null);
  assert.equal(parseRule('density_stall', true, { hours: 48 }), null);
  assert.equal(parseRule('something_else', true, {}), null);
});

test('defaults follow the way the winemaker writes density (1.060 or 1060)', () => {
  assert.deepEqual(densityDefaults(), { hours: 48, minDrop: 0.002, dryBelow: 0.998 });
  assert.deepEqual(densityDefaults(1.085), { hours: 48, minDrop: 0.002, dryBelow: 0.998 });
  assert.deepEqual(densityDefaults(1085), { hours: 48, minDrop: 2, dryBelow: 998 });
  assert.deepEqual(TEMPERATURE_DEFAULTS, { minC: 18, maxC: 30 });
});

test('forms: numbers with a comma work; bad values say what is wrong', () => {
  const ok = validateDensityForm({ hours: '72', minDrop: '0,003', dryBelow: '0.996' });
  assert.ok(ok.ok);
  assert.deepEqual(ok.params, { hours: 72, minDrop: 0.003, dryBelow: 0.996 });
  assert.deepEqual(densityToForm(ok.params), { hours: '72', minDrop: '0.003', dryBelow: '0.996' });

  const bad = validateDensityForm({ hours: '1.5', minDrop: '0', dryBelow: 'x' });
  assert.ok(!bad.ok);
  assert.ok(bad.errors.hours && bad.errors.minDrop && bad.errors.dryBelow);

  assert.ok(validateTemperatureForm({ minC: '20', maxC: '28' }).ok);
  const reversed = validateTemperatureForm({ minC: '30', maxC: '20' });
  assert.ok(!reversed.ok);
  assert.equal(reversed.errors.maxC, 'The lowest must be below the highest.');
  assert.ok(!validateTemperatureForm({ minC: '', maxC: '20' }).ok);
});

test('form messages follow the language', () => {
  i18n.setLang('ka');
  const bad = validateDensityForm({ hours: '0', minDrop: '0.002', dryBelow: '0.998' });
  assert.match(bad.errors.hours, /1/);
  assert.notEqual(bad.errors.hours, 'Hours must be a whole number from 1 to 720.');
});
