import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { EntryReview } from '@/components/EntryReview';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useTanks } from '@/hooks/useTanks';
import { createEntry } from '@/lib/entries';
import {
  draftFromParse,
  manualDraft,
  validateDraft,
  type DraftErrors,
  type EntryDraft,
} from '@/lib/entryDraft';
import { AppError, errorMessage } from '@/lib/errors';
import { parseNote } from '@/lib/parser';
import { spacing } from '@/theme';

type Review = {
  draft: EntryDraft;
  errors: DraftErrors;
  saveError: string | null;
  saving: boolean;
};

const EXAMPLE = 'Tank 12, added 20 g/hl SO2, temp 22°C';

export default function NewEntryScreen() {
  const { tankId } = useLocalSearchParams<{ tankId?: string }>();
  const startTankId = tankId ?? null;
  const tanks = useTanks();

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  if (tanks.loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!tanks.data) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={tanks.error ?? 'Could not load your tanks.'}
          onRetry={tanks.refresh}
          retrying={tanks.refreshing}
        />
      </Screen>
    );
  }
  const tankList = tanks.data;
  if (tankList.length === 0) {
    return (
      <Screen>
        <AppText variant="title">Create a tank first</AppText>
        <AppText muted>Entries belong to a tank. Add one, then come back.</AppText>
        <Button title="+ New tank" onPress={() => router.replace('/tanks/new')} />
      </Screen>
    );
  }
  const startTank = tankList.find((tank) => tank.id === startTankId);

  async function handleParse() {
    setParseError(null);
    setParsing(true);
    try {
      const result = await parseNote(
        { kind: 'text', text },
        { tankNames: tankList.map((tank) => tank.name) },
      );
      setReview({
        draft: draftFromParse(result, tankList, startTankId),
        errors: {},
        saveError: null,
        saving: false,
      });
    } catch (err) {
      setParseError(errorMessage(err));
    } finally {
      setParsing(false);
    }
  }

  function fillInManually() {
    setParseError(null);
    setReview({ draft: manualDraft(text, startTankId), errors: {}, saveError: null, saving: false });
  }

  async function handleSave(current: Review) {
    const result = validateDraft(current.draft, tankList);
    if (!result.ok) {
      setReview({ ...current, errors: result.errors, saveError: null });
      return;
    }
    setReview({ ...current, errors: {}, saveError: null, saving: true });
    try {
      const saved = await createEntry(result.entry);
      if (saved.tankId === startTankId) {
        router.back(); // the tank screen refetches its timeline on focus
      } else {
        router.replace({ pathname: '/tanks/[id]', params: { id: saved.tankId } });
      }
    } catch (err) {
      const tankError = err instanceof AppError && err.field === 'tank';
      setReview({
        ...current,
        saving: false,
        errors: tankError ? { tank: err.message } : {},
        saveError: tankError ? null : errorMessage(err),
      });
    }
  }

  // ---- Review step -------------------------------------------------------
  if (review) {
    const hasErrors =
      review.errors.tank || review.errors.items || review.errors.note || review.errors.form;
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen
          footer={
            <View style={styles.footer}>
              <Button title="Save entry" onPress={() => handleSave(review)} loading={review.saving} />
              <Button
                variant="secondary"
                title="Back to note"
                onPress={() => setReview(null)}
                disabled={review.saving}
              />
            </View>
          }
        >
          <OfflineBanner message="You're offline. Saving needs internet. Your entry stays here." />
          <AppText variant="title">Check and save</AppText>
          {review.saveError ? (
            <Banner message={review.saveError} onRetry={() => handleSave(review)} />
          ) : null}
          {hasErrors ? (
            <Banner message={review.errors.form ?? 'Please fix the highlighted fields.'} />
          ) : null}
          <EntryReview
            draft={review.draft}
            onChange={(draft) => setReview({ ...review, draft })}
            tanks={tankList}
            errors={review.errors}
            disabled={review.saving}
          />
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  // ---- Input step --------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            title={parsing ? 'Reading your note…' : 'Review entry'}
            onPress={handleParse}
            loading={parsing}
            disabled={text.trim() === ''}
          />
        }
      >
        <OfflineBanner />
        {startTank ? <AppText muted>For {startTank.name}</AppText> : null}

        <TextField
          label="What did you do?"
          value={text}
          onChangeText={setText}
          placeholder={EXAMPLE}
          multiline
          textAlignVertical="top"
          autoFocus
          editable={!parsing}
          style={styles.noteInput}
        />
        <AppText muted variant="caption">
          Mention the tank, what you added or measured, and units. Voice recording comes in step 5.
        </AppText>

        {parseError ? (
          <View style={styles.errorBox}>
            <Banner message={parseError} onRetry={handleParse} />
            <Button variant="secondary" title="Fill in yourself" onPress={fillInManually} />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  noteInput: { minHeight: 160, paddingTop: spacing.sm },
  errorBox: { gap: spacing.sm },
});
