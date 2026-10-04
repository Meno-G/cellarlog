import { router, Stack, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

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
          headerRight: () => (
            <HeaderButton
              title="Edit"
              onPress={() => router.push({ pathname: '/tanks/[id]/edit', params: { id } })}
            />
          ),
        }}
      />
      <AppText variant="title">Tank {id}</AppText>
      <AppText muted>The entry timeline comes in step 4.</AppText>
    </Screen>
  );
}
