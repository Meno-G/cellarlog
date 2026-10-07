import { StyleSheet, View } from 'react-native';

import { useIsOffline } from '@/hooks/useNetworkStatus';
import { useOutbox } from '@/hooks/useOutbox';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

function changes(count: number): string {
  return count === 1 ? '1 change' : `${count} changes`;
}

/** Shows changes (entries, tanks) saved on the phone that haven't reached the server yet. Nothing otherwise. */
export function SyncBanner() {
  const { pendingCount, failedCount, uploading, lastError, uploadNow } = useOutbox();
  const offline = useIsOffline();
  const { colors } = useTheme();

  if (pendingCount === 0 && failedCount === 0) return null;

  let message: string;
  if (uploading) message = `Uploading ${changes(pendingCount)}…`;
  else if (pendingCount > 0 && offline)
    message = `${changes(pendingCount)} saved on this phone. They upload when you're back online.`;
  else if (pendingCount > 0) message = lastError ?? `${changes(pendingCount)} waiting to upload.`;
  else message = '';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}
    >
      {message ? (
        <View style={styles.row}>
          <Icon name={uploading ? 'cloud-sync-outline' : 'cloud-upload-outline'} size={24} color={colors.warningText} />
          <AppText style={[styles.text, { color: colors.warningText }]}>{message}</AppText>
        </View>
      ) : null}
      {failedCount > 0 ? (
        <AppText style={[styles.text, { color: colors.danger }]}>
          {changes(failedCount)} couldn&apos;t upload. Tap the marked tank or entry to fix, retry or delete it.
        </AppText>
      ) : null}
      {pendingCount > 0 && !offline && !uploading ? (
        <Button variant="secondary" title="Upload now" onPress={uploadNow} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 17 },
  box: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
