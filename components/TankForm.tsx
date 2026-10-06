import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInput } from 'react-native';

import { AppError, errorMessage } from '@/lib/errors';
import {
  TANK_FORM_FIELDS,
  validateTankForm,
  type TankFormErrors,
  type TankFormValues,
} from '@/lib/tankForm';
import type { TankInput } from '@/lib/tanks';

import { Banner } from './Banner';
import { OfflineBanner } from './OfflineBanner';
import { Button } from './Button';
import { Screen } from './Screen';
import { TextField } from './TextField';

type Props = {
  initialValues: TankFormValues;
  submitLabel: string;
  /** Shown while the phone is offline (what happens when you save). */
  offlineMessage?: string;
  /** Should throw an AppError on failure; a `field` error is shown under that input. */
  onSubmit: (input: TankInput) => Promise<void>;
};

function isFormField(field: string | undefined): field is keyof TankFormValues {
  return TANK_FORM_FIELDS.some((name) => name === field);
}

export function TankForm({ initialValues, submitLabel, onSubmit, offlineMessage }: Props) {
  const [values, setValues] = useState<TankFormValues>(initialValues);
  const [errors, setErrors] = useState<TankFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const volumeRef = useRef<TextInput>(null);
  const varietyRef = useRef<TextInput>(null);
  const vintageRef = useRef<TextInput>(null);

  function setField(field: keyof TankFormValues, text: string) {
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

        <TextField
          label="Tank name"
          value={values.name}
          onChangeText={(text) => setField('name', text)}
          error={errors.name}
          placeholder="Tank 12"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => volumeRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={volumeRef}
          label="Volume (liters)"
          value={values.volume}
          onChangeText={(text) => setField('volume', text)}
          error={errors.volume}
          placeholder="5000"
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => varietyRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={varietyRef}
          label="Wine / grape variety (optional)"
          value={values.variety}
          onChangeText={(text) => setField('variety', text)}
          error={errors.variety}
          placeholder="Saperavi"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => vintageRef.current?.focus()}
          editable={!submitting}
        />
        <TextField
          ref={vintageRef}
          label="Vintage (optional)"
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
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
