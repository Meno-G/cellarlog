// The Georgian voice test: scoring what the recognizer heard.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TEST_PHRASES,
  wordsOf,
  wordRecall,
  numbersIn,
  numbersRight,
  scorePhrase,
  isGood,
  summarize,
  resultsToCsv,
} = require('../.test-build/voiceTest.js');

test('there are 30 sentences, each with words and numbers that appear in its text', () => {
  assert.equal(TEST_PHRASES.length, 30);
  for (const phrase of TEST_PHRASES) {
    assert.ok(phrase.words.length >= 1);
    for (const word of phrase.words) assert.ok(wordsOf(phrase.text).includes(word.toLowerCase()), `${word} in ${phrase.text}`);
    for (const number of phrase.numbers) {
      const shown = number.includes('.') ? number.split('.') : [number];
      for (const digits of shown) assert.ok(phrase.text.includes(digits), `${digits} in ${phrase.text}`);
    }
  }
});

test('words: heard in order; extra words are fine; endings one letter off are accepted', () => {
  const expected = ['ცისტერნა', 'ტემპერატურა', 'გრადუსი'];
  assert.equal(wordRecall(expected, 'ცისტერნა 12 ტემპერატურა 22 გრადუსი'), 1);
  assert.equal(wordRecall(expected, 'ცისტერნა თორმეტი ტემპერატურა ოცდაორი გრადუსი'), 1, 'numbers spelled out do not hurt the word score');
  assert.equal(wordRecall(expected, 'ცისტერნა გრადუსი'), 2 / 3);
  assert.equal(wordRecall(expected, 'გრადუსი ტემპერატურა ცისტერნა'), 1 / 3, 'order matters');
  assert.equal(wordRecall(expected, 'ცისტერნას ტემპერატურა გრადუსი'), 1, 'one letter off in a long word');
  assert.equal(wordRecall(expected, ''), 0);
  assert.equal(wordRecall([], 'anything'), 1);
});

test('numbers: digits only; "6,5" and "6" "5" both count as 6.5; spelled-out numbers are missed', () => {
  assert.deepEqual(numbersIn('ცისტერნა 12, ტემპერატურა 22,5'), ['12', '22.5']);
  assert.equal(numbersRight(['12', '22'], 'ცისტერნა 12 ტემპერატურა 22 გრადუსი'), 2);
  assert.equal(numbersRight(['12', '22'], 'ცისტერნა 12 ტემპერატურა 23'), 1);
  assert.equal(numbersRight(['2', '6.5'], 'ცისტერნა 2 მჟავიანობა 6,5'), 2);
  assert.equal(numbersRight(['2', '6.5'], 'ცისტერნა 2 მჟავიანობა 6 მთელი 5'), 2, '"6 whole 5" is 6.5: two numbers in a row');
  assert.equal(numbersRight(['2', '6.5'], 'ცისტერნა 2 მჟავიანობა 7 მთელი 5'), 1);
  assert.equal(numbersRight(['2', '6.5'], 'ცისტერნა 2 მჟავიანობა 6 5'), 2);
  assert.equal(numbersRight(['12', '22'], 'ცისტერნა თორმეტი ტემპერატურა ოცდაორი'), 0);
});

test('a sentence is good when almost all words and every number are right', () => {
  const good = scorePhrase(0, 'ცისტერნა 12 ტემპერატურა 22 გრადუსი');
  assert.ok(isGood(good));
  assert.equal(good.usedDigits, true);
  const wrongNumber = scorePhrase(0, 'ცისტერნა 12 ტემპერატურა 23 გრადუსი');
  assert.ok(!isGood(wrongNumber));
  const spelled = scorePhrase(0, 'ცისტერნა თორმეტი ტემპერატურა ოცდაორი გრადუსი');
  assert.equal(spelled.usedDigits, false);
  assert.ok(!isGood(spelled), 'numbers as words cannot be parsed: not good');
  assert.throws(() => scorePhrase(99, 'x'));
});

test('summary and CSV', () => {
  const results = [
    scorePhrase(0, 'ცისტერნა 12 ტემპერატურა 22 გრადუსი'),
    scorePhrase(1, 'ქვევრი 3 სიმკვრივე 1085'),
    scorePhrase(2, 'კასრი შვიდი'),
  ];
  const s = summarize(results);
  assert.equal(s.done, 3);
  assert.equal(s.good, 2);
  assert.equal(s.numbersRight, 4 / 6);
  assert.equal(s.digitsShare, 2 / 3);
  assert.ok(s.wordRecall > 0.7 && s.wordRecall < 0.9);
  assert.deepEqual(summarize([]), { done: 0, good: 0, wordRecall: 0, numbersRight: 0, digitsShare: 0 });

  const csv = resultsToCsv(results);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0], 'sentence,expected,heard,word_recall,numbers_right,numbers_total,digits');
  assert.ok(lines[1].startsWith('1,'));
  assert.ok(lines[1].includes('"ცისტერნა 12, ტემპერატურა 22 გრადუსი"'), 'text with a comma is quoted');
});

test('verdict: too few sentences, numbers as words, reliable, mixed, poor', () => {
  const { verdictOf } = require('../.test-build/voiceTest.js');
  const base = { done: 20, good: 10, wordRecall: 0.9, numbersRight: 0.95, digitsShare: 1 };
  assert.equal(verdictOf({ ...base, done: 3 }), 'none');
  assert.equal(verdictOf({ ...base, digitsShare: 0.2 }), 'words');
  assert.equal(verdictOf(base), 'reliable');
  assert.equal(verdictOf({ ...base, numbersRight: 0.8 }), 'mixed');
  assert.equal(verdictOf({ ...base, wordRecall: 0.6 }), 'mixed', 'good numbers but poor words is not reliable');
  assert.equal(verdictOf({ ...base, numbersRight: 0.4 }), 'poor');
});
