// Shows ferment changes made offline before they reach the server: a ferment
// started, edited, ended or deleted on the phone shows at once on top of the
// saved copy. Pure: no network, no storage.
import type { Ferment } from './ferments';
import type { OutboxItem } from './outbox';

/** A vessel's ferments with the queued saves and deletes applied, newest first. */
export function applyFermentChanges(ferments: readonly Ferment[], items: readonly OutboxItem[], tankId: string): Ferment[] {
  const shown = new Map<string, Ferment>(ferments.filter((ferment) => ferment.tankId === tankId).map((ferment) => [ferment.id, ferment]));
  for (const item of items) {
    if (item.kind === 'ferment-save' && item.tankId === tankId) {
      const earlier = shown.get(item.fermentId);
      shown.set(item.fermentId, {
        id: item.fermentId,
        tankId,
        name: item.input.name,
        startedAt: item.input.startedAt,
        endedAt: item.input.endedAt,
        createdAt: earlier?.createdAt ?? item.createdAt,
      });
    } else if (item.kind === 'ferment-delete' && item.tankId === tankId) {
      shown.delete(item.fermentId);
    }
  }
  return [...shown.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
