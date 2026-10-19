// Transferring wine between vessels: both entries, validation, and moving the grape.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { planTransfer, receive, sendOut, contentBefore } = require('../.test-build/transfer.js');

beforeEach(() => i18n.setLang('en'));

const v = (id, name, variety = null, vintage = null, kind = 'tank', contentLiters = null) => ({ id, name, kind, volumeLiters: 3000, contentLiters, variety, vintage });
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
  assert.deepEqual(receive(nine, fourteen, null, true), { name: 'Tank 14', kind: 'tank', volumeLiters: 3000, contentLiters: null, variety: 'Rkatsiteli', vintage: 2026, blend: null });
  assert.equal(receive(nine, fourteen, null, false), null, 'nothing changes when nothing is given and the liters are unknown');
  assert.equal(receive(fourteen, nine, null, true), null, 'nothing to give from a vessel without a grape');
  const qvevri = receive(v('q', 'Qvevri 1', 'Kisi', null, 'qvevri'), v('t', 'Tank 5', null, null, 'barrel'), null, true);
  assert.equal(qvevri.kind, 'barrel', 'the receiving vessel keeps its own type');
  assert.equal(qvevri.vintage, null);
});

test('wine amounts: the receiver gets more, the source gets less', () => {
  const full = v('a', 'Tank 1', 'Saperavi', 2026, 'tank', 2000);
  const empty = v('b', 'Tank 2');
  assert.equal(receive(full, empty, 800, false).contentLiters, 800, 'a blank vessel counts as empty');
  assert.equal(receive(full, v('c', 'Tank 3', 'Kisi', 2025, 'tank', 500), 800, false).contentLiters, 1300);
  assert.equal(receive(full, v('d', 'Tank 4', 'Kisi', 2025), 800, false), null, 'unknown content stays unknown');
  assert.equal(contentBefore(v('d', 'Tank 4', 'Kisi', 2025)), null);
  assert.equal(sendOut(full, 800, false).contentLiters, 1200);
  assert.equal(sendOut(full, 800, false).variety, 'Saperavi', 'the same wine stays in it');
  assert.equal(sendOut(v('e', 'T', 'Kisi', 2025), 800, false), null, 'unknown content: nothing to update');
  assert.deepEqual(sendOut(full, 2000, true), { name: 'Tank 1', kind: 'tank', volumeLiters: 3000, contentLiters: 0, variety: null, vintage: null, blend: null });
  assert.equal(sendOut(v('f', 'T', null, null, 'tank', 0), 0, true), null, 'already empty');
});

test('a transfer must fit: what the source holds and what the receiver has room for', () => {
  const src = v('a', 'Tank 1', 'Saperavi', 2026, 'tank', 2000);
  const dst = v('b', 'Tank 2', null, null, 'tank', 2500);
  const list = [src, dst];
  const tooMuch = planTransfer(src, list, { destinationId: 'b', volume: '2500', note: '' });
  assert.ok(!tooMuch.ok && tooMuch.errors.volume.includes('Tank 1'), 'the source holds only 2000');
  const noRoom = planTransfer(src, list, { destinationId: 'b', volume: '1000', note: '' });
  assert.ok(!noRoom.ok && noRoom.errors.volume.includes('Tank 2'), 'only 500 fit');
  assert.ok(planTransfer(src, list, { destinationId: 'b', volume: '500', note: '' }).ok, 'exactly fills it');
  assert.ok(planTransfer(src, list, { destinationId: 'b', volume: '', note: '' }).ok, 'no liters given: nothing to check');
});

test('messages follow the language', () => {
  i18n.setLang('ka');
  const none = planTransfer(nine, all, { destinationId: null, volume: '', note: '' });
  assert.notEqual(none.errors.destination, 'Choose the vessel the wine goes to.');
  assert.ok(none.errors.destination.length > 5);
});

const { NEW_TANK } = require('../.test-build/transfer.js');

