import { Pressable, StyleSheet, View } from 'react-native';

import { formatItemValue, formatRelative } from '@/lib/format';
import type { LatestValue } from '@/lib/latestValues';
import { fonts, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  values: readonly LatestValue[];
  /** Tapping a numeric value opens its history. */
  onSelect: (name: string) => void;
};

/** The newest reading of each value on a tank, with how long ago it was measured. */
export function LatestValues({ values, onSelect }: Props) {
  const { colors } = useTheme();
  if (values.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      <AppText variant="heading" style={{ color: colors.header }}>
        Latest values
      </AppText>
      <AppText muted variant="caption">
        Tap a value to see how it changed.
      </AppText>
      <View style={styles.tiles}>
        {values.map(({ item, createdAt }) => {
          const value = formatItemValue(item);
          const when = formatRelative(createdAt);
          // Text values ("deep ruby") have no history to chart.
          const charted = typeof item.value === 'number';
          return (
            <Pressable
              key={item.name.toLowerCase()}
              onPress={() => onSelect(item.name)}
              disabled={!charted}
              accessibilityRole={charted ? 'button' : undefined}
              accessibilityLabel={`${item.name}: ${value}, ${when}`}
              accessibilityHint={charted ? 'Shows every reading of this value' : undefined}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <AppText muted style={styles.name} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText style={styles.value} numberOfLines={1}>
                {value}
              </AppText>
              <AppText muted style={styles.when} numberOfLines={1}>
                {when}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    minHeight: touch.minHeight + 16,
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  name: { fontSize: 14, lineHeight: 18 },
  value: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26 },
  when: { fontSize: 13, lineHeight: 17 },
});
