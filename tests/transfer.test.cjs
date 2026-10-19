// Transferring wine between vessels: both entries, validation, and moving the grape.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { planTransfer, giveGrape } = require('../.test-build/transfer.js');

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

test('the receiving vessel can take the grape and vintage; the source keeps its own', () => {
  assert.deepEqual(giveGrape(nine, fourteen), { name: 'Tank 14', kind: 'tank', volumeLiters: 3000, variety: 'Rkatsiteli', vintage: 2026 });
  assert.equal(giveGrape(fourteen, nine), null, 'nothing to give from a vessel without a grape');
  const qvevri = giveGrape(v('q', 'Qvevri 1', 'Kisi', null, 'qvevri'), v('t', 'Tank 5', null, null, 'barrel'));
  assert.equal(qvevri.kind, 'barrel', 'the receiving vessel keeps its own type');
  assert.equal(qvevri.vintage, null);
});

test('messages follow the language', () => {
  i18n.setLang('ka');
  const none = planTransfer(nine, all, { destinationId: null, volume: '', note: '' });
  assert.notEqual(none.errors.destination, 'Choose the vessel the wine goes to.');
  assert.ok(none.errors.destination.length > 5);
});

const { NEW_TANK, emptied } = require('../.test-build/transfer.js');

test('a new vessel: created first, with the entered name, type and volume, and the entries name it', () => {
  const result = planTransfer(
    nine,
    all,
    { destinationId: NEW_TANK, volume: '2000', note: '', newName: ' Tank 15 ', newKind: 'qvevri', newVolume: '2000' },
    false,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.plan.newTank, { name: 'Tank 15', kind: 'qvevri', volumeLiters: 2000, variety: null, vintage: null });
  assert.equal(result.destination.name, 'Tank 15');
  assert.deepEqual(result.plan.sourceEntry.parsed.items[0], { name: 'Destination', value: 'Tank 15', unit: null });
  assert.equal(result.plan.destinationEntry.tankId, '', 'the id is only known once the vessel is created');
  assert.equal(result.plan.destinationEntry.parsed.tank_name, 'Tank 15');
  assert.deepEqual(result.plan.destinationEntry.parsed.items[0], { name: 'Source', value: 'Tank 9', unit: null });
});

test('a new vessel is created with the grape and vintage when they move with the wine', () => {
  const result = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '', note: '', newName: 'Tank 15', newVolume: '2000' }, true);
  assert.ok(result.ok);
  assert.equal(result.plan.newTank.variety, 'Rkatsiteli');
  assert.equal(result.plan.newTank.vintage, 2026);
  assert.equal(result.plan.newTank.kind, 'tank', 'a plain tank unless chosen otherwise');
  assert.deepEqual(emptied(nine), { name: 'Tank 9', kind: 'tank', volumeLiters: 3000, variety: null, vintage: null });
  assert.equal(emptied(fourteen), null);
});

test('a new vessel needs a name and a volume, and the name must be free', () => {
  const empty = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '', note: '', newName: '', newVolume: '' });
  assert.ok(!empty.ok);
  assert.ok(empty.errors.newName && empty.errors.newVolume);

  const noVolume = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '2000', note: '', newName: 'Tank 15', newVolume: '' });
  assert.ok(!noVolume.ok);
  assert.ok(noVolume.errors.newVolume && !noVolume.errors.newName);

  const taken = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '', note: '', newName: 'tank 14', newVolume: '500' });
  assert.ok(!taken.ok);
  assert.equal(taken.errors.newName, 'You already have a tank called "Tank 14".');
  const spelled = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '', note: '', newName: 'T2', newVolume: '500' });
  assert.ok(!spelled.ok, '"T2" is "Tank 2"');
});

test('choosing an existing vessel still ignores the new-vessel fields', () => {
  const result = planTransfer(nine, all, { destinationId: 't14', volume: '', note: '', newName: '', newVolume: '' });
  assert.ok(result.ok);
  assert.equal(result.plan.newTank, null);
  assert.equal(result.plan.destinationEntry.tankId, 't14');
});

const { litersLeft, isEmptyLeft } = require('../.test-build/transfer.js');

const d = (iso) => new Date(iso).toISOString();
const out = (at, volume, unit = 'L') => ({ type: 'transfer', createdAt: d(at), parsed: { items: [{ name: 'Destination', value: 'Tank 14', unit: null }, { name: 'Volume', value: volume, unit }] } });
const into = (at, volume) => ({ type: 'transfer', createdAt: d(at), parsed: { items: [{ name: 'Source', value: 'Tank 3', unit: null }, { name: 'Volume', value: volume, unit: 'L' }] } });
const ferment = (start) => ({ id: 'f', name: 'F', startedAt: d(start), endedAt: null });
const five = { volumeLiters: 5000 };
const now = new Date('2026-10-20T00:00:00Z');

test('emptiness: 3 t out, then 2 t out of 5 t: the second transfer empties it', () => {
  const entries = [out('2026-10-10T08:00:00Z', 3000)];
  assert.equal(litersLeft(five, [], [], 3000, now), 2000, 'the first transfer leaves 2000');
  assert.ok(!isEmptyLeft(litersLeft(five, [], [], 3000, now)));
  assert.equal(litersLeft(five, entries, [], 2000, now), 0, 'with the 3000 already moved out, 2000 more leaves nothing');
  assert.ok(isEmptyLeft(litersLeft(five, entries, [], 2000, now)));
  assert.ok(!isEmptyLeft(litersLeft(five, entries, [], 1000, now)));
});

test('emptiness counts only wine moved out since the vessel was last filled', () => {
  const before = [out('2026-09-01T08:00:00Z', 4000)];
  assert.equal(litersLeft(five, before, [ferment('2026-10-01T00:00:00Z')], 1000, now), 4000, 'a new ferment starts a new fill');
  assert.equal(litersLeft(five, [out('2026-10-05T08:00:00Z', 4000), into('2026-10-08T08:00:00Z', 5000)], [], 1000, now), 4000, 'wine received since resets it');
  assert.equal(litersLeft(five, [into('2026-10-01T08:00:00Z', 5000), out('2026-10-05T08:00:00Z', 4000)], [], 1000, now), 0);
});

test('emptiness: unknown liters, hectoliters, and no volume recorded on earlier transfers', () => {
  assert.equal(litersLeft(five, [], [], null, now), null);
  assert.equal(litersLeft(five, [out('2026-10-10T08:00:00Z', 30, 'hL')], [], 2000, now), 0);
  const noVolume = { type: 'transfer', createdAt: d('2026-10-10T08:00:00Z'), parsed: { items: [{ name: 'Destination', value: 'X', unit: null }] } };
  assert.equal(litersLeft(five, [noVolume], [], 2000, now), 3000, 'an earlier transfer without liters counts as 0');
  assert.ok(!isEmptyLeft(null));
  assert.ok(isEmptyLeft(0.8));
});
