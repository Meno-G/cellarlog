import { Stack } from 'expo-router';

import { useLanguage } from '@/hooks/useLanguage';
import { OutboxProvider } from '@/hooks/useOutbox';
import { useSession } from '@/hooks/useSession';
import { BrandMark } from '@/components/BrandMark';
import { fonts, georgianFamily, useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();
  const { lang, t } = useLanguage();
  const session = useSession();

  // Signing out swaps to (auth); render nothing in between so no screen
  // in here runs without a user.
  if (session.status !== 'signedIn') return null;

  return (
    // Keyed by user: a different account on the same phone gets its own outbox.
    <OutboxProvider key={session.user.id} userId={session.user.id}>
      <Stack
        screenOptions={{
          // The cellar-burgundy band at the top of every screen.
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.onHeader,
          headerShadowVisible: false,
          headerTitleStyle:
            lang === 'ka'
              ? { color: colors.onHeader, fontFamily: georgianFamily(fonts.display), fontSize: 21 }
              : { color: colors.onHeader, fontFamily: fonts.display, fontSize: 26 },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: t.titles.tanks, headerTitle: () => <BrandMark size={26} /> }} />
        <Stack.Screen name="tanks/new" options={{ title: t.titles.newTank, presentation: 'modal' }} />
        <Stack.Screen name="tanks/[id]/index" options={{ title: t.titles.tank }} />
        <Stack.Screen name="tanks/[id]/history" options={{ title: '' }} />
        <Stack.Screen name="tanks/[id]/so2" options={{ title: t.so2.title }} />
        <Stack.Screen name="tanks/[id]/lineage" options={{ title: t.lineage.title }} />
        <Stack.Screen name="tanks/[id]/ferments" options={{ title: t.ferment.listTitle }} />
        <Stack.Screen name="tanks/[id]/ferment-form" options={{ title: t.ferment.newTitle, presentation: 'modal' }} />
        <Stack.Screen name="tanks/[id]/alerts" options={{ title: t.alerts.rulesTitle }} />
        <Stack.Screen name="tanks/[id]/transfer" options={{ title: t.transfer.title }} />
        <Stack.Screen name="tanks/[id]/curve" options={{ title: t.ferment.chartTitle }} />
        <Stack.Screen name="tanks/[id]/edit" options={{ title: t.titles.editTank, presentation: 'modal' }} />
        <Stack.Screen name="account" options={{ title: t.titles.account }} />
        <Stack.Screen name="voice-test" options={{ title: t.voiceTest.title }} />
        <Stack.Screen name="entries/new" options={{ title: t.titles.addEntry }} />
        <Stack.Screen name="entries/[id]/edit" options={{ title: t.titles.editEntry }} />
      </Stack>
    </OutboxProvider>
  );
}
