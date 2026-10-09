import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { useDialog } from '@/hooks/useDialog';
import { useT } from '@/hooks/useLanguage';
import { useIsOffline } from '@/hooks/useNetworkStatus';
import { useOutbox } from '@/hooks/useOutbox';
import { useUser } from '@/hooks/useSession';
import { deleteAccount, signOut } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { PRIVACY_URL } from '@/lib/links';
import { radius, spacing, useTheme } from '@/theme';

/** Who is signed in, sign out, the privacy policy, and deleting the account (Google Play requires it). */
export default function AccountScreen() {
  const user = useUser();
  const outbox = useOutbox();
  const offline = useIsOffline();
  const dialog = useDialog();
  const t = useT();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function confirmSignOut() {
    const waiting = outbox.items.length;
    const lines = [
      user.email ? t.home.signedInAs(user.email) : null,
      waiting > 0 ? t.home.signOutWaiting(waiting) : null,
    ].filter((line): line is string => line !== null);
    dialog(t.home.signOutTitle, lines.join('\n\n') || undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.account.signOut,
        style: 'destructive',
        onPress: () => {
          setError(null);
          signOut().catch((err: unknown) => setError(errorMessage(err)));
        },
      },
    ]);
  }

  async function deleteNow() {
    setError(null);
    setDeleting(true);
    try {
      // On success the session ends and the app returns to sign-in by itself.
      await deleteAccount(user.id);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  // Asked twice, like deleting a tank: this can't be undone.
  function confirmDelete() {
    dialog(t.account.confirmTitle, t.account.confirmText(user.email ?? ''), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.account.confirmContinue,
        style: 'destructive',
        onPress: () =>
          dialog(t.account.sureTitle, t.account.sureText, [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.account.deleteForever, style: 'destructive', onPress: () => void deleteNow() },
          ]),
      },
    ]);
  }

  return (
    <Screen>
      {user.email ? (
        <AppText variant="title" style={{ color: colors.heading }}>
          {t.account.signedInAs(user.email)}
        </AppText>
      ) : null}
      {error ? <Banner message={error} /> : null}

      <Button variant="secondary" title={t.account.signOut} icon="logout" onPress={confirmSignOut} disabled={deleting} />
      <Button
        variant="secondary"
        title={t.account.privacy}
        icon="shield-lock-outline"
        onPress={() => void Linking.openURL(PRIVACY_URL)}
      />

      <View style={[styles.danger, { borderColor: colors.danger }]}>
        <AppText variant="label" style={{ color: colors.danger }}>
          {t.account.deleteTitle}
        </AppText>
        <AppText muted variant="caption">
          {t.account.deleteText}
        </AppText>
        <OfflineBanner message={t.account.offline} />
        <Button
          variant="danger"
          title={t.account.deleteButton}
          onPress={confirmDelete}
          loading={deleting}
          disabled={offline}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: {
    marginTop: spacing.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radius.md,
  },
});
