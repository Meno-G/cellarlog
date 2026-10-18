// A Georgian voice test: the winemaker reads 30 cellar sentences aloud and the app
// scores what the phone's recognizer heard, so it's measured whether Georgian
// speech is reliable enough (words and, above all, numbers) before building more.
// Pure: scoring only.

export type TestPhrase = {
  /** As shown: numbers in digits, read aloud naturally. */
  text: string;
  /** The non-number words that should be recognised, in order. */
  words: readonly string[];
  /** The numbers that must come out right ("6.5" may also be heard as "6" then "5"). */
  numbers: readonly string[];
};

const p = (text: string, words: string[], numbers: string[]): TestPhrase => ({ text, words, numbers });

/** 30 typical cellar notes: vessel and measurement words with numbers. */
export const TEST_PHRASES: readonly TestPhrase[] = [
  p('ცისტერნა 12, ტემპერატურა 22 გრადუსი', ['ცისტერნა', 'ტემპერატურა', 'გრადუსი'], ['12', '22']),
  p('ქვევრი 3, სიმკვრივე 1085', ['ქვევრი', 'სიმკვრივე'], ['3', '1085']),
  p('კასრი 7, ტემპერატურა 18 გრადუსი', ['კასრი', 'ტემპერატურა', 'გრადუსი'], ['7', '18']),
  p('ცისტერნა 5, ბრიქსი 22', ['ცისტერნა', 'ბრიქსი'], ['5', '22']),
  p('ქვევრი 9, სპირტი 13 პროცენტი', ['ქვევრი', 'სპირტი', 'პროცენტი'], ['9', '13']),
  p('ცისტერნა 2, მჟავიანობა 6 მთელი 5', ['ცისტერნა', 'მჟავიანობა', 'მთელი'], ['2', '6.5']),
  p('ქვევრი 4, გოგირდი 25 გრამი ჰექტოლიტრზე', ['ქვევრი', 'გოგირდი', 'გრამი', 'ჰექტოლიტრზე'], ['4', '25']),
  p('ცისტერნა 12, დავამატე 20 გრამი გოგირდი', ['ცისტერნა', 'დავამატე', 'გრამი', 'გოგირდი'], ['12', '20']),
  p('კასრი 3, სიმკვრივე 1062', ['კასრი', 'სიმკვრივე'], ['3', '1062']),
  p('ქვევრი 1, დუღილის მეორე დღე, ტემპერატურა 26 გრადუსი', ['ქვევრი', 'დუღილის', 'მეორე', 'დღე', 'ტემპერატურა', 'გრადუსი'], ['1', '26']),
  p('ცისტერნა 6, თავისუფალი გოგირდი 28', ['ცისტერნა', 'თავისუფალი', 'გოგირდი'], ['6', '28']),
  p('ცისტერნა 6, საერთო გოგირდი 85', ['ცისტერნა', 'საერთო', 'გოგირდი'], ['6', '85']),
  p('კასრი 2, ტემპერატურა 15 გრადუსი', ['კასრი', 'ტემპერატურა', 'გრადუსი'], ['2', '15']),
  p('ქვევრი 10, სიმკვრივე 1062', ['ქვევრი', 'სიმკვრივე'], ['10', '1062']),
  p('ცისტერნა 3, ნარჩენი შაქარი 2 გრამი ლიტრში', ['ცისტერნა', 'ნარჩენი', 'შაქარი', 'გრამი', 'ლიტრში'], ['3', '2']),
  p('ცისტერნა 11, ბრიქსი 18', ['ცისტერნა', 'ბრიქსი'], ['11', '18']),
  p('ქვევრი 5, ტემპერატურა 31 გრადუსი', ['ქვევრი', 'ტემპერატურა', 'გრადუსი'], ['5', '31']),
  p('ცისტერნა 12-დან გადავიღე 2000 ლიტრი ცისტერნა 2-ში', ['ცისტერნა', 'გადავიღე', 'ლიტრი', 'ცისტერნა'], ['12', '2000', '2']),
  p('ქვევრი 3, დავაგემოვნე, ტკბილი და რბილი', ['ქვევრი', 'დავაგემოვნე', 'ტკბილი', 'და', 'რბილი'], ['3']),
  p('ცისტერნა 9, სპირტი 12 მთელი 5 პროცენტი', ['ცისტერნა', 'სპირტი', 'მთელი', 'პროცენტი'], ['9', '12.5']),
  p('ქვევრი 7, აქროლადი მჟავიანობა 0 მთელი 4', ['ქვევრი', 'აქროლადი', 'მჟავიანობა', 'მთელი'], ['7', '0.4']),
  p('ცისტერნა 1, სიმკვრივე 996', ['ცისტერნა', 'სიმკვრივე'], ['1', '996']),
  p('კასრი 4, თავისუფალი გოგირდი 32', ['კასრი', 'თავისუფალი', 'გოგირდი'], ['4', '32']),
  p('ცისტერნა 15, ტემპერატურა 24 გრადუსი', ['ცისტერნა', 'ტემპერატურა', 'გრადუსი'], ['15', '24']),
  p('ქვევრი 2, ბრიქსი 5', ['ქვევრი', 'ბრიქსი'], ['2', '5']),
  p('ცისტერნა 4, დავამატე 30 გრამი ბენტონიტი', ['ცისტერნა', 'დავამატე', 'გრამი', 'ბენტონიტი'], ['4', '30']),
  p('ცისტერნა 10, საფერავი, ტემპერატურა 27 გრადუსი', ['ცისტერნა', 'საფერავი', 'ტემპერატურა', 'გრადუსი'], ['10', '27']),
  p('ქვევრი 6, რქაწითელი, სიმკვრივე 1040', ['ქვევრი', 'რქაწითელი', 'სიმკვრივე'], ['6', '1040']),
  p('ცისტერნა 13, მჟავიანობა 7 მთელი 2', ['ცისტერნა', 'მჟავიანობა', 'მთელი'], ['13', '7.2']),
  p('კასრი 1, ტემპერატურა 12 გრადუსი', ['კასრი', 'ტემპერატურა', 'გრადუსი'], ['1', '12']),
];

