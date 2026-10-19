// What wine a vessel holds when it's a blend: the parts (grape and vintage, with
// liters when known) and how they combine when wine is poured from one vessel
// into another. Pure. A vessel with one wine has no parts list: its `variety`
// and `vintage` say it all. For a blend they hold a summary (the grapes joined
// by " + ", the vintage when all parts share it) and `blend` holds the parts.
import { z } from 'zod';

import { formatWine } from './format';

export const blendPartSchema = z.object({
  variety: z.string().nullable(),
  vintage: z.number().nullable(),
  /** Liters of this part in the vessel; null when not known. */
  liters: z.number().nullable(),
});
export type BlendPart = z.infer<typeof blendPartSchema>;

/** Old saved copies and queued changes have no blend. */
export const blendSchema = z.array(blendPartSchema).nullable().catch(null);

type Wine = {
  variety: string | null;
  vintage: number | null;
  contentLiters: number | null;
  blend?: BlendPart[] | null;
};

const round1 = (liters: number) => Math.round(liters * 10) / 10;
const key = (variety: string | null) => (variety ?? '').trim().toLowerCase();

/** The wines in a vessel: its blend, or its single wine, or nothing (a vessel without a grape or vintage). */
export function partsOf(vessel: Wine): BlendPart[] {
  if (vessel.blend && vessel.blend.length > 0) return vessel.blend;
  if (vessel.variety === null && vessel.vintage === null) return [];
  return [{ variety: vessel.variety, vintage: vessel.vintage, liters: vessel.contentLiters }];
}

/** The same wines in `liters` liters: one wine takes them all, a blend keeps its shares (when they are known). */
export function resize(parts: readonly BlendPart[], liters: number | null): BlendPart[] {
  if (liters === null) return parts.map((part) => ({ ...part, liters: null }));
  const [only] = parts;
  if (parts.length === 1 && only) return [{ ...only, liters }];
  const known = parts.every((part) => part.liters !== null);
  const sum = parts.reduce((total, part) => total + (part.liters ?? 0), 0);
  if (known && sum > 0) return parts.map((part) => ({ ...part, liters: round1((liters * (part.liters ?? 0)) / sum) }));
  return parts.map((part) => ({ ...part, liters: null }));
}

/** Pours `incoming` into `base`: the same grape and vintage add up, the others become parts of the blend. */
export function mergeParts(base: readonly BlendPart[], incoming: readonly BlendPart[]): BlendPart[] {
  const merged = base.map((part) => ({ ...part }));
  for (const part of incoming) {
    const same = merged.find((other) => key(other.variety) === key(part.variety) && other.vintage === part.vintage);
    if (!same) merged.push({ ...part });
    else same.liters = same.liters === null || part.liters === null ? null : round1(same.liters + part.liters);
  }
  return merged;
}

/** What to store for these parts: the grapes, the vintage when all share it, and the parts when there are several. */
export function summary(parts: readonly BlendPart[]): { variety: string | null; vintage: number | null; blend: BlendPart[] | null } {
  if (parts.length === 0) return { variety: null, vintage: null, blend: null };
  const varieties: string[] = [];
  for (const part of parts) {
    const name = part.variety?.trim() ?? '';
    if (name !== '' && !varieties.some((seen) => key(seen) === key(name))) varieties.push(name);
  }
  const first = parts[0]?.vintage ?? null;
  const sharedVintage = first !== null && parts.every((part) => part.vintage === first) ? first : null;
  return {
    variety: varieties.length === 0 ? null : varieties.join(' + '),
    vintage: sharedVintage,
    blend: parts.length > 1 ? parts.map((part) => ({ ...part })) : null,
  };
}

/** "Saperavi 2025 (60%) + Ocakhanuri Sapere 2024 (40%)"; the shares only when every part's liters are known. */
export function formatBlend(parts: readonly BlendPart[]): string {
  const total = parts.reduce((sum, part) => sum + (part.liters ?? 0), 0);
  const shares = parts.length > 1 && total > 0 && parts.every((part) => part.liters !== null);
  return parts
    .map((part) => {
      const label = [part.variety, part.vintage === null ? null : String(part.vintage)]
        .filter((piece): piece is string => piece !== null && piece !== '')
        .join(' ');
      return shares ? `${label} (${Math.round(((part.liters ?? 0) / total) * 100)}%)` : label;
    })
    .filter((text) => text !== '')
    .join(' + ');
}

/** The wine of a vessel as shown to the user, or null when none is recorded. */
export function describeWine(vessel: Pick<Wine, 'variety' | 'vintage' | 'blend'>): string | null {
  if (vessel.blend && vessel.blend.length > 1) return formatBlend(vessel.blend);
  return formatWine(vessel.variety, vessel.vintage);
}
