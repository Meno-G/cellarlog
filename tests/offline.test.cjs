const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setStoreForTests, userKey } = require('../.test-build/storage.js');
const { tanksCache, tankCache, entriesCache, clearCache, saveOfflineCopy, removeTankFromCache } = require('../.test-build/cache.js');
const {
  enqueue,
  listOutbox,
  markFailed,
  markPending,
  removeFromOutbox,
  flushQueue,
  newLocalId,
} = require('../.test-build/outbox.js');
const { AppError } = require('../.test-build/errors.js');
const {
  enqueueTankCreate,
  enqueueTankUpdate,
  enqueueTankDelete,
  dropQueuedForTank,
  discardLocalTank,
  isLocalTank,
} = require('../.test-build/outbox.js');
const { applyTankChanges, findDuplicateName } = require('../.test-build/tankOverlay.js');

/** In-memory stand-in for the phone's localStorage. */
function memoryStore() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let store;
beforeEach(() => {
  store = memoryStore();
  setStoreForTests(store);
});

const tank12 = { id: 't12', name: 'Tank 12', kind: 'tank', volumeLiters: 5000, contentLiters: null, blend: null, variety: 'Saperavi', vintage: 2025, createdAt: '2026-10-01T10:00:00Z' };
const tank2 = { id: 't2', name: 'Tank 2', kind: 'tank', volumeLiters: 1000.5, contentLiters: null, blend: null, variety: null, vintage: null, createdAt: '2026-10-01T11:00:00Z' };
const parsed = { tank_name: 'Tank 12', type: 'addition', items: [{ name: 'SO2', value: 20, unit: 'g/hL' }], note: null };
const entry = { id: 'e1', tankId: 't12', type: 'addition', rawText: 'Tank 12 added 20 g/hl SO2', parsed, createdAt: '2026-10-02T09:00:00Z' };
const valid = { tankId: 't12', type: 'addition', rawText: 'Tank 12 added 20 g/hl SO2', parsed };

// ---- cache ----------------------------------------------------------------
test('cache: tanks and timelines round-trip, with the time they were saved', () => {
  tanksCache('u1').write([tank12, tank2]);
  const tanks = tanksCache('u1').read();
  assert.deepEqual(tanks.data, [tank12, tank2]);
  assert.ok(!Number.isNaN(Date.parse(tanks.savedAt)));

  entriesCache('u1', 't12').write([entry]);
  assert.deepEqual(entriesCache('u1', 't12').read().data, [entry]);
  assert.equal(entriesCache('u1', 't2').read(), null);
});

test('cache: one tank is read from and written into the cached list', () => {
  tanksCache('u1').write([tank12, tank2]);
  assert.deepEqual(tankCache('u1', 't2').read().data, tank2);
  assert.equal(tankCache('u1', 'nope').read(), null);
  tankCache('u1', 't2').write({ ...tank2, volumeLiters: 900 });
  assert.equal(tanksCache('u1').read().data.find((t) => t.id === 't2').volumeLiters, 900);
});

test('cache: corrupt or outdated data reads as nothing instead of crashing', () => {
  store.setItem(userKey('u1', 'tanks'), '{not json');
  assert.equal(tanksCache('u1').read(), null);
  store.setItem(userKey('u1', 'tanks'), JSON.stringify({ data: [{ id: 1 }], savedAt: 'x' }));
  assert.equal(tanksCache('u1').read(), null);
});

test('cache: users never see each other\'s data, and sign-out clears it', () => {
  tanksCache('u1').write([tank12]);
  entriesCache('u1', 't12').write([entry]);
  assert.equal(tanksCache('u2').read(), null);
  enqueue('u1', valid, { localId: 'q1', createdAt: '2026-10-02T10:00:00Z' });
  clearCache('u1');
  assert.equal(tanksCache('u1').read(), null);
  assert.equal(entriesCache('u1', 't12').read(), null);
  assert.equal(listOutbox('u1').length, 1, 'queued entries survive sign-out');
});

test('cache: one sync saves every timeline, even tanks never opened', () => {
  const e = (id, tankId, at) => ({ ...entry, id, tankId, createdAt: at });
  const recent = [e('3', 't12', '2026-10-03'), e('2', 't2', '2026-10-02'), e('1', 't12', '2026-10-01')];
  saveOfflineCopy('u1', [tank12, tank2, { ...tank2, id: 't99', name: 'Tank 99' }], recent, 200);
  assert.deepEqual(tanksCache('u1').read().data.map((t) => t.id), ['t12', 't2', 't99']);
  assert.deepEqual(entriesCache('u1', 't12').read().data.map((x) => x.id), ['3', '1'], 'newest first');
  assert.deepEqual(entriesCache('u1', 't2').read().data.map((x) => x.id), ['2']);
  assert.deepEqual(entriesCache('u1', 't99').read().data, [], 'a tank with no entries opens empty, not as an error');
  saveOfflineCopy('u1', [tank12], recent, 1);
  assert.deepEqual(entriesCache('u1', 't12').read().data.map((x) => x.id), ['3'], 'per-tank limit');
});

