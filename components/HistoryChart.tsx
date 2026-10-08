import { StyleSheet, View } from 'react-native';

import { formatEntryTime, formatItemValue } from '@/lib/format';
import type { HistoryPoint } from '@/lib/latestValues';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  name: string;
  /** Oldest first. */
  points: readonly HistoryPoint[];
};

/** The most recent readings drawn; older ones are still in the list below the chart. */
const MAX_BARS = 24;
const HEIGHT = 150;

/**
 * Bars for the latest readings, oldest on the left. Heights run from the lowest
 * to the highest reading shown (not from zero), so small changes stay visible.
 */
export function HistoryChart({ name, points }: Props) {
  const { colors } = useTheme();
  const shown = points.slice(-MAX_BARS);
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (!first || !last || shown.length < 2) return null;

  const values = shown.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low;
  const unit = last.unit;
  const label = (value: number) => formatItemValue({ name, value, unit });

  return (
    <View
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        `Chart of the last ${shown.length} ${name} readings, from ${formatEntryTime(first.createdAt)} ` +
        `to ${formatEntryTime(last.createdAt)}. Lowest ${label(low)}, highest ${label(high)}, latest ${label(last.value)}.`
      }
    >
      <View style={styles.bars}>
        {shown.map((point, index) => {
          // At least a sliver for the lowest reading; all equal: a flat line at mid-height.
          const share = range === 0 ? 0.5 : 0.08 + (0.92 * (point.value - low)) / range;
          const latest = index === shown.length - 1;
          return (
            <View
              key={`${point.createdAt}-${index}`}
              style={[
                styles.bar,
                {
                  height: Math.max(4, share * HEIGHT),
                  backgroundColor: colors.primary,
                  opacity: latest ? 1 : 0.45,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.dates}>
        <AppText muted style={styles.scaleText}>
          {formatEntryTime(first.createdAt)}
        </AppText>
        <AppText muted style={styles.scaleText}>
          {formatEntryTime(last.createdAt)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  scaleText: { fontSize: 13, lineHeight: 17, fontFamily: fonts.bodySemi },
  bars: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
});
