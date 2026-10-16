import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { alertTexts } from '@/components/AlertPanel';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useRules } from '@/hooks/useRules';
import { useTank } from '@/hooks/useTanks';
import {
  TEMPERATURE_DEFAULTS,
  densityDefaults,
  densityToForm,
  evaluateRules,
  temperatureToForm,
  validateDensityForm,
  validateTemperatureForm,
  type AlertResult,
  type DensityFormValues,
  type TemperatureFormValues,
} from '@/lib/alertRules';
import { saveRule, type SavedRule } from '@/lib/alerts';
import { errorMessage } from '@/lib/errors';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { radius, spacing, useTheme } from '@/theme';

type Entries = ReturnType<typeof applyEntryChanges>;

/** The newest density reading, to pick defaults in the same scale (1.060 or 1060). */
function densitySample(timeline: Entries): number | undefined {
  for (const entry of timeline) {
    for (const item of entry.parsed.items) {
      if (item.name.trim().toLowerCase() === 'density' && typeof item.value === 'number') return item.value;
    }
  }
  return undefined;
}

/** Set the vessel's two alert rules: density not dropping, and temperature out of range. */
export default function AlertRulesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const rules = useRules(id);
  const ferments = useFerments(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const t = useT();

  const hero = <HeroBand title={t.alerts.rulesTitle} subtitle={tank.data?.name} />;

  if (rules.loading || ferments.loading || entries.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState label={t.alerts.loading} />
      </Screen>
    );
  }
  if (!rules.data || !ferments.data || !entries.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState
          message={rules.error ?? ferments.error ?? entries.error ?? t.messages.loadRulesFailed}
          onRetry={() => {
            rules.refresh();
            ferments.refresh();
            entries.refresh();
          }}
          retrying={rules.refreshing}
        />
      </Screen>
    );
  }

  const timeline = applyEntryChanges(entries.data, outbox.items, id);
  const results = evaluateRules(rules.data, timeline, ferments.data);
  return (
    <RulesEditor
      key="editor"
      tankId={id}
      hero={hero}
      rules={rules.data}
      results={results}
      sample={densitySample(timeline)}
    />
  );
}

function RulesEditor({
  tankId,
  hero,
  rules,
  results,
  sample,
}: {
  tankId: string;
  hero: React.ReactNode;
  rules: readonly SavedRule[];
  results: readonly AlertResult[];
  sample: number | undefined;
}) {
  const t = useT();
  const { colors } = useTheme();
  const density = rules.find((rule) => rule.kind === 'density_stall');
  const temperature = rules.find((rule) => rule.kind === 'temperature_range');

  // Rules start switched off, so nothing alerts until the winemaker has chosen to.
  const [densityOn, setDensityOn] = useState(density?.enabled ?? false);
  const [tempOn, setTempOn] = useState(temperature?.enabled ?? false);
  const [densityValues, setDensityValues] = useState<DensityFormValues>(() =>
    densityToForm(density?.kind === 'density_stall' ? density.params : densityDefaults(sample)),
  );
  const [tempValues, setTempValues] = useState<TemperatureFormValues>(() =>
    temperatureToForm(temperature?.kind === 'temperature_range' ? temperature.params : TEMPERATURE_DEFAULTS),
  );
  const [densityErrors, setDensityErrors] = useState<Partial<Record<keyof DensityFormValues, string>>>({});
  const [tempErrors, setTempErrors] = useState<Partial<Record<keyof TemperatureFormValues, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onOff = [
    { value: 'on', label: t.alerts.on },
    { value: 'off', label: t.alerts.off },
  ] as const;

  async function handleSave() {
    setError(null);
    const d = validateDensityForm(densityValues);
    const tm = validateTemperatureForm(tempValues);
    setDensityErrors(d.ok ? {} : d.errors);
    setTempErrors(tm.ok ? {} : tm.errors);
    if (!d.ok || !tm.ok) return;
    setSaving(true);
    try {
      await saveRule(tankId, { kind: 'density_stall', enabled: densityOn, params: d.params });
      await saveRule(tankId, { kind: 'temperature_range', enabled: tempOn, params: tm.params });
      router.back(); // the screens refetch on focus
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  /** What the saved rule says right now. */
  function status(kind: 'density_stall' | 'temperature_range'): string | null {
    const result = results.find((r) => r.rule.kind === kind);
    if (!result) return null;
    if (result.status === 'tripped') return `${t.alerts.statusTripped}. ${alertTexts(result, t).observed}`;
    if (result.status === 'ok') return result.reason ? t.alerts.reasons[result.reason] : t.alerts.statusOk;
    return `${t.alerts.statusNoData}: ${result.reason ? t.alerts.reasons[result.reason] : ''}`;
  }

  const densityStatus = status('density_stall');
  const tempStatus = status('temperature_range');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen hero={hero} footer={<Button title={t.alerts.save} icon="check" onPress={handleSave} loading={saving} />}>
        <OfflineBanner message={t.alerts.needsInternet} />
        {error ? <Banner message={error} /> : null}
        <AppText muted>{t.alerts.intro}</AppText>
        <Banner tone="info" message={t.alerts.defaultsNote} />

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="title">{t.alerts.densityName}</AppText>
          <ChoiceChips label={t.alerts.title} choices={onOff} selected={densityOn ? 'on' : 'off'} onSelect={(v) => setDensityOn(v === 'on')} disabled={saving} />
          <TextField
            label={t.alerts.densityHours}
            value={densityValues.hours}
            onChangeText={(hours) => setDensityValues((c) => ({ ...c, hours }))}
            error={densityErrors.hours}
            keyboardType="numeric"
            editable={!saving}
          />
          <TextField
            label={t.alerts.densityMinDrop}
            value={densityValues.minDrop}
            onChangeText={(minDrop) => setDensityValues((c) => ({ ...c, minDrop }))}
            error={densityErrors.minDrop}
            keyboardType="decimal-pad"
            editable={!saving}
          />
          <TextField
            label={t.alerts.densityDryBelow}
            value={densityValues.dryBelow}
            onChangeText={(dryBelow) => setDensityValues((c) => ({ ...c, dryBelow }))}
            error={densityErrors.dryBelow}
            keyboardType="decimal-pad"
            editable={!saving}
          />
          {densityStatus ? (
            <AppText muted variant="caption">
              {t.alerts.currentCheck}: {densityStatus}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="title">{t.alerts.temperatureName}</AppText>
          <ChoiceChips label={t.alerts.title} choices={onOff} selected={tempOn ? 'on' : 'off'} onSelect={(v) => setTempOn(v === 'on')} disabled={saving} />
          <TextField
            label={t.alerts.temperatureMin}
            value={tempValues.minC}
            onChangeText={(minC) => setTempValues((c) => ({ ...c, minC }))}
            error={tempErrors.minC}
            keyboardType="numbers-and-punctuation"
            editable={!saving}
          />
          <TextField
            label={t.alerts.temperatureMax}
            value={tempValues.maxC}
            onChangeText={(maxC) => setTempValues((c) => ({ ...c, maxC }))}
            error={tempErrors.maxC}
            keyboardType="numbers-and-punctuation"
            editable={!saving}
          />
          {tempStatus ? (
            <AppText muted variant="caption">
              {t.alerts.currentCheck}: {tempStatus}
            </AppText>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