// ---- outbox ---------------------------------------------------------------
test('outbox: keeps entries in the order they were recorded', () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '2026-10-02T10:00:00Z' });
  enqueue('u1', { ...valid, rawText: 'second' }, { localId: 'b', createdAt: '2026-10-02T10:05:00Z' });
  assert.deepEqual(listOutbox('u1').map((i) => [i.localId, i.status]), [['a', 'pending'], ['b', 'pending']]);
  assert.equal(listOutbox('u2').length, 0);
});

test('outbox: fail, retry and remove', () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '2026-10-02T10:00:00Z' });
  markFailed('u1', 'a', 'That tank no longer exists.');
  assert.deepEqual([listOutbox('u1')[0].status, listOutbox('u1')[0].error], ['failed', 'That tank no longer exists.']);
  markPending('u1', 'a');
  assert.deepEqual([listOutbox('u1')[0].status, listOutbox('u1')[0].error], ['pending', null]);
  removeFromOutbox('u1', 'a');
  assert.equal(listOutbox('u1').length, 0);
});

test('outbox: a full phone storage is reported, not silently lost', () => {
  setStoreForTests({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
  assert.throws(() => enqueue('u1', valid, { localId: 'a', createdAt: 'x' }), /storage may be full/);
});

test('flush: uploads oldest first and empties the queue', async () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '1' });
  enqueue('u1', valid, { localId: 'b', createdAt: '2' });
  const seen = [];
  const result = await flushQueue('u1', async (item) => { seen.push(item.localId); });
  assert.deepEqual(seen, ['a', 'b']);
  assert.deepEqual(result, { uploaded: 2, failed: 0, interrupted: false });
  assert.equal(listOutbox('u1').length, 0);
});

test('flush: losing the connection stops and keeps the rest queued', async () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '1' });
  enqueue('u1', valid, { localId: 'b', createdAt: '2' });
  enqueue('u1', valid, { localId: 'c', createdAt: '3' });
  const result = await flushQueue('u1', async (item) => {
    if (item.localId === 'b') throw new TypeError('Network request failed');
  });
  assert.deepEqual(result, { uploaded: 1, failed: 0, interrupted: true });
  assert.deepEqual(listOutbox('u1').map((i) => [i.localId, i.status]), [['b', 'pending'], ['c', 'pending']]);
});

test('flush: an expired login also waits instead of failing the entry', async () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '1' });
  const result = await flushQueue('u1', async () => { throw new AppError('auth', 'Session expired'); });
  assert.equal(result.interrupted, true);
  assert.equal(listOutbox('u1')[0].status, 'pending');
});

test('flush: an entry that can never upload is flagged, the others continue', async () => {
  enqueue('u1', valid, { localId: 'a', createdAt: '1' });
  enqueue('u1', valid, { localId: 'b', createdAt: '2' });
  const result = await flushQueue('u1', async (item) => {
    if (item.localId === 'a') throw new AppError('not_found', 'That tank no longer exists. Pick another tank.');
  });
  assert.deepEqual(result, { uploaded: 1, failed: 1, interrupted: false });
  assert.deepEqual(listOutbox('u1').map((i) => [i.localId, i.status, i.error]), [
    ['a', 'failed', 'That tank no longer exists. Pick another tank.'],
  ]);
  const again = await flushQueue('u1', async () => { throw new Error('should not be called'); });
  assert.deepEqual(again, { uploaded: 0, failed: 0, interrupted: false }, 'failed entries wait for Try again');
});

// ---- tanks offline ----------------------------------------------------------
const newTank = { name: 'Tank 7', volumeLiters: 800, variety: 'Rkatsiteli', vintage: 2026 };

test('outbox: entries queued by the previous app version (no "kind") still load', () => {
  const legacy = { localId: 'old', tankId: 't12', type: 'note', rawText: 'Sulfur dioxide 22.', parsed: { ...parsed, type: 'note', items: [] }, createdAt: '2026-10-06T08:17:27.608Z', status: 'pending', error: null };
  store.setItem(userKey('u1', 'outbox'), JSON.stringify([legacy, { garbage: true }]));
  const items = listOutbox('u1');
  assert.equal(items.length, 1, 'the unreadable item is skipped, the good one kept');
  assert.equal(items[0].kind, 'entry');
  assert.equal(items[0].rawText, 'Sulfur dioxide 22.');
});

