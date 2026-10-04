const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseWithRules } = require('../.test-build/parser/rules.js');
const { parseResultSchema } = require('../.test-build/parser/schema.js');
const { matchTank, tankKey } = require('../.test-build/tankMatch.js');
const { draftFromParse, manualDraft, validateDraft, newDraftItem } = require('../.test-build/entryDraft.js');
const { parseNumber } = require('../.test-build/numbers.js');

const names = ['Tank 12', 'Tank 14', 'Tank 2', 'Barrique 3'];
const tanks = names.map((name, i) => ({ id: 'id-' + i, name }));
const p = (t) => {
  const r = parseWithRules(t, names);
  assert.ok(parseResultSchema.safeParse(r).success, t);
  return r;
};
const simple = (r) => r.items.map((i) => [i.name, i.value, i.unit]);

// ---- Typed notes ----------------------------------------------------------
test('example from the brief', () => {
  const r = p('Tank 12, added 20 g/hl SO2, temp 22°C');
  assert.equal(r.type, 'addition');
  assert.equal(r.tank_name, 'Tank 12');
  assert.deepEqual(simple(r), [['SO2', 20, 'g/hL'], ['Temperature', 22, '°C']]);
  assert.equal(r.transcript, 'Tank 12, added 20 g/hl SO2, temp 22°C');
});
test('lab analysis with decimal comma', () => {
  const r = p('tank 12 ph 3,45 brix 22.5 TA 6.2 g/l');
  assert.equal(r.type, 'lab_analysis');
  assert.deepEqual(simple(r), [['pH', 3.45, null], ['Brix', 22.5, '°Bx'], ['TA', 6.2, 'g/L']]);
});
test('transfer', () => {
  const r = p('Racked tank 12 to tank 14, 2000 L');
  assert.equal(r.type, 'transfer');
  assert.equal(r.tank_name, 'Tank 12');
  assert.deepEqual(simple(r), [['Destination', 'Tank 14', null], ['Volume', 2000, 'L']]);
});
test('tasting keeps free text', () => {
  const r = p('Tasted tank 2: nose of cherry, firm tannins, long finish');
  assert.equal(r.type, 'tasting');
  assert.equal(r.tank_name, 'Tank 2');
  assert.equal(r.note, 'Tasted: nose of cherry, firm tannins, long finish');
});
test('plain note', () => {
  const r = p('Check the pump seal tomorrow');
  assert.equal(r.type, 'note');
  assert.equal(r.tank_name, null);
  assert.equal(r.note, 'Check the pump seal tomorrow');
});
test('temperature variants', () => {
  assert.deepEqual(simple(p('T12 temperature 18 degrees')), [['Temperature', 18, '°C']]);
  assert.deepEqual(simple(p('tank 2 at 14 °C')), [['Temperature', 14, '°C']]);
  assert.deepEqual(simple(p('Tank 2 temp -1.5')), [['Temperature', -1.5, '°C']]);
});
test('multiple additions, known multi-word tank', () => {
  const r = p('Barrique 3 added 30 g of bentonite and 10 g/hl tannin');
  assert.equal(r.tank_name, 'Barrique 3');
  assert.deepEqual(simple(r), [['bentonite', 30, 'g'], ['tannin', 10, 'g/hL']]);
});
test('free vs total SO2 are lab values, not additions', () => {
  const r = p('Tank 12 free SO2 28 mg/l total SO2 85');
  assert.equal(r.type, 'lab_analysis');
  assert.deepEqual(simple(r), [['Free SO2', 28, 'mg/L'], ['Total SO2', 85, 'mg/L']]);
});
test('unknown tank is still reported', () => {
  assert.equal(p('tank 99 temp 15').tank_name, 'Tank 99');
});

