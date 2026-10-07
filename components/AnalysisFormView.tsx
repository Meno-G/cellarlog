import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  ANALYSIS_FIELDS,
  unitFor,
  type AnalysisErrors,
  type AnalysisField,
  type AnalysisForm,
} from '@/lib/analysisForm';
import { newDraftItem, type DraftItem } from '@/lib/entryDraft';
import { fonts, fontSize, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { TextField } from './TextField';
import { ValueRowEditor } from './ValueRowEditor';

type TankChoice = { id: string; name: string };

type Props = {
  form: AnalysisForm;
  onChange: (form: AnalysisForm) => void;
  tanks: readonly TankChoice[];
  errors: AnalysisErrors;
  disabled?: boolean;
};

/** The "Analysis" tab: one labelled field per analysis, plus fields the user adds by name. */
export function AnalysisFormView({ form, onChange, tanks, errors, disabled = false }: Props) {
  const { colors } = useTheme();
  // "Next" on the keypad jumps to the following field.
  const inputs = useRef<(TextInput | null)[]>([]);
  const tankChoices = tanks.map((tank) => ({ value: tank.id, label: tank.name }));

  function setValue(field: AnalysisField, value: string) {
    onChange({ ...form, values: { ...form.values, [field.id]: value } });
  }

  function updateExtra(key: string, fields: Partial<Omit<DraftItem, 'key'>>) {
    onChange({
      ...form,
      extras: form.extras.map((item) => (item.key === key ? { ...item, ...fields } : item)),
    });
  }

  return (
    <View style={styles.wrapper}>
      <ChoiceChips
        label="Tank"
        choices={tankChoices}
        selected={form.tankId}
        onSelect={(tankId) => onChange({ ...form, tankId })}
        error={errors.tank}
        disabled={disabled}
      />

      <View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {ANALYSIS_FIELDS.map((field, index) => {
          const error = errors.fields?.[field.id];
          const unit = unitFor(field, form);
          const last = index === ANALYSIS_FIELDS.length - 1;
          return (
            <View
              key={field.id}
              style={[
                styles.fieldBlock,
                !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.fieldRow}>
                <AppText style={styles.fieldLabel}>{field.label}</AppText>
                <TextInput
                  ref={(input) => {
                    inputs.current[index] = input;
                  }}
                  value={form.values[field.id] ?? ''}
                  onChangeText={(value) => setValue(field, value)}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  returnKeyType={last ? 'done' : 'next'}
                  submitBehavior={last ? 'blurAndSubmit' : 'submit'}
                  onSubmitEditing={() => inputs.current[index + 1]?.focus()}
                  editable={!disabled}
                  accessibilityLabel={unit ? `${field.label}, in ${unit}` : field.label}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: error ? colors.danger : colors.border,
                    },
                  ]}
                />
                <AppText muted style={styles.unit}>
                  {field.units.length > 1 ? '' : (unit ?? '')}
                </AppText>
              </View>
              {field.units.length > 1 ? (
                <View style={styles.unitChoices} accessibilityRole="radiogroup" accessibilityLabel={`${field.label} unit`}>
                  {field.units.map((choice) => {
                    const active = choice === unit;
                    return (
                      <Pressable
                        key={choice}
                        onPress={() => onChange({ ...form, units: { ...form.units, [field.id]: choice } })}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityLabel={choice}
                        accessibilityState={{ checked: active, disabled }}
                        style={({ pressed }) => [
                          styles.unitPill,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <AppText
                          style={{
                            color: active ? colors.onPrimary : colors.text,
                            fontFamily: active ? fonts.bodyBold : fonts.bodySemi,
                          }}
                        >
                          {choice}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {error ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {error}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        {form.extras.map((item, index) => (
          <ValueRowEditor
            key={item.key}
            item={item}
            title={`Added field ${index + 1}`}
            onChange={(fields) => updateExtra(item.key, fields)}
            onRemove={() => onChange({ ...form, extras: form.extras.filter((row) => row.key !== item.key) })}
            error={errors.extras?.[item.key]}
            disabled={disabled}
          />
        ))}
        <Button
          variant="secondary"
          title="Add field"
          icon="plus"
          onPress={() => onChange({ ...form, extras: [...form.extras, newDraftItem()] })}
          disabled={disabled}
          accessibilityHint="Adds a field where you type the name, value and unit"
        />
      </View>

      <TextField
        label="Note (optional)"
        value={form.note}
        onChangeText={(note) => onChange({ ...form, note })}
        error={errors.note}
        multiline
        textAlignVertical="top"
        style={styles.note}
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  section: { gap: spacing.sm },
  table: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  fieldBlock: { paddingVertical: spacing.sm, gap: spacing.xs },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldLabel: { flex: 1, fontFamily: fonts.bodySemi },
  input: {
    width: 116,
    minHeight: touch.minHeight,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: fontSize.body + 2,
    fontFamily: fonts.bodySemi,
    textAlign: 'right',
  },
  unit: { width: 44, fontSize: 16 },
  unitChoices: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingRight: 44 + spacing.sm },
  unitPill: {
    minHeight: touch.minHeight - 8,
    minWidth: touch.minHeight,
    borderWidth: 2,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  note: { minHeight: 96, paddingTop: spacing.sm },
});
