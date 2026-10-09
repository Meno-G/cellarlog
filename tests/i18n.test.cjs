// English / Georgian: switching, saving the choice, and what lib/ shows in each language.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setStoreForTests } = require('../.test-build/storage.js');
const i18n = require('../.test-build/i18n/index.js');
const { en } = require('../.test-build/i18n/en.js');
const { ka } = require('../.test-build/i18n/ka.js');
const { formatRelative, formatEntryTime, formatItemValue, formatLiters } = require('../.test-build/format.js');
const { validateTankForm } = require('../.test-build/tankForm.js');
const { tankKey, matchTank } = require('../.test-build/tankMatch.js');
const { toAppError } = require('../.test-build/errors.js');

let map;
beforeEach(() => {
  map = new Map();
  setStoreForTests({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  });
  i18n.setLang('en');
});

/** Every key of en exists in ka with the same kind of value (TypeScript checks this too). */
function sameShape(a, b, path = '') {
  for (const key of Object.keys(a)) {
    if (['items', 'units'].includes(key) && path === '') continue; // English shows stored names as they are
    assert.ok(key in b, `ka is missing ${path}${key}`);
    if (a[key] !== null && typeof a[key] === 'object' && !Array.isArray(a[key])) sameShape(a[key], b[key], `${path}${key}.`);
    else if (a[key] !== null) assert.equal(typeof b[key], typeof a[key], `${path}${key}`);
  }
}

test('Georgian has every text English has', () => {
  sameShape(en, ka);
});

test('the first start follows the phone; the choice is saved and wins after that', () => {
  assert.equal(i18n.loadLang('ka-GE'), 'ka');
  assert.equal(i18n.getLang(), 'ka');
  i18n.setLang('en');
  assert.equal(i18n.loadLang('en-US'), 'en');

  i18n.chooseLang('ka');
  assert.equal(i18n.loadLang('en-US'), 'ka', 'saved choice beats the phone language');
  i18n.chooseLang('en');
  assert.equal(i18n.loadLang('ka-GE'), 'en');
});

test('subscribers hear about a change once; switching to the same language is quiet', () => {
  let calls = 0;
  const unsubscribe = i18n.subscribeLang(() => calls++);
  i18n.setLang('ka');
  i18n.setLang('ka');
  i18n.setLang('en');
  unsubscribe();
  i18n.setLang('ka');
  assert.equal(calls, 2);
});

test('times, units and value names in Georgian', () => {
  const now = new Date(2026, 9, 7, 15, 0);
  i18n.setLang('ka');
  assert.equal(formatRelative(new Date(2026, 9, 7, 14, 50).toISOString(), now), '10 წთ-ის წინ');
  assert.equal(formatRelative(new Date(2026, 9, 6, 9, 0).toISOString(), now), 'გუშინ');
  assert.equal(formatRelative(new Date(2026, 8, 3, 9, 0).toISOString(), now), '3 სექ');
  assert.equal(formatRelative(new Date(2025, 8, 3, 9, 0).toISOString(), now), '3 სექ 2025');
  assert.match(formatEntryTime(new Date(2026, 9, 7, 9, 5).toISOString(), now), /^დღეს /);
  assert.equal(formatItemValue({ name: 'TA', value: 6.5, unit: 'g/L' }), '6.5 გ/ლ');
  assert.equal(formatItemValue({ name: 'Temperature', value: 18, unit: '°C' }), '18°C');
  assert.match(formatLiters(5000), / ლ$/);
  assert.equal(i18n.itemName('TA'), 'ტიტრ. მჟავიანობა');
  assert.equal(i18n.itemName('free so2'), 'თავისუფალი SO2');
  assert.equal(i18n.itemName('Colour'), 'Colour', 'own names stay as typed');

  i18n.setLang('en');
  assert.equal(formatItemValue({ name: 'TA', value: 6.5, unit: 'g/L' }), '6.5 g/L');
  assert.equal(i18n.itemName('TA'), 'TA');
});

test('lib messages follow the language', () => {
  const bad = { name: '', volume: 'abc', variety: '', vintage: '1800' };
  let result = validateTankForm(bad);
  assert.equal(result.errors.name, 'Give the tank a name, e.g. "Tank 12".');
  i18n.setLang('ka');
  result = validateTankForm(bad);
  assert.equal(result.errors.name, 'მიეცით ცისტერნას სახელი, მაგ. „ცისტერნა 12“.');
  assert.equal(result.errors.vintage, 'შეიყვანეთ წელი 1900-დან 2100-მდე, ან დატოვეთ ცარიელი.');
  assert.equal(toAppError(new TypeError('Network request failed'), 'x').message, ka.messages.network);
});

test('an English voice note finds a Georgian-named tank', () => {
  assert.equal(tankKey('ცისტერნა 12'), '12');
  assert.equal(tankKey('ც-12'), '12');
  const tanks = [{ id: 'a', name: 'ცისტერნა 12' }, { id: 'b', name: 'ცისტერნა 2' }];
  assert.equal(matchTank('tank 12', tanks)?.id, 'a');
  assert.equal(matchTank('T2', tanks)?.id, 'b');
});
