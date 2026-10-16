// Alert rules in Supabase. See alertRules.ts for what a rule is and how it's checked.
// Reading works offline from the saved copy (lib/cache.ts); saving needs a connection.
import { parseRule, type AlertRule } from './alertRules';
import type { Database } from './database.types';
import { AppError, fromDbError, toAppError } from './errors';
import { strings } from './i18n';
import { getSupabase } from './supabase';

type RuleRow = Omit<Database['public']['Tables']['alert_rules']['Row'], 'user_id'>;

export type SavedRule = AlertRule & { id: string; tankId: string };

const COLUMNS = 'id, tank_id, kind, enabled, params, created_at, updated_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromRow(row: RuleRow): SavedRule | null {
  // A row edited by hand in the dashboard must not break the screen: it is skipped.
  const rule = parseRule(row.kind, row.enabled, row.params);
  return rule ? { ...rule, id: row.id, tankId: row.tank_id } : null;
}

function rulesFrom(rows: RuleRow[]): SavedRule[] {
  return rows.map(fromRow).filter((rule): rule is SavedRule => rule !== null);
}

/** One vessel's rules. */
export async function listRules(tankId: string): Promise<SavedRule[]> {
  if (!UUID.test(tankId)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { data, error } = await getSupabase().from('alert_rules').select(COLUMNS).eq('tank_id', tankId);
    if (error) throw fromDbError(error, strings().messages.loadRulesFailed);
    return rulesFrom(data);
  } catch (error) {
    throw toAppError(error, strings().messages.loadRulesFailed);
  }
}

/** Every rule of the user (RLS limits it to theirs), for the offline copy. */
export async function listAllRules(): Promise<SavedRule[]> {
  try {
    const { data, error } = await getSupabase().from('alert_rules').select(COLUMNS);
    if (error) throw fromDbError(error, strings().messages.loadRulesFailed);
    return rulesFrom(data);
  } catch (error) {
    throw toAppError(error, strings().messages.loadRulesFailed);
  }
}

/** Creates or replaces the vessel's rule of this kind (one per kind per vessel). */
export async function saveRule(tankId: string, rule: AlertRule): Promise<void> {
  if (!UUID.test(tankId)) throw new AppError('not_found', strings().messages.tankGone);
  try {
    const { error } = await getSupabase()
      .from('alert_rules')
      .upsert(
        { tank_id: tankId, kind: rule.kind, enabled: rule.enabled, params: rule.params, updated_at: new Date().toISOString() },
        { onConflict: 'tank_id,kind' },
      );
    if (error) throw fromDbError(error, strings().messages.saveRuleFailed);
  } catch (error) {
    throw toAppError(error, strings().messages.saveRuleFailed);
  }
}
