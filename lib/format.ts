import type { ParsedItem } from './parser/schema';

const liters = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatLiters(value: number): string {
  return `${liters.format(value)} L`;
}

/** "Saperavi · 2025", "Saperavi", "2025", or null when both are empty. */
export function formatWine(variety: string | null, vintage: number | null): string | null {
  const parts = [variety, vintage === null ? null : String(vintage)].filter(
    (part): part is string => part !== null && part !== '',
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** "20 g/hL", "3.45", "Tank 14". Units like °C attach without a space. */
export function formatItemValue(item: ParsedItem): string {
  const value = typeof item.value === 'number' ? plain.format(item.value) : item.value;
  if (!item.unit) return value;
  return item.unit.startsWith('°') || item.unit === '%' ? `${value}${item.unit}` : `${value} ${item.unit}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today 14:32", "Yesterday 09:10", "3 Oct 09:10", "3 Oct 2025 09:10". */
export function formatEntryTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const clock = time.format(date);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Yesterday ${clock}`;
  const day = date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear;
  return `${day.format(date)} ${clock}`;
}
