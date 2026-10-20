import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { EntryCard } from '@/components/EntryCard';
import { AlertPanel } from '@/components/AlertPanel';
import { FermentPanel } from '@/components/FermentPanel';
import { ReminderPanel } from '@/components/ReminderPanel';
import { HeaderButton } from '@/components/HeaderButton';
import { LatestValues } from '@/components/LatestValues';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useDialog } from '@/hooks/useDialog';
import { useOutbox } from '@/hooks/useOutbox';
import { useRules } from '@/hooks/useRules';
import { useTank } from '@/hooks/useTanks';
import { applyEntryChanges, type ShownEntry } from '@/lib/entryOverlay';
import { errorMessage } from '@/lib/errors';
import { evaluateRules } from '@/lib/alertRules';
import { csvFilename, entriesForScope, entriesToCsv } from '@/lib/exportCsv';
import { buildReportHtml, reportTitle } from '@/lib/reportHtml';
import { activeFerment } from '@/lib/fermentCurves';
import type { Ferment } from '@/lib/ferments';
import { shareCsv, sharePdf } from '@/lib/shareFile';
import { describeWine } from '@/lib/blend';
import { formatEntryTime, formatFill } from '@/lib/format';
import { latestValues } from '@/lib/latestValues';
import { spacing, useTheme } from '@/theme';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const entries = useEntries(id);
  const ferments = useFerments(id);
  const rules = useRules(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const t = useT();
  const dialog = useDialog();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function entryLabel(entry: ShownEntry): string {
    return `${t.entryTypes[entry.type]} · ${formatEntryTime(entry.createdAt)}`;
  }

  function editEntry(entry: ShownEntry) {
    router.push({ pathname: '/entries/[id]/edit', params: { id: entry.id, tankId: entry.tankId } });
  }

  /** Android shows at most three buttons in a dialog, so each state gets its own short menu. */
  function openEntryActions(entry: ShownEntry) {
    const label = entryLabel(entry);
    const upload = entry.upload;
    const edit = { text: t.common.edit, onPress: () => editEntry(entry) };
    const remove = { text: t.common.delete, style: 'destructive' as const, onPress: () => confirmDelete(entry) };
    const cancel = { text: t.common.cancel, style: 'cancel' as const };
    const tryAgain = upload ? { text: t.common.tryAgain, onPress: () => outbox.retry(upload.localId) } : null;
    const error = upload?.error ?? t.messages.somethingWrong;

    if (!upload) {
      dialog(label, undefined, [cancel, remove, edit]);
    } else if (upload.action === 'delete') {
      // Only a failed delete is still shown.
      dialog(label, t.tank.couldntDeleteEntry(error), [
        cancel,
        { text: t.tank.keepEntry, onPress: () => outbox.discard(upload.localId) },
        ...(tryAgain ? [tryAgain] : []),
      ]);
    } else if (upload.status === 'pending') {
      const message =
        upload.action === 'edit' ? t.tank.entryEdited : t.tank.entrySaved;
      dialog(label, message, [cancel, remove, edit]);
    } else if (upload.action === 'edit') {
      dialog(label, t.tank.couldntUploadEdit(error), [
        { text: t.tank.undoEdit, style: 'destructive', onPress: () => outbox.discard(upload.localId) },
        edit,
        ...(tryAgain ? [tryAgain] : []),
      ]);
    } else {
      dialog(label, t.tank.couldntUploadEntry(error), [
        remove,
        edit,
        ...(tryAgain ? [tryAgain] : []),
      ]);
    }
  }

  function confirmDelete(entry: ShownEntry) {
    const label = entryLabel(entry);
    const neverUploaded = entry.upload?.action === 'create';
    dialog(
      t.tank.deleteEntryTitle,
      `${label}\n\n${neverUploaded ? t.tank.neverUploaded : t.tank.cantUndo}`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
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
          message={tank.error ?? t.messages.loadTankFailed}
          onRetry={tank.refresh}
          retrying={tank.refreshing}
        />
      </Screen>
    );
  }

  const { name, volumeLiters, contentLiters, variety, vintage, blend, upload } = tank.data;
  const tankItem = outbox.items.find(
    (item) =>
      (item.kind === 'tank-create' && item.localId === id) ||
      ((item.kind === 'tank-update' || item.kind === 'tank-delete') && item.tankId === id),
  );
  const localOnly = tankItem?.kind === 'tank-create';

  function confirmEndFerment(ferment: Ferment) {
    dialog(t.ferment.endTitle(ferment.name), t.ferment.endText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.ferment.endButton,
        onPress: () => {
          setActionError(null);
          // Ends now; the entries recorded so far still belong to it.
          // Online it ends now; offline the change waits on this phone.
          outbox
            .saveFerment(id, ferment.id, { name: ferment.name, startedAt: ferment.startedAt, endedAt: new Date().toISOString() })
            .catch((err: unknown) => setActionError(errorMessage(err)))
            .finally(ferments.refresh);
        },
      },
    ]);
  }

  /** A CSV or a printable report of the whole vessel, or of its running (else newest) ferment. */
  function exportData(format: 'csv' | 'pdf') {
    const all = ferments.data ?? [];
    const current = activeFerment(all) ?? all[0];
    const kind = tank.data?.kind ?? 'tank';
    const send = (scope: 'all' | string, ferment: Ferment | null) => {
      setActionError(null);
      const now = new Date();
      const chosen = entriesForScope(rows, all, scope, now);
      const done =
        format === 'csv'
          ? shareCsv(
              csvFilename(name, ferment?.name ?? null, now),
              entriesToCsv({ vessel: { name, kind }, ferments: all, entries: chosen }),
              t.exportData.shareTitle(name),
            )
          : sharePdf(
              buildReportHtml({ vessel: { name, kind, variety, vintage, blend, volumeLiters, contentLiters }, ferment, entries: chosen, now }),
              reportTitle(name, ferment?.name ?? null),
            );
      done.catch((err: unknown) => setActionError(errorMessage(err)));
    };
    if (rows.length === 0) {
      setActionError(t.exportData.nothing);
    } else if (!current) {
      send('all', null);
    } else {
      dialog(t.exportData.title, t.exportData.text, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.exportData.wholeVessel, onPress: () => send('all', null) },
        { text: current.name, onPress: () => send(current.id, current) },
      ]);
    }
  }

  function confirmDiscardTank() {
    const waiting = outbox.items.filter((item) => item.kind === 'entry' && item.tankId === id).length;
    dialog(
      t.tank.discardTankTitle(name),
      t.tank.discardTankText(waiting),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
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
  // Checked on the phone against the running ferment, so it also works offline.
  const alertResults = evaluateRules(rules.data ?? [], rows, ferments.data ?? []);

  function refreshAll() {
    tank.refresh();
    entries.refresh();
    outbox.uploadNow();
  }

  function renderTimelineState() {
    if (entries.loading) return <LoadingState label={t.tank.loadingTimeline} />;
    if (!entries.data) {
      return (
        <ErrorState
          message={entries.error ?? t.messages.loadTimelineFailed}
          onRetry={entries.refresh}
          retrying={entries.refreshing}
        />
      );
    }
    return (
      <View style={styles.empty}>
        <AppText muted>{t.tank.noEntries}</AppText>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <OfflineBanner message={t.tank.offline} />
      <SyncBanner />
      <CachedNote cachedAt={tank.cachedAt} error={tank.error} onRetry={refreshAll} />
      {upload?.status === 'failed' && tankItem ? (
        <View style={styles.uploadBox}>
          <Banner
            message={
              upload.action === 'delete'
                ? t.tank.couldntDeleteTank(upload.error ?? t.messages.somethingWrong)
                : t.tank.couldntUploadTank(upload.error ?? t.messages.somethingWrong)
            }
            onRetry={() => outbox.retry(tankItem.localId)}
          />
          {localOnly ? (
            <Button variant="danger" title={t.tank.deleteLocalTank} onPress={confirmDiscardTank} />
          ) : null}
        </View>
      ) : upload ? (
        <Banner tone="waiting" message={t.tank.tankWaiting} />
      ) : null}
      <FermentPanel
        ferments={ferments.data}
        onStart={() => router.push({ pathname: '/tanks/[id]/ferment-form', params: { id } })}
        onEnd={confirmEndFerment}
        onList={() => router.push({ pathname: '/tanks/[id]/ferments', params: { id } })}
        onChart={() => router.push({ pathname: '/tanks/[id]/curve', params: { id } })}
      />
      {activeFerment(ferments.data ?? []) ? <ReminderPanel tankId={id} /> : null}
      <Button
        variant="secondary"
        title={t.transfer.button}
        icon="swap-horizontal"
        onPress={() => router.push({ pathname: '/tanks/[id]/transfer', params: { id } })}
      />
      <AlertPanel
        rules={rules.data}
        results={alertResults}
        onRules={() => router.push({ pathname: '/tanks/[id]/alerts', params: { id } })}
        onDecision={() => router.push({ pathname: '/entries/new', params: { tankId: id, decision: '1' } })}
      />
      <LatestValues
        values={latest}
        onSelect={(valueName) => router.push({ pathname: '/tanks/[id]/history', params: { id, name: valueName } })}
      />
      <Button
        variant="secondary"
        title={t.lineage.button}
        icon="source-branch"
        onPress={() => router.push({ pathname: '/tanks/[id]/lineage', params: { id } })}
      />
      <Button
        variant="secondary"
        title={t.so2.button}
        icon="calculator-variant-outline"
        onPress={() => router.push({ pathname: '/tanks/[id]/so2', params: { id } })}
      />
      <Button variant="secondary" title={t.exportData.pdfButton} icon="file-pdf-box" onPress={() => exportData('pdf')} />
      <Button variant="secondary" title={t.exportData.button} icon="file-delimited-outline" onPress={() => exportData('csv')} />
      <View style={styles.timelineHeading}>
        <AppText variant="heading" style={{ color: colors.heading }}>
          {t.tank.timeline}
        </AppText>
        {rows.length > 0 ? (
          <AppText muted variant="caption">
            {t.tank.tapToEdit}
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
          subtitle={[describeWine({ variety, vintage, blend }) ?? t.tank.noWine, formatFill(contentLiters, volumeLiters)].join(' · ')}
        />
      }
      footer={
        <Button
          title={t.tank.addEntry}
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
              title={t.common.edit}
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
