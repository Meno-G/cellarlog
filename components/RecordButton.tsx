import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { fonts, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

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

const SIZE = touch.recordButton;
const HALO = SIZE + 76;

/** One big tap-to-start / tap-to-stop button. Tapping twice is easier with gloves than holding. */
export function RecordButton({ listening, busy, elapsedMs, maxMs, disabled = false, onPress }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || (busy && !listening);
  // Created once; it drives the halo on the native side.
  const [pulse] = useState(() => new Animated.Value(0));

  // A slow breathing halo while listening (skipped when the phone asks for reduced motion).
  useEffect(() => {
    if (!listening) {
      pulse.setValue(0);
      return;
    }
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [listening, pulse]);

  const label = listening
    ? `Listening… tap to stop · ${formatClock(elapsedMs)} / ${formatClock(maxMs)}`
    : busy
      ? 'Please wait…'
      : 'Tap and speak';

  return (
    <View style={styles.wrapper}>
      <View style={styles.stage}>
        {listening ? (
          <Animated.View
            style={[
              styles.halo,
              {
                backgroundColor: colors.primary,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.22] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }],
              },
            ]}
          />
        ) : null}
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
              backgroundColor: colors.primary,
              borderColor: colors.accent,
              opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy && !listening ? (
            <ActivityIndicator size="large" color={colors.onPrimary} />
          ) : listening ? (
            <View style={[styles.stop, { backgroundColor: colors.onPrimary }]} />
          ) : (
            <Icon name="microphone" size={64} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>
      <AppText
        accessibilityLiveRegion="polite"
        style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.primary, textAlign: 'center' }}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  stage: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: HALO, height: HALO, borderRadius: HALO / 2 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#4A1322',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  stop: { width: 46, height: 46, borderRadius: 10 },
});
