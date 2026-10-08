const { test } = require('node:test');
const assert = require('node:assert/strict');
const { latestValues } = require('../.test-build/latestValues.js');

const entry = (type, createdAt, items) => ({ type, createdAt, parsed: { items } });
const v = (name, value, unit = null) => ({ name, value, unit });
const summary = (list) => list.map(({ item, createdAt }) => `${item.name}=${item.value}@${createdAt.slice(8, 10)}`);

test('newest value per name, in the form order, whatever order entries come in', () => {
  const result = latestValues([
    entry('lab_analysis', '2026-10-01T08:00:00Z', [v('pH', 3.5), v('Alcohol', 12.5, '%'), v('Free SO2', 20, 'mg/L')]),
    entry('lab_analysis', '2026-10-05T08:00:00Z', [v('pH', 3.45), v('Free SO2', 28, 'mg/L')]),
    entry('temperature', '2026-10-03T08:00:00Z', [v('Temperature', 18, '°C')]),
  ]);
  assert.deepEqual(summary(result), ['Free SO2=28@05', 'Temperature=18@03', 'pH=3.45@05', 'Alcohol=12.5@01']);
});

test('additions and transfers only count real readings', () => {
  const result = latestValues([
    entry('addition', '2026-10-06T08:00:00Z', [v('SO2', 20, 'g/hL'), v('Temperature', 22, '°C')]),
    entry('transfer', '2026-10-06T09:00:00Z', [v('Destination', 'Tank 14'), v('Volume', 500, 'L')]),
    entry('addition', '2026-10-06T10:00:00Z', [v('Bentonite', 30, 'g/hL')]),
  ]);
  assert.deepEqual(summary(result), ['Temperature=22@06']);
});

test('custom fields from analyses come after the standard ones, newest first; names match case-insensitively', () => {
  const result = latestValues([
    entry('lab_analysis', '2026-10-02T08:00:00Z', [v('Colour', 'deep ruby'), v('malic acid', 1.2, 'g/L')]),
    entry('lab_analysis', '2026-10-04T08:00:00Z', [v('Malic acid', 0.8, 'g/L'), v('Volume', 48, 'hL')]),
  ]);
  assert.deepEqual(summary(result), ['Volume=48@04', 'Malic acid=0.8@04', 'Colour=deep ruby@02']);
});

test('no entries, no values', () => {
  assert.deepEqual(latestValues([]), []);
  assert.deepEqual(latestValues([entry('note', '2026-10-01T08:00:00Z', [])]), []);
});
