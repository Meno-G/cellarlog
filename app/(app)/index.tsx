import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { CachedNote } from '@/components/CachedNote';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { SyncBanner } from '@/components/SyncBanner';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankCard } from '@/components/TankCard';
import { TextField } from '@/components/TextField';
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
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const summaries = useTankSummaries((tanks.data ?? []).map((tank) => tank.id));

  const tankCount = tanks.data?.length ?? 0;
  const waiting = outbox.pendingCount + outbox.failedCount;
  const summary = [
    tanks.data ? (tankCount === 1 ? '1 tank' : `${tankCount} tanks`) : null,
    waiting > 0 ? (waiting === 1 ? '1 change waiting to upload' : `${waiting} changes waiting to upload`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function confirmSignOut() {
    const waiting = outbox.items.length;
    const lines = [
      user.email ? `You are signed in as ${user.email}.` : null,
      waiting > 0
        ? `${waiting === 1 ? '1 change is' : `${waiting} changes are`} saved on this phone but not uploaded yet. ` +
          'They stay on this phone and upload the next time you sign in with this account.'
        : null,
    ].filter((line): line is string => line !== null);
    Alert.alert('Sign out?', lines.join('\n\n') || undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSignOutError(null);
          signOut().catch((err: unknown) => setSignOutError(errorMessage(err)));
        },
      },
    ]);
  }

  function renderBody() {
    if (tanks.loading) return <LoadingState label="Loading tanks…" />;
    if (!tanks.data) {
      return (
        <ErrorState
          message={tanks.error ?? 'Could not load your tanks.'}
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
                Your cellar
              </AppText>
            ) : null}
            {searching ? (
              <TextField
                label="Find a tank"
                value={query}
                onChangeText={setQuery}
                placeholder="Name, grape or vintage"
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
              <AppText variant="title">No matching tanks</AppText>
              <AppText muted style={styles.emptyText}>
                Nothing matches “{query.trim()}”. Try part of the name, the grape or the vintage.
              </AppText>
              <Button variant="secondary" title="Show all tanks" onPress={() => setQuery('')} />
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="title">No tanks yet</AppText>
              <AppText muted style={styles.emptyText}>
                Add your first tank to start logging additions, temperatures and tastings.
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
      footer={<Button title="New tank" icon="plus" onPress={() => router.push('/tanks/new')} />}
    >
      <Stack.Screen
        options={{ headerRight: () => <HeaderButton title="Sign out" onPress={confirmSignOut} /> }}
      />
      {signOutError ? <Banner message={signOutError} /> : null}
      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm },
  heading: { marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { textAlign: 'center' },
});
