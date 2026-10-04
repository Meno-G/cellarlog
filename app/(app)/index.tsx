import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function TanksScreen() {
  return (
    <Screen footer={<Button title="+ New tank" onPress={() => router.push('/tanks/new')} />}>
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
