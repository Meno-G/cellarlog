import { useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function NewEntryScreen() {
  const { tankId } = useLocalSearchParams<{ tankId?: string }>();

  return (
    <Screen>
      <AppText variant="title">New entry</AppText>
      <AppText muted>
        {tankId ? `For tank ${tankId}. ` : ''}Text entry comes in step 4, voice in step 5.
      </AppText>
    </Screen>
  );
}
