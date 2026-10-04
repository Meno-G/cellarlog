import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { EntryReview } from '@/components/EntryReview';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RecordButton } from '@/components/RecordButton';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useTanks } from '@/hooks/useTanks';
import { MAX_RECORDING_MS, useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { createEntry } from '@/lib/entries';
import {
  draftFromParse,
  manualDraft,
  validateDraft,
  type DraftErrors,
  type EntryDraft,
} from '@/lib/entryDraft';
import { AppError, errorMessage } from '@/lib/errors';
import { parseNote, type ParseInput } from '@/lib/parser';
import { spacing, useTheme } from '@/theme';

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
  const { colors } = useTheme();

  const [text, setText] = useState('');
  /** Which kind of input is being parsed right now, if any. */
  const [parsingKind, setParsingKind] = useState<ParseInput['kind'] | null>(null);
  const parsing = parsingKind !== null;
  const [parseError, setParseError] = useState<string | null>(null);
  /** The input that failed to parse, so "Try again" doesn't need a new recording. */
  const [failedInput, setFailedInput] = useState<ParseInput | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  async function runParse(input: ParseInput) {
    const tankList = tanks.data ?? [];
    setParseError(null);
    setFailedInput(null);
    setParsingKind(input.kind);
    try {
      const result = await parseNote(input, {
        tankNames: tankList.map((tank) => tank.name),
        defaultTankName: tankList.find((tank) => tank.id === startTankId)?.name ?? null,
      });
      setReview({
        draft: draftFromParse(result, tankList, startTankId),
        errors: {},
        saveError: null,
        saving: false,
      });
    } catch (err) {
      setParseError(errorMessage(err));
      setFailedInput(input);
    } finally {
      setParsingKind(null);
    }
  }

  // A finished recording is sent straight away: one less tap with wet gloves.
  const recorder = useVoiceRecorder({
    onRecorded: (recording) => void runParse({ kind: 'audio', ...recording }),
  });

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

  function fillInManually() {
    const typed = failedInput?.kind === 'text' ? failedInput.text : text;
    setParseError(null);
    setFailedInput(null);
    setReview({ draft: manualDraft(typed, startTankId), errors: {}, saveError: null, saving: false });
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
                title="Back"
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

  // ---- Input step: record or type ---------------------------------------
  const busy = parsing || recorder.active;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            title="Review typed note"
            onPress={() => runParse({ kind: 'text', text })}
            loading={parsingKind === 'text'}
            disabled={text.trim() === '' || busy}
          />
        }
      >
        <OfflineBanner />
        {startTank ? <AppText muted>For {startTank.name}</AppText> : null}

        <RecordButton
          recording={recorder.recording}
          busy={busy}
          durationMs={recorder.durationMs}
          maxMs={MAX_RECORDING_MS}
          disabled={parsing}
          onPress={recorder.recording ? recorder.stop : () => void recorder.start()}
        />
        {parsing ? (
          <AppText style={styles.center} accessibilityLiveRegion="polite">
            Reading your note…
          </AppText>
        ) : null}

        {recorder.permission === 'blocked' ? (
          <Banner
            message="Microphone access is turned off for this app. Turn it on in Settings, or type your note below."
            onRetry={() => void Linking.openSettings()}
            retryLabel="Open settings"
          />
        ) : null}
        {recorder.permission === 'denied' ? (
          <Banner
            tone="info"
            message="CellarLog needs the microphone to record notes. Tap record and choose Allow, or type your note below."
          />
        ) : null}
        {recorder.error ? <Banner message={recorder.error} /> : null}

        {parseError ? (
          <View style={styles.errorBox}>
            <Banner
              message={
                failedInput?.kind === 'audio'
                  ? `${parseError} Your recording is kept.`
                  : parseError
              }
              onRetry={failedInput ? () => void runParse(failedInput) : undefined}
            />
            <Button variant="secondary" title="Fill in yourself" onPress={fillInManually} />
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <AppText muted>or type it</AppText>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <TextField
          label="Note"
          value={text}
          onChangeText={setText}
          placeholder={EXAMPLE}
          multiline
          textAlignVertical="top"
          editable={!busy}
          style={styles.noteInput}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  center: { textAlign: 'center' },
  noteInput: { minHeight: 120, paddingTop: spacing.sm },
  errorBox: { gap: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
