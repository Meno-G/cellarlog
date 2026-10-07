const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatRelative, formatItemValue, formatWine } = require('../.test-build/format.js');

const now = new Date(2026, 9, 7, 15, 0); // 7 Oct 2026, 15:00 local
const ago = (ms) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;

test('formatRelative: recent activity on a tank card', () => {
  assert.equal(formatRelative(ago(20 * 1000), now), 'just now');
  assert.equal(formatRelative(ago(12 * MIN), now), '12 min ago');
  assert.equal(formatRelative(ago(125 * MIN), now), '2 h ago');
  assert.equal(formatRelative(new Date(2026, 9, 6, 22, 0).toISOString(), now), 'yesterday');
  assert.equal(formatRelative(new Date(2026, 9, 3, 9, 0).toISOString(), now), '4 days ago');
  assert.match(formatRelative(new Date(2026, 8, 1).toISOString(), now), /Sep/);
  assert.match(formatRelative(new Date(2025, 8, 1).toISOString(), now), /2025/);
});

test('formatItemValue and formatWine', () => {
  assert.equal(formatItemValue({ name: 'Temperature', value: 22, unit: '°C' }), '22°C');
  assert.equal(formatItemValue({ name: 'SO2', value: 20, unit: 'g/hL' }), '20 g/hL');
  assert.equal(formatItemValue({ name: 'Destination', value: 'Tank 2', unit: null }), 'Tank 2');
  assert.equal(formatWine('Saperavi', 2025), 'Saperavi · 2025');
  assert.equal(formatWine(null, null), null);
});
