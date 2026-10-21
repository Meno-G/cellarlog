import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { Dropdown } from '@/components/Dropdown';
import { CurveChart, seriesColor } from '@/components/CurveChart';
import { HeroBand } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { chartableMeasures, compareAtDay, fermentCurves } from '@/lib/fermentCurves';
import { formatItemValue } from '@/lib/format';
import { itemName } from '@/lib/i18n';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** Any measured value (density, Brix, alcohol, residual sugar, VA, pH…) against days since the ferment started, with earlier ferments laid over it. */
export default function CurveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const ferments = useFerments(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const t = useT();
  const [chosen, setChosen] = useState<string | null>(null);

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
  // Every value with numbers in some ferment; it opens on the first (density if there is any).
  const measures = chartableMeasures(timeline, ferments.data, now);
  const measure = measures.find((m) => m.name === chosen)?.name ?? measures[0]?.name ?? 'Density';
  const curves = fermentCurves(timeline, ferments.data, measure, now);
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
          {measures.length > 0 ? (
            <Dropdown
              label={t.ferment.measureLabel}
              options={measures.map((m) => ({ value: m.name, label: `${itemName(m.name)} (${m.count})` }))}
              selected={measure}
              onSelect={setChosen}
            />
          ) : null}

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
