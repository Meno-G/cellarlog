const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyAnalysisForm, validateAnalysisForm } = require('../.test-build/analysisForm.js');

const tanks = [{ id: 't12', name: 'Tank 12' }, { id: 't14', name: 'Tank 14' }];
const form = (fields) => ({ ...emptyAnalysisForm('t12'), ...fields });
const extra = (key, name, value, unit = '') => ({ key, name, value, unit });

test('filled fields become items in form order; empty ones are skipped', () => {
  const result = validateAnalysisForm(
    form({ values: { alcohol: '13', ta: '6,5', freeSo2: '28', ph: ' ', volume: '' } }),
    tanks,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.entry, {
    tankId: 't12',
    type: 'lab_analysis',
    rawText: '',
    parsed: {
      tank_name: 'Tank 12',
      type: 'lab_analysis',
      items: [
        { name: 'Free SO2', value: 28, unit: 'mg/L' },
        { name: 'TA', value: 6.5, unit: 'g/L' },
        { name: 'Alcohol', value: 13, unit: '%' },
      ],
      note: null,
    },
  });
});

test('a typed unit after the number is accepted', () => {
  const result = validateAnalysisForm(
    form({ values: { alcohol: '13%', ta: '6.5 g/l', temperature: '22 °C', brix: '-1.5' } }),
    tanks,
  );
  assert.ok(result.ok);
  assert.deepEqual(
    result.entry.parsed.items.map((item) => item.value),
    [22, 6.5, 13, -1.5],
  );
});

test('pH and density have no unit; volume uses the chosen unit', () => {
  const result = validateAnalysisForm(
    form({ values: { ph: '3.45', density: '0.995', volume: '48' }, units: { volume: 'hL' } }),
    tanks,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.entry.parsed.items, [
    { name: 'pH', value: 3.45, unit: null },
    { name: 'Density', value: 0.995, unit: null },
    { name: 'Volume', value: 48, unit: 'hL' },
  ]);
  const litres = validateAnalysisForm(form({ values: { volume: '4800' } }), tanks);
  assert.equal(litres.entry.parsed.items[0].unit, 'L', 'litres by default');
});

test('only a temperature is filed as a temperature entry', () => {
  const result = validateAnalysisForm(form({ values: { temperature: '18' } }), tanks);
  assert.ok(result.ok);
  assert.equal(result.entry.type, 'temperature');
  assert.equal(result.entry.parsed.type, 'temperature');
});

test('the note is kept as the note and as raw_text', () => {
  const result = validateAnalysisForm(form({ values: { ph: '3.5' }, note: '  after racking ' }), tanks);
  assert.ok(result.ok);
  assert.equal(result.entry.parsed.note, 'after racking');
  assert.equal(result.entry.rawText, 'after racking');
});

test('added fields: numbers become numbers, text stays text, empty rows are ignored', () => {
  const result = validateAnalysisForm(
    form({
      extras: [
        extra('a', 'Malic acid', '0,8', 'g/L'),
        extra('b', 'Colour', 'deep ruby'),
        extra('c', '', '', ''),
      ],
    }),
    tanks,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.entry.parsed.items, [
    { name: 'Malic acid', value: 0.8, unit: 'g/L' },
    { name: 'Colour', value: 'deep ruby', unit: null },
  ]);
});

test('errors: tank, non-numbers, out of range, half-filled added field, nothing filled', () => {
  const bad = validateAnalysisForm(
    { ...form({ values: { ph: 'abc', alcohol: '130' }, extras: [extra('a', 'Malic acid', '')] }), tankId: null },
    tanks,
  );
  assert.ok(!bad.ok);
  assert.ok(bad.errors.tank);
  assert.match(bad.errors.fields.ph, /number/);
  assert.match(bad.errors.fields.alcohol, /between 0 and 100/);
  assert.ok(bad.errors.extras.a);
  assert.equal(bad.errors.form, undefined, 'no "fill in a value" message on top of field errors');

  const empty = validateAnalysisForm(form({ note: 'just a note' }), tanks);
  assert.ok(!empty.ok);
  assert.equal(empty.errors.form, 'Fill in at least one value.');

  const gone = validateAnalysisForm({ ...form({ values: { ph: '3.4' } }), tankId: 'deleted' }, tanks);
  assert.ok(!gone.ok);
  assert.ok(gone.errors.tank);
});
