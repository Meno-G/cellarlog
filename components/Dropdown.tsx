import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { fonts, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type DropdownOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly DropdownOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  disabled?: boolean;
};

/**
 * A drop-down list for a long list of choices (ChoiceChips are better for a few). The
 * closed field shows the choice; tapping it opens the list in a sheet with large rows.
 */
export function Dropdown<T extends string>({ label, options, selected, onSelect, disabled = false }: Props<T>) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === selected);

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        accessibilityState={{ expanded: open, disabled }}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <AppText style={styles.fieldText} numberOfLines={1}>
          {current?.label ?? ''}
        </AppText>
        <Icon name="chevron-down" size={26} color={colors.primary} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={label} accessibilityRole="button">
          {/* Taps on the sheet must not close it. */}
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: height * 0.7 }]}
          >
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === selected;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setOpen(false);
                      onSelect(option.value);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <AppText style={{ flex: 1, fontFamily: isSelected ? fonts.bodyBold : fonts.body }}>{option.label}</AppText>
                    {isSelected ? <Icon name="check" size={24} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  field: {
    minHeight: touch.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  fieldText: { flex: 1, fontFamily: fonts.bodySemi },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    minHeight: touch.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
