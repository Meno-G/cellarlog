import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { signIn, signUp } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { fonts, spacing, useTheme } from '@/theme';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const isSignUp = mode === 'signUp';

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { needsEmailConfirmation } = await signUp(email, password);
        if (needsEmailConfirmation) {
          setInfo('Account created. Open the confirmation link we emailed you, then sign in.');
          setMode('signIn');
          setPassword('');
        }
      } else {
        await signIn(email, password);
      }
      // On success the session gate in app/_layout.tsx switches to the tanks screen.
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode(isSignUp ? 'signIn' : 'signUp');
    setError(null);
    setInfo(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        hero={
          <View style={[styles.hero, { backgroundColor: colors.header, paddingTop: insets.top + spacing.xl }]}>
            <BrandMark size={42} />
            <AppText style={[styles.tagline, { color: colors.onHeaderMuted }]}>CELLAR NOTES, SPOKEN</AppText>
          </View>
        }
      >
        <AppText variant="heading" style={[styles.heading, { color: colors.header }]}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </AppText>

        {info ? <Banner tone="info" message={info} /> : null}
        {error ? <Banner message={error} /> : null}

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@winery.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={isSignUp ? 'At least 6 characters' : undefined}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!submitting}
        />

        <Button
          title={isSignUp ? 'Create account' : 'Sign in'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={email.trim() === '' || password === ''}
        />
        <Button
          variant="secondary"
          title={isSignUp ? 'I already have an account' : 'Create an account'}
          onPress={toggleMode}
          disabled={submitting}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { marginTop: spacing.sm },
  hero: { alignItems: 'center', paddingBottom: spacing.xl, gap: spacing.sm },
  tagline: { fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 2 },
});