test('flush: a tank created offline uploads before the entries recorded for it', async () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '1' });
  enqueue('u1', { ...valid, tankId: 'tank-local' }, { localId: 'e-local', createdAt: '2' });
  assert.equal(isLocalTank(listOutbox('u1'), 'tank-local'), true);
  const seen = [];
  const result = await flushQueue('u1', async (item) => { seen.push(`${item.kind}:${item.localId}`); });
  assert.deepEqual(seen, ['tank-create:tank-local', 'entry:e-local']);
  assert.equal(result.uploaded, 2);
});

test('flush: entries wait (not fail) while their tank cannot upload; others continue', async () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '1' });
  enqueue('u1', { ...valid, tankId: 'tank-local' }, { localId: 'e-local', createdAt: '2' });
  enqueue('u1', valid, { localId: 'e-other', createdAt: '3' });
  const seen = [];
  const result = await flushQueue('u1', async (item) => {
    seen.push(item.localId);
    if (item.kind === 'tank-create') throw new AppError('validation', 'You already have a tank called "Tank 7".', { field: 'name' });
  });
  assert.deepEqual(seen, ['tank-local', 'e-other'], 'the waiting entry is not even tried');
  assert.deepEqual(result, { uploaded: 1, failed: 1, interrupted: false });
  assert.deepEqual(listOutbox('u1').map((i) => [i.localId, i.status]), [['tank-local', 'failed'], ['e-local', 'pending']]);
});

test('outbox: editing a tank that has not uploaded yet changes the queued tank', () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '1' });
  markFailed('u1', 'tank-local', 'You already have a tank called "Tank 7".');
  enqueueTankUpdate('u1', 'tank-local', { ...newTank, name: 'Tank 7B' }, { localId: 'upd', createdAt: '2' });
  const items = listOutbox('u1');
  assert.equal(items.length, 1, 'no separate edit is queued');
  assert.deepEqual([items[0].kind, items[0].tank.name, items[0].status, items[0].error], ['tank-create', 'Tank 7B', 'pending', null]);
});

test('outbox: a second offline edit of a tank replaces the first', () => {
  enqueueTankUpdate('u1', 't12', { ...newTank, name: 'Tank 12', volumeLiters: 4800 }, { localId: 'u1a', createdAt: '1' });
  enqueueTankUpdate('u1', 't12', { ...newTank, name: 'Tank 12', volumeLiters: 4500 }, { localId: 'u1b', createdAt: '2' });
  const items = listOutbox('u1');
  assert.deepEqual(items.map((i) => [i.kind, i.tankId, i.tank.volumeLiters]), [['tank-update', 't12', 4500]]);
});

test('outbox: deleting a tank that never uploaded also drops its entries', () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '1' });
  enqueue('u1', { ...valid, tankId: 'tank-local' }, { localId: 'e-local', createdAt: '2' });
  enqueue('u1', valid, { localId: 'e-other', createdAt: '3' });
  discardLocalTank('u1', 'tank-local');
  assert.deepEqual(listOutbox('u1').map((i) => i.localId), ['e-other']);
});

test('overlay: tanks created and edited offline show at once, sorted, with their upload state', () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '2026-10-06T09:00:00Z' });
  enqueueTankUpdate('u1', 't12', { name: 'Tank 12', volumeLiters: 4800, variety: 'Saperavi', vintage: 2025 }, { localId: 'upd', createdAt: '2' });
  const shown = applyTankChanges([tank12, tank2], listOutbox('u1'));
  assert.deepEqual(shown.map((t) => t.name), ['Tank 2', 'Tank 7', 'Tank 12']);
  const t7 = shown.find((t) => t.id === 'tank-local');
  assert.deepEqual([t7.volumeLiters, t7.upload.status], [800, 'pending']);
  const t12 = shown.find((t) => t.id === 't12');
  assert.deepEqual([t12.volumeLiters, t12.upload.status], [4800, 'pending']);
  assert.equal(shown.find((t) => t.id === 't2').upload, null);
});

test('duplicate tank names are caught on the phone (case, spaces, "T12" spelling)', () => {
  const list = [tank12, tank2];
  assert.equal(findDuplicateName(' tank 12 ', list, null)?.id, 't12');
  assert.equal(findDuplicateName('T12', list, null)?.id, 't12');
  assert.equal(findDuplicateName('Tank 12', list, 't12'), null, 'renaming a tank to its own name is fine');
  assert.equal(findDuplicateName('Tank 3', list, null), null);
});

