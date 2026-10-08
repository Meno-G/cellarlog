import { Pressable, StyleSheet, View } from 'react-native';

import type { TankSummary } from '@/hooks/useTankSummaries';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { formatItemValue, formatLiters, formatRelative, formatWine } from '@/lib/format';
import { cardReadings } from '@/lib/latestValues';
import type { ShownTank } from '@/lib/tankOverlay';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  tank: ShownTank;
  summary?: TankSummary;
  onPress: () => void;
};

export function TankCard({ tank, summary, onPress }: Props) {
  const last = summary?.last;
  // A few latest readings, so the cellar can be checked without opening each tank.
  const readings = cardReadings(summary?.latest ?? []);
  const { colors } = useTheme();
  const wine = formatWine(tank.variety, tank.vintage);
  const volume = formatLiters(tank.volumeLiters);
  const failed = tank.upload?.status === 'failed';
  const lastText = last
    ? `Last: ${ENTRY_TYPE_LABELS[last.type].toLowerCase()} · ${formatRelative(last.createdAt)}`
    : 'No entries yet';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        tank.name,
        wine,
        volume,
        ...readings.map(({ item }) => `${item.name} ${formatItemValue(item)}`),
        lastText,
        tank.upload ? 'not uploaded yet' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: failed ? colors.danger : tank.upload ? colors.warningBorder : colors.border,
          borderStyle: tank.upload ? 'dashed' : 'solid',
          borderWidth: tank.upload ? 1.5 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Wine-coloured edge; gold while the tank waits to upload. */}
      <View style={[styles.edge, { backgroundColor: tank.upload ? colors.accent : colors.primary }]} />
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant="title" numberOfLines={1} style={styles.name}>
            {tank.name}
          </AppText>
          <AppText style={{ fontFamily: fonts.bodySemi, fontSize: 16, color: colors.primary }}>{volume}</AppText>
        </View>
        <AppText muted numberOfLines={1} style={styles.wine}>
          {wine ?? 'No wine set'}
        </AppText>
        {readings.length > 0 ? (
          <View style={styles.readings}>
            {readings.map(({ item }) => (
              <View key={item.name} style={[styles.reading, { backgroundColor: colors.background }]}>
                <AppText muted style={styles.readingName} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText style={styles.readingValue} numberOfLines={1}>
                  {formatItemValue(item)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {tank.upload ? (
          <AppText
            style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: failed ? colors.danger : colors.warningText }}
          >
            {failed
              ? `${tank.upload.action === 'delete' ? "Couldn't delete" : "Couldn't upload"}: ${tank.upload.error ?? 'unknown error'}`
              : 'Saved on this phone · waiting to upload'}
          </AppText>
        ) : (
          <AppText muted variant="caption">
            {lastText}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  edge: { width: 8, borderRadius: 4, alignSelf: 'stretch' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  name: { flexShrink: 1 },
  wine: { fontSize: 17 },
  readings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginVertical: spacing.xs },
  reading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 2,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  readingName: { fontSize: 14, lineHeight: 19 },
  readingValue: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
});
