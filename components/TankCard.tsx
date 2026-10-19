import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import type { TankSummary } from '@/hooks/useTankSummaries';
import { describeWine } from '@/lib/blend';
import { formatFill, formatItemValue, formatRelative } from '@/lib/format';
import { itemName } from '@/lib/i18n';
import { cardReadings } from '@/lib/latestValues';
import type { ShownTank } from '@/lib/tankOverlay';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  tank: ShownTank;
  summary?: TankSummary;
  onPress: () => void;
  /** Selection mode: a checkbox is shown and a tap selects instead of opening. */
  selecting?: boolean;
  selected?: boolean;
};

export function TankCard({ tank, summary, onPress, selecting = false, selected = false }: Props) {
  const last = summary?.last;
  // A few latest readings, so the cellar can be checked without opening each tank.
  const readings = cardReadings(summary?.latest ?? []);
  const { colors } = useTheme();
  const t = useT();
  // "Qvevri · Saperavi · 2025": the type is only mentioned when it isn't a plain tank.
  const wine = [tank.kind === 'tank' ? null : t.vesselKinds[tank.kind], describeWine(tank)]
    .filter((part): part is string => part !== null)
    .join(' · ') || null;
  const volume = formatFill(tank.contentLiters, tank.volumeLiters);
  const failed = tank.upload?.status === 'failed';
  const lastText = last
    ? t.tankCard.last(t.entryTypes[last.type], formatRelative(last.createdAt))
    : t.tankCard.noEntries;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={[
        tank.name,
        wine,
        volume,
        ...readings.map(({ item }) => `${itemName(item.name)} ${formatItemValue(item)}`),
        lastText,
        tank.upload ? t.tankCard.notUploaded : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected
            ? colors.primary
            : failed
              ? colors.danger
              : tank.upload
                ? colors.warningBorder
                : colors.border,
          borderStyle: tank.upload && !selected ? 'dashed' : 'solid',
          borderWidth: selected ? 2.5 : tank.upload ? 1.5 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {selecting ? (
        <View style={styles.check}>
          <Icon name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={30} color={colors.primary} />
        </View>
      ) : null}
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
          {wine ?? t.tankCard.noWine}
        </AppText>
        {readings.length > 0 ? (
          <View style={styles.readings}>
            {readings.map(({ item }) => (
              <View key={item.name} style={[styles.reading, { backgroundColor: colors.background }]}>
                <AppText muted style={styles.readingName} numberOfLines={1}>
                  {itemName(item.name)}
                </AppText>
                <AppText style={styles.readingValue} numberOfLines={1}>
                  {formatItemValue(item)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {summary && summary.alerts > 0 ? (
          <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger }}>
            {'⚠ '}
            {t.alerts.badge(summary.alerts)}
          </AppText>
        ) : null}
        {summary?.ferment ? (
          <AppText style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.primary }}>
            {t.ferment.runningLine(summary.ferment.name, summary.ferment.day)}
          </AppText>
        ) : null}
        {tank.upload ? (
          <AppText
            style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: failed ? colors.danger : colors.warningText }}
          >
            {failed
              ? (tank.upload.action === 'delete' ? t.tankCard.couldntDelete : t.tankCard.couldntUpload)(
                  tank.upload.error ?? t.messages.somethingWrong,
                )
              : t.tankCard.savedWaiting}
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
  check: { justifyContent: 'center' },
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
