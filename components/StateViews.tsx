import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.center} accessibilityLabel={label ?? t.common.loading}>
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
  const t = useT();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <AppText style={[styles.text, { color: colors.danger }]}>{message}</AppText>
      {onRetry ? (
        <Button title={t.common.tryAgain} variant="secondary" onPress={onRetry} loading={retrying} />
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
