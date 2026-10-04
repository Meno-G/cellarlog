import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <AppText muted>{label}</AppText> : null}
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <AppText style={[styles.text, { color: colors.danger }]}>{message}</AppText>
      {onRetry ? (
        <Button title="Try again" variant="secondary" onPress={onRetry} loading={retrying} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: { textAlign: 'center' },
});
