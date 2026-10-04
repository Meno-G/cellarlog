import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankCard } from '@/components/TankCard';
import { useSession } from '@/hooks/useSession';
import { useTanks } from '@/hooks/useTanks';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { spacing, useTheme } from '@/theme';

export default function TanksScreen() {
  const session = useSession();
  const tanks = useTanks();
  const { colors } = useTheme();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const email = session.status === 'signedIn' ? session.session.user.email : undefined;

  function confirmSignOut() {
    Alert.alert('Sign out?', email ? `You are signed in as ${email}.` : undefined, [
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
            {tanks.error ? <Banner message={tanks.error} onRetry={tanks.refresh} /> : null}
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
      footer={<Button title="+ New tank" onPress={() => router.push('/tanks/new')} />}
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
  list: { gap: spacing.sm, paddingBottom: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { textAlign: 'center' },
});
