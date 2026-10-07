import { Pressable } from 'react-native';

import { fonts, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  onPress: () => void;
};

/** A text button in the burgundy header band. */
export function HeaderButton({ title, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={12}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: spacing.md,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: colors.onHeaderMuted,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText style={{ color: colors.onHeader, fontFamily: fonts.bodySemi, fontSize: 17 }}>{title}</AppText>
    </Pressable>
  );
}
