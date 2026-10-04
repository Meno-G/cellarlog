import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { EntryReview } from '@/components/EntryReview';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntry } from '@/hooks/useEntries';
import { useTanks } from '@/hooks/useTanks';
import { updateEntry, type Entry } from '@/lib/entries';
import { draftFromSaved, validateDraft, type DraftErrors, type EntryDraft } from '@/lib/entryDraft';
import { AppError, errorMessage } from '@/lib/errors';
import type { Tank } from '@/lib/tanks';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useEntry(id);
  const tanks = useTanks();

  if (entry.loading || tanks.loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!entry.data || !tanks.data) {
    const retry = () => {
      entry.refresh();
      tanks.refresh();
    };
    return (
      <Screen scroll={false}>
        <ErrorState
          message={entry.error ?? tanks.error ?? 'Could not load the entry.'}
          onRetry={retry}
          retrying={entry.refreshing || tanks.refreshing}
        />
      </Screen>
    );
  }

  // Keyed so the form starts fresh if a different entry is shown.
  return <EntryEditor key={entry.data.id} entry={entry.data} tanks={tanks.data} />;
}

function EntryEditor({ entry, tanks }: { entry: Entry; tanks: Tank[] }) {
  const [draft, setDraft] = useState<EntryDraft>(() => draftFromSaved(entry));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaveError(null);
    const result = validateDraft(draft, tanks);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = await updateEntry(entry.id, result.entry);
      if (saved.tankId === entry.tankId) {
        router.back(); // the timeline refetches on focus
      } else {
        // Moved to another tank: show that tank's timeline instead.
        router.replace({ pathname: '/tanks/[id]', params: { id: saved.tankId } });
      }
    } catch (err) {
      if (err instanceof AppError && err.field === 'tank') setErrors({ tank: err.message });
      else setSaveError(errorMessage(err));
      setSaving(false);
    }
  }

  const hasErrors = errors.tank || errors.items || errors.note || errors.form;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen footer={<Button title="Save changes" onPress={handleSave} loading={saving} />}>
        <OfflineBanner message="You're offline. Saving needs internet. Your changes stay here." />
        {saveError ? <Banner message={saveError} onRetry={handleSave} /> : null}
        {hasErrors ? (
          <Banner message={errors.form ?? 'Please fix the highlighted fields.'} />
        ) : null}
        <EntryReview
          draft={draft}
          onChange={setDraft}
          tanks={tanks}
          errors={errors}
          disabled={saving}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
