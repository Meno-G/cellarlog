import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDialog } from '@/hooks/useDialog';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank, useTanks } from '@/hooks/useTanks';
import { applyEntryChanges, type ShownEntry } from '@/lib/entryOverlay';
import { errorMessage } from '@/lib/errors';
import { activeFerment } from '@/lib/fermentCurves';
import { updateFerment, type Ferment } from '@/lib/ferments';
import { parseNumber } from '@/lib/numbers';
import type { ShownTank } from '@/lib/tankOverlay';
import {
  NEW_TANK,
  emptied,
  giveGrape,
  isEmptyLeft,
  litersLeft,
  planTransfer,
  type TransferErrors,
} from '@/lib/transfer';
import { VESSEL_KINDS, type VesselKind } from '@/lib/vesselKinds';
import { fonts, spacing, useTheme } from '@/theme';

type Step = 'vessel' | 'entries' | 'more';

/**
 * Wine moves from this vessel to another (an existing one, or a new one that is
 * created on the spot): a transfer entry in each. The receiving vessel can take
 * the grape and vintage; the source keeps its own unless it is now empty.
 */
export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const tanks = useTanks();
  const ferments = useFerments(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const t = useT();
  const hero = <HeroBand title={t.transfer.title} subtitle={tank.data ? t.transfer.from(tank.data.name) : undefined} />;

  if (tank.loading || tanks.loading || ferments.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState />
      </Screen>
    );
  }
  if (!tank.data || !tanks.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState
          message={tank.error ?? tanks.error ?? t.messages.loadTanksFailed}
          onRetry={() => {
            tank.refresh();
            tanks.refresh();
          }}
          retrying={tank.refreshing || tanks.refreshing}
        />
      </Screen>
    );
  }

  const fermentList = ferments.data ?? [];
  return (
    <TransferEditor
      source={tank.data}
      all={tanks.data}
      fermentList={fermentList}
      running={activeFerment(fermentList)}
      // Includes entries still waiting to upload, so wine moved a moment ago counts.
      timeline={applyEntryChanges(entries.data ?? [], outbox.items, id)}
      hero={hero}
    />
  );
}

