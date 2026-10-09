// Persistent localStorage on the phone (login, offline cache, outbox). Must load first.
import 'expo-sqlite/localStorage/install';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavTheme } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Screen } from '@/components/Screen';
import { useT } from '@/hooks/useLanguage';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { getConfigProblems } from '@/lib/env';
import { loadLang } from '@/lib/i18n';
import { fontAssets, useTheme } from '@/theme';

// The saved choice, or the phone's language on first start (Georgian phones start in Georgian).
loadLang(Intl.DateTimeFormat().resolvedOptions().locale);

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
  // Fonts ship inside the app; if they ever fail to load, carry on with system fonts.
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  if (!fontsLoaded && !fontError) {
    return <View style={[styles.center, { backgroundColor: colors.header }]} />;
  }

  return (
    <ThemeProvider value={navTheme}>
      {/* Light icons on the burgundy header band. */}
      <StatusBar style="light" />
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
  const t = useT();
  return (
    <Screen edges={['top', 'bottom']}>
      <AppText variant="title">{t.setup.title}</AppText>
      <AppText>{t.setup.text}</AppText>
      {problems.map((problem) => (
        <Banner key={problem} message={problem} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
