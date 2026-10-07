import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { EntryCard } from '@/components/EntryCard';
import { HeaderButton } from '@/components/HeaderButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntries } from '@/hooks/useEntries';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { deleteEntry, type Entry } from '@/lib/entries';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { errorMessage } from '@/lib/errors';
import { formatEntryTime, formatLiters, formatWine } from '@/lib/format';
import type { EntryItem } from '@/lib/outbox';
import { radius, spacing, useTheme } from '@/theme';

/** A timeline row: an entry on the server, or one saved on this phone and not uploaded yet. */
type Row = { entry: Entry; queued: EntryItem | null };

function queuedAsEntry(item: EntryItem): Entry {
  return {
    id: item.localId,
    tankId: item.tankId,
    type: item.type,
    rawText: item.rawText,
    parsed: item.parsed,
    createdAt: item.createdAt,
  };
}

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
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

  function openQueuedActions(item: EntryItem) {
    const label = entryLabel(queuedAsEntry(item));
    const message =
      item.status === 'failed'
        ? `Couldn't upload: ${item.error ?? 'unknown error'}`
        : 'Saved on this phone. It uploads automatically when you are online.';
    Alert.alert(label, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete this entry?', `${label}\n\nIt was never uploaded, so it will be gone for good.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => outbox.discard(item.localId) },
          ]),
      },
      { text: 'Try again', onPress: () => outbox.retry(item.localId) },
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

  const { name, volumeLiters, variety, vintage, upload } = tank.data;
  const tankItem = outbox.items.find(
    (item) =>
      (item.kind === 'tank-create' && item.localId === id) ||
      ((item.kind === 'tank-update' || item.kind === 'tank-delete') && item.tankId === id),
  );
  const localOnly = tankItem?.kind === 'tank-create';

  function confirmDiscardTank() {
    const waiting = outbox.items.filter((item) => item.kind === 'entry' && item.tankId === id).length;
    Alert.alert(
      `Delete ${name}?`,
      'This tank was never uploaded, so it will be gone for good' +
        (waiting > 0 ? `, together with its ${waiting === 1 ? '1 entry' : `${waiting} entries`}.` : '.'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            outbox.discardTank(id);
            router.back();
          },
        },
      ],
    );
  }

  // Newest first: entries waiting to upload sit in the timeline at the time they were recorded.
  const saved = entries.data ?? [];
  const savedIds = new Set(saved.map((entry) => entry.id));
  const queued = outbox.items.filter(
    (item): item is EntryItem => item.kind === 'entry' && item.tankId === id && !savedIds.has(item.localId),
  );
  const rows: Row[] = [
    ...queued.map((item) => ({ entry: queuedAsEntry(item), queued: item })),
    ...saved.map((entry) => ({ entry, queued: null })),
  ].sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));

  function refreshAll() {
    tank.refresh();
    entries.refresh();
    outbox.uploadNow();
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
      <OfflineBanner message="You're offline. New entries are saved on this phone and upload later." />
      <SyncBanner />
      <CachedNote cachedAt={tank.cachedAt} error={tank.error} onRetry={refreshAll} />
      {upload?.status === 'failed' && tankItem ? (
        <View style={styles.uploadBox}>
          <Banner
            message={
              upload.action === 'delete'
                ? `Couldn't delete this tank: ${upload.error ?? 'unknown error'}`
                : `This tank couldn't upload: ${upload.error ?? 'unknown error'} Fix it with Edit, then try again.`
            }
            onRetry={() => outbox.retry(tankItem.localId)}
          />
          {localOnly ? (
            <Button variant="danger" title="Delete this tank" onPress={confirmDiscardTank} />
          ) : null}
        </View>
      ) : upload ? (
        <Banner tone="info" message="Saved on this phone · this tank uploads when you're back online." />
      ) : null}
      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="heading">{name}</AppText>
        <AppText muted>{formatWine(variety, vintage) ?? 'No wine set'}</AppText>
        <AppText variant="label">{formatLiters(volumeLiters)}</AppText>
      </View>
      <AppText variant="title">Timeline</AppText>
      {rows.length > 0 ? (
        <AppText muted variant="caption">
          Tap an entry to edit or delete it.
        </AppText>
      ) : null}
      {actionError ? <Banner message={actionError} /> : null}
      {rows.length > 0 ? (
        <CachedNote cachedAt={entries.cachedAt} error={entries.error} onRetry={entries.refresh} />
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
        data={rows}
        keyExtractor={(row) => row.entry.id}
        renderItem={({ item }) =>
          item.queued ? (
            <EntryCard
              entry={item.entry}
              upload={{ status: item.queued.status, error: item.queued.error }}
              onPress={() => item.queued && openQueuedActions(item.queued)}
            />
          ) : (
            <EntryCard
              entry={item.entry}
              onPress={() => openEntryActions(item.entry)}
              busy={item.entry.id === deletingId}
            />
          )
        }
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
  uploadBox: { gap: spacing.sm },
});
