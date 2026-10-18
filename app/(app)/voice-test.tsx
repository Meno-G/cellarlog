import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { RecordButton } from '@/components/RecordButton';
import { HeroBand, Screen } from '@/components/Screen';
import { useT } from '@/hooks/useLanguage';
import { MAX_LISTEN_MS, useSpeechToText } from '@/hooks/useSpeechToText';
import { errorMessage } from '@/lib/errors';
import { dayString } from '@/lib/fermentForm';
import { shareCsv } from '@/lib/shareFile';
import {
  TEST_PHRASES,
  isGood,
  resultsToCsv,
  scorePhrase,
  summarize,
  verdictOf,
  type PhraseResult,
} from '@/lib/voiceTest';
import { fonts, radius, spacing, useTheme } from '@/theme';

const pct = (share: number) => Math.round(share * 100);

/**
 * Measures whether the phone's Georgian speech recognition is reliable: the
 * winemaker reads 30 cellar sentences and each answer is scored for words and
 * numbers. Nothing is saved or sent.
 */
export default function VoiceTestScreen() {
  const { colors } = useTheme();
  const t = useT();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, PhraseResult>>({});
  const [finished, setFinished] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const speech = useSpeechToText({
    language: 'ka-GE',
    vocabulary: [],
    onFinished: (heard) => setResults((current) => ({ ...current, [index]: scorePhrase(index, heard) })),
  });

  const all = Object.values(results);
  const summary = summarize(all);
  const current = results[index];
  const hero = <HeroBand title={t.voiceTest.title} subtitle={finished ? t.voiceTest.resultTitle : t.voiceTest.sentenceOf(index + 1, TEST_PHRASES.length)} />;

  async function share() {
    setShareError(null);
    try {
      await shareCsv(`cellarlog-georgian-voice-test-${dayString(new Date())}.csv`, resultsToCsv(all), t.voiceTest.title);
    } catch (err) {
      setShareError(errorMessage(err));
    }
  }

  function restart() {
    setResults({});
    setIndex(0);
    setFinished(false);
  }

  if (!speech.available) {
    return (
      <Screen hero={hero}>
        <Banner tone="info" message={Platform.OS === 'web' ? t.newEntry.voiceInApp : t.newEntry.voiceNeedsBuild} />
      </Screen>
    );
  }

  if (finished) {
    const verdict = verdictOf(summary);
    return (
      <Screen
        hero={hero}
        footer={
          <View style={styles.footer}>
            <Button title={t.voiceTest.share} icon="share-variant-outline" onPress={share} disabled={all.length === 0} />
            <Button variant="secondary" title={t.voiceTest.restart} onPress={restart} />
          </View>
        }
      >
        {shareError ? <Banner message={shareError} /> : null}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="title">{t.voiceTest.resultGood(summary.good, summary.done)}</AppText>
          <AppText>{t.voiceTest.resultWords(pct(summary.wordRecall))}</AppText>
          <AppText>{t.voiceTest.resultNumbers(pct(summary.numbersRight))}</AppText>
          <AppText muted>{t.voiceTest.resultDigits(pct(summary.digitsShare))}</AppText>
        </View>
        <Banner tone={verdict === 'reliable' ? 'info' : 'waiting'} message={t.voiceTest.verdict[verdict]} />
      </Screen>
    );
  }

  const phrase = TEST_PHRASES[index];
  const last = index === TEST_PHRASES.length - 1;

  return (
    <Screen
      hero={hero}
      footer={
        <View style={styles.footer}>
          <Button
            title={last ? t.voiceTest.finish : t.voiceTest.next}
            icon={last ? 'check' : 'arrow-right'}
            onPress={() => (last ? setFinished(true) : setIndex(index + 1))}
            disabled={speech.active || !current}
          />
          {all.length >= 5 && !last ? (
            <Button variant="secondary" title={t.voiceTest.finish} onPress={() => setFinished(true)} disabled={speech.active} />
          ) : null}
        </View>
      }
    >
      {all.length === 0 && !speech.active ? <Banner tone="info" message={t.voiceTest.intro} /> : null}

      <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <AppText variant="quote" style={styles.phrase}>
          {phrase?.text}
        </AppText>
      </View>

      <RecordButton
        listening={speech.listening}
        busy={speech.active}
        elapsedMs={speech.elapsedMs}
        maxMs={MAX_LISTEN_MS}
        onPress={speech.listening ? speech.stop : () => void speech.start()}
      />

      {speech.error ? <Banner message={speech.error.message} /> : null}
      {speech.active && speech.transcript ? <AppText muted>{speech.transcript}</AppText> : null}

      {current && !speech.active ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isGood(current) ? colors.primary : colors.warningBorder }]}>
          <AppText style={{ fontFamily: fonts.bodyBold, color: isGood(current) ? colors.primary : colors.warningText }}>
            {isGood(current) ? t.voiceTest.good : t.voiceTest.notGood}
          </AppText>
          <AppText muted variant="caption">
            {t.voiceTest.heard}
          </AppText>
          <AppText>{current.heard || t.voiceTest.nothingHeard}</AppText>
          <AppText>{t.voiceTest.words(pct(current.recall))}</AppText>
          <AppText>{t.voiceTest.numbers(current.numbersRight, current.numbersTotal)}</AppText>
          {current.heard && !current.usedDigits ? <AppText muted>{t.voiceTest.numbersAsWords}</AppText> : null}
          <AppText muted variant="caption">
            {t.voiceTest.retry}
          </AppText>
        </View>
      ) : null}

      {all.length > 0 ? (
        <AppText muted variant="caption" style={styles.progress}>
          {t.voiceTest.progress(summary.done, summary.good)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  card: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  phrase: { fontSize: 26, lineHeight: 36 },
  progress: { textAlign: 'center' },
});
