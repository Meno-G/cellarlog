import { Pressable, StyleSheet, View } from 'react-native';

import { fonts, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type Choice<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Large single-choice buttons: easier with gloves than a dropdown. Plain
 * choices wrap as pills; choices with icons form a 3-column grid of tiles.
 */
export function ChoiceChips<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  error,
  disabled = false,
}: Props<T>) {
  const { colors } = useTheme();
  const tiles = choices.some((choice) => choice.icon);

  return (
    <View style={styles.wrapper} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        {choices.map((choice) => {
          const active = choice.value === selected;
          const foreground = active ? colors.onPrimary : colors.text;
          return (
            <Pressable
              key={choice.value}
              onPress={() => onSelect(choice.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ checked: active, disabled }}
              style={({ pressed }) => [
                tiles ? styles.tile : styles.pill,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : error ? colors.danger : colors.border,
                  opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {choice.icon ? <Icon name={choice.icon} size={24} color={active ? colors.onPrimary : colors.iconFg} /> : null}
              <AppText
                numberOfLines={1}
                style={{
                  color: foreground,
                  fontFamily: active ? fonts.bodyBold : fonts.bodySemi,
                  fontSize: tiles ? 15 : 17,
                }}
              >
                {choice.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    minHeight: touch.minHeight - 4,
    minWidth: touch.minHeight,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 68,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
