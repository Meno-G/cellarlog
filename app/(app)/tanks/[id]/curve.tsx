import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { ChoiceChips } from '@/components/ChoiceChips';
import { CurveChart, seriesColor } from '@/components/CurveChart';
import { HeroBand } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { compareAtDay, fermentCurves, type Curves } from '@/lib/fermentCurves';
import type { Ferment } from '@/lib/ferments';
import { formatItemValue } from '@/lib/format';
import { itemName } from '@/lib/i18n';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** The values worth following through a fermentation, as stored. */
const MEASURES = ['Density', 'Temperature'] as const;
type Measure = (typeof MEASURES)[number];

/** Density and temperature against days since the ferment started, with earlier ferments laid over it. */
export default function CurveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const ferments = useFerments(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const t = useT();
  const [chosen, setChosen] = useState<Measure | null>(null);

  const hero = <HeroBand title={t.ferment.chartTitle} subtitle={tank.data?.name} />;
  const frame = (children: ReactNode) => (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      {hero}
      {children}
    </SafeAreaView>
  );

  if (ferments.loading || entries.loading) return frame(<LoadingState />);
  if (!ferments.data || !entries.data) {
    return frame(
      <ErrorState
        message={ferments.error ?? entries.error ?? t.messages.loadFermentsFailed}
        onRetry={() => {
          ferments.refresh();
          entries.refresh();
        }}
        retrying={ferments.refreshing || entries.refreshing}
      />,
    );
  }

  const timeline = applyEntryChanges(entries.data, outbox.items, id);
  const now = new Date();
  const byMeasure = Object.fromEntries(
    MEASURES.map((measure) => [measure, fermentCurves(timeline, ferments.data ?? [], measure, now)]),
  ) as Record<Measure, Curves<Ferment>>;
  // Open on density if it has readings (the fermentation curve), else on temperature.
  const measure: Measure = chosen ?? (byMeasure.Density.series.length > 0 ? 'Density' : 'Temperature');
  const curves = byMeasure[measure];
  const comparison = compareAtDay(curves);
  const show = (value: number) => formatItemValue({ name: measure, value, unit: curves.unit });

  return frame(
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={ferments.refreshing || entries.refreshing}
          onRefresh={() => {
            ferments.refresh();
            entries.refresh();
          }}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <CachedNote cachedAt={ferments.cachedAt ?? entries.cachedAt} error={ferments.error ?? entries.error} onRetry={ferments.refresh} />

      {ferments.data.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="title">{t.ferment.listEmptyTitle}</AppText>
          <AppText muted style={styles.emptyText}>
            {t.ferment.needFerment}
          </AppText>
          <Button
            title={t.ferment.start}
            icon="plus"
            onPress={() => router.push({ pathname: '/tanks/[id]/ferment-form', params: { id } })}
          />
        </View>
      ) : (
        <>
          <ChoiceChips
            label={t.ferment.measureLabel}
            choices={MEASURES.map((value) => ({ value, label: itemName(value) }))}
            selected={measure}
            onSelect={setChosen}
          />

          {curves.series.length === 0 ? (
            <AppText muted>{t.ferment.noReadings}</AppText>
          ) : (
            <>
              <CurveChart name={measure} curves={curves} />

              <View style={styles.legend}>
                {curves.series.map((series, index) => (
                  <View key={series.ferment.id} style={styles.legendRow}>
                    <View style={[styles.swatch, { backgroundColor: seriesColor(colors, series, index) }]} />
                    <AppText style={styles.legendName} numberOfLines={1}>
                      {series.ferment.name}
                    </AppText>
                    <AppText muted variant="caption">
                      {series.current ? t.ferment.thisFerment : t.ferment.earlierFerments}
                    </AppText>
                  </View>
                ))}
              </View>

              {comparison ? (
                <View style={[styles.compare, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <AppText variant="heading" style={{ color: colors.heading }}>
                    {t.ferment.compareTitle(comparison.day)}
                  </AppText>
                  <AppText style={styles.compareNow}>{t.ferment.compareNow(show(comparison.now.value))}</AppText>
                  {comparison.earlier.length === 0 ? (
                    <AppText muted>{t.ferment.compareNone}</AppText>
                  ) : (
                    comparison.earlier.map(({ ferment, point }) => (
                      <AppText key={ferment.id}>{t.ferment.compareThen(ferment.name, show(point.value))}</AppText>
                    ))
                  )}
                </View>
              ) : null}

              {curves.skipped > 0 ? (
                <AppText muted variant="caption">
                  {t.history.skipped(curves.skipped)}
                </AppText>
              ) : null}
            </>
          )}
        </>
      )}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { textAlign: 'center' },
  legend: { gap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  swatch: { width: 22, height: 6, borderRadius: 3 },
  legendName: { flexShrink: 1 },
  compare: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  compareNow: { fontFamily: fonts.bodySemi },
});
