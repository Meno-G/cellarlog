// Rewrites how notes are *spoken* (or loosely typed) into the compact forms the
// rules in ./rules.ts look for:
//   "tank twelve, twenty grams per hectoliter of sulfur dioxide" -> "tank 12, 20 g/hl of SO2"
//   "p h three point four five, twenty two bricks"              -> "pH 3.45, 22 brix"
// Pure string work, no network: runs on the phone.

const SMALL: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
};

type Token = { word: string; lower: string };

function isNumberWord(lower: string): boolean {
  return lower in SMALL || lower in TENS || lower === 'hundred' || lower === 'thousand';
}

/** Reads number words starting at `start`; returns the value and how many tokens were used. */
function readNumber(tokens: Token[], start: number): { value: number; used: number } | null {
  let total = 0;
  let current = 0;
  let used = 0;
  let sawNumber = false;
  for (let i = start; i < tokens.length; i++) {
    const lower = tokens[i]?.lower ?? '';
    if (lower in SMALL) {
      // "twenty two" -> 22, but "two two" is two numbers.
      if (sawNumber && current % 10 !== 0) break;
      if (sawNumber && current % 100 !== 0 && (SMALL[lower] ?? 0) >= 10) break;
      current += SMALL[lower] ?? 0;
    } else if (lower in TENS) {
      if (sawNumber && current % 100 !== 0) break;
      current += TENS[lower] ?? 0;
    } else if (lower === 'hundred' && sawNumber) {
      current *= 100;
    } else if (lower === 'thousand' && sawNumber) {
      total += current * 1000;
      current = 0;
    } else if (lower === 'and' && sawNumber && isNumberWord(tokens[i + 1]?.lower ?? '')) {
      // "two hundred and fifty"
    } else {
      break;
    }
    sawNumber = true;
    used = i - start + 1;
  }
  return sawNumber ? { value: total + current, used } : null;
}

/** "twenty two" -> "22", "three point four five" -> "3.45", "minus two" -> "-2". */
export function wordsToNumbers(text: string): string {
  const tokens: Token[] = text.split(/(\s+)/).map((word) => ({ word, lower: word.toLowerCase() }));
  // Work on words only; whitespace tokens are kept for re-joining.
  const words = tokens.filter((token) => token.word.trim() !== '');
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const token = words[i];
    if (!token) continue;
    // Keep punctuation attached to a number word ("twelve," -> "12,").
    const bare = token.lower.replace(/[,.;:!?]+$/, '');
    const trailing = token.word.slice(bare.length);
    const read = isNumberWord(bare)
      ? readNumber([{ word: bare, lower: bare }, ...words.slice(i + 1)], 0)
      : null;
    if (read) {
      out.push(String(read.value) + (read.used === 1 ? trailing : ''));
      i += read.used - 1;
      continue;
    }
    out.push(token.word);
  }
  let joined = out.join(' ');
  // "minus 2" / "negative 2" -> "-2"
  joined = joined.replace(/\b(?:minus|negative)\s+(\d)/gi, '-$1');
  // "3 point 4 5" / "3 point four five" -> "3.45"; "point 5" -> "0.5"
  joined = joined.replace(
    // After "point": one multi-digit number ("point 45") or single digits ("point 4 5"),
    // so "3 point 4 5 22 brix" stays "3.45 22 brix".
    /(\d+)?\s*\bpoint\s+(\d{2,}\b|(?:(?:\d|zero|oh|one|two|three|four|five|six|seven|eight|nine)\b\s*)+)/gi,
    (_match, whole: string | undefined, decimals: string) => {
      const digits = decimals
        .trim()
        .split(/\s+/)
        .map((part) => DIGIT_WORDS[part.toLowerCase()] ?? part)
        .join('');
      return `${whole ?? '0'}.${digits} `;
    },
  );
  // "and a half" after a number
  joined = joined.replace(/(\d+)\s+and a half\b/gi, (_m, whole: string) => `${whole}.5`);
  return joined.replace(/\s{2,}/g, ' ').trim();
}

type Replacement = string | ((match: string, ...groups: string[]) => string);

/** "Tongue, 12" -> "Tank 12", "tonk 12" -> "tank 12": keeps the capital if there was one. */
const toTank = (match: string) => (/^[A-Z]/.test(match) ? 'Tank ' : 'tank ');

