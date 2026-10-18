// Transferring wine between vessels: both entries, validation, and moving the grape.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { planTransfer, moveGrape } = require('../.test-build/transfer.js');

beforeEach(() => i18n.setLang('en'));

const v = (id, name, variety = null, vintage = null, kind = 'tank') => ({ id, name, kind, volumeLiters: 3000, variety, vintage });
const nine = v('t9', 'Tank 9', 'Rkatsiteli', 2026);
const fourteen = v('t14', 'Tank 14');
const all = [nine, fourteen, v('t2', 'Tank 2')];

test('a transfer makes one entry in each vessel, each naming the other', () => {
  const result = planTransfer(nine, all, { destinationId: 't14', volume: '2000', note: ' after fermentation ' });
  assert.ok(result.ok);
  assert.equal(result.destination.id, 't14');
  const { sourceEntry, destinationEntry, volumeLiters } = result.plan;
  assert.equal(volumeLiters, 2000);
  assert.deepEqual(sourceEntry, {
    tankId: 't9',
    type: 'transfer',
    rawText: 'after fermentation',
    parsed: {
      tank_name: 'Tank 9',
      type: 'transfer',
      items: [{ name: 'Destination', value: 'Tank 14', unit: null }, { name: 'Volume', value: 2000, unit: 'L' }],
      note: 'after fermentation',
    },
  });
  assert.equal(destinationEntry.tankId, 't14');
  assert.equal(destinationEntry.parsed.tank_name, 'Tank 14');
  assert.deepEqual(destinationEntry.parsed.items, [
    { name: 'Source', value: 'Tank 9', unit: null },
    { name: 'Volume', value: 2000, unit: 'L' },
  ]);
  assert.equal(destinationEntry.parsed.note, 'after fermentation');
});

test('the volume is optional, accepts a comma, and is rounded like tank volumes', () => {
  const none = planTransfer(nine, all, { destinationId: 't14', volume: '', note: '' });
  assert.ok(none.ok);
  assert.equal(none.plan.volumeLiters, null);
  assert.deepEqual(none.plan.sourceEntry.parsed.items, [{ name: 'Destination', value: 'Tank 14', unit: null }]);
  assert.equal(none.plan.sourceEntry.parsed.note, null);

  const decimal = planTransfer(nine, all, { destinationId: 't14', volume: '1500,55', note: '' });
  assert.ok(decimal.ok);
  assert.equal(decimal.plan.volumeLiters, 1500.6);
});

test('errors: no destination, the same vessel, a bad volume', () => {
  const none = planTransfer(nine, all, { destinationId: null, volume: '', note: '' });
  assert.ok(!none.ok);
  assert.equal(none.errors.destination, 'Choose the vessel the wine goes to.');

  const same = planTransfer(nine, all, { destinationId: 't9', volume: '', note: '' });
  assert.ok(!same.ok, 'a vessel cannot receive from itself');

  const gone = planTransfer(nine, all, { destinationId: 'deleted', volume: '', note: '' });
  assert.ok(!gone.ok);

  for (const volume of ['abc', '0', '-5', '1e9999']) {
    const bad = planTransfer(nine, all, { destinationId: 't14', volume, note: '' });
    assert.ok(!bad.ok, volume);
    assert.ok(bad.errors.volume);
  }
});

test('the grape and vintage can move with the wine: the source is left empty', () => {
  const moved = moveGrape(nine, fourteen);
  assert.deepEqual(moved, {
    source: { name: 'Tank 9', kind: 'tank', volumeLiters: 3000, variety: null, vintage: null },
    destination: { name: 'Tank 14', kind: 'tank', volumeLiters: 3000, variety: 'Rkatsiteli', vintage: 2026 },
  });
  assert.equal(moveGrape(fourteen, nine), null, 'nothing to move from a vessel without a grape');
  const qvevri = moveGrape(v('q', 'Qvevri 1', 'Kisi', null, 'qvevri'), fourteen);
  assert.equal(qvevri.source.kind, 'qvevri', 'the vessel type is kept');
  assert.equal(qvevri.destination.vintage, null);
});

test('messages follow the language', () => {
  i18n.setLang('ka');
  const none = planTransfer(nine, all, { destinationId: null, volume: '', note: '' });
  assert.notEqual(none.errors.destination, 'Choose the vessel the wine goes to.');
  assert.ok(none.errors.destination.length > 5);
});