// ---- Spoken notes (as a speech recognizer writes them) -------------------
test('spoken: the brief example, all in words', () => {
  const spoken = 'Tank twelve added twenty grams per hectoliter of sulfur dioxide temperature twenty two degrees';
  const r = p(spoken);
  assert.equal(r.type, 'addition');
  assert.equal(r.tank_name, 'Tank 12');
  assert.deepEqual(simple(r), [['SO2', 20, 'g/hL'], ['Temperature', 22, '°C']]);
  assert.equal(r.transcript, spoken, 'raw text keeps the exact words');
});
test('spoken: recognizer digits with spelled units', () => {
  const r = p('tank 12 added 20 g per hectoliter S O 2 temp 22 degrees Celsius');
  assert.deepEqual(simple(r), [['SO2', 20, 'g/hL'], ['Temperature', 22, '°C']]);
});
test('spoken: lab values with "point" and misheard brix', () => {
  const r = p('tank twelve p h three point four five twenty two bricks TA six point two grams per liter');
  assert.equal(r.type, 'lab_analysis');
  assert.deepEqual(simple(r), [['pH', 3.45, null], ['Brix', 22, '°Bx'], ['TA', 6.2, 'g/L']]);
});
test('spoken: transfer with "into" and "number"', () => {
  const r = p('racked tank number twelve into tank fourteen two thousand liters');
  assert.equal(r.type, 'transfer');
  assert.equal(r.tank_name, 'Tank 12');
  assert.deepEqual(simple(r), [['Destination', 'Tank 14', null], ['Volume', 2000, 'L']]);
});
test('spoken: free SO2 and alcohol', () => {
  const r = p('tank two free so two twenty eight milligrams per liter alcohol thirteen point five percent');
  assert.equal(r.type, 'lab_analysis');
  assert.deepEqual(simple(r), [['Free SO2', 28, 'mg/L'], ['Alcohol', 13.5, '%']]);
});
test('spoken: addition in grams', () => {
  const r = p('barrique three added thirty grams of bentonite');
  assert.equal(r.tank_name, 'Barrique 3');
  assert.deepEqual(simple(r), [['bentonite', 30, 'g']]);
});
test('spoken: tasting', () => {
  const r = p('tasted tank two nose of cherry firm tannins');
  assert.equal(r.type, 'tasting');
  assert.equal(r.tank_name, 'Tank 2');
});

// ---- Matching, drafts, numbers ---------------------------------------------
test('tank matching', () => {
  assert.equal(tankKey('Tank 12'), '12');
  assert.equal(tankKey('T-12'), '12');
  assert.equal(tankKey('Barrique 3'), 'barrique3');
  assert.equal(matchTank('tank 12', tanks)?.id, 'id-0');
  assert.equal(matchTank('T12', tanks)?.id, 'id-0');
  assert.equal(matchTank('12', tanks)?.id, 'id-0');
  assert.equal(matchTank('Tank 1', tanks), null);
  assert.equal(matchTank('Tank 99', tanks), null);
  assert.equal(matchTank(null, tanks), null);
  const twins = [{ id: 'a', name: 'Tank 5' }, { id: 'b', name: 'T5' }];
  assert.equal(matchTank('Tank 5', twins)?.id, 'a', 'exact wins');
  assert.equal(matchTank('5', twins), null, 'ambiguous');
});
test('draft: parser tank wins, falls back to start tank', () => {
  const d1 = draftFromParse(p('Tank 14 temp 12'), tanks, 'id-0');
  assert.equal(d1.tankId, 'id-1');
  assert.equal(d1.unmatchedTankName, null);
  const d2 = draftFromParse(p('temp 12'), tanks, 'id-0');
  assert.equal(d2.tankId, 'id-0');
  const d3 = draftFromParse(p('tank 99 temp 12'), tanks, 'id-0');
  assert.equal(d3.tankId, 'id-0');
  assert.equal(d3.unmatchedTankName, 'Tank 99');
});
test('draft validation', () => {
  const d = draftFromParse(p('Tank 12, added 20 g/hl SO2, temp 22°C'), tanks, null);
  const ok = validateDraft(d, tanks);
  assert.ok(ok.ok);
  assert.deepEqual(ok.entry.parsed, {
    tank_name: 'Tank 12',
    type: 'addition',
    items: [{ name: 'SO2', value: 20, unit: 'g/hL' }, { name: 'Temperature', value: 22, unit: '°C' }],
    note: null,
  });
  const edited = {
    ...d,
    items: [
      newDraftItem({ name: 'pH', value: '3,4', unit: '' }),
      newDraftItem({ name: 'Colour', value: 'deep ruby', unit: '' }),
      newDraftItem(),
    ],
  };
  const r = validateDraft(edited, tanks);
  assert.ok(r.ok);
  assert.deepEqual(r.entry.parsed.items, [
    { name: 'pH', value: 3.4, unit: null },
    { name: 'Colour', value: 'deep ruby', unit: null },
  ]);
  const half = newDraftItem({ name: 'SO2', value: '' });
  const bad = validateDraft({ ...d, tankId: null, items: [half] }, tanks);
  assert.ok(!bad.ok);
  assert.ok(bad.errors.tank);
  assert.ok(bad.errors.items[half.key]);
  const empty = validateDraft({ ...d, items: [], note: '  ' }, tanks);
  assert.ok(!empty.ok);
  assert.ok(empty.errors.form);
  const manual = validateDraft(manualDraft('Pump broke', 'id-2'), tanks);
  assert.ok(manual.ok);
  assert.equal(manual.entry.type, 'note');
});
test('parseNumber negatives', () => {
  assert.equal(parseNumber('-2'), -2);
  assert.equal(parseNumber('-0,5'), -0.5);
});
