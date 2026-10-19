import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CachedNote } from '@/components/CachedNote';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { SyncBanner } from '@/components/SyncBanner';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankCard } from '@/components/TankCard';
import { TextField } from '@/components/TextField';
import { useDialog } from '@/hooks/useDialog';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTankSummaries } from '@/hooks/useTankSummaries';
import { useTanks } from '@/hooks/useTanks';
import { errorMessage } from '@/lib/errors';
import { searchTanks } from '@/lib/tankOverlay';
import { spacing, useTheme } from '@/theme';

/** The search box appears once the list is long enough to need it. */
const SEARCH_FROM = 6;

export default function TanksScreen() {
  const outbox = useOutbox();
  const tanks = useTanks();
  const { colors } = useTheme();
  const t = useT();
  const dialog = useDialog();
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const summaries = useTankSummaries((tanks.data ?? []).map((tank) => tank.id));

  const tankCount = tanks.data?.length ?? 0;
  const waiting = outbox.pendingCount + outbox.failedCount;
  const summary = [
    tanks.data ? t.home.tankCount(tankCount) : null,
    waiting > 0 ? t.home.waitingToUpload(waiting) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function leaveSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));
  }

  async function removeTanks(ids: string[]) {
    setDeleting(true);
    // Online each is deleted now; offline it disappears at once and the deletion uploads later.
    const results = await Promise.allSettled(ids.map((id) => outbox.deleteTank(id)));
    const problems = results.flatMap((result) => (result.status === 'rejected' ? [errorMessage(result.reason)] : []));
    setDeleting(false);
    leaveSelecting();
    tanks.refresh();
    if (problems.length > 0) {
      dialog(t.home.deleteFailedTitle, t.home.deleteFailed(problems.length, ids.length, [...new Set(problems)].join(' ')), [
        { text: 'OK' },
      ]);
    }
  }

  /** Asked twice, like deleting one tank: it also deletes everything recorded in them. */
  function confirmDelete(ids: string[]) {
    if (ids.length === 0) return;
    const names = (tanks.data ?? []).filter((tank) => ids.includes(tank.id)).map((tank) => tank.name);
    const listed = names.slice(0, 5).join(', ') + (names.length > 5 ? ` ${t.home.andMore(names.length - 5)}` : '');
    dialog(t.home.deleteTitle(ids.length), t.home.deleteText(listed), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.home.deleteContinue,
        style: 'destructive',
        onPress: () =>
          dialog(t.home.sureTitle, t.home.sureText(ids.length), [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.home.deleteForever, style: 'destructive', onPress: () => void removeTanks(ids) },
          ]),
      },
    ]);
  }

  function renderBody() {
    if (tanks.loading) return <LoadingState label={t.home.loadingTanks} />;
    if (!tanks.data) {
      return (
        <ErrorState
          message={tanks.error ?? t.messages.loadTanksFailed}
          onRetry={tanks.refresh}
          retrying={tanks.refreshing}
        />
      );
    }
    const searching = tankCount >= SEARCH_FROM;
    const shown = searching ? searchTanks(tanks.data, query) : tanks.data;
    return (
      <FlatList
        data={shown}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(tank) => tank.id}
        extraData={selected}
        renderItem={({ item }) => (
          <TankCard
            tank={item}
            summary={summaries.get(item.id)}
            selecting={selecting}
            selected={selected.includes(item.id)}
            onPress={() => (selecting ? toggle(item.id) : router.push({ pathname: '/tanks/[id]', params: { id: item.id } }))}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={tanks.refreshing}
            onRefresh={tanks.refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <OfflineBanner />
            <SyncBanner />
            <CachedNote cachedAt={tanks.cachedAt} error={tanks.error} onRetry={tanks.refresh} />
            {tankCount > 0 ? (
              <View style={styles.toolbar}>
                {selecting ? (
                  <>
                    <Button
                      variant="secondary"
                      title={t.home.selectAll}
                      icon="checkbox-multiple-marked-outline"
                      onPress={() => setSelected(shown.map((tank) => tank.id))}
                      disabled={deleting}
                      style={styles.toolbarButton}
                    />
                    <Button
                      variant="secondary"
                      title={t.home.cancelSelect}
                      onPress={leaveSelecting}
                      disabled={deleting}
                      style={styles.toolbarButton}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      title={t.home.select}
                      icon="checkbox-multiple-marked-outline"
                      onPress={() => setSelecting(true)}
                      style={styles.toolbarButton}
                    />
                    <Button
                      variant="danger"
                      title={t.home.deleteAll}
                      icon="delete-outline"
                      onPress={() => confirmDelete((tanks.data ?? []).map((tank) => tank.id))}
                      style={styles.toolbarButton}
                    />
                  </>
                )}
              </View>
            ) : null}
            {selecting ? (
              <AppText muted variant="caption">
                {selected.length > 0 ? t.home.selectedCount(selected.length) : t.home.selectHint}
              </AppText>
            ) : null}
            {tankCount > 0 ? (
              <AppText variant="heading" style={[styles.heading, { color: colors.heading }]}>
                {t.home.yourCellar}
              </AppText>
            ) : null}
            {searching ? (
              <TextField
                label={t.home.findTank}
                value={query}
                onChangeText={setQuery}
                placeholder={t.home.findPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          tankCount > 0 ? (
            <View style={styles.empty}>
              <AppText variant="title">{t.home.noMatchTitle}</AppText>
              <AppText muted style={styles.emptyText}>
                {t.home.noMatchText(query.trim())}
              </AppText>
              <Button variant="secondary" title={t.home.showAll} onPress={() => setQuery('')} />
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="title">{t.home.noTanksTitle}</AppText>
              <AppText muted style={styles.emptyText}>
                {t.home.noTanksText}
              </AppText>
            </View>
          )
        }
      />
    );
  }

  return (
    <Screen
      scroll={false}
      hero={summary ? <HeroBand subtitle={summary} /> : null}
      footer={
        selecting ? (
          <Button
            variant="danger"
            title={t.home.deleteSelected(selected.length)}
            icon="delete-outline"
            disabled={selected.length === 0}
            loading={deleting}
            onPress={() => confirmDelete(selected)}
          />
        ) : (
          <Button title={t.home.newTank} icon="plus" onPress={() => router.push('/tanks/new')} />
        )
      }
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <LanguageSwitch />
              <HeaderButton title={t.account.button} onPress={() => router.push('/account')} />
            </View>
          ),
        }}
      />
      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm },
  toolbar: { flexDirection: 'row', gap: spacing.sm },
  toolbarButton: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { textAlign: 'center' },
});
