// SO2 calculator: molecular fraction, needed free SO2, KMBS amount, form checks.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { molecularFraction, so2Plan, so2FromForm } = require('../.test-build/so2.js');

beforeEach(() => i18n.setLang('en'));

test('free SO2 needed for 0.8 mg/L molecular matches published tables', () => {
  // Iowa State / Oklahoma State tables: about 21-22 at pH 3.2, 50-55 at 3.6, 125 at 4.0.
  const needed = (ph) => so2Plan(ph, 0, 0.8, null).neededFree;
  assert.ok(Math.abs(needed(3.2) - 21) < 2, String(needed(3.2)));
  assert.ok(Math.abs(needed(3.6) - 50) < 3, String(needed(3.6)));
  assert.ok(Math.abs(needed(4.0) - 125) < 5, String(needed(4.0)));
  assert.ok(Math.abs(molecularFraction(3.5) - 0.0196) < 0.001, 'about 2% at pH 3.5');
});

test('what to add and the KMBS for a volume', () => {
  const plan = so2Plan(3.6, 20, 0.8, 1000);
  assert.equal(plan.neededFree, 50.1);
  assert.equal(plan.toAddMgL, 30.1);
  assert.equal(plan.toAddGHl, 3.01, '1 mg/L = 0.1 g/hL');
  assert.equal(plan.kmbsGrams, 52.9, 'about 30 g SO2 / 0.57');
  assert.equal(so2Plan(3.6, 20, 0.8, null).kmbsGrams, null);
  const enough = so2Plan(3.2, 60, 0.8, 500);
  assert.equal(enough.toAddMgL, 0, 'already above the target');
  assert.equal(enough.kmbsGrams, 0);
  assert.ok(so2Plan(3.6, 40, 0.8, null).molecularNow > 0.6);
});

test('the form: numbers with commas, optional volume, and range errors', () => {
  const ok = so2FromForm({ ph: '3,45', free: '25', target: '0.8', liters: '' });
  assert.ok(ok.ok);
  assert.equal(ok.plan.kmbsGrams, null);
  for (const bad of [{ ph: '7' }, { ph: '' }, { free: '-1' }, { free: 'lots' }, { target: '5' }, { liters: '0' }]) {
    const result = so2FromForm({ ph: '3.4', free: '25', target: '0.8', liters: '1000', ...bad });
    assert.ok(!result.ok, JSON.stringify(bad));
    assert.ok(Object.keys(result.errors).length >= 1);
  }
});
