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
import { useLastActivity } from '@/hooks/useLastActivity';
import { useOutbox } from '@/hooks/useOutbox';
import { useUser } from '@/hooks/useSession';
import { useTanks } from '@/hooks/useTanks';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { spacing, useTheme } from '@/theme';

export default function TanksScreen() {
  const user = useUser();
  const outbox = useOutbox();
  const tanks = useTanks();
  const { colors } = useTheme();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const last = useLastActivity((tanks.data ?? []).map((tank) => tank.id));

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
        ? `${waiting === 1 ? '1 entry is' : `${waiting} entries are`} saved on this phone but not uploaded yet. ` +
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
    return (
      <FlatList
        data={tanks.data}
        keyExtractor={(tank) => tank.id}
        renderItem={({ item }) => (
          <TankCard
            tank={item}
            last={last.get(item.id)}
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
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="title">No tanks yet</AppText>
            <AppText muted style={styles.emptyText}>
              Add your first tank to start logging additions, temperatures and tastings.
            </AppText>
          </View>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { textAlign: 'center' },
});