// ---- deleting tanks ---------------------------------------------------------
test('delete offline: a server tank is queued, and its other queued changes are dropped', () => {
  enqueue('u1', valid, { localId: 'e12', createdAt: '1' }); // entry for t12
  enqueueTankUpdate('u1', 't12', { name: 'Tank 12', volumeLiters: 4800, variety: null, vintage: null }, { localId: 'upd', createdAt: '2' });
  enqueue('u1', { ...valid, tankId: 't2' }, { localId: 'e2', createdAt: '3' });
  const item = enqueueTankDelete('u1', 't12', { localId: 'del', createdAt: '4' });
  assert.equal(item.kind, 'tank-delete');
  assert.deepEqual(listOutbox('u1').map((i) => [i.kind, i.localId]), [['entry', 'e2'], ['tank-delete', 'del']]);
});

test('delete offline: a tank that never uploaded is just discarded with its entries', () => {
  enqueueTankCreate('u1', newTank, { localId: 'tank-local', createdAt: '1' });
  enqueue('u1', { ...valid, tankId: 'tank-local' }, { localId: 'e-local', createdAt: '2' });
  assert.equal(enqueueTankDelete('u1', 'tank-local', { localId: 'del', createdAt: '3' }), null);
  assert.equal(listOutbox('u1').length, 0, 'nothing to send to the server');
});

test('delete online: changes still queued for that tank are dropped', () => {
  enqueue('u1', valid, { localId: 'e12', createdAt: '1' });
  enqueue('u1', { ...valid, tankId: 't2' }, { localId: 'e2', createdAt: '2' });
  dropQueuedForTank('u1', 't12');
  assert.deepEqual(listOutbox('u1').map((i) => i.localId), ['e2']);
});

test('overlay: a pending delete hides the tank at once; a failed one shows it, marked', () => {
  enqueueTankDelete('u1', 't12', { localId: 'del', createdAt: '1' });
  assert.deepEqual(applyTankChanges([tank12, tank2], listOutbox('u1')).map((t) => t.id), ['t2']);
  markFailed('u1', 'del', "You don't have access to that.");
  const t12 = applyTankChanges([tank12, tank2], listOutbox('u1')).find((t) => t.id === 't12');
  assert.deepEqual([t12.upload.status, t12.upload.action], ['failed', 'delete']);
});

test('flush: a queued delete is uploaded like any other change', async () => {
  enqueueTankDelete('u1', 't12', { localId: 'del', createdAt: '1' });
  const seen = [];
  await flushQueue('u1', async (item) => { seen.push(`${item.kind}:${item.tankId}`); });
  assert.deepEqual(seen, ['tank-delete:t12']);
  assert.equal(listOutbox('u1').length, 0);
});

test('cache: a deleted tank and its timeline leave the saved copy', () => {
  saveOfflineCopy('u1', [tank12, tank2], [entry], 200);
  removeTankFromCache('u1', 't12');
  assert.deepEqual(tanksCache('u1').read().data.map((t) => t.id), ['t2']);
  assert.equal(entriesCache('u1', 't12').read(), null);
});

const UUID_V4 =/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('newLocalId: a valid, unique UUID v4 (it becomes the entry id)', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newLocalId()));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, UUID_V4);
});

test('newLocalId: the fallback for phones without crypto.randomUUID', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  } catch {
    t.skip('crypto cannot be hidden in this Node version');
    return;
  }
  try {
    const ids = new Set(Array.from({ length: 500 }, () => newLocalId()));
    assert.equal(ids.size, 500);
    for (const id of ids) assert.match(id, UUID_V4);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});

const { searchTanks } = require('../.test-build/tankOverlay.js');

test('search: by name (also "t12"), variety or vintage; every word must match', () => {
  const tanks = [
    { name: 'Tank 12', variety: 'Saperavi', vintage: 2025 },
    { name: 'Tank 2', variety: 'Rkatsiteli', vintage: 2024 },
    { name: 'Barrique 3', variety: 'Saperavi', vintage: 2024 },
  ];
  const names = (query) => searchTanks(tanks, query).map((t) => t.name);
  assert.deepEqual(names(''), ['Tank 12', 'Tank 2', 'Barrique 3']);
  assert.deepEqual(names('  '), ['Tank 12', 'Tank 2', 'Barrique 3']);
  assert.deepEqual(names('t12'), ['Tank 12']);
  assert.deepEqual(names('saperavi'), ['Tank 12', 'Barrique 3']);
  assert.deepEqual(names('saperavi 2024'), ['Barrique 3']);
  assert.deepEqual(names('barr'), ['Barrique 3']);
  assert.deepEqual(names('merlot'), []);
});
