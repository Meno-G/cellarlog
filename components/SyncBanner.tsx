import { StyleSheet, View } from 'react-native';

import { useIsOffline } from '@/hooks/useNetworkStatus';
import { useOutbox } from '@/hooks/useOutbox';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

function entries(count: number): string {
  return count === 1 ? '1 entry' : `${count} entries`;
}

/** Shows entries saved on the phone that haven't reached the server yet. Nothing otherwise. */
export function SyncBanner() {
  const { pendingCount, failedCount, uploading, lastError, uploadNow } = useOutbox();
  const offline = useIsOffline();
  const { colors } = useTheme();

  if (pendingCount === 0 && failedCount === 0) return null;

  let message: string;
  if (uploading) message = `Uploading ${entries(pendingCount)}…`;
  else if (pendingCount > 0 && offline)
    message = `${entries(pendingCount)} saved on this phone. They upload when you're back online.`;
  else if (pendingCount > 0) message = lastError ?? `${entries(pendingCount)} waiting to upload.`;
  else message = '';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.warningBg, borderColor: colors.warningText }]}
    >
      {message ? (
        <AppText variant="label" style={{ color: colors.warningText }}>
          {message}
        </AppText>
      ) : null}
      {failedCount > 0 ? (
        <AppText variant="label" style={{ color: colors.danger }}>
          {entries(failedCount)} couldn&apos;t upload. Open the tank and tap the entry to retry or delete it.
        </AppText>
      ) : null}
      {pendingCount > 0 && !offline && !uploading ? (
        <Button variant="secondary" title="Upload now" onPress={uploadNow} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
