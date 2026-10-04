import { Pressable, StyleSheet, View } from 'react-native';

import { formatLiters, formatWine } from '@/lib/format';
import type { Tank } from '@/lib/tanks';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  tank: Tank;
  onPress: () => void;
};

export function TankCard({ tank, onPress }: Props) {
  const { colors } = useTheme();
  const wine = formatWine(tank.variety, tank.vintage);
  const volume = formatLiters(tank.volumeLiters);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[tank.name, wine, volume].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {tank.name}
        </AppText>
        <AppText muted numberOfLines={1}>
          {wine ?? 'No wine set'}
        </AppText>
      </View>
      <AppText variant="label">{volume}</AppText>
      <AppText variant="title" muted>
        ›
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  text: { flex: 1, gap: 2 },
});