// Order matters: longer phrases first.
const PHRASES: [RegExp, Replacement][] = [
  // Mishearings seen on a real phone (Galaxy S25, on-device English)
  [/\bhect(?:o|a|y|i|e)?l?\.?\s*-?\s*lit(?:er|re)s?\b/gi, 'hectoliter'], // "hectyl. Liter"
  [/\b(?:tank|tonk|tongue|thank|tang|tink|tanks)\b[\s,.]*(?=\d)/gi, toTank], // "Tongue, 12"
  [/\b(?:wrecked|wracked|racket|rocked)\b(?=\s+tank\b)/gi, 'racked'], // "Wrecked tank 12"
  [/\bb\W{0,3}r\W{0,3}i\W{0,3}x\b/gi, 'brix'], // spelled "B, r, i, x"
  [/\bbreaks\b(?=\s*\d)/gi, 'brix'], // "Breaks 22"
  [/(\d)\s*breaks\b/gi, '$1 brix'],
  [/\b(?:tunnels|tannens|tanins)\b/gi, 'tannins'],
  // Units
  [/\bmilligrams?\s+(?:per|a|\/)\s+lit(?:er|re)s?\b/gi, 'mg/l'],
  [/\bmg\s+per\s+(?:l|lit(?:er|re))\b/gi, 'mg/l'],
  [/\bgrams?\s+(?:per|a|\/)\s+hecto(?:lit(?:er|re)s?)?\b/gi, 'g/hl'],
  [/\bg\s+per\s+(?:hl|hecto(?:lit(?:er|re))?)\b/gi, 'g/hl'],
  [/\bgrams?\s+per\s+hl\b/gi, 'g/hl'],
  [/\bmil(?:li)?lit(?:er|re)s?\s+per\s+hecto(?:lit(?:er|re)s?)?\b/gi, 'ml/hl'],
  [/\bgrams?\s+(?:per|a|\/)\s+lit(?:er|re)s?\b/gi, 'g/l'],
  [/\bg\s+per\s+(?:l|lit(?:er|re))\b/gi, 'g/l'],
  [/\bparts\s+per\s+million\b/gi, 'ppm'],
  [/\bhectolit(?:er|re)s?\b/gi, 'hl'],
  [/\bkilo(?:gram)?s?\b/gi, 'kg'],
  [/(\d)\s*(?:grams?|gr)\b/gi, '$1 g'],
  [/(\d)\s*(?:millilit(?:er|re)s?|mls?)\b/gi, '$1 ml'],
  [/(\d)\s*lit(?:er|re)s?\b/gi, '$1 l'],
  [/(\d)\s*(?:percent|per cent)\b/gi, '$1%'],
  [/(\d)\s*(?:°|degrees?|deg)\s*(?:fahrenheit|f)\b/gi, '$1°F'],
  [/(\d)\s*(?:°|degrees?|deg)(?!\s*f\b)\s*(?:celsius|centigrade|c)?\b/gi, '$1°C'],
  [/(\d)\s*°(?![cf])/gi, '$1°C'],
  // Wine terms speech recognizers spell out or mishear
  [/\b(?:sulfur|sulphur)\s+dioxide\b/gi, 'SO2'],
  [/\bs\s*\.?\s*o\s*\.?\s*(?:2|two|too|to)\b/gi, 'SO2'],
  [/\bso2\b/gi, 'SO2'],
  [/\b(?:potassium\s+)?meta\s*bi\s*sulf?ph?ite\b/gi, 'metabisulfite'],
  [/\bp\s*\.?\s*h\b\.?/gi, 'pH'],
  [/\b(?:bricks|brics|brick)\b/gi, 'brix'],
  [/\bdegrees?\s+brix\b/gi, 'brix'],
  [/\btitratable\s+acid(?:ity)?\b/gi, 'TA'],
  [/\bt\s*\.\s*a\b\.?/gi, 'TA'],
  // A lone "T" before an acid reading in g/L ("22 T 6.2 grams per liter") is TA, not a tank.
  [/\bt\b\.?\s*(?=\d+(?:[.,]\d+)?\s*g\/l\b)/gi, 'TA '],
  [/\bvolatile\s+acid(?:ity)?\b/gi, 'VA'],
  [/\bv\s*\.\s*a\b\.?/gi, 'VA'],
  [/\bmalo\s*lactic\b/gi, 'malolactic'],
  // "tank number 12" / "tank no. 12" / "tank #12" -> "tank 12"
  [/\b(tank|barrel|barrique|vat)\s+(?:number|no\.?|#)\s*(\d)/gi, '$1 $2'],
];

/** Full normalisation: numbers first, then phrases and units. */
export function normalizeNote(text: string): string {
  let result = wordsToNumbers(text);
  for (const [pattern, replacement] of PHRASES) {
    result =
      typeof replacement === 'string'
        ? result.replace(pattern, replacement)
        : result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
}
