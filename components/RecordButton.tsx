import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  recording: boolean;
  /** Starting/stopping the recorder, or sending the recording. */
  busy: boolean;
  durationMs: number;
  maxMs: number;
  disabled?: boolean;
  onPress: () => void;
};

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One big tap-to-start / tap-to-stop button. Tapping twice is easier with gloves than holding. */
export function RecordButton({ recording, busy, durationMs, maxMs, disabled = false, onPress }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || (busy && !recording);

  const label = recording
    ? `Tap to stop · ${formatClock(durationMs)} / ${formatClock(maxMs)}`
    : busy
      ? 'Please wait…'
      : 'Tap to record';

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        accessibilityState={{ disabled: inactive, busy }}
        hitSlop={16}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: recording ? colors.danger : colors.surface,
            borderColor: recording ? colors.danger : colors.primary,
            opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {busy && !recording ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : recording ? (
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
