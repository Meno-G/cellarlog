const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setStoreForTests, userKey } = require('../.test-build/storage.js');
const { tanksCache, tankCache, entriesCache, clearCache, saveOfflineCopy } = require('../.test-build/cache.js');
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

const tank12 = { id: 't12', name: 'Tank 12', volumeLiters: 5000, variety: 'Saperavi', vintage: 2025, createdAt: '2026-10-01T10:00:00Z' };
const tank2 = { id: 't2', name: 'Tank 2', volumeLiters: 1000.5, variety: null, vintage: null, createdAt: '2026-10-01T11:00:00Z' };
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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
