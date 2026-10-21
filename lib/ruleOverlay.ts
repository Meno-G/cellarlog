// Shows alert-rule changes made offline before they reach the server: a rule saved
// on the phone replaces the saved one of its kind at once. Pure.
import { parseRule } from './alertRules';
import type { SavedRule } from './alerts';
import type { OutboxItem } from './outbox';

/** A vessel's rules with the queued saves applied (one rule per kind). */
export function applyRuleChanges(rules: readonly SavedRule[], items: readonly OutboxItem[], tankId: string): SavedRule[] {
  const shown = new Map<string, SavedRule>(rules.filter((rule) => rule.tankId === tankId).map((rule) => [rule.kind, rule]));
  for (const item of items) {
    if (item.kind !== 'rule-save' || item.tankId !== tankId) continue;
    const rule = parseRule(item.ruleKind, item.enabled, item.params);
    if (rule) shown.set(rule.kind, { ...rule, id: shown.get(rule.kind)?.id ?? `queued:${item.localId}`, tankId });
  }
  return [...shown.values()];
}
