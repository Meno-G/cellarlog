import { StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { activeFerment, fermentDay } from '@/lib/fermentCurves';
import type { Ferment } from '@/lib/ferments';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  /** Undefined while still loading with nothing saved. */
  ferments: readonly Ferment[] | undefined;
  onStart: () => void;
  onEnd: (ferment: Ferment) => void;
  onList: () => void;
  onChart: () => void;
};

/** The vessel's ferment at a glance: which one is running and what day it's on, plus the chart and list. */
export function FermentPanel({ ferments, onStart, onEnd, onList, onChart }: Props) {
  const { colors } = useTheme();
  const t = useT();
  if (!ferments) return null;
  const running = activeFerment(ferments);

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading" style={{ color: colors.heading }}>
        {t.ferment.title}
      </AppText>
      <AppText style={{ color: running ? colors.text : colors.textMuted }}>
        {running ? t.ferment.runningLine(running.name, fermentDay(running.startedAt, new Date())) : t.ferment.noneRunning}
      </AppText>
      {running ? (
        <Button variant="secondary" title={t.ferment.endNow} icon="stop-circle-outline" onPress={() => onEnd(running)} />
      ) : (
        <Button title={t.ferment.start} icon="play-circle-outline" onPress={onStart} />
      )}
      <View style={styles.row}>
        <Button style={styles.half} variant="secondary" title={t.ferment.chart} icon="chart-line" onPress={onChart} />
        <Button style={styles.half} variant="secondary" title={t.ferment.allFerments} icon="format-list-bulleted" onPress={onList} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, paddingHorizontal: spacing.sm },
});