test('a new vessel: created first, with the entered name, type and volume, and the entries name it', () => {
  const result = planTransfer(
    nine,
    all,
    { destinationId: NEW_TANK, volume: '2000', note: '', newName: ' Tank 15 ', newKind: 'qvevri', newVolume: '2000' },
    false,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.plan.newTank, { name: 'Tank 15', kind: 'qvevri', volumeLiters: 2000, contentLiters: 2000, blend: null, variety: null, vintage: null });
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
});

test('a new vessel holds the wine moved into it, and must be big enough', () => {
  const some = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '1500', note: '', newName: 'Tank 15', newVolume: '5000' });
  assert.ok(some.ok);
  assert.equal(some.plan.newTank.volumeLiters, 5000, 'capacity as entered');
  assert.equal(some.plan.newTank.contentLiters, 1500, 'the wine moved');
  const noLiters = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '', note: '', newName: 'Tank 15', newVolume: '5000' });
  assert.equal(noLiters.plan.newTank.contentLiters, null);
  const small = planTransfer(nine, all, { destinationId: NEW_TANK, volume: '2000', note: '', newName: 'Tank 15', newVolume: '1500' });
  assert.ok(!small.ok && small.errors.newVolume);
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
const five = { volumeLiters: 5000, contentLiters: null };
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

test('emptiness with the wine in it recorded: 10 t tank holding 5 t', () => {
  const ten = { volumeLiters: 10000, contentLiters: 5000 };
  assert.equal(litersLeft(ten, [], [], 5000, now), 0, 'all of it moves: empty');
  assert.ok(isEmptyLeft(litersLeft(ten, [], [], 5000, now)));
  assert.equal(litersLeft(ten, [], [], 3000, now), 2000);
  assert.ok(!isEmptyLeft(litersLeft(ten, [], [], 3000, now)));
  assert.equal(litersLeft(ten, [out('2026-10-10T08:00:00Z', 9999)], [], 3000, now), 2000, 'the recorded amount wins over old transfers');
  assert.equal(litersLeft(ten, [], [], null, now), null);
});

test('emptiness: unknown liters, hectoliters, and no volume recorded on earlier transfers', () => {
  assert.equal(litersLeft(five, [], [], null, now), null);
  assert.equal(litersLeft(five, [out('2026-10-10T08:00:00Z', 30, 'hL')], [], 2000, now), 0);
  const noVolume = { type: 'transfer', createdAt: d('2026-10-10T08:00:00Z'), parsed: { items: [{ name: 'Destination', value: 'X', unit: null }] } };
  assert.equal(litersLeft(five, [noVolume], [], 2000, now), 3000, 'an earlier transfer without liters counts as 0');
  assert.ok(!isEmptyLeft(null));
  assert.ok(isEmptyLeft(0.8));
});

const { entriesToCarry } = require('../.test-build/transfer.js');

const note = (at, type = 'lab_analysis') => ({ type, rawText: '', createdAt: d(at), parsed: { tank_name: 'Tank 12', type, items: [{ name: 'pH', value: 3.4, unit: null }], note: null } });

test('the wine history that follows it: everything since the vessel was filled, except transfers', () => {
  const list = [
    note('2026-09-01T08:00:00Z'),
    note('2026-10-05T08:00:00Z', 'addition'),
    out('2026-10-06T08:00:00Z', 1000),
    note('2026-10-02T08:00:00Z', 'tasting'),
  ].map((e) => ({ rawText: '', ...e }));
  const all = entriesToCarry(list, [], now);
  assert.deepEqual(all.map((e) => e.type), ['lab_analysis', 'tasting', 'addition'], 'oldest first, no transfers');
  const since = entriesToCarry(list, [ferment('2026-10-01T00:00:00Z')], now);
  assert.deepEqual(since.map((e) => e.type), ['tasting', 'addition'], 'only since the latest ferment started');
  const received = entriesToCarry([...list, { ...into('2026-10-04T00:00:00Z', 5000), rawText: '' }], [], now);
  assert.deepEqual(received.map((e) => e.type), ['addition'], 'only since the wine last came in');
  assert.deepEqual(entriesToCarry([], [], now), []);
});