/** The words of a text: letters only, lower case. */
export function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min(above + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = above;
    }
  }
  return row[b.length] ?? 0;
}

/** A heard word counts as the expected one if equal, or one letter off in a longer word (endings vary). */
function sameWord(expected: string, heard: string): boolean {
  if (expected === heard) return true;
  return expected.length >= 5 && heard.length >= 5 && distance(expected, heard) <= 1;
}

/**
 * Which share of the expected words was heard, in order (extra heard words don't
 * count against it: a recognizer that spells out the numbers still passes here).
 */
export function wordRecall(expected: readonly string[], heard: string): number {
  if (expected.length === 0) return 1;
  const words = wordsOf(heard);
  // Longest common subsequence of expected words inside the heard words.
  const table: number[][] = Array.from({ length: expected.length + 1 }, () => new Array<number>(words.length + 1).fill(0));
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= words.length; j++) {
      table[i]![j] = sameWord(expected[i - 1] ?? '', words[j - 1] ?? '')
        ? (table[i - 1]![j - 1] ?? 0) + 1
        : Math.max(table[i - 1]![j] ?? 0, table[i]![j - 1] ?? 0);
    }
  }
  return (table[expected.length]![words.length] ?? 0) / expected.length;
}

/** The numbers written as digits in a text ("6,5" becomes "6.5"). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));
}

/**
 * How many of the expected numbers were heard right. A decimal like "6.5" also
 * counts when heard as the two numbers "6" and "5" in a row. Numbers heard as
 * words ("ექვსი") are not digits and count as missed: that's a finding.
 */
export function numbersRight(expected: readonly string[], heard: string): number {
  const found = numbersIn(heard);
  const joined = new Set<string>();
  for (let i = 0; i + 1 < found.length; i++) joined.add(`${found[i]}.${found[i + 1]}`);
  return expected.filter((number) => found.includes(number) || joined.has(number)).length;
}

export type PhraseResult = {
  index: number;
  heard: string;
  /** 0 to 1. */
  recall: number;
  numbersRight: number;
  numbersTotal: number;
  /** The recognizer wrote digits (rather than spelling the numbers out). */
  usedDigits: boolean;
};

export function scorePhrase(index: number, heard: string): PhraseResult {
  const phrase = TEST_PHRASES[index];
  if (!phrase) throw new Error(`No test phrase ${index}`);
  return {
    index,
    heard,
    recall: wordRecall(phrase.words, heard),
    numbersRight: numbersRight(phrase.numbers, heard),
    numbersTotal: phrase.numbers.length,
    usedDigits: /\d/.test(heard),
  };
}

/** A phrase is good when nearly all words were heard and every number is right. */
export function isGood(result: PhraseResult): boolean {
  return result.recall >= 0.8 && result.numbersRight === result.numbersTotal;
}

export type TestSummary = {
  done: number;
  good: number;
  /** Average share of expected words heard, 0 to 1. */
  wordRecall: number;
  /** Share of all expected numbers heard right, 0 to 1. */
  numbersRight: number;
  /** Share of answers in which the recognizer wrote digits. */
  digitsShare: number;
};

export function summarize(results: readonly PhraseResult[]): TestSummary {
  const done = results.length;
  if (done === 0) return { done: 0, good: 0, wordRecall: 0, numbersRight: 0, digitsShare: 0 };
  const total = results.reduce((sum, r) => sum + r.numbersTotal, 0);
  return {
    done,
    good: results.filter(isGood).length,
    wordRecall: results.reduce((sum, r) => sum + r.recall, 0) / done,
    numbersRight: total === 0 ? 1 : results.reduce((sum, r) => sum + r.numbersRight, 0) / total,
    digitsShare: results.filter((r) => r.usedDigits).length / done,
  };
}

/** The results as CSV (for sharing), one row per sentence. */
export function resultsToCsv(results: readonly PhraseResult[]): string {
  const cell = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const rows = [['sentence', 'expected', 'heard', 'word_recall', 'numbers_right', 'numbers_total', 'digits']];
  for (const r of [...results].sort((a, b) => a.index - b.index)) {
    rows.push([
      String(r.index + 1),
      TEST_PHRASES[r.index]?.text ?? '',
      r.heard,
      r.recall.toFixed(2),
      String(r.numbersRight),
      String(r.numbersTotal),
      r.usedDigits ? 'yes' : 'no',
    ]);
  }
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export type Verdict = 'none' | 'reliable' | 'mixed' | 'poor' | 'words';

/** A plain reading of the numbers: no claim beyond what was measured. */
export function verdictOf(summary: TestSummary): Verdict {
  if (summary.done < 5) return 'none';
  // The recognizer spells numbers out as words: a different problem from "mishears".
  if (summary.digitsShare < 0.5) return 'words';
  if (summary.numbersRight >= 0.9 && summary.wordRecall >= 0.85) return 'reliable';
  if (summary.numbersRight >= 0.7) return 'mixed';
  return 'poor';
}
