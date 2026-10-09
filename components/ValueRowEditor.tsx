import { Pressable, StyleSheet, View } from 'react-native';

import type { DraftItem } from '@/lib/entryDraft';
import { useT } from '@/hooks/useLanguage';
import { fonts, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { TextField } from './TextField';

type Props = {
  item: DraftItem;
  /** "Value 2", "Field 1": shown above the row and used in the remove button's label. */
  title: string;
  onChange: (fields: Partial<Omit<DraftItem, 'key'>>) => void;
  onRemove: () => void;
  error?: string;
  disabled?: boolean;
};

/** One name / value / unit row the user types in full (review screen, added analysis fields). */
export function ValueRowEditor({ item, title, onChange, onRemove, error, disabled = false }: Props) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View
      style={[
        styles.item,
        { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.itemHeader}>
        <AppText muted variant="caption">
          {title}
        </AppText>
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t.valueRow.removeLabel(title, item.name)}
          hitSlop={8}
          style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText style={{ color: colors.danger, fontFamily: fonts.bodyBold }}>{t.common.remove}</AppText>
        </Pressable>
      </View>
      <TextField
        label={t.valueRow.name}
        value={item.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="SO2"
        editable={!disabled}
      />
      <View style={styles.valueRow}>
        <View style={styles.value}>
          <TextField
            label={t.valueRow.value}
            value={item.value}
            onChangeText={(value) => onChange({ value })}
            placeholder="20"
            editable={!disabled}
          />
        </View>
        <View style={styles.unit}>
          <TextField
            label={t.valueRow.unit}
            value={item.unit}
            onChangeText={(unit) => onChange({ unit })}
            placeholder="g/hL"
            autoCapitalize="none"
            editable={!disabled}
          />
        </View>
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
  item: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { minHeight: touch.minHeight - 8, justifyContent: 'center', paddingHorizontal: spacing.sm },
  valueRow: { flexDirection: 'row', gap: spacing.sm },
  value: { flex: 3 },
  unit: { flex: 2 },
});
