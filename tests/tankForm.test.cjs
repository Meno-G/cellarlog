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

const base = { name: 'Tank 12', kind: 'tank', volume: '5000', content: '', blend: [], variety: 'Saperavi', vintage: '2025' };
const errs = (values) => {
  const result = validateTankForm({ ...base, ...values });
  assert.ok(!result.ok);
  return result.errors;
};

test('valid tank form', () => {
  assert.deepEqual(validateTankForm(base), {
    ok: true,
    input: { name: 'Tank 12', kind: 'tank', volumeLiters: 5000, contentLiters: null, blend: null, variety: 'Saperavi', vintage: 2025 },
  });
  assert.deepEqual(validateTankForm({ ...base, name: '  T1 ', variety: '  ', vintage: '' }), {
    ok: true,
    input: { name: 'T1', kind: 'tank', volumeLiters: 5000, contentLiters: null, blend: null, variety: null, vintage: null },
  });
  const rounded = validateTankForm({ ...base, volume: '1234,56' });
  assert.ok(rounded.ok && rounded.input.volumeLiters === 1234.6);
});

test('the wine in the vessel is optional and can not exceed its capacity', () => {
  const some = validateTankForm({ ...base, content: '3000' });
  assert.ok(some.ok);
  assert.equal(some.input.contentLiters, 3000);
  assert.equal(validateTankForm({ ...base, content: '0' }).input.contentLiters, 0, 'an empty vessel');
  assert.equal(validateTankForm({ ...base, content: '5000' }).input.contentLiters, 5000, 'exactly full');
  assert.equal(validateTankForm({ ...base, content: '1234,56' }).input.contentLiters, 1234.6);
  assert.ok(errs({ content: '5001' }).content, 'more than fits');
  assert.ok(errs({ content: '-1' }).content);
  assert.ok(errs({ content: 'lots' }).content);
});

test('a blend: parts decide the grape and vintage; one part alone or a bad part is an error', () => {
  const row = (variety, vintage, liters = '') => ({ variety, vintage, liters });
  const ok = validateTankForm({ ...base, blend: [row('Saperavi', '2025', '3000'), row('Ojaleshi', '2025', '2000'), row('', '', '')] });
  assert.ok(ok.ok);
  assert.equal(ok.input.variety, 'Saperavi + Ojaleshi', 'the field is filled from the parts');
  assert.equal(ok.input.vintage, 2025);
  assert.deepEqual(ok.input.blend.map((p) => p.liters), [3000, 2000]);
  const years = validateTankForm({ ...base, blend: [row('Saperavi', '2024'), row('Saperavi', '2025')] });
  assert.equal(years.input.vintage, null, 'different years');
  assert.equal(validateTankForm({ ...base }).input.blend, null, 'no rows: one wine');
  assert.ok(errs({ blend: [row('Saperavi', '2025')] }).blend, 'one part alone');
  assert.ok(errs({ blend: [row('A', '2025'), row('', '', '500')] }).blend, 'a part without grape or vintage');
  assert.ok(errs({ blend: [row('A', '1800'), row('B', '2025')] }).blend, 'bad vintage');
  assert.ok(errs({ blend: [row('A', '2025', 'lots'), row('B', '2025')] }).blend, 'bad liters');
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
