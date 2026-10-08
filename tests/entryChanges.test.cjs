// Editing and deleting entries on the phone (offline), and how the timeline shows it.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setStoreForTests } = require('../.test-build/storage.js');
const {
  enqueue,
  enqueueEntryUpdate,
  enqueueEntryDelete,
  enqueueTankDelete,
  enqueueTankCreate,
  dropQueuedForEntry,
  hasQueuedEntryChanges,
  isLocalEntry,
  listOutbox,
  markFailed,
  flushQueue,
} = require('../.test-build/outbox.js');
const { applyEntryChanges } = require('../.test-build/entryOverlay.js');
const { entriesCache, removeEntryFromCache } = require('../.test-build/cache.js');

beforeEach(() => {
  const map = new Map();
  setStoreForTests({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  });
});

const parsed = (items, type = 'lab_analysis') => ({ tank_name: 'Tank 12', type, items, note: null });
const serverEntry = (id, createdAt, items, tankId = 't12') => ({
  id, tankId, type: 'lab_analysis', rawText: '', parsed: parsed(items), createdAt,
});
const valid = (items, tankId = 't12') => ({ tankId, type: 'lab_analysis', rawText: '', parsed: parsed(items) });
const ph = (value) => [{ name: 'pH', value, unit: null }];
let n = 0;
const meta = () => ({ localId: `q${++n}`, createdAt: `2026-10-08T10:00:${String(n % 60).padStart(2, '0')}Z` });

const e1 = serverEntry('e1', '2026-10-01T08:00:00Z', ph(3.5));
const e2 = serverEntry('e2', '2026-10-02T08:00:00Z', ph(3.4));

test('edit offline: the timeline shows the new values at the original place', () => {
  enqueueEntryUpdate('u1', e1, valid(ph(3.45)), meta());
  const shown = applyEntryChanges([e2, e1], listOutbox('u1'), 't12');
  assert.deepEqual(shown.map((e) => e.id), ['e2', 'e1']);
  assert.equal(shown[1].parsed.items[0].value, 3.45);
  assert.equal(shown[1].createdAt, e1.createdAt);
  assert.equal(shown[1].upload.action, 'edit');
  assert.equal(shown[0].upload, null);
});

test('edit offline: a second edit replaces the first', () => {
  enqueueEntryUpdate('u1', e1, valid(ph(3.45)), meta());
  enqueueEntryUpdate('u1', e1, valid(ph(3.47)), meta());
  const items = listOutbox('u1');
  assert.equal(items.length, 1);
  assert.equal(items[0].parsed.items[0].value, 3.47);
});

test('edit an entry that has not uploaded yet: the queued entry changes, keeping its id and time', () => {
  const created = meta();
  enqueue('u1', valid(ph(3.5)), created);
  enqueueEntryUpdate('u1', { id: created.localId, createdAt: created.createdAt }, valid(ph(3.6)), meta());
  const items = listOutbox('u1');
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'entry');
  assert.equal(items[0].localId, created.localId);
  assert.equal(items[0].createdAt, created.createdAt);
  assert.equal(items[0].parsed.items[0].value, 3.6);
});

test('moving an entry to another tank offline: it leaves one timeline and joins the other', () => {
  enqueueEntryUpdate('u1', e1, valid(ph(3.5), 't14'), meta());
  const items = listOutbox('u1');
  assert.deepEqual(applyEntryChanges([e2, e1], items, 't12').map((e) => e.id), ['e2']);
  const moved = applyEntryChanges([], items, 't14');
  assert.deepEqual(moved.map((e) => [e.id, e.tankId, e.createdAt]), [['e1', 't14', e1.createdAt]]);
});

test('delete offline: hidden at once, its queued edit is dropped; a failed delete shows it again, marked', () => {
  enqueueEntryUpdate('u1', e1, valid(ph(3.45)), meta());
  const del = enqueueEntryDelete('u1', e1, meta());
  let items = listOutbox('u1');
  assert.deepEqual(items.map((i) => i.kind), ['entry-delete']);
  assert.deepEqual(applyEntryChanges([e2, e1], items, 't12').map((e) => e.id), ['e2']);

  markFailed('u1', del.localId, 'Server said no');
  items = listOutbox('u1');
  const shown = applyEntryChanges([e2, e1], items, 't12');
  assert.deepEqual(shown.map((e) => e.id), ['e2', 'e1']);
  assert.deepEqual(shown[1].upload, { status: 'failed', error: 'Server said no', action: 'delete', localId: del.localId });
});

test('delete an entry that never uploaded: it just leaves the queue', () => {
  const created = meta();
  enqueue('u1', valid(ph(3.5)), created);
  assert.ok(isLocalEntry(listOutbox('u1'), created.localId));
  assert.equal(enqueueEntryDelete('u1', { id: created.localId, tankId: 't12' }, meta()), null);
  assert.deepEqual(listOutbox('u1'), []);
});

test('queued changes for an entry are detected, and dropped after a direct delete', () => {
  assert.ok(!hasQueuedEntryChanges(listOutbox('u1'), 'e1'));
  enqueueEntryUpdate('u1', e1, valid(ph(3.45)), meta());
  assert.ok(hasQueuedEntryChanges(listOutbox('u1'), 'e1'));
  assert.ok(!hasQueuedEntryChanges(listOutbox('u1'), 'e2'));
  dropQueuedForEntry('u1', 'e1');
  assert.deepEqual(listOutbox('u1'), []);
});

test('flush: edits and deletes upload in order; an edit into a tank not created yet waits', async () => {
  const tank = meta();
  enqueueTankCreate('u1', { name: 'Tank 14', volumeLiters: 1000, variety: null, vintage: null }, tank);
  markFailed('u1', tank.localId, 'name clash');
  enqueueEntryUpdate('u1', e1, valid(ph(3.5), tank.localId), meta());
  enqueueEntryDelete('u1', e2, meta());
  const sent = [];
  const result = await flushQueue('u1', async (item) => {
    sent.push(`${item.kind}:${item.entryId}`);
  });
  assert.deepEqual(sent, ['entry-delete:e2']);
  assert.equal(result.uploaded, 1);
  assert.deepEqual(listOutbox('u1').map((i) => i.kind), ['tank-create', 'entry-update']);
});

test('deleting a tank offline drops queued edits and deletes of its entries', () => {
  enqueueEntryUpdate('u1', e1, valid(ph(3.45)), meta());
  enqueueEntryDelete('u1', e2, meta());
  enqueueTankDelete('u1', 't12', meta());
  assert.deepEqual(listOutbox('u1').map((i) => i.kind), ['tank-delete']);
});

test('cache: a deleted entry leaves its saved timeline', () => {
  entriesCache('u1', 't12').write([e2, e1]);
  removeEntryFromCache('u1', 't12', 'e1');
  assert.deepEqual(entriesCache('u1', 't12').read().data.map((e) => e.id), ['e2']);
  removeEntryFromCache('u1', 't99', 'e1'); // no saved timeline: nothing happens
});

test('overlay: new entries queued for this tank show, newest first; other tanks\' do not', () => {
  const created = meta();
  enqueue('u1', valid(ph(3.3)), created);
  enqueue('u1', valid(ph(3.3), 't14'), meta());
  const shown = applyEntryChanges([e2, e1], listOutbox('u1'), 't12');
  assert.deepEqual(shown.map((e) => e.id), [created.localId, 'e2', 'e1']);
  assert.equal(shown[0].upload.action, 'create');
});
