import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useUser } from '@/hooks/useSession';
import { useTank, useTanks } from '@/hooks/useTanks';
import { entriesCache } from '@/lib/cache';
import { applyEntryChanges, type ShownEntry } from '@/lib/entryOverlay';
import { formatEntryTime, formatLiters } from '@/lib/format';
import { cameFrom, wentTo, type LineageStep } from '@/lib/lineage';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** Where this vessel's wine came from, and where it went, through the transfers recorded. */
export default function LineageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { id: userId } = useUser();
  const tank = useTank(id);
  const tanks = useTanks();
  const entries = useEntries(id);
  const outbox = useOutbox();
  const t = useT();
  const hero = <HeroBand title={t.lineage.title} subtitle={tank.data?.name} />;

  // Every vessel's saved timeline (each sync saves all of them), with changes waiting to upload.
  const timelines = useMemo(() => {
    const map = new Map<string, ShownEntry[]>();
    for (const other of tanks.data ?? []) {
      const saved =
        other.id === id ? (entries.data ?? entriesCache(userId, id).read()?.data ?? []) : (entriesCache(userId, other.id).read()?.data ?? []);
      map.set(other.name.trim().toLowerCase(), applyEntryChanges(saved, outbox.items, other.id));
    }
    return map;
  }, [tanks.data, entries.data, outbox.items, id, userId]);

  if (tank.loading || tanks.loading || entries.loading) {
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

  const came = cameFrom(tank.data.name, timelines);
  const went = wentTo(timelines.get(tank.data.name.trim().toLowerCase()) ?? []);
  return (
    <Screen hero={hero}>
      <AppText muted variant="caption">
        {t.lineage.hint}
      </AppText>
      <Section title={t.lineage.cameFrom}>
        {came.length === 0 ? (
          <AppText muted>{t.lineage.noneCame}</AppText>
        ) : (
          came.map((step, index) => <Step key={`${step.at}-${index}`} step={step} depth={0} label={t.lineage.from} />)
        )}
      </Section>
      <Section title={t.lineage.wentTo}>
        {went.length === 0 ? (
          <AppText muted>{t.lineage.noneWent}</AppText>
        ) : (
          went.map((step, index) => <Step key={`${step.at}-${index}`} step={{ ...step, from: [] }} depth={0} label={t.lineage.to} />)
        )}
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="heading" style={{ color: colors.heading }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** One transfer, and (indented below) what had come into that vessel before. */
function Step({ step, depth, label }: { step: LineageStep; depth: number; label: (vessel: string) => string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginLeft: depth * spacing.md, gap: spacing.sm }}>
      <View style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible>
        <AppText style={{ fontFamily: fonts.bodySemi }}>{label(step.vessel)}</AppText>
        <AppText muted variant="caption">
          {[formatEntryTime(step.at), step.liters === null ? null : formatLiters(step.liters)].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      {step.from.map((earlier, index) => (
        <Step key={`${earlier.at}-${index}`} step={earlier} depth={depth + 1} label={label} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  step: { gap: 2, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
});
