import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  listening: boolean;
  /** Starting or finishing recognition. */
  busy: boolean;
  elapsedMs: number;
  maxMs: number;
  disabled?: boolean;
  onPress: () => void;
};

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One big tap-to-start / tap-to-stop button. Tapping twice is easier with gloves than holding. */
export function RecordButton({ listening, busy, elapsedMs, maxMs, disabled = false, onPress }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || (busy && !listening);

  const label = listening
    ? `Listening… tap to stop · ${formatClock(elapsedMs)} / ${formatClock(maxMs)}`
    : busy
      ? 'Please wait…'
      : 'Tap and speak';

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Start speaking'}
        accessibilityState={{ disabled: inactive, busy }}
        hitSlop={16}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: listening ? colors.danger : colors.surface,
            borderColor: listening ? colors.danger : colors.primary,
            opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {busy && !listening ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : listening ? (
          <View style={[styles.stop, { backgroundColor: colors.onDanger }]} />
        ) : (
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
        )}
      </Pressable>
      <AppText variant="label" accessibilityLiveRegion="polite">
        {label}
      </AppText>
    </View>
  );
}

const size = touch.recordButton;

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  button: {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 },
  stop: { width: size * 0.34, height: size * 0.34, borderRadius: 8 },
});
