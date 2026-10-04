import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useTank } from '@/hooks/useTanks';
import { formatLiters, formatWine } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
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

  return (
    <Screen
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
      {tank.error ? <Banner message={tank.error} onRetry={tank.refresh} /> : null}

      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="heading">{name}</AppText>
        <AppText muted>{formatWine(variety, vintage) ?? 'No wine set'}</AppText>
        <AppText variant="label">{formatLiters(volumeLiters)}</AppText>
      </View>

      <AppText variant="title">Timeline</AppText>
      <AppText muted>Entries will appear here (step 4).</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 2,
  },
});
