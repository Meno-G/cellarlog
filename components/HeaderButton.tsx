import { Pressable } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  onPress: () => void;
};

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
        paddingHorizontal: spacing.sm,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText variant="label" style={{ color: colors.primary }}>
        {title}
      </AppText>
    </Pressable>
  );
}
