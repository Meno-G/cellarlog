// Shows tank changes made offline before they reach the server: tanks created
// on the phone appear in the list, and queued edits replace the old values.
// Pure: no network, no storage.
import { tankKey } from './tankMatch';
import type { OutboxItem } from './outbox';
import type { Tank } from './tanks';

export type TankUpload = { status: 'pending' | 'failed'; error: string | null };

/** A tank as shown in the app, plus its upload state when it has unsent changes. */
export type ShownTank = Tank & { upload: TankUpload | null };

const byNaturalName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortTanks<T extends { name: string }>(tanks: readonly T[]): T[] {
  return [...tanks].sort((a, b) => byNaturalName.compare(a.name, b.name));
}

/** Server/cached tanks with the queued creates and edits applied, sorted by name. */
export function applyTankChanges(tanks: readonly Tank[], items: readonly OutboxItem[]): ShownTank[] {
  const shown = new Map<string, ShownTank>(tanks.map((tank) => [tank.id, { ...tank, upload: null }]));
  for (const item of items) {
    const upload: TankUpload = { status: item.status, error: item.error };
    if (item.kind === 'tank-create') {
      // Once uploaded it also comes back from the server; the queued values still win until it's gone.
      shown.set(item.localId, { id: item.localId, ...item.tank, createdAt: item.createdAt, upload });
    } else if (item.kind === 'tank-update') {
      const current = shown.get(item.tankId);
      if (current) shown.set(item.tankId, { ...current, ...item.tank, upload });
    }
  }
  return sortTanks([...shown.values()]);
}

/**
 * Another tank with the same name (ignoring case, spaces and "Tank"/"T" spelling),
 * or null. Catches duplicates offline, before the server's unique index would.
 */
export function findDuplicateName(
  name: string,
  tanks: readonly { id: string; name: string }[],
  exceptId: string | null,
): { id: string; name: string } | null {
  const wanted = name.trim().toLowerCase();
  return (
    tanks.find((tank) => tank.id !== exceptId && tank.name.trim().toLowerCase() === wanted) ??
    tanks.find((tank) => tank.id !== exceptId && tankKey(tank.name) === tankKey(name) && tankKey(name) !== '') ??
    null
  );
}
