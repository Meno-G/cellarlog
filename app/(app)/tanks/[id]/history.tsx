import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CachedNote } from '@/components/CachedNote';
import { HistoryChart } from '@/components/HistoryChart';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { formatChange, formatEntryTime, formatItemValue, formatRelative } from '@/lib/format';
import { valueHistory, type HistoryPoint } from '@/lib/latestValues';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** Every reading of one value on a tank (e.g. Brix during fermentation), with a chart. */
export default function ValueHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();

  const hero = <HeroBand title={name} subtitle={tank.data ? `History · ${tank.data.name}` : 'History'} />;

  if (entries.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState label="Loading readings…" />
      </Screen>
    );
  }
  if (!entries.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState
          message={entries.error ?? 'Could not load the readings.'}
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
      <Stat label="Latest" value={show(latest)} detail={formatRelative(latest.createdAt)} />
      {previous ? (
        <Stat
          label="Change"
          value={formatChange(latest.value - previous.value, latest.unit)}
          detail={`since ${formatRelative(previous.createdAt)}`}
        />
      ) : null}
      {points.length > 1 ? (
        <>
          <Stat label="Lowest" value={show({ value: Math.min(...values), unit: latest.unit })} />
          <Stat label="Highest" value={show({ value: Math.max(...values), unit: latest.unit })} />
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
                {skipped === 1 ? '1 reading' : `${skipped} readings`} in another unit or written as text{' '}
                {skipped === 1 ? "isn't" : "aren't"} included. They are still on the timeline.
              </AppText>
            ) : null}
            {points.length > 0 ? (
              <AppText variant="heading" style={{ color: colors.header }}>
                All readings
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
            <AppText variant="title">No readings yet</AppText>
            <AppText muted style={styles.emptyText}>
              Readings of {name} on this tank will show here, from the Analysis tab or a spoken note.
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
