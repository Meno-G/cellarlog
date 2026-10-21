// CSV export: rows, escaping, ferment days, scope and file names.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entriesToCsv, entriesForScope, csvCell, csvFilename, CSV_HEADER } = require('../.test-build/exportCsv.js');

const d = (iso) => new Date(iso).toISOString();
const ferment = { id: 'f26', name: 'Saperavi 2026', startedAt: d('2026-10-01T00:00:00Z'), endedAt: null };
const old = { id: 'f25', name: 'Saperavi 2025', startedAt: d('2025-10-01T00:00:00Z'), endedAt: d('2025-10-21T23:59:59Z') };
const entry = (at, type, items, note = null, rawText = '') => ({ type, createdAt: d(at), rawText, parsed: { note, items } });
const vessel = { name: 'Qvevri 3', kind: 'qvevri' };

/** Splits a CSV into rows of cells (handles quotes); enough for these tests. */
function parse(csv) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}

test('one row per value; an entry without values is one row; oldest first; CRLF endings', () => {
  const csv = entriesToCsv({
    vessel,
    ferments: [ferment],
    entries: [
      entry('2026-10-05T10:00:00Z', 'tasting', [], 'Plum, soft'),
      entry('2026-10-03T08:00:00Z', 'lab_analysis', [{ name: 'Density', value: 1.085, unit: null }, { name: 'Temperature', value: 24, unit: '°C' }], 'after racking'),
    ],
  });
  assert.ok(csv.endsWith('\r\n'));
  const rows = parse(csv);
  assert.deepEqual(rows[0], [...CSV_HEADER]);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.slice(1).map((r) => [r[6], r[7], r[8], r[9]]), [
    ['lab_analysis', 'Density', '1.085', ''],
    ['lab_analysis', 'Temperature', '24', '°C'],
    ['tasting', '', '', ''],
  ]);
  // the note goes on the entry's first row only
  assert.deepEqual(rows.slice(1).map((r) => r[10]), ['after racking', '', 'Plum, soft']);
});

test('each row names its vessel, ferment and day of the ferment', () => {
  const csv = entriesToCsv({
    vessel,
    ferments: [old, ferment],
    entries: [
      entry('2025-10-03T08:00:00Z', 'lab_analysis', [{ name: 'Density', value: 1.09, unit: null }]),
      entry('2026-10-12T08:00:00Z', 'lab_analysis', [{ name: 'Density', value: 1.05, unit: null }]),
      entry('2026-09-20T08:00:00Z', 'note', [], 'before any ferment'),
    ],
  });
  const rows = parse(csv).slice(1);
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[2], r[3]]), [
    ['Qvevri 3', 'qvevri', 'Saperavi 2025', '3'],
    ['Qvevri 3', 'qvevri', '', ''], // oldest first: September 2026, between the two ferments
    ['Qvevri 3', 'qvevri', 'Saperavi 2026', '12'],
  ]);
});

test('what was said is kept only when it adds something beyond the note', () => {
  const csv = entriesToCsv({
    vessel,
    ferments: [],
    entries: [
      entry('2026-10-05T10:00:00Z', 'note', [], 'Racked into tank two', 'Wrecked tank 12 into tank 2'),
      entry('2026-10-06T10:00:00Z', 'note', [], 'same words', 'same words'),
    ],
  });
  const rows = parse(csv).slice(1);
  assert.deepEqual(rows.map((r) => r[11]), ['Wrecked tank 12 into tank 2', '']);
});

test('cells are quoted when needed; formula-looking text is neutralised, numbers are not', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('-5', false), '-5');
  const csv = entriesToCsv({
    vessel: { name: '=1+1', kind: 'tank' },
    ferments: [],
    entries: [entry('2026-10-05T10:00:00Z', 'lab_analysis', [{ name: 'Temperature', value: -2, unit: '°C' }], '+cmd')],
  });
  const row = parse(csv)[1];
  assert.equal(row[0], "'=1+1");
  assert.equal(row[8], '-2', 'a negative number stays a number');
  assert.equal(row[10], "'+cmd");
});

test('Georgian text and degree signs survive', () => {
  const csv = entriesToCsv({
    vessel: { name: 'ქვევრი 3', kind: 'qvevri' },
    ferments: [],
    entries: [entry('2026-10-05T10:00:00Z', 'note', [], 'გემო: რბილი')],
  });
  const row = parse(csv)[1];
  assert.equal(row[0], 'ქვევრი 3');
  assert.equal(row[10], 'გემო: რბილი');
});

test('scope: the whole vessel, or only the entries of one ferment', () => {
  const entries = [
    entry('2025-10-03T08:00:00Z', 'note', []),
    entry('2026-10-03T08:00:00Z', 'note', []),
    entry('2026-10-04T08:00:00Z', 'note', []),
  ];
  const now = new Date('2026-10-10T00:00:00Z');
  assert.equal(entriesForScope(entries, [old, ferment], 'all', now).length, 3);
  assert.equal(entriesForScope(entries, [old, ferment], 'f26', now).length, 2);
  assert.equal(entriesForScope(entries, [old, ferment], 'f25', now).length, 1);
  assert.equal(entriesForScope(entries, [old, ferment], 'gone', now).length, 3, 'an unknown ferment falls back to everything');
});

test('file names keep letters of any script', () => {
  const now = new Date(2026, 9, 18, 12);
  assert.equal(csvFilename('Tank 12', null, now), 'enolog-tank-12-2026-10-18.csv');
  assert.equal(csvFilename('Tank 12', 'Saperavi 2026', now), 'enolog-tank-12-saperavi-2026-2026-10-18.csv');
  assert.equal(csvFilename('ქვევრი 3', null, now), 'enolog-ქვევრი-3-2026-10-18.csv');
  assert.equal(csvFilename('!!!', null, now), 'enolog-vessel-2026-10-18.csv');
});
