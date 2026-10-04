import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { EntryCard } from '@/components/EntryCard';
import { HeaderButton } from '@/components/HeaderButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useTank } from '@/hooks/useTanks';
import { formatLiters, formatWine } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const { colors } = useTheme();

  if (tank.loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }

  if (!tank.data) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={tank.error ?? 'Could not load this tank.'}
          onRetry={tank.refresh}
          retrying={tank.refreshing}
        />
      </Screen>
    );
  }

  const { name, volumeLiters, variety, vintage } = tank.data;

  function refreshAll() {
    tank.refresh();
    entries.refresh();
  }

  function renderTimelineState() {
    if (entries.loading) return <LoadingState label="Loading timeline…" />;
    if (!entries.data) {
      return (
        <ErrorState
          message={entries.error ?? 'Could not load the timeline.'}
          onRetry={entries.refresh}
          retrying={entries.refreshing}
        />
      );
    }
    return (
      <View style={styles.empty}>
        <AppText muted>No entries yet. Tap “Add entry” to log the first one.</AppText>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <OfflineBanner />
      {tank.error ? <Banner message={tank.error} onRetry={refreshAll} /> : null}
      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="heading">{name}</AppText>
        <AppText muted>{formatWine(variety, vintage) ?? 'No wine set'}</AppText>
        <AppText variant="label">{formatLiters(volumeLiters)}</AppText>
      </View>
      <AppText variant="title">Timeline</AppText>
      {entries.data && entries.error ? (
        <Banner message={entries.error} onRetry={entries.refresh} />
      ) : null}
    </View>
  );

  return (
    <Screen
      scroll={false}
      footer={
        <Button
          title="Add entry"
          onPress={() => router.push({ pathname: '/entries/new', params: { tankId: id } })}
        />
      }
    >
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <HeaderButton
              title="Edit"
              onPress={() => router.push({ pathname: '/tanks/[id]/edit', params: { id } })}
            />
          ),
        }}
      />
      <FlatList
        data={entries.data ?? []}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={renderTimelineState()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={tank.refreshing || entries.refreshing}
            onRefresh={refreshAll}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  summary: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
});
