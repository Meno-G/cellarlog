import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';

export type Choice<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  error?: string;
  disabled?: boolean;
};

/** Large, wrap-around single-choice buttons: easier with gloves than a dropdown. */
export function ChoiceChips<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  error,
  disabled = false,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        {choices.map((choice) => {
          const active = choice.value === selected;
          return (
            <Pressable
              key={choice.value}
              onPress={() => onSelect(choice.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : error ? colors.danger : colors.border,
                  opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <AppText variant="label" style={{ color: active ? colors.onPrimary : colors.text }}>
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
  wrapper: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: touch.minHeight,
    minWidth: touch.minHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
