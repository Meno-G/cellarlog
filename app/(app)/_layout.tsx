import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontSize: 20, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Tanks' }} />
      <Stack.Screen name="tanks/new" options={{ title: 'New tank', presentation: 'modal' }} />
      <Stack.Screen name="tanks/[id]/index" options={{ title: 'Tank' }} />
      <Stack.Screen name="tanks/[id]/edit" options={{ title: 'Edit tank', presentation: 'modal' }} />
      <Stack.Screen name="entries/new" options={{ title: 'Add entry' }} />
    </Stack>
  );
}
