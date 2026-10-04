const liters = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

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
