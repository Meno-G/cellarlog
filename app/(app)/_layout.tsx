import { Stack } from 'expo-router';

import { OutboxProvider } from '@/hooks/useOutbox';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();
  const session = useSession();

  // Signing out swaps to (auth); render nothing in between so no screen
  // in here runs without a user.
  if (session.status !== 'signedIn') return null;

  return (
    // Keyed by user: a different account on the same phone gets its own outbox.
    <OutboxProvider key={session.user.id} userId={session.user.id}>
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
        <Stack.Screen name="entries/[id]/edit" options={{ title: 'Edit entry' }} />
      </Stack>
    </OutboxProvider>
  );
}
