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
import { MAX_LISTEN_MS, useSpeechToText } from '@/hooks/useSpeechToText';
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  function openReview(note: string) {
    const tankList = tanks.data ?? [];
    setParseError(null);
    try {
      const result = parseNote(note, { tankNames: tankList.map((tank) => tank.name) });
      setReview({
        draft: draftFromParse(result, tankList, startTankId),
        errors: {},
        saveError: null,
        saving: false,
      });
    } catch (err) {
      setParseError(errorMessage(err));
    }
  }

  // Speaking fills the note; when you stop, it goes straight to review (one less tap with gloves).
  const speech = useSpeechToText({
    vocabulary: (tanks.data ?? []).map((tank) => tank.name),
    onFinished: (transcript) => {
      setText(transcript);
      openReview(transcript);
    },
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

  // ---- Input step: speak or type ----------------------------------------
  const showDownload =
    Platform.OS === 'android' &&
    speech.available &&
    (speech.error?.offerOfflineDownload === true || speech.offlineReady === false);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            title="Review note"
            onPress={() => openReview(text)}
            disabled={text.trim() === '' || speech.active}
          />
        }
      >
        <OfflineBanner message="You're offline. You can still record and review; saving needs internet." />
        {startTank ? <AppText muted>For {startTank.name}</AppText> : null}

        {speech.available ? (
          <RecordButton
            listening={speech.listening}
            busy={speech.active}
            elapsedMs={speech.elapsedMs}
            maxMs={MAX_LISTEN_MS}
            onPress={speech.listening ? speech.stop : () => void speech.start()}
          />
        ) : (
          <Banner
            tone="info"
            message="Voice notes need the CellarLog app build. Expo Go doesn't include speech recognition. You can type your note below."
          />
        )}

        {speech.permission === 'blocked' ? (
          <Banner
            message="Microphone access is turned off for CellarLog. Turn it on in Settings, or type your note below."
            onRetry={() => void Linking.openSettings()}
            retryLabel="Open settings"
          />
        ) : null}
        {speech.permission === 'denied' ? (
          <Banner
            tone="info"
            message="CellarLog needs the microphone to hear your notes. Tap the button and choose Allow, or type below."
          />
        ) : null}
        {speech.error && speech.permission !== 'blocked' ? <Banner message={speech.error.message} /> : null}

        {showDownload ? (
          <View style={styles.downloadBox}>
            <AppText muted variant="caption">
              {speech.downloadNote ??
                'Voice uses the internet right now. Download English once (on Wi-Fi) to speak notes in the cellar without signal.'}
            </AppText>
            {speech.downloadNote === null ? (
              <Button
                variant="secondary"
                title="Download English for offline"
                onPress={() => void speech.downloadOffline()}
              />
            ) : null}
          </View>
        ) : null}

        {parseError ? (
          <View style={styles.errorBox}>
            <Banner message={parseError} />
            <Button variant="secondary" title="Fill in yourself" onPress={fillInManually} />
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <AppText muted>{speech.active ? 'what I heard' : 'or type it'}</AppText>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <TextField
          label="Note"
          value={speech.active ? speech.transcript : text}
          onChangeText={setText}
          placeholder={speech.active ? 'Listening…' : EXAMPLE}
          multiline
          textAlignVertical="top"
          editable={!speech.active}
          style={styles.noteInput}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  noteInput: { minHeight: 120, paddingTop: spacing.sm },
  errorBox: { gap: spacing.sm },
  downloadBox: { gap: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
