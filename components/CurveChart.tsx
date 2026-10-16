import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import type { Curves, CurveSeries } from '@/lib/fermentCurves';
import type { Ferment } from '@/lib/ferments';
import { formatItemValue } from '@/lib/format';
import { itemName } from '@/lib/i18n';
import { fonts, radius, spacing, useTheme, type Theme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  /** The stored value name, e.g. "Density". */
  name: string;
  curves: Curves<Ferment>;
};

const HEIGHT = 230;
const Y_LABEL_WIDTH = 58;
const PAD = 12;

/** Colours for the series: this ferment in wine, earlier ones in other tokens. */
export function seriesColor(colors: Theme['colors'], series: CurveSeries<Ferment>, index: number): string {
  if (series.current) return colors.primary;
  const earlier = [colors.accent, colors.textMuted, colors.warningBorder, colors.danger];
  return earlier[(index - 1) % earlier.length] ?? colors.textMuted;
}

type Pt = { x: number; y: number };

/** A straight line between two points, drawn as a thin rotated View (no chart library). */
function Segment({ from, to, color, thickness }: { from: Pt; to: Pt; color: string; thickness: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

/**
 * Value against days since the ferment started, one line per ferment: the
 * current one bold, earlier ones thinner. Plain Views, so it works on the phone
 * and in the browser without a native module.
 */
export function CurveChart({ name, curves }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  // Drawn at once from the window size (the screen's column is at most 720 wide), refined when measured.
  const width = measured || Math.min(window.width, 720) - spacing.md * 2 - spacing.sm * 2;

  const onLayout = (event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width);

  const plotW = Math.max(0, width - Y_LABEL_WIDTH - PAD * 2);
  const plotH = HEIGHT - PAD * 2;
  const range = curves.max - curves.min;
  // Pad the value range a little so the curves don't touch the frame; a flat curve sits mid-height.
  const padded = range === 0 ? Math.max(Math.abs(curves.max) * 0.02, 0.01) : range * 0.08;
  const lo = curves.min - padded;
  const hi = curves.max + padded;
  const toPt = (day: number, value: number): Pt => ({
    x: PAD + Y_LABEL_WIDTH + (day / curves.maxDay) * plotW,
    y: PAD + (1 - (value - lo) / (hi - lo)) * plotH,
  });
  const label = (value: number) => formatItemValue({ name, value, unit: curves.unit });

  return (
    <View
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={t.ferment.chartLabel(itemName(name), curves.series.length)}
    >
      <View style={{ height: HEIGHT }} onLayout={onLayout}>
        {width > 0 ? (
          <>
            {[0, 0.5, 1].map((share) => {
              const y = PAD + share * plotH;
              const value = hi - share * (hi - lo);
              return (
                <View key={share} style={[styles.grid, { top: y, left: PAD + Y_LABEL_WIDTH, right: PAD }]}>
                  <View style={[styles.gridLine, { backgroundColor: colors.border }]} />
                  <AppText muted style={[styles.yLabel, { top: -9, left: -Y_LABEL_WIDTH - 4 }]} numberOfLines={1}>
                    {label(Math.round(value * 1000) / 1000)}
                  </AppText>
                </View>
              );
            })}
            {/* Earlier ferments first, so this one is drawn on top. */}
            {[...curves.series].reverse().map((series, reversedIndex) => {
              const index = curves.series.length - 1 - reversedIndex;
              const color = seriesColor(colors, series, index);
              const thickness = series.current ? 3.5 : 2;
              const dot = series.current ? 9 : 6;
              const pts = series.points.map((point) => toPt(point.day, point.value));
              return (
                <View key={series.ferment.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                  {pts.slice(1).map((pt, i) => (
                    <Segment key={i} from={pts[i] as Pt} to={pt} color={color} thickness={thickness} />
                  ))}
                  {pts.map((pt, i) => (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: pt.x - dot / 2,
                        top: pt.y - dot / 2,
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </View>
              );
            })}
          </>
        ) : null}
      </View>
      <View style={[styles.xAxis, { marginLeft: PAD + Y_LABEL_WIDTH, marginRight: PAD }]}>
        <AppText muted style={styles.xLabel}>
          0
        </AppText>
        <AppText muted style={styles.xLabel}>
          {curves.maxDay}
        </AppText>
      </View>
      <AppText muted variant="caption" style={styles.axisTitle}>
        {t.ferment.daysAxis(curves.maxDay)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  grid: { position: 'absolute', height: 0 },
  gridLine: { height: StyleSheet.hairlineWidth * 2, width: '100%' },
  yLabel: { position: 'absolute', width: Y_LABEL_WIDTH, textAlign: 'right', fontSize: 12, lineHeight: 16, fontFamily: fonts.bodySemi },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bodySemi },
  axisTitle: { textAlign: 'center', fontSize: 13, lineHeight: 17 },
});
