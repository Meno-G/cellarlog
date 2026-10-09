// Numbers, values and times as shown, in the current language (see ./i18n).
import { strings, unitName } from './i18n';
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
  return `${liters.format(value)} ${unitName('L')}`;
}

/** "Saperavi · 2025", "Saperavi", "2025", or null when both are empty. */
export function formatWine(variety: string | null, vintage: number | null): string | null {
  const parts = [variety, vintage === null ? null : String(vintage)].filter(
    (part): part is string => part !== null && part !== '',
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** "20 g/hL" (Georgian "20 გ/ჰლ"), "3.45", "Tank 14". Units like °C attach without a space. */
export function formatItemValue(item: ParsedItem): string {
  const value = typeof item.value === 'number' ? plain.format(item.value) : item.value;
  if (!item.unit) return value;
  const unit = unitName(item.unit);
  return unit.startsWith('°') || unit === '%' ? `${value}${unit}` : `${value} ${unit}`;
}

/** "3 Oct" or "3 Oct 2025"; Georgian uses its own month names ("3 ოქტ"). */
function formatDay(date: Date, withYear: boolean): string {
  const months = strings().time.months;
  if (months) {
    const day = `${date.getDate()} ${months[date.getMonth()] ?? ''}`;
    return withYear ? `${day} ${date.getFullYear()}` : day;
  }
  return (withYear ? dayMonthYear : dayMonth).format(date);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "just now", "12 min ago", "2 h ago", "yesterday", "4 days ago", "3 Oct", "3 Oct 2025". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const t = strings().time;
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return t.hoursAgo(Math.floor(minutes / 60));
  if (days === 1) return t.yesterday;
  if (days < 7) return t.daysAgo(days);
  return formatDay(date, date.getFullYear() !== now.getFullYear());
}

/** "Today 14:32", "Yesterday 09:10", "3 Oct 09:10", "3 Oct 2025 09:10". */
export function formatEntryTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const clock = time.format(date);
  const t = strings().time;
  if (days === 0) return t.today(clock);
  if (days === 1) return t.yesterdayAt(clock);
  return `${formatDay(date, date.getFullYear() !== now.getFullYear())} ${clock}`;
}

/** "+1.2°C", "−0.05 g/L", "±0": the change between two readings, rounded like the readings. */
export function formatChange(delta: number, unit: string | null): string {
  const rounded = Math.round(delta * 1000) / 1000;
  if (rounded === 0) return '±0';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatItemValue({ name: '', value: Math.abs(rounded), unit })}`;
}
