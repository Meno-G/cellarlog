import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function SignInScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <AppText variant="heading">CellarLog</AppText>
      <AppText muted>Email sign-in comes in step 2.</AppText>
    </Screen>
  );
}
