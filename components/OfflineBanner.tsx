import { StyleSheet, View } from 'react-native';

import { useIsOffline } from '@/hooks/useNetworkStatus';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = { message?: string };

/** Renders nothing while online. */
export function OfflineBanner({
  message = "You're offline. Loading and saving need internet.",
}: Props) {
  const offline = useIsOffline();
  const { colors } = useTheme();
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.warningBg, borderColor: colors.warningText }]}
    >
      <AppText variant="label" style={{ color: colors.warningText }}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
