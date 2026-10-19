// Potential alcohol of a must from its first Brix (or density) reading: an
// estimate with a range, because the yield per degree Brix depends on the yeast
// and the fermentation. Pure.

const round1 = (value: number) => Math.round(value * 10) / 10;

/** % vol per °Brix: the range commonly used for wine must (about 0.55 to 0.60). */
const LOW_PER_BRIX = 0.55;
const HIGH_PER_BRIX = 0.6;

/**
 * °Brix from a density (1.090 or 1090 or 1,090: all read as 1.090), by the
 * usual cubic fit for sugar solutions. Null outside what a must can be.
 */
export function brixFromDensity(density: number): number | null {
  const sg = density >= 900 ? density / 1000 : density;
  if (!Number.isFinite(sg) || sg < 1.0 || sg > 1.2) return null;
  const brix = 182.4601 * sg ** 3 - 775.6821 * sg ** 2 + 1262.7794 * sg - 669.5622;
  return round1(brix);
}

export type AlcoholEstimate = { brix: number; low: number; high: number };

/** The range of potential alcohol (% vol) for a Brix, or null when it can't be a must's. */
export function potentialAlcohol(brix: number): AlcoholEstimate | null {
  if (!Number.isFinite(brix) || brix < 5 || brix > 45) return null;
  return { brix: round1(brix), low: round1(brix * LOW_PER_BRIX), high: round1(brix * HIGH_PER_BRIX) };
}

/** From one reading: a "Brix" value as it is, a "Density" value converted. Null for other names. */
export function estimateFromReading(name: string, value: number): AlcoholEstimate | null {
  const key = name.trim().toLowerCase();
  if (key === 'brix') return potentialAlcohol(value);
  if (key === 'density') {
    const brix = brixFromDensity(value);
    return brix === null ? null : potentialAlcohol(brix);
  }
  return null;
}
