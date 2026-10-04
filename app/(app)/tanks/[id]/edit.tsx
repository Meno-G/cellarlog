import { useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function EditTankScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <AppText muted>Editing tank {id}. The form comes in step 3.</AppText>
    </Screen>
  );
}
