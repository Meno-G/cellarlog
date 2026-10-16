/**
 * Parses what people type on a phone keypad: "5000", "5 000", "5,000",
 * "5,000.5" and "5000,5" (comma as decimal separator), "-2" and "-0,5".
 * Returns null for empty input and NaN for anything that isn't a number.
 */
export function parseNumber(text: string): number | null {
  let cleaned = text.replace(/[\s']/g, '');
  if (cleaned === '') return null;
  const negative = cleaned.startsWith('-');
  if (negative) cleaned = cleaned.slice(1);
  if (cleaned.includes('.') || /^[1-9]\d{0,2}(,\d{3})+$/.test(cleaned)) {
    // "5,000.5" or "12,500": commas are thousands separators. ("0,003" starts with 0: a decimal.)
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // "5000,5": a comma is the decimal separator.
    cleaned = cleaned.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  const value = Number(cleaned);
  return negative ? -value : value;
}
