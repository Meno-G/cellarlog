import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  message: string;
  tone?: 'error' | 'info';
  onRetry?: () => void;
  retryLabel?: string;
};

export function Banner({ message, tone = 'error', onRetry, retryLabel = 'Try again' }: Props) {
  const { colors } = useTheme();
  const isError = tone === 'error';

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        {
          backgroundColor: isError ? colors.surface : colors.surfaceAlt,
          borderColor: isError ? colors.danger : colors.border,
        },
      ]}
    >
      <AppText style={isError ? { color: colors.danger } : undefined}>{message}</AppText>
      {onRetry ? <Button variant="secondary" title={retryLabel} onPress={onRetry} /> : null}
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
