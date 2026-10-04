import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { HeaderButton } from '@/components/HeaderButton';
import { Screen } from '@/components/Screen';
import { useSession } from '@/hooks/useSession';
import { signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

export default function TanksScreen() {
  const session = useSession();
  const [error, setError] = useState<string | null>(null);

  const email = session.status === 'signedIn' ? session.session.user.email : undefined;

  function confirmSignOut() {
    Alert.alert('Sign out?', email ? `You are signed in as ${email}.` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setError(null);
          signOut().catch((err: unknown) => setError(errorMessage(err)));
        },
      },
    ]);
  }

  return (
    <Screen footer={<Button title="+ New tank" onPress={() => router.push('/tanks/new')} />}>
      <Stack.Screen
        options={{ headerRight: () => <HeaderButton title="Sign out" onPress={confirmSignOut} /> }}
      />
      {error ? <Banner message={error} /> : null}
      <AppText variant="title">No tanks yet</AppText>
      <AppText muted>Your tanks will be listed here (step 3).</AppText>
      <Button
        variant="secondary"
        title="Open sample tank"
        onPress={() => router.push({ pathname: '/tanks/[id]', params: { id: 'sample' } })}
      />
    </Screen>
  );
}
