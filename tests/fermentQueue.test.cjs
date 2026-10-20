// Ferment changes made offline: queued, shown at once, uploaded in order.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../.test-build/storage.js');
const outbox = require('../.test-build/outbox.js');
const { applyFermentChanges } = require('../.test-build/fermentOverlay.js');

const memory = new Map();
beforeEach(() => {
  memory.clear();
  storage.setStoreForTests({ getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) });
});

const meta = (n) => ({ localId: `L${n}`, createdAt: `2026-10-0${n}T10:00:00.000Z` });
const input = (name, start = '2026-10-01T00:00:00.000Z', end = null) => ({ name, startedAt: start, endedAt: end });
const server = { id: 'f1', tankId: 't1', name: 'Harvest', startedAt: '2026-09-20T00:00:00.000Z', endedAt: null, createdAt: '2026-09-20T00:00:00.000Z' };

test('a ferment started offline shows at once; changing it again replaces the queued change', () => {
  outbox.enqueueFermentSave('u', 't1', 'new1', input('Harvest 2026'), true, meta(1));
  outbox.enqueueFermentSave('u', 't1', 'new1', input('Harvest 2026', '2026-10-01T00:00:00.000Z', '2026-10-12T00:00:00.000Z'), false, meta(2));
  const items = outbox.listOutbox('u');
  assert.equal(items.length, 1, 'one queued change');
  assert.equal(items[0].isNew, true, 'it never reached the server, so it stays new');
  assert.equal(items[0].localId, 'L1', 'and keeps its first identity');
  const shown = applyFermentChanges([], items, 't1');
  assert.deepEqual(shown.map((f) => [f.id, f.name, f.endedAt]), [['new1', 'Harvest 2026', '2026-10-12T00:00:00.000Z']]);
  assert.deepEqual(applyFermentChanges([], items, 'other'), [], 'only this vessel');
});

test('ending a ferment from the server copy is shown on top of it; deleting hides it', () => {
  outbox.enqueueFermentSave('u', 't1', 'f1', input('Harvest', server.startedAt, '2026-10-05T00:00:00.000Z'), false, meta(1));
  const ended = applyFermentChanges([server], outbox.listOutbox('u'), 't1');
  assert.equal(ended[0].endedAt, '2026-10-05T00:00:00.000Z');
  assert.equal(ended[0].createdAt, server.createdAt, 'keeps when it was created');
  outbox.enqueueFermentDelete('u', 't1', 'f1', meta(2));
  const items = outbox.listOutbox('u');
  assert.deepEqual(items.map((i) => i.kind), ['ferment-delete'], 'the earlier change is dropped');
  assert.deepEqual(applyFermentChanges([server], items, 't1'), []);
});

test('deleting a ferment that never uploaded just removes it from the queue', () => {
  outbox.enqueueFermentSave('u', 't1', 'new1', input('X'), true, meta(1));
  assert.equal(outbox.enqueueFermentDelete('u', 't1', 'new1', meta(2)), null);
  assert.deepEqual(outbox.listOutbox('u'), []);
  assert.ok(!outbox.hasQueuedFermentChanges([], 'new1'));
});

test('uploads wait for a vessel created offline, and go in order', async () => {
  outbox.enqueueTankCreate('u', { name: 'T', kind: 'tank', volumeLiters: 100, contentLiters: null, variety: null, vintage: null, blend: null }, { localId: 'tank-new', createdAt: '2026-10-01T09:00:00.000Z' });
  outbox.enqueueFermentSave('u', 'tank-new', 'fnew', input('F'), true, meta(2));
  const sent = [];
  const result = await outbox.flushQueue('u', async (item) => {
    sent.push(item.kind);
  });
  assert.deepEqual(sent, ['tank-create', 'ferment-save']);
  assert.equal(result.uploaded, 2);

  // a vessel whose creation failed holds its ferment back
  outbox.enqueueTankCreate('u', { name: 'T2', kind: 'tank', volumeLiters: 100, contentLiters: null, variety: null, vintage: null, blend: null }, { localId: 'tank-bad', createdAt: '2026-10-03T09:00:00.000Z' });
  outbox.enqueueFermentSave('u', 'tank-bad', 'f2', input('F2'), true, meta(4));
  const sent2 = [];
  await outbox.flushQueue('u', async (item) => {
    sent2.push(item.kind);
    if (item.kind === 'tank-create') throw new Error('name taken');
  });
  assert.deepEqual(sent2, ['tank-create'], 'the ferment is not tried');
});

test('deleting a vessel drops the ferment changes queued for it', () => {
  outbox.enqueueFermentSave('u', 't1', 'f1', input('F'), false, meta(1));
  outbox.enqueueTankDelete('u', 't1', meta(2));
  assert.deepEqual(outbox.listOutbox('u').map((i) => i.kind), ['tank-delete']);
});
