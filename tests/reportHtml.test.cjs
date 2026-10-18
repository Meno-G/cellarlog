// The printable report: escaping, content and language.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../.test-build/i18n/index.js');
const { buildReportHtml, esc, reportTitle } = require('../.test-build/reportHtml.js');

beforeEach(() => i18n.setLang('en'));

const d = (iso) => new Date(iso).toISOString();
const vessel = { name: 'Qvevri 3', kind: 'qvevri', variety: 'Saperavi', vintage: 2026, volumeLiters: 800 };
const ferment = { id: 'f', name: 'Saperavi 2026', startedAt: d('2026-10-01T00:00:00Z'), endedAt: null };
const entry = (at, type, items, note = null, rawText = '') => ({ type, createdAt: d(at), rawText, parsed: { note, items } });
const now = new Date('2026-10-18T12:00:00Z');

test('everything typed by the user is escaped (names, notes, what was said)', () => {
  const html = buildReportHtml({
    vessel: { ...vessel, name: '<img src=x onerror=alert(1)>' },
    ferment: null,
    entries: [entry('2026-10-05T10:00:00Z', 'note', [], '<script>alert("x")</script>', 'said & "done" <b>')],
    now,
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('said &amp; &quot;done&quot; &lt;b&gt;'));
  assert.equal(esc(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;');
});

test('a ferment report names the ferment, its period, its days and the day of each entry', () => {
  const html = buildReportHtml({
    vessel,
    ferment,
    entries: [
      entry('2026-10-12T08:00:00Z', 'lab_analysis', [{ name: 'Density', value: 1.05, unit: null }, { name: 'Temperature', value: 24, unit: '°C' }]),
      entry('2026-10-03T08:00:00Z', 'lab_analysis', [{ name: 'Density', value: 1.085, unit: null }]),
    ],
    now,
  });
  assert.ok(html.includes('Saperavi 2026'));
  assert.ok(html.includes('Qvevri · Qvevri 3'));
  assert.ok(html.includes('800'));
  assert.ok(html.includes('18 days'), 'running since 1 Oct, now 18 Oct');
  assert.ok(html.includes('Density 1.05 · Temperature 24°C'));
  assert.ok(html.includes('day 12'));
  assert.ok(html.indexOf('1.085') < html.indexOf('Density 1.05 '), 'oldest entry first');
  assert.ok(html.includes('<b>1.05</b>'), 'the latest value of each measurement is listed');
  assert.ok(html.includes('<html lang="en">'));
});

test('a vessel without entries says so; the report only restates records', () => {
  const html = buildReportHtml({ vessel, ferment: null, entries: [], now });
  assert.ok(html.includes('No entries'));
  assert.ok(!/diagnos|should|recommend/i.test(html.replace(/<style>[\s\S]*<\/style>/, '')));
});

test('the Georgian report uses Georgian words, month names and the right language tag', () => {
  i18n.setLang('ka');
  const html = buildReportHtml({
    vessel,
    ferment,
    entries: [entry('2026-10-03T08:00:00Z', 'tasting', [], 'რბილი')],
    now,
  });
  assert.ok(html.includes('<html lang="ka">'));
  assert.ok(html.includes('ქვევრი'));
  assert.ok(html.includes('დაგემოვნება') || html.includes('დეგუსტაცია'));
  assert.ok(html.includes('რბილი'));
  assert.ok(html.includes('ოქტ'), 'Georgian month abbreviation');
});

test('titles', () => {
  assert.equal(reportTitle('Tank 12', null), 'Tank 12');
  assert.equal(reportTitle('Tank 12', 'Saperavi 2026'), 'Tank 12 · Saperavi 2026');
});
