const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTankForm } = require('../.test-build/tankForm.js');
const { parseNumber } = require('../.test-build/numbers.js');

test('parseNumber', () => {
  const cases = [
    ['5000', 5000], ['5 000', 5000], ['5,000', 5000], ['12,500', 12500], ['1,250,000', 1250000],
    ['5000,5', 5000.5], ['5,25', 5.25], ['0,003', 0.003], ['0,5', 0.5], ['0.003', 0.003], ['5,000.5', 5000.5], ['5000.5', 5000.5], ["5'000", 5000],
    ['', null], ['   ', null],
  ];
  for (const [input, expected] of cases) assert.equal(parseNumber(input), expected, input);
  for (const bad of ['abc', '5L', '1e5', '5..0', '5,0,0']) assert.ok(Number.isNaN(parseNumber(bad)), bad);
});

const base = { name: 'Tank 12', kind: 'tank', volume: '5000', variety: 'Saperavi', vintage: '2025' };
const errs = (values) => {
  const result = validateTankForm({ ...base, ...values });
  assert.ok(!result.ok);
  return result.errors;
};

test('valid tank form', () => {
  assert.deepEqual(validateTankForm(base), {
    ok: true,
    input: { name: 'Tank 12', kind: 'tank', volumeLiters: 5000, variety: 'Saperavi', vintage: 2025 },
  });
  assert.deepEqual(validateTankForm({ ...base, name: '  T1 ', variety: '  ', vintage: '' }), {
    ok: true,
    input: { name: 'T1', kind: 'tank', volumeLiters: 5000, variety: null, vintage: null },
  });
  const rounded = validateTankForm({ ...base, volume: '1234,56' });
  assert.ok(rounded.ok && rounded.input.volumeLiters === 1234.6);
});

test('invalid tank form', () => {
  assert.ok(errs({ name: '   ' }).name);
  assert.ok(errs({ name: 'x'.repeat(101) }).name);
  assert.ok(errs({ volume: '' }).volume);
  assert.ok(errs({ volume: '0' }).volume);
  assert.ok(errs({ volume: '-5' }).volume);
  assert.ok(errs({ volume: '0.04' }).volume, 'rounds to 0');
  assert.ok(errs({ volume: 'lots' }).volume);
  assert.ok(errs({ volume: '1000000000' }).volume);
  assert.ok(errs({ vintage: '1899' }).vintage);
  assert.ok(errs({ vintage: '25' }).vintage);
  assert.deepEqual(Object.keys(errs({ name: '', volume: '', vintage: '3000' })).sort(), [
    'name',
    'vintage',
    'volume',
  ]);
});
