import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';

import { AnalysisFormView } from '@/components/AnalysisFormView';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { EntryReview } from '@/components/EntryReview';
import { HeaderTabs } from '@/components/HeaderTabs';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RecordButton } from '@/components/RecordButton';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useLanguage } from '@/hooks/useLanguage';
import { MAX_LISTEN_MS, useSpeechToText } from '@/hooks/useSpeechToText';
import { useOutbox } from '@/hooks/useOutbox';
import { useTanks } from '@/hooks/useTanks';
import {
  emptyAnalysisForm,
  validateAnalysisForm,
  type AnalysisErrors,
  type AnalysisForm,
} from '@/lib/analysisForm';
import {
  draftFromParse,
  manualDraft,
  validateDraft,
  type DraftErrors,
  type EntryDraft,
  type ValidEntry,
} from '@/lib/entryDraft';
import { AppError, errorMessage } from '@/lib/errors';
import { parseNote } from '@/lib/parser';
import { fonts, spacing, useTheme } from '@/theme';

type Review = {
  draft: EntryDraft;
  errors: DraftErrors;
  saveError: string | null;
  saving: boolean;
};

type Tab = 'note' | 'analysis';

type AnalysisState = {
  form: AnalysisForm;
  errors: AnalysisErrors;
  saveError: string | null;
  saving: boolean;
};

