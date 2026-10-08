import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { EntryCard } from '@/components/EntryCard';
import { HeaderButton } from '@/components/HeaderButton';
import { LatestValues } from '@/components/LatestValues';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntries } from '@/hooks/useEntries';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges, type ShownEntry } from '@/lib/entryOverlay';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { errorMessage } from '@/lib/errors';
import { formatEntryTime, formatLiters, formatWine } from '@/lib/format';
import { latestValues } from '@/lib/latestValues';
import { spacing, useTheme } from '@/theme';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function entryLabel(entry: ShownEntry): string {
    return `${ENTRY_TYPE_LABELS[entry.type]} · ${formatEntryTime(entry.createdAt)}`;
  }

  function editEntry(entry: ShownEntry) {
    router.push({ pathname: '/entries/[id]/edit', params: { id: entry.id, tankId: entry.tankId } });
  }

  /** Android shows at most three buttons in a dialog, so each state gets its own short menu. */
  function openEntryActions(entry: ShownEntry) {
    const label = entryLabel(entry);
    const upload = entry.upload;
    const edit = { text: 'Edit', onPress: () => editEntry(entry) };
    const remove = { text: 'Delete', style: 'destructive' as const, onPress: () => confirmDelete(entry) };
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    const tryAgain = upload ? { text: 'Try again', onPress: () => outbox.retry(upload.localId) } : null;

    if (!upload) {
      Alert.alert(label, undefined, [cancel, remove, edit]);
    } else if (upload.action === 'delete') {
      // Only a failed delete is still shown.
      Alert.alert(label, `Couldn't delete: ${upload.error ?? 'unknown error'}`, [
        cancel,
        { text: 'Keep entry', onPress: () => outbox.discard(upload.localId) },
        ...(tryAgain ? [tryAgain] : []),
      ]);
    } else if (upload.status === 'pending') {
      const message =
        upload.action === 'edit'
          ? 'Edited on this phone. The change uploads automatically when you are online.'
          : 'Saved on this phone. It uploads automatically when you are online.';
      Alert.alert(label, message, [cancel, remove, edit]);
    } else if (upload.action === 'edit') {
      Alert.alert(label, `Couldn't upload this edit: ${upload.error ?? 'unknown error'}`, [
        { text: 'Undo edit', style: 'destructive', onPress: () => outbox.discard(upload.localId) },
        edit,
        ...(tryAgain ? [tryAgain] : []),
      ], { cancelable: true });
    } else {
      Alert.alert(label, `Couldn't upload: ${upload.error ?? 'unknown error'}`, [
        remove,
        edit,
        ...(tryAgain ? [tryAgain] : []),
      ], { cancelable: true });
    }
  }

  function confirmDelete(entry: ShownEntry) {
    const label = entryLabel(entry);
    const neverUploaded = entry.upload?.action === 'create';
    Alert.alert(
      'Delete this entry?',
      `${label}

${neverUploaded ? 'It was never uploaded, so it will be gone for good.' : "This can't be undone."}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            setDeletingId(entry.id);
            // Online it's deleted now; offline it disappears at once and the deletion uploads later.
            outbox
              .deleteEntry(entry)
              .catch((err: unknown) => setActionError(errorMessage(err)))
              .finally(() => {
                setDeletingId(null);
                entries.refresh();
              });
          },
        },
      ],
    );
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

  // Newest first, with changes made on this phone applied: new entries sit at the time
  // they were recorded, edits show their new values, deleted entries are gone.
  const rows = applyEntryChanges(entries.data ?? [], outbox.items, id);

  // Includes entries still waiting to upload, so a reading shows up as soon as it's saved.
  const latest = latestValues(rows);

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
        <Banner tone="waiting" message="Saved on this phone · this tank uploads when you're back online." />
      ) : null}
      <LatestValues
        values={latest}
        onSelect={(valueName) => router.push({ pathname: '/tanks/[id]/history', params: { id, name: valueName } })}
      />
      <View style={styles.timelineHeading}>
        <AppText variant="heading" style={{ color: colors.header }}>
          Timeline
        </AppText>
        {rows.length > 0 ? (
          <AppText muted variant="caption">
            Tap to edit or delete
          </AppText>
        ) : null}
      </View>
      {actionError ? <Banner message={actionError} /> : null}
      {rows.length > 0 ? (
        <CachedNote cachedAt={entries.cachedAt} error={entries.error} onRetry={entries.refresh} />
      ) : null}
    </View>
  );

  return (
    <Screen
      scroll={false}
      hero={
        <HeroBand
          title={name}
          subtitle={[formatWine(variety, vintage) ?? 'No wine set', formatLiters(volumeLiters)].join(' · ')}
        />
      }
      footer={
        <Button
          title="Add entry"
          icon="microphone"
          onPress={() => router.push({ pathname: '/entries/new', params: { tankId: id } })}
        />
      }
    >
      <Stack.Screen
        options={{
          // The name is shown large in the band below; keep the header itself quiet.
          title: '',
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
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            upload={item.upload ?? undefined}
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
  list: { gap: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  timelineHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  uploadBox: { gap: spacing.sm },
});
