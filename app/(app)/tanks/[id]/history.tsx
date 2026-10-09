import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CachedNote } from '@/components/CachedNote';
import { HistoryChart } from '@/components/HistoryChart';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { formatChange, formatEntryTime, formatItemValue, formatRelative } from '@/lib/format';
import { itemName } from '@/lib/i18n';
import { valueHistory, type HistoryPoint } from '@/lib/latestValues';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** Every reading of one value on a tank (e.g. Brix during fermentation), with a chart. */
export default function ValueHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const t = useT();
  const shownName = itemName(name);

  const hero = (
    <HeroBand title={shownName} subtitle={tank.data ? t.history.titleFor(tank.data.name) : t.history.title} />
  );

  if (entries.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState label={t.history.loading} />
      </Screen>
    );
  }
  if (!entries.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState
          message={entries.error ?? t.history.loadFailed}
          onRetry={entries.refresh}
          retrying={entries.refreshing}
        />
      </Screen>
    );
  }

  // Includes changes made on this phone that haven't uploaded yet.
  const timeline = applyEntryChanges(entries.data, outbox.items, id);
  const { points, skipped } = valueHistory(timeline, name);
  const newestFirst = [...points].reverse();
  const latest = newestFirst[0];
  const previous = newestFirst[1];
  const values = points.map((point) => point.value);
  const show = (point: Pick<HistoryPoint, 'value' | 'unit'>) => formatItemValue({ name, ...point });

  const summary = latest ? (
    <View style={styles.summary}>
      <Stat label={t.history.latest} value={show(latest)} detail={formatRelative(latest.createdAt)} />
      {previous ? (
        <Stat
          label={t.history.change}
          value={formatChange(latest.value - previous.value, latest.unit)}
          detail={t.history.since(formatRelative(previous.createdAt))}
        />
      ) : null}
      {points.length > 1 ? (
        <>
          <Stat label={t.history.lowest} value={show({ value: Math.min(...values), unit: latest.unit })} />
          <Stat label={t.history.highest} value={show({ value: Math.max(...values), unit: latest.unit })} />
        </>
      ) : null}
    </View>
  ) : null;

  return (
    <Screen scroll={false} hero={hero}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={newestFirst}
        keyExtractor={(point, index) => `${point.createdAt}-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={entries.refreshing}
            onRefresh={entries.refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <CachedNote cachedAt={entries.cachedAt} error={entries.error} onRetry={entries.refresh} />
            {summary}
            <HistoryChart name={name} points={points} />
            {skipped > 0 ? (
              <AppText muted variant="caption">
                {t.history.skipped(skipped)}
              </AppText>
            ) : null}
            {points.length > 0 ? (
              <AppText variant="heading" style={{ color: colors.heading }}>
                {t.history.allReadings}
              </AppText>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const before = newestFirst[index + 1];
          return (
            <View
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessible
              accessibilityLabel={`${formatEntryTime(item.createdAt)}: ${show(item)}${
                before ? `, ${formatChange(item.value - before.value, item.unit)}` : ''
              }`}
            >
              <AppText style={styles.when}>{formatEntryTime(item.createdAt)}</AppText>
              <View style={styles.rowValues}>
                <AppText style={styles.value}>{show(item)}</AppText>
                {before ? (
                  <AppText muted variant="caption">
                    {formatChange(item.value - before.value, item.unit)}
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="title">{t.history.noReadingsTitle}</AppText>
            <AppText muted style={styles.emptyText}>
              {t.history.noReadingsText(shownName)}
            </AppText>
          </View>
        }
      />
    </Screen>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
    >
      <AppText muted style={styles.statLabel}>
        {label}
      </AppText>
      <AppText style={styles.statValue} numberOfLines={1}>
        {value}
      </AppText>
      {detail ? (
        <AppText muted style={styles.statDetail} numberOfLines={1}>
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statLabel: { fontSize: 14, lineHeight: 18 },
  statValue: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28 },
  statDetail: { fontSize: 13, lineHeight: 17 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  when: { flexShrink: 1 },
  rowValues: { alignItems: 'flex-end' },
  value: { fontFamily: fonts.bodyBold },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { textAlign: 'center' },
});
