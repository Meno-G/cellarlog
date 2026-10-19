// Blends: what a vessel holds when wine of another grape or year is poured in.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { partsOf, mergeParts, resize, summary, formatBlend, describeWine } = require('../.test-build/blend.js');
const { receive, sendOut, planTransfer, NEW_TANK } = require('../.test-build/transfer.js');

beforeEach(() => i18n.setLang('en'));

const vessel = (name, variety, vintage, contentLiters, blend = null) => ({
  id: name, name, kind: 'tank', volumeLiters: 10000, contentLiters, variety, vintage, blend,
});

test('one wine, no wine, and a blend as parts', () => {
  assert.deepEqual(partsOf(vessel('A', 'Saperavi', 2025, 3000)), [{ variety: 'Saperavi', vintage: 2025, liters: 3000 }]);
  assert.deepEqual(partsOf(vessel('B', null, null, null)), []);
  const blend = [{ variety: 'Saperavi', vintage: 2025, liters: 1 }, { variety: 'Kisi', vintage: 2024, liters: 1 }];
  assert.equal(partsOf(vessel('C', 'Saperavi + Kisi', null, 2, blend)), blend);
});

test('mixing: the same wine adds up, a different grape or year becomes a part', () => {
  const base = [{ variety: 'Saperavi', vintage: 2025, liters: 1000 }];
  assert.deepEqual(mergeParts(base, [{ variety: 'SAPERAVI', vintage: 2025, liters: 500 }]), [{ variety: 'Saperavi', vintage: 2025, liters: 1500 }]);
  assert.equal(mergeParts(base, [{ variety: 'Saperavi', vintage: 2024, liters: 500 }]).length, 2, 'another year');
  assert.equal(mergeParts(base, [{ variety: 'Ojaleshi', vintage: 2025, liters: 500 }]).length, 2, 'another grape');
  assert.equal(mergeParts(base, [{ variety: 'Saperavi', vintage: 2025, liters: null }])[0].liters, null, 'an unknown amount makes it unknown');
});

test('summary and display of a blend', () => {
  const parts = [
    { variety: 'Saperavi', vintage: 2025, liters: 3000 },
    { variety: 'Ojaleshi', vintage: 2025, liters: 1000 },
  ];
  const s = summary(parts);
  assert.equal(s.variety, 'Saperavi + Ojaleshi');
  assert.equal(s.vintage, 2025, 'all the same year');
  assert.equal(s.blend.length, 2);
  assert.equal(formatBlend(parts), 'Saperavi 2025 (75%) + Ojaleshi 2025 (25%)');
  assert.equal(summary([{ variety: 'A', vintage: 2024, liters: 1 }, { variety: 'A', vintage: 2025, liters: 1 }]).vintage, null, 'different years');
  assert.deepEqual(summary([]), { variety: null, vintage: null, blend: null });
  assert.equal(summary([{ variety: 'Saperavi', vintage: 2025, liters: 5 }]).blend, null, 'one wine is not a blend');
  assert.equal(formatBlend([{ variety: 'A', vintage: 2024, liters: null }, { variety: 'B', vintage: null, liters: 5 }]), 'A 2024 + B', 'no shares when an amount is unknown');
  assert.equal(describeWine(vessel('X', 'Saperavi', 2025, 1)), 'Saperavi · 2025');
  assert.equal(describeWine({ variety: 'A + B', vintage: null, blend: parts }), 'Saperavi 2025 (75%) + Ojaleshi 2025 (25%)');
  assert.equal(describeWine(vessel('N', null, null, null)), null);
});

test('resize keeps the shares of a blend', () => {
  const parts = [{ variety: 'A', vintage: 1, liters: 3000 }, { variety: 'B', vintage: 1, liters: 1000 }];
  assert.deepEqual(resize(parts, 2000).map((p) => p.liters), [1500, 500]);
  assert.deepEqual(resize([{ variety: 'A', vintage: 1, liters: 3000 }], 700).map((p) => p.liters), [700]);
  assert.deepEqual(resize(parts, null).map((p) => p.liters), [null, null]);
});

test('pouring Saperavi into a vessel holding Ojaleshi makes a blend with shares', () => {
  const source = vessel('T12', 'Saperavi', 2025, 3000);
  const receiver = vessel('T30', 'Ojaleshi', 2025, 2000);
  const next = receive(source, receiver, 3000, true);
  assert.equal(next.contentLiters, 5000);
  assert.equal(next.variety, 'Ojaleshi + Saperavi');
  assert.equal(next.vintage, 2025);
  assert.equal(describeWine(next), 'Ojaleshi 2025 (40%) + Saperavi 2025 (60%)');
  // answering No keeps the receiver's wine as it was
  const plain = receive(source, receiver, 3000, false);
  assert.equal(plain.variety, 'Ojaleshi');
  assert.equal(plain.blend, null);
});

test('different years mix too, and the blend can go on into a third vessel', () => {
  const old = vessel('T1', 'Saperavi', 2024, 1000);
  const fresh = vessel('T2', 'Saperavi', 2025, 1000);
  const mixed = receive(old, fresh, 1000, true);
  assert.equal(mixed.vintage, null);
  assert.equal(describeWine(mixed), 'Saperavi 2025 (50%) + Saperavi 2024 (50%)');
  const blended = { ...vessel('T2', mixed.variety, mixed.vintage, 2000, mixed.blend) };
  const toNew = planTransfer(blended, [blended], { destinationId: NEW_TANK, volume: '1000', note: '', newName: 'T3', newVolume: '2000' }, true);
  assert.ok(toNew.ok);
  assert.deepEqual(toNew.plan.newTank.blend.map((p) => p.liters), [500, 500], 'half the volume, same shares');
  assert.equal(toNew.plan.newTank.contentLiters, 1000);
});

test('a new vessel is created with the wine: name, grape and year', () => {
  const source = vessel('T12', 'SAPERAVI', 2025, 3000);
  const result = planTransfer(source, [source], { destinationId: NEW_TANK, volume: '3000', note: '', newName: 'T30', newVolume: '5000' }, true);
  assert.ok(result.ok);
  assert.equal(result.plan.newTank.variety, 'SAPERAVI');
  assert.equal(result.plan.newTank.vintage, 2025);
  assert.equal(result.plan.newTank.blend, null);
});

test('the source keeps its blend, in a smaller amount, or loses it when empty', () => {
  const blend = [{ variety: 'A', vintage: 1, liters: 3000 }, { variety: 'B', vintage: 1, liters: 1000 }];
  const source = vessel('S', 'A + B', 1, 4000, blend);
  const left = sendOut(source, 2000, false);
  assert.equal(left.contentLiters, 2000);
  assert.deepEqual(left.blend.map((p) => p.liters), [1500, 500]);
  const empty = sendOut(source, 4000, true);
  assert.deepEqual([empty.variety, empty.vintage, empty.blend, empty.contentLiters], [null, null, null, 0]);
});
