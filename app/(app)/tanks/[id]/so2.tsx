import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useEntries } from '@/hooks/useEntries';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { latestValues } from '@/lib/latestValues';
import { so2FromForm, type So2FormValues } from '@/lib/so2';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** The newest number recorded under this name on the tank, as text for an input. */
function latestNumber(values: ReturnType<typeof latestValues>, name: string): string {
  const found = values.find((value) => value.item.name.trim().toLowerCase() === name);
  return found && typeof found.item.value === 'number' ? String(found.item.value) : '';
}

/** Free SO2 needed at the wine's pH and the KMBS to add, from this tank's latest readings. */
export default function So2Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const t = useT();
  const hero = <HeroBand title={t.so2.title} subtitle={tank.data?.name} />;

  if (tank.loading || entries.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState />
      </Screen>
    );
  }
  if (!tank.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState message={tank.error ?? t.messages.loadTankFailed} onRetry={tank.refresh} retrying={tank.refreshing} />
      </Screen>
    );
  }
  const latest = latestValues(applyEntryChanges(entries.data ?? [], outbox.items, id));
  const start: So2FormValues = {
    ph: latestNumber(latest, 'ph'),
    free: latestNumber(latest, 'free so2'),
    target: '0.8',
    liters: tank.data.contentLiters === null ? '' : String(tank.data.contentLiters),
  };
  return <So2Form start={start} filled={start.ph !== '' || start.free !== ''} hero={hero} />;
}

function So2Form({ start, filled, hero }: { start: So2FormValues; filled: boolean; hero: React.ReactNode }) {
  const t = useT();
  const { colors } = useTheme();
  const [values, setValues] = useState<So2FormValues>(start);
  const [touched, setTouched] = useState(false);
  const result = so2FromForm(values);
  const set = (field: keyof So2FormValues) => (text: string) => {
    setTouched(true);
    setValues((current) => ({ ...current, [field]: text }));
  };
  // Errors only after the user has typed, so the screen opens quietly when a value is missing.
  const errors = result.ok || !touched ? {} : result.errors;

  const line = (label: string, value: string, strong = false) => (
    <View style={styles.line} key={label}>
      <AppText muted style={styles.lineLabel}>
        {label}
      </AppText>
      <AppText style={{ fontFamily: strong ? fonts.bodyBold : fonts.bodySemi, color: strong ? colors.primary : colors.text }}>
        {value}
      </AppText>
    </View>
  );

  return (
    <Screen hero={hero}>
      <AppText muted variant="caption">
        {t.so2.hint}
      </AppText>
      {filled ? (
        <AppText muted variant="caption">
          {t.so2.filled}
        </AppText>
      ) : null}
      <TextField label={t.so2.ph} value={values.ph} onChangeText={set('ph')} error={errors.ph} keyboardType="decimal-pad" placeholder="3.4" />
      <TextField label={t.so2.free} value={values.free} onChangeText={set('free')} error={errors.free} keyboardType="decimal-pad" placeholder="25" />
      <TextField label={t.so2.target} value={values.target} onChangeText={set('target')} error={errors.target} keyboardType="decimal-pad" placeholder="0.8" />
      <AppText muted variant="caption">
        {t.so2.targetNote}
      </AppText>
      <TextField label={t.so2.volume} value={values.liters} onChangeText={set('liters')} error={errors.liters} keyboardType="decimal-pad" placeholder="5000" />

      {result.ok ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {line(t.so2.molecularNow, `${result.plan.molecularNow} mg/L`)}
          {line(t.so2.needed, `${result.plan.neededFree} mg/L`)}
          {result.plan.toAddMgL === 0 ? (
            <AppText style={{ fontFamily: fonts.bodySemi, color: colors.primary }}>{t.so2.enough}</AppText>
          ) : (
            <>
              {line(t.so2.toAdd, `${result.plan.toAddMgL} mg/L · ${result.plan.toAddGHl} g/hL`, true)}
              {result.plan.kmbsGrams !== null ? line(t.so2.kmbs, `${result.plan.kmbsGrams} g`, true) : null}
            </>
          )}
        </View>
      ) : null}
      <AppText muted variant="caption">
        {t.so2.formula}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  lineLabel: { flexShrink: 1 },
});