export default function NewEntryScreen() {
  const { tankId, decision } = useLocalSearchParams<{ tankId?: string; decision?: string }>();
  const startTankId = tankId ?? null;
  const tanks = useTanks();
  const outbox = useOutbox();
  const { colors } = useTheme();
  const { lang, t } = useLanguage();

  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  // From an alert's "Record my decision": straight to the form, with the decision type chosen.
  const [review, setReview] = useState<Review | null>(() =>
    decision === '1'
      ? { draft: { ...manualDraft('', startTankId), type: 'decision' }, errors: {}, saveError: null, saving: false }
      : null,
  );
  const [tab, setTab] = useState<Tab>('note');
  const [analysis, setAnalysis] = useState<AnalysisState>(() => ({
    form: emptyAnalysisForm(startTankId),
    errors: {},
    saveError: null,
    saving: false,
  }));

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
          message={tanks.error ?? t.messages.loadTanksFailed}
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
        <AppText variant="title">{t.newEntry.createTankFirst}</AppText>
        <AppText muted>{t.newEntry.createTankFirstText}</AppText>
        <Button title={t.newEntry.newTankButton} onPress={() => router.replace('/tanks/new')} />
      </Screen>
    );
  }
  const startTank = tankList.find((tank) => tank.id === startTankId);

  function fillInManually() {
    setParseError(null);
    setReview({ draft: manualDraft(text, startTankId), errors: {}, saveError: null, saving: false });
  }

  // Online it's saved straight away; offline it's kept on the phone and
  // shows on the timeline as "waiting to upload" (either way we go back).
  async function saveAndLeave(entry: ValidEntry) {
    await outbox.saveEntry(entry);
    if (entry.tankId === startTankId) {
      router.back(); // the tank screen refetches its timeline on focus
    } else {
      router.replace({ pathname: '/tanks/[id]', params: { id: entry.tankId } });
    }
  }

  async function handleSave(current: Review) {
    const result = validateDraft(current.draft, tankList);
    if (!result.ok) {
      setReview({ ...current, errors: result.errors, saveError: null });
      return;
    }
    setReview({ ...current, errors: {}, saveError: null, saving: true });
    try {
      await saveAndLeave(result.entry);
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

  async function handleSaveAnalysis(current: AnalysisState) {
    const result = validateAnalysisForm(current.form, tankList);
    if (!result.ok) {
      setAnalysis({ ...current, errors: result.errors, saveError: null });
      return;
    }
    setAnalysis({ ...current, errors: {}, saveError: null, saving: true });
    try {
      await saveAndLeave(result.entry);
    } catch (err) {
      const tankError = err instanceof AppError && err.field === 'tank';
      setAnalysis({
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
          hero={<HeroBand title={t.newEntry.checkAndSave} />}
          footer={
            <View style={styles.footer}>
              <Button title={t.newEntry.saveEntry} icon="check" onPress={() => handleSave(review)} loading={review.saving} />
              <Button
                variant="secondary"
                title={t.newEntry.backToNote}
                onPress={() => setReview(null)}
                disabled={review.saving}
              />
            </View>
          }
        >
          <OfflineBanner message={t.newEntry.offlineReview} />
          {review.saveError ? (
            <Banner message={review.saveError} onRetry={() => handleSave(review)} />
          ) : null}
          {hasErrors ? (
            <Banner message={review.errors.form ?? t.common.fixFields} />
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

  // Tabs are locked while listening, so a finished recording always lands on its note.
  const hero = (
    <HeroBand subtitle={startTank ? t.newEntry.forTank(startTank.name) : undefined}>
      <HeaderTabs
        tabs={[
          { value: 'note', label: t.newEntry.tabNote, icon: 'microphone' },
          { value: 'analysis', label: t.newEntry.tabAnalysis, icon: 'flask-outline' },
        ]} selected={tab} onSelect={setTab} disabled={speech.active || analysis.saving} />
    </HeroBand>
  );

  // ---- Analysis tab: one field per value ---------------------------------
  if (tab === 'analysis') {
    const hasErrors =
      analysis.errors.tank ||
      analysis.errors.fields ||
      analysis.errors.extras ||
      analysis.errors.note ||
      analysis.errors.form;
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen
          hero={hero}
          footer={
            <Button
              title={t.newEntry.saveAnalysis}
              icon="check"
              onPress={() => handleSaveAnalysis(analysis)}
              loading={analysis.saving}
            />
          }
        >
          <OfflineBanner message={t.newEntry.offlineAnalysis} />
          {analysis.saveError ? (
            <Banner message={analysis.saveError} onRetry={() => handleSaveAnalysis(analysis)} />
          ) : null}
          {hasErrors ? (
            <Banner message={analysis.errors.form ?? t.common.fixFields} />
          ) : null}
          <AnalysisFormView
            form={analysis.form}
            onChange={(form) => setAnalysis({ ...analysis, form })}
            tanks={tankList}
            errors={analysis.errors}
            disabled={analysis.saving}
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
        hero={hero}
        footer={
          <Button
            variant="secondary"
            title={t.newEntry.reviewNote}
            onPress={() => openReview(text)}
            disabled={text.trim() === '' || speech.active}
          />
        }
      >
        <OfflineBanner message={t.newEntry.offlineRecord} />
        {/* Voice and typed notes are understood in English only; Georgian users get a pointer to the Analysis tab. */}
        {lang === 'ka' && t.newEntry.speakLanguage ? <Banner tone="info" message={t.newEntry.speakLanguage} /> : null}

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
            // In the browser there's no speech module: voice lives in the Android app.
            message={Platform.OS === 'web' ? t.newEntry.voiceInApp : t.newEntry.voiceNeedsBuild}
          />
        )}

        {speech.permission === 'blocked' ? (
          <Banner
            message={t.newEntry.micBlocked}
            onRetry={() => void Linking.openSettings()}
            retryLabel={t.newEntry.openSettings}
          />
        ) : null}
        {speech.permission === 'denied' ? (
          <Banner
            tone="info"
            message={t.newEntry.micDenied}
          />
        ) : null}
        {speech.error && speech.permission !== 'blocked' ? <Banner message={speech.error.message} /> : null}

        {showDownload ? (
          <View style={styles.downloadBox}>
            <AppText muted variant="caption">
              {speech.downloadNote ??
                t.newEntry.downloadText}
            </AppText>
            {speech.downloadNote === null ? (
              <Button
                variant="secondary"
                title={t.newEntry.downloadEnglish}
                onPress={() => void speech.downloadOffline()}
              />
            ) : null}
          </View>
        ) : null}

        {parseError ? (
          <View style={styles.errorBox}>
            <Banner message={parseError} />
            <Button variant="secondary" title={t.newEntry.fillInYourself} onPress={fillInManually} />
          </View>
        ) : null}

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <AppText muted>{speech.active ? t.newEntry.whatIHeard : t.newEntry.orTypeIt}</AppText>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <TextField
          label={t.newEntry.note}
          value={speech.active ? speech.transcript : text}
          onChangeText={setText}
          placeholder={speech.active ? t.newEntry.listening : t.newEntry.example}
          multiline
          textAlignVertical="top"
          editable={!speech.active}
          // While listening, what was heard shows large in the serif, like a handwritten log.
          style={speech.active ? [styles.noteInput, styles.heard] : styles.noteInput}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  noteInput: { minHeight: 120, paddingTop: spacing.sm },
  heard: { minHeight: 150, fontFamily: fonts.quote, fontSize: 25, lineHeight: 32 },
  errorBox: { gap: spacing.sm },
  downloadBox: { gap: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
