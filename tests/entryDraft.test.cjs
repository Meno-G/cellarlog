const { test } = require('node:test');
const assert = require('node:assert/strict');
const { draftFromSaved, validateDraft } = require('../.test-build/entryDraft.js');

const tanks = [{ id: 't12', name: 'Tank 12' }, { id: 't14', name: 'Tank 14' }];
const saved = {
  tankId: 't12',
  type: 'addition',
  rawText: 'Tank 12, added 20 g/hl SO2, temp 22°C',
  parsed: {
    tank_name: 'Tank 12',
    type: 'addition',
    items: [{ name: 'SO2', value: 20, unit: 'g/hL' }, { name: 'Colour', value: 'deep ruby', unit: null }],
    note: 'after racking',
  },
};

test('open + save without changes is a no-op', () => {
  const result = validateDraft(draftFromSaved(saved), tanks);
  assert.ok(result.ok);
  assert.deepEqual(result.entry, { tankId: 't12', type: 'addition', rawText: saved.rawText, parsed: saved.parsed });
});

test('moving to another tank updates tank_name too', () => {
  const draft = { ...draftFromSaved(saved), tankId: 't14' };
  const result = validateDraft(draft, tanks);
  assert.ok(result.ok);
  assert.equal(result.entry.tankId, 't14');
  assert.equal(result.entry.parsed.tank_name, 'Tank 14');
  assert.equal(result.entry.rawText, saved.rawText, 'original note is kept');
});
