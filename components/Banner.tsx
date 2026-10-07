import { StyleSheet, View } from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Tone = 'error' | 'info' | 'waiting';

type Props = {
  message: string;
  tone?: Tone;
  onRetry?: () => void;
  retryLabel?: string;
  /** Overrides the tone's icon. */
  icon?: IconName;
};

const ICONS: Record<Tone, IconName> = {
  error: 'alert-circle-outline',
  info: 'information-outline',
  waiting: 'cloud-upload-outline',
};

export function Banner({ message, tone = 'error', onRetry, retryLabel = 'Try again', icon }: Props) {
  const { colors } = useTheme();
  const palette = {
    error: { bg: colors.surface, border: colors.danger, text: colors.danger },
    info: { bg: colors.surfaceAlt, border: colors.border, text: colors.text },
    waiting: { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningText },
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <View style={styles.row}>
        <Icon name={icon ?? ICONS[tone]} size={24} color={palette.text} />
        <AppText style={[styles.text, { color: palette.text, fontFamily: fonts.bodySemi }]}>{message}</AppText>
      </View>
      {onRetry ? <Button variant="secondary" title={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, fontSize: 17 },
});
