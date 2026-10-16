import { StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { trippedAlerts, type AlertResult } from '@/lib/alertRules';
import type { SavedRule } from '@/lib/alerts';
import { formatItemValue, formatRelative } from '@/lib/format';
import type { Strings } from '@/lib/i18n';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  /** Undefined while still loading with nothing saved. */
  rules: readonly SavedRule[] | undefined;
  results: readonly AlertResult[];
  onRules: () => void;
  onDecision: () => void;
};

/** What was observed and which rule tripped, in plain words. No diagnosis, no advice. */
export function alertTexts(result: AlertResult, t: Strings): { name: string; observed: string; rule: string } {
  const { rule, from, latest } = result;
  if (rule.kind === 'density_stall') {
    const show = (value: number, unit: string | null) => formatItemValue({ name: 'Density', value, unit });
    return {
      name: t.alerts.densityName,
      observed:
        from && latest
          ? t.alerts.densityObserved(show(from.value, from.unit), formatRelative(from.at), show(latest.value, latest.unit), formatRelative(latest.at))
          : '',
      rule: t.alerts.densityRule(rule.params.hours, show(rule.params.minDrop, null)),
    };
  }
  const celsius = (value: number) => formatItemValue({ name: 'Temperature', value, unit: '°C' });
  return {
    name: t.alerts.temperatureName,
    observed: latest ? t.alerts.temperatureObserved(celsius(latest.value), formatRelative(latest.at)) : '',
    rule: t.alerts.temperatureRule(celsius(rule.params.minC), celsius(rule.params.maxC)),
  };
}

/**
 * Alerts on the tank screen. The tripped rules show as cards with what was
 * observed and the rule; deciding what to do is left to the person (a button
 * opens a new entry to note the decision).
 */
export function AlertPanel({ rules, results, onRules, onDecision }: Props) {
  const { colors } = useTheme();
  const t = useT();
  if (!rules) return null;

  const tripped = trippedAlerts(results);
  const enabled = results.length > 0;
  // Every enabled rule is waiting because no ferment is running.
  const noFerment = enabled && results.every((result) => result.reason === 'no-ferment');

  return (
    <View style={styles.wrapper}>
      <AppText variant="heading" style={{ color: colors.heading }}>
        {t.alerts.title}
      </AppText>

      {tripped.map((result) => {
        const text = alertTexts(result, t);
        return (
          <View
            key={result.rule.kind}
            accessibilityRole="alert"
            style={[styles.card, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}
          >
            <AppText style={{ fontFamily: fonts.bodyBold, color: colors.warningText }}>
              {t.alerts.trippedTitle}: {text.name}
            </AppText>
            <AppText style={{ color: colors.warningText }}>
              <AppText style={{ fontFamily: fonts.bodyBold, color: colors.warningText }}>{t.alerts.observed}: </AppText>
              {text.observed}
            </AppText>
            <AppText style={{ color: colors.warningText }}>
              <AppText style={{ fontFamily: fonts.bodyBold, color: colors.warningText }}>{t.alerts.rule}: </AppText>
              {text.rule}
            </AppText>
            <Button variant="secondary" title={t.alerts.recordDecision} icon="check-decagram-outline" onPress={onDecision} />
            <AppText style={{ color: colors.warningText, fontSize: 14, lineHeight: 19 }}>{t.alerts.decisionHint}</AppText>
          </View>
        );
      })}

      {tripped.length === 0 ? (
        <AppText muted>
          {rules.length === 0 ? t.alerts.noRules : noFerment ? t.alerts.noFerment : enabled ? t.alerts.noneTripped : t.alerts.noRules}
        </AppText>
      ) : null}

      <Button variant="secondary" title={t.alerts.rulesButton} icon="bell-cog-outline" onPress={onRules} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  card: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
