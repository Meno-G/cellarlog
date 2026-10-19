import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { AppError, errorMessage } from '@/lib/errors';
import {
  TANK_FORM_FIELDS,
  type BlendRowValues,
  validateTankForm,
  type TankFormErrors,
  type TankFormValues,
} from '@/lib/tankForm';
import { VESSEL_KINDS, type TankInput } from '@/lib/tanks';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { Banner } from './Banner';
import { ChoiceChips } from './ChoiceChips';
import { OfflineBanner } from './OfflineBanner';
import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';
import { TextField } from './TextField';

type Props = {
  initialValues: TankFormValues;
  submitLabel: string;
  /** Shown while the phone is offline (what happens when you save). */
  offlineMessage?: string;
  /** Shown at the very end of the form, below the fields (e.g. a delete button). */
  footerExtra?: ReactNode;
  /** Should throw an AppError on failure; a `field` error is shown under that input. */
  onSubmit: (input: TankInput) => Promise<void>;
};

function isFormField(field: string | undefined): field is keyof TankFormValues {
  return TANK_FORM_FIELDS.some((name) => name === field);
}

export function TankForm({ initialValues, submitLabel, onSubmit, offlineMessage, footerExtra }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const [values, setValues] = useState<TankFormValues>(initialValues);
  const [errors, setErrors] = useState<TankFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const volumeRef = useRef<TextInput>(null);
  const contentRef = useRef<TextInput>(null);
  const varietyRef = useRef<TextInput>(null);
  const vintageRef = useRef<TextInput>(null);

  function setField(field: keyof TankFormErrors, text: string) {
    setValues((current) => ({ ...current, [field]: text }));
    // Clear the error for a field as soon as the user edits it.
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function setRow(index: number, field: keyof BlendRowValues, text: string) {
    setValues((current) => ({
      ...current,
      blend: current.blend.map((row, at) => (at === index ? { ...row, [field]: text } : row)),
    }));
    if (errors.blend) setErrors((current) => ({ ...current, blend: undefined }));
  }

  function addRow() {
    setValues((current) => ({ ...current, blend: [...current.blend, { variety: '', vintage: '', liters: '' }] }));
  }

  function removeRow(index: number) {
    setValues((current) => ({ ...current, blend: current.blend.filter((_, at) => at !== index) }));
  }

  async function handleSubmit() {
    setSubmitError(null);
    const result = validateTankForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.input);
    } catch (err) {
      if (err instanceof AppError && isFormField(err.field)) {
        const field = err.field;
        setErrors({ [field]: err.message });
      } else {
        setSubmitError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={<Button title={submitLabel} onPress={handleSubmit} loading={submitting} />}
      >
        <OfflineBanner message={offlineMessage} />
        {submitError ? <Banner message={submitError} /> : null}

        <ChoiceChips
          label={t.tankForm.kind}
          choices={VESSEL_KINDS.map((kind) => ({ value: kind, label: t.vesselKinds[kind] }))}
          selected={values.kind}
          onSelect={(kind) => setValues((current) => ({ ...current, kind }))}
          disabled={submitting}
        />
        <TextField
          label={t.tankForm.name}
          value={values.name}
          onChangeText={(text) => setField('name', text)}
          error={errors.name}
          placeholder={t.tankForm.namePlaceholder}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => volumeRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={volumeRef}
          label={t.tankForm.volume}
          value={values.volume}
          onChangeText={(text) => setField('volume', text)}
          error={errors.volume}
          placeholder="5000"
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => contentRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={contentRef}
          label={t.tankForm.content}
          value={values.content}
          onChangeText={(text) => setField('content', text)}
          error={errors.content}
          placeholder="3000"
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => varietyRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={varietyRef}
          label={t.tankForm.variety}
          value={values.variety}
          onChangeText={(text) => setField('variety', text)}
          error={errors.variety}
          placeholder={t.tankForm.varietyPlaceholder}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => vintageRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={vintageRef}
          label={t.tankForm.vintage}
          value={values.vintage}
          onChangeText={(text) => setField('vintage', text)}
          error={errors.vintage}
          placeholder="2025"
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!submitting}
        />
        <AppText variant="heading" style={{ color: colors.heading }}>
          {t.tankForm.blendTitle}
        </AppText>
        <AppText muted variant="caption">
          {t.tankForm.blendHint}
        </AppText>
        {values.blend.map((row, index) => (
          <View key={index} style={[styles.part, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText style={{ fontFamily: fonts.bodySemi }}>{t.tankForm.blendPart(index + 1)}</AppText>
            <TextField
              label={t.tankForm.blendVariety}
              value={row.variety}
              onChangeText={(text) => setRow(index, 'variety', text)}
              autoCapitalize="words"
              editable={!submitting}
            />
            <View style={styles.pair}>
              <View style={styles.half}>
                <TextField
                  label={t.tankForm.blendVintage}
                  value={row.vintage}
                  onChangeText={(text) => setRow(index, 'vintage', text)}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!submitting}
                />
              </View>
              <View style={styles.half}>
                <TextField
                  label={t.tankForm.blendLiters}
                  value={row.liters}
                  onChangeText={(text) => setRow(index, 'liters', text)}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                />
              </View>
            </View>
            <Button variant="secondary" title={t.tankForm.blendRemove} icon="close" onPress={() => removeRow(index)} disabled={submitting} />
          </View>
        ))}
        {errors.blend ? <Banner message={errors.blend} /> : null}
        <Button variant="secondary" title={t.tankForm.blendAdd} onPress={addRow} disabled={submitting} />
        {footerExtra}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  part: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
