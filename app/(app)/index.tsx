import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
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
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useUser } from '@/hooks/useSession';
import { useTankSummaries } from '@/hooks/useTankSummaries';
import { useTanks } from '@/hooks/useTanks';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { searchTanks } from '@/lib/tankOverlay';
import { spacing, useTheme } from '@/theme';

/** The search box appears once the list is long enough to need it. */
const SEARCH_FROM = 6;

export default function TanksScreen() {
  const user = useUser();
  const outbox = useOutbox();
  const tanks = useTanks();
  const { colors } = useTheme();
  const t = useT();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const summaries = useTankSummaries((tanks.data ?? []).map((tank) => tank.id));

  const tankCount = tanks.data?.length ?? 0;
  const waiting = outbox.pendingCount + outbox.failedCount;
  const summary = [
    tanks.data ? t.home.tankCount(tankCount) : null,
    waiting > 0 ? t.home.waitingToUpload(waiting) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function confirmSignOut() {
    const waiting = outbox.items.length;
    const lines = [
      user.email ? t.home.signedInAs(user.email) : null,
      waiting > 0 ? t.home.signOutWaiting(waiting) : null,
    ].filter((line): line is string => line !== null);
    Alert.alert(t.home.signOutTitle, lines.join('\n\n') || undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.home.signOut,
        style: 'destructive',
        onPress: () => {
          setSignOutError(null);
          signOut().catch((err: unknown) => setSignOutError(errorMessage(err)));
        },
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
        renderItem={({ item }) => (
          <TankCard
            tank={item}
            summary={summaries.get(item.id)}
            onPress={() => router.push({ pathname: '/tanks/[id]', params: { id: item.id } })}
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
              <AppText variant="heading" style={[styles.heading, { color: colors.header }]}>
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
      footer={<Button title={t.home.newTank} icon="plus" onPress={() => router.push('/tanks/new')} />}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <LanguageSwitch />
              <HeaderButton title={t.home.signOut} onPress={confirmSignOut} />
            </View>
          ),
        }}
      />
      {signOutError ? <Banner message={signOutError} /> : null}
      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { textAlign: 'center' },
});