function TransferEditor({
  source,
  all,
  fermentList,
  running,
  timeline,
  hero,
}: {
  source: ShownTank;
  all: ShownTank[];
  fermentList: Ferment[];
  running: Ferment | undefined;
  timeline: ShownEntry[];
  hero: ReactNode;
}) {
  const t = useT();
  const { colors } = useTheme();
  const dialog = useDialog();
  const outbox = useOutbox();
  const others = all.filter((candidate) => candidate.id !== source.id);
  // With no other vessel yet, the only choice is a new one.
  const [destinationId, setDestinationId] = useState<string | null>(others.length === 0 ? NEW_TANK : null);
  const [volume, setVolume] = useState('');
  const [note, setNote] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<VesselKind>('tank');
  const [newVolume, setNewVolume] = useState('');
  // The new vessel's volume follows the liters moved until it has been typed in by hand.
  const newVolumeTyped = useRef(false);
  // Usually the wine is done fermenting when it moves.
  const [endFerment, setEndFerment] = useState(true);
  const hasContents = source.variety !== null || source.vintage !== null;
  const [giveContents, setGiveContents] = useState(hasContents);
  // "Is the source empty?" starts from what the recorded volumes say, until the user answers.
  const moving = (() => {
    const parsed = parseNumber(volume);
    return parsed === null || Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  })();
  const left = litersLeft(source, timeline, fermentList, moving);
  const suggestedEmpty = isEmptyLeft(left);
  const [emptyAnswer, setEmptyAnswer] = useState<boolean | null>(null);
  const markEmpty = emptyAnswer ?? suggestedEmpty;
  const [errors, setErrors] = useState<TransferErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  // Kept across retries, so a second tap never creates the vessel or records an entry twice.
  const done = useRef<{ tankId: string | null; source: boolean; destination: boolean }>({
    tankId: null,
    source: false,
    destination: false,
  });

  const yesNo = [
    { value: 'yes', label: t.transfer.yes },
    { value: 'no', label: t.transfer.no },
  ] as const;

  function changeVolume(text: string) {
    setVolume(text);
    if (!newVolumeTyped.current) setNewVolume(text);
  }

  async function handleSave() {
    setError(null);
    const result = planTransfer(source, all, { destinationId, volume, note, newName, newKind, newVolume }, giveContents);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // A new vessel is created first (it works offline: it queues), then both entries.
      let destinationTankId = result.destination.id;
      if (result.plan.newTank) {
        setStep('vessel');
        if (done.current.tankId === null) done.current.tankId = (await outbox.createTank(result.plan.newTank)).id;
        destinationTankId = done.current.tankId;
      }
      setStep('entries');
      if (!done.current.source) {
        await outbox.saveEntry(result.plan.sourceEntry);
        done.current.source = true;
      }
      if (!done.current.destination) {
        await outbox.saveEntry({ ...result.plan.destinationEntry, tankId: destinationTankId });
        done.current.destination = true;
      }
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
      setStep(null);
      return;
    }

    // The rest doesn't depend on each other, so it runs at the same time: one slow request holds up only itself.
    setStep('more');
    const tasks: Promise<unknown>[] = [];
    if (endFerment && running) {
      tasks.push(updateFerment(running.id, { name: running.name, startedAt: running.startedAt, endedAt: new Date().toISOString() }));
    }
    const existing = all.find((candidate) => candidate.id === destinationId);
    if (giveContents && existing) {
      const grape = giveGrape(source, existing);
      if (grape) tasks.push(outbox.updateTank(existing.id, grape));
    }
    // The source keeps its grape and vintage unless it is now empty.
    const empty = markEmpty ? emptied(source) : null;
    if (empty) tasks.push(outbox.updateTank(source.id, empty));

    const settled = await Promise.allSettled(tasks);
    const problems = settled.flatMap((outcome) => (outcome.status === 'rejected' ? [errorMessage(outcome.reason)] : []));
    if (problems.length > 0) {
      dialog(t.transfer.title, t.transfer.partialFailed([...new Set(problems)].join(' ')), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      router.back(); // the screens refetch on focus
    }
    setSaving(false);
    setStep(null);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        hero={hero}
        footer={
          <View style={styles.footer}>
            <Button title={t.transfer.save} icon="check" onPress={handleSave} loading={saving} />
            {step ? (
              <AppText muted variant="caption" style={styles.step}>
                {t.transfer.steps[step === 'vessel' ? 'vessel' : step === 'entries' ? 'entries' : 'more']}
              </AppText>
            ) : null}
          </View>
        }
      >
        <OfflineBanner message={t.transfer.offlineNote} />
        {error ? <Banner message={error} onRetry={handleSave} /> : null}

        <ChoiceChips
          label={t.transfer.to}
          choices={[
            ...others.map((candidate) => ({ value: candidate.id, label: candidate.name })),
            { value: NEW_TANK, label: t.transfer.newTank },
          ]}
          selected={destinationId}
          onSelect={setDestinationId}
          error={errors.destination}
          disabled={saving}
        />

        {destinationId === NEW_TANK ? (
          <>
            <AppText muted variant="caption">
              {t.transfer.newHint}
            </AppText>
            <TextField
              label={t.transfer.newName}
              value={newName}
              onChangeText={setNewName}
              error={errors.newName}
              placeholder={t.tankForm.namePlaceholder}
              autoCapitalize="words"
              editable={!saving}
            />
            <ChoiceChips
              label={t.tankForm.kind}
              choices={VESSEL_KINDS.map((kind) => ({ value: kind, label: t.vesselKinds[kind] }))}
              selected={newKind}
              onSelect={setNewKind}
              disabled={saving}
            />
            <TextField
              label={t.transfer.newVolume}
              value={newVolume}
              onChangeText={(text) => {
                newVolumeTyped.current = true;
                setNewVolume(text);
              }}
              error={errors.newVolume}
              keyboardType="decimal-pad"
              placeholder="5000"
              editable={!saving}
            />
          </>
        ) : null}

        <TextField
          label={t.transfer.volume}
          value={volume}
          onChangeText={changeVolume}
          error={errors.volume}
          keyboardType="decimal-pad"
          placeholder="2000"
          editable={!saving}
        />
        <TextField
          label={t.common.noteOptional}
          value={note}
          onChangeText={setNote}
          error={errors.note}
          multiline
          textAlignVertical="top"
          style={styles.note}
          editable={!saving}
        />

        {running ? (
          <ChoiceChips
            label={t.transfer.endFerment(running.name)}
            choices={yesNo}
            selected={endFerment ? 'yes' : 'no'}
            onSelect={(value) => setEndFerment(value === 'yes')}
            disabled={saving}
          />
        ) : null}
        {hasContents ? (
          <>
            <ChoiceChips
              label={t.transfer.giveGrape}
              choices={yesNo}
              selected={giveContents ? 'yes' : 'no'}
              onSelect={(value) => setGiveContents(value === 'yes')}
              disabled={saving}
            />
            <AppText muted variant="caption">
              {t.transfer.giveGrapeHint(source.name)}
            </AppText>
            <ChoiceChips
              label={t.transfer.emptyQuestion(source.name)}
              choices={yesNo}
              selected={markEmpty ? 'yes' : 'no'}
              onSelect={(value) => setEmptyAnswer(value === 'yes')}
              disabled={saving}
            />
            <AppText
              muted={!suggestedEmpty}
              variant="caption"
              style={suggestedEmpty ? { color: colors.primary, fontFamily: fonts.bodySemi } : undefined}
            >
              {suggestedEmpty && left !== null ? t.transfer.emptyHintYes(Math.max(0, left)) : t.transfer.emptyHintNo}
            </AppText>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.xs },
  step: { textAlign: 'center' },
  note: { minHeight: 96, paddingTop: spacing.sm },
});
