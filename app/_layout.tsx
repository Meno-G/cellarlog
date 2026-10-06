// Persistent localStorage on the phone (login, offline cache, outbox). Must load first.
import 'expo-sqlite/localStorage/install';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Screen } from '@/components/Screen';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { getConfigProblems } from '@/lib/env';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { dark, colors } = useTheme();

  const navTheme = useMemo<NavTheme>(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [dark, colors]);

  const configProblems = getConfigProblems();

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {configProblems ? (
        <ConfigErrorScreen problems={configProblems} />
      ) : (
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      )}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const session = useSession();
  const { colors } = useTheme();

  if (session.status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <Screen edges={['top', 'bottom']}>
        <Banner message={session.message} />
      </Screen>
    );
  }

  const signedIn = session.status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConfigErrorScreen({ problems }: { problems: string[] }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <AppText variant="title">Setup needed</AppText>
      <AppText>
        The app&apos;s .env file is missing or incomplete. Copy .env.example to .env, fill it in,
        then restart with: npx expo start --clear
      </AppText>
      {problems.map((problem) => (
        <Banner key={problem} message={problem} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
