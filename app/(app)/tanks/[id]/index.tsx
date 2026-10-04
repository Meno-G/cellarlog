import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

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
import { deleteEntry, type Entry } from '@/lib/entries';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { errorMessage } from '@/lib/errors';
import { formatEntryTime, formatLiters, formatWine } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const { colors } = useTheme();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function entryLabel(entry: Entry): string {
    return `${ENTRY_TYPE_LABELS[entry.type]} · ${formatEntryTime(entry.createdAt)}`;
  }

  function openEntryActions(entry: Entry) {
    Alert.alert(entryLabel(entry), undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(entry) },
      {
        text: 'Edit',
        onPress: () => router.push({ pathname: '/entries/[id]/edit', params: { id: entry.id } }),
      },
    ]);
  }

  function confirmDelete(entry: Entry) {
    Alert.alert('Delete this entry?', `${entryLabel(entry)}\n\nThis can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          setDeletingId(entry.id);
          deleteEntry(entry.id)
            .catch((err: unknown) => setActionError(errorMessage(err)))
            .finally(() => {
              setDeletingId(null);
              entries.refresh();
            });
        },
      },
    ]);
  }

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
      {entries.data && entries.data.length > 0 ? (
        <AppText muted variant="caption">
          Tap an entry to edit or delete it.
        </AppText>
      ) : null}
      {actionError ? <Banner message={actionError} /> : null}
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
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onPress={() => openEntryActions(item)}
            busy={item.id === deletingId}
          />
        )}
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
