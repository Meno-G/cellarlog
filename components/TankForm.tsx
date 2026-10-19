import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInput } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { AppError, errorMessage } from '@/lib/errors';
import {
  TANK_FORM_FIELDS,
  validateTankForm,
  type TankFormErrors,
  type TankFormValues,
} from '@/lib/tankForm';
import { VESSEL_KINDS, type TankInput } from '@/lib/tanks';

import { Banner } from './Banner';
import { ChoiceChips } from './ChoiceChips';
import { OfflineBanner } from './OfflineBanner';
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
        {footerExtra}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
