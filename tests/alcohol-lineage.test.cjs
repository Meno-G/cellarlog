// Potential alcohol from Brix/density, and following wine through transfers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { brixFromDensity, potentialAlcohol, estimateFromReading } = require('../.test-build/alcohol.js');
const { cameFrom, wentTo } = require('../.test-build/lineage.js');

test('density to Brix, in any scale', () => {
  assert.ok(Math.abs(brixFromDensity(1.09) - 21.6) < 0.5, 'about 21.6 °Brix at 1.090');
  assert.equal(brixFromDensity(1090), brixFromDensity(1.09), '1090 is 1.090');
  assert.equal(brixFromDensity(0.995), null, 'not a must');
  assert.equal(brixFromDensity(5), null);
});

test('potential alcohol is a range, only for plausible musts', () => {
  assert.deepEqual(potentialAlcohol(22), { brix: 22, low: 12.1, high: 13.2 });
  assert.equal(potentialAlcohol(3), null);
  assert.equal(potentialAlcohol(60), null);
  assert.equal(estimateFromReading('Brix', 24).high, 14.4);
  assert.ok(estimateFromReading('Density', 1.09).low > 11);
  assert.equal(estimateFromReading('pH', 3.4), null);
});

const t = (at, type, items) => ({ type, createdAt: new Date(at).toISOString(), parsed: { items } });
const into = (at, from, liters) => t(at, 'transfer', [{ name: 'Source', value: from, unit: null }, ...(liters ? [{ name: 'Volume', value: liters, unit: 'L' }] : [])]);
const out = (at, to, liters) => t(at, 'transfer', [{ name: 'Destination', value: to, unit: null }, { name: 'Volume', value: liters, unit: 'L' }]);

test('where the wine came from, back through several vessels', () => {
  const timelines = new Map([
    ['tank 30', [into('2026-10-10T08:00:00Z', 'Tank 12', 3000), t('2026-10-11T08:00:00Z', 'lab_analysis', [])]],
    ['tank 12', [into('2026-10-05T08:00:00Z', 'Tank 3', 4000), out('2026-10-10T08:00:00Z', 'Tank 30', 3000)]],
    ['tank 3', [into('2026-10-01T08:00:00Z', 'Tank 12', 100)]],
  ]);
  const steps = cameFrom('Tank 30', timelines);
  assert.equal(steps.length, 1);
  assert.deepEqual([steps[0].vessel, steps[0].liters], ['Tank 12', 3000]);
  assert.equal(steps[0].from[0].vessel, 'Tank 3');
  // Tank 3 received from Tank 12 on Oct 1, which is before... but not before Tank 12 sent on Oct 5: it is followed once, then stops by date.
  assert.equal(steps[0].from[0].from[0].vessel, 'Tank 12');
  assert.deepEqual(steps[0].from[0].from[0].from, [], 'nothing earlier: the chain cannot loop');
});

test('a vessel that no longer exists ends the chain; depth is limited', () => {
  const timelines = new Map([['tank 30', [into('2026-10-10T08:00:00Z', 'Gone', null)]]]);
  const steps = cameFrom('Tank 30', timelines);
  assert.deepEqual([steps[0].vessel, steps[0].liters, steps[0].from], ['Gone', null, []]);
  assert.deepEqual(cameFrom('Tank 30', timelines, { depth: 0 }), []);
  assert.deepEqual(cameFrom('Nobody', timelines), []);
});

test('where it went, newest first', () => {
  const list = wentTo([out('2026-10-02T08:00:00Z', 'A', 1000), out('2026-10-03T08:00:00Z', 'B', 2000), into('2026-10-04T00:00:00Z', 'C', 5)]);
  assert.deepEqual(list.map((s) => [s.vessel, s.liters]), [['B', 2000], ['A', 1000]]);
});
