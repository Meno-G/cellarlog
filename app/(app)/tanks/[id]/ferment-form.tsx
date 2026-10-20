import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDialog } from '@/hooks/useDialog';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { errorMessage } from '@/lib/errors';
import type { Ferment } from '@/lib/ferments';
import {
  dayString,
  fermentToForm,
  newFermentForm,
  validateFermentForm,
  type FermentFormErrors,
  type FermentFormValues,
} from '@/lib/fermentForm';
import { radius, spacing, useTheme } from '@/theme';

/** Start a ferment, or (with fermentId) change its name and dates, end it, or delete it. */
export default function FermentFormScreen() {
  const { id, fermentId } = useLocalSearchParams<{ id: string; fermentId?: string }>();
  const tank = useTank(id);
  const ferments = useFerments(id);
  const t = useT();

  if (ferments.loading || tank.loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!ferments.data || !tank.data) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={ferments.error ?? tank.error ?? t.messages.loadFermentsFailed}
          onRetry={() => {
            ferments.refresh();
            tank.refresh();
          }}
          retrying={ferments.refreshing || tank.refreshing}
        />
      </Screen>
    );
  }

  const existing = fermentId ? ferments.data.find((ferment) => ferment.id === fermentId) : undefined;
  if (fermentId && !existing) {
    return (
      <Screen scroll={false}>
        <ErrorState message={t.messages.fermentGone} onRetry={() => router.back()} />
      </Screen>
    );
  }

  return (
    <FermentEditor
      key={existing?.id ?? 'new'}
      tankId={id}
      existing={existing}
      others={ferments.data.filter((ferment) => ferment.id !== existing?.id)}
      initial={existing ? fermentToForm(existing) : newFermentForm(tank.data)}
    />
  );
}

function FermentEditor({
  tankId,
  existing,
  others,
  initial,
}: {
  tankId: string;
  existing: Ferment | undefined;
  others: Ferment[];
  initial: FermentFormValues;
}) {
  const t = useT();
  const { colors } = useTheme();
  const dialog = useDialog();
  const outbox = useOutbox();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FermentFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startRef = useRef<TextInput>(null);
  const endRef = useRef<TextInput>(null);

  function setField(field: keyof FermentFormValues, text: string) {
    setValues((current) => ({ ...current, [field]: text }));
    if (errors[field] || errors.form) setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  /** Runs a save or delete: shows errors, goes back on success. */
  async function run(action: () => Promise<unknown>) {
    setSubmitError(null);
    setBusy(true);
    try {
      await action();
      router.back(); // the ferment screens refetch on focus
    } catch (err) {
      setSubmitError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleSave() {
    const result = validateFermentForm(values, others);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    // Online it is saved now; offline it waits on this phone and uploads later.
    await run(() => outbox.saveFerment(tankId, existing?.id ?? null, result.input));
  }

  function confirmEndNow() {
    if (!existing) return;
    dialog(t.ferment.endTitle(existing.name), t.ferment.endText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.ferment.endButton,
        onPress: () => {
          // Ends today, and today's entries still belong to it (the end date includes its whole day).
          const result = validateFermentForm({ ...values, endDate: dayString(new Date()) }, others);
          if (!result.ok) {
            setErrors(result.errors);
            return;
          }
          void run(() => outbox.saveFerment(tankId, existing.id, result.input));
        },
      },
    ]);
  }

  function confirmDelete() {
    if (!existing) return;
    dialog(t.ferment.deleteTitle(existing.name), t.ferment.deleteText, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.ferment.deleteButton, style: 'destructive', onPress: () => void run(() => outbox.deleteFerment(tankId, existing.id)) },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? t.ferment.editTitle : t.ferment.newTitle }} />
      <Screen
        footer={
          <Button
            title={existing ? t.common.saveChanges : t.ferment.createButton}
            icon="check"
            onPress={handleSave}
            loading={busy}
          />
        }
      >
        <OfflineBanner message={t.ferment.offlineNote} />
        {submitError ? <Banner message={submitError} /> : null}
        {errors.form ? <Banner message={errors.form} /> : null}

        <TextField
          label={t.ferment.name}
          value={values.name}
          onChangeText={(text) => setField('name', text)}
          error={errors.name}
          placeholder={t.ferment.namePlaceholder}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => startRef.current?.focus()}
          editable={!busy}
        />
        <TextField
          ref={startRef}
          label={t.ferment.startDate}
          value={values.startDate}
          onChangeText={(text) => setField('startDate', text)}
          error={errors.startDate}
          placeholder={t.ferment.datePlaceholder}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          returnKeyType="next"
          onSubmitEditing={() => endRef.current?.focus()}
          editable={!busy}
        />
        <TextField
          ref={endRef}
          label={t.ferment.endDate}
          value={values.endDate}
          onChangeText={(text) => setField('endDate', text)}
          error={errors.endDate}
          placeholder={t.ferment.datePlaceholder}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          editable={!busy}
        />

        {existing && existing.endedAt === null ? (
          <Button variant="secondary" title={t.ferment.endNow} icon="stop-circle-outline" onPress={confirmEndNow} disabled={busy} />
        ) : null}

        {existing ? (
          <View style={[styles.danger, { borderColor: colors.danger }]}>
            <AppText variant="label" style={{ color: colors.danger }}>
              {t.ferment.deleteButton}
            </AppText>
            <AppText muted variant="caption">
              {t.ferment.deleteText}
            </AppText>
            <Button variant="danger" title={t.ferment.deleteButton} onPress={confirmDelete} disabled={busy} />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  danger: { marginTop: spacing.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 2, borderRadius: radius.md },
});
