import { Pressable, StyleSheet, View } from 'react-native';

import { formatLiters, formatWine } from '@/lib/format';
import type { ShownTank } from '@/lib/tankOverlay';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  tank: ShownTank;
  onPress: () => void;
};

export function TankCard({ tank, onPress }: Props) {
  const { colors } = useTheme();
  const wine = formatWine(tank.variety, tank.vintage);
  const volume = formatLiters(tank.volumeLiters);
  const failed = tank.upload?.status === 'failed';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[tank.name, wine, volume, tank.upload ? 'not uploaded yet' : null]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: failed ? colors.danger : tank.upload ? colors.warningText : colors.border,
          borderStyle: tank.upload ? 'dashed' : 'solid',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.row}>
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
      </View>
      {tank.upload ? (
        <AppText variant="label" style={{ color: failed ? colors.danger : colors.warningText }}>
          {failed
            ? `${tank.upload.action === 'delete' ? "Couldn't delete" : "Couldn't upload"}: ${tank.upload.error ?? 'unknown error'}`
            : 'Saved on this phone · waiting to upload'}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 80,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
