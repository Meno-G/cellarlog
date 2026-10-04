const { test } = require('node:test');
const assert = require('node:assert/strict');
const { wordsToNumbers, normalizeNote } = require('../.test-build/parser/normalize.js');

test('number words', () => {
  const cases = [
    ['tank twelve', 'tank 12'],
    ['twenty two degrees', '22 degrees'],
    ['two hundred and fifty liters', '250 liters'],
    ['two thousand liters', '2000 liters'],
    ['three point four five', '3.45'],
    ['3 point 45', '3.45'],
    ['point five', '0.5'],
    ['minus two degrees', '-2 degrees'],
    ['tank twelve, added twenty grams', 'tank 12, added 20 grams'],
    ['one two', '1 2'],
    ['nineteen ninety', '19 90'],
    ['twenty and a half', '20.5'],
    ['nothing numeric here', 'nothing numeric here'],
  ];
  for (const [input, expected] of cases) assert.equal(wordsToNumbers(input), expected, input);
});

test('spoken notes normalise to rule-friendly text', () => {
  const cases = [
    ['Tank twelve added twenty grams per hectoliter of sulfur dioxide temperature twenty two degrees Celsius',
     'Tank 12 added 20 g/hl of SO2 temperature 22°C'],
    ['tank 12 added 20 g per hectoliter S O 2 temp 22°', 'tank 12 added 20 g/hl SO2 temp 22°C'],
    ['tank 12 p h three point four five twenty two bricks TA six point two grams per liter',
     'tank 12 pH 3.45 22 brix TA 6.2 g/l'],
    ['racked tank number twelve into tank fourteen two thousand liters', 'racked tank 12 into tank 14 2000 l'],
    ['tank 2 free so two twenty eight milligrams per liter', 'tank 2 free SO2 28 mg/l'],
    ['tank 2 alcohol thirteen point five percent', 'tank 2 alcohol 13.5%'],
    ['barrique 3 added 30 grams of bentonite', 'barrique 3 added 30 g of bentonite'],
    ['Tasted tank two: ripe plum, soft tannins', 'Tasted tank 2: ripe plum, soft tannins'],
    ['tank 5 at 60 degrees fahrenheit', 'tank 5 at 60°F'],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeNote(input), expected, input);
});
