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
import { useUser } from '@/hooks/useSession';
import { useTank, useTanks } from '@/hooks/useTanks';
import { applyEntryChanges, type ShownEntry } from '@/lib/entryOverlay';
import { fermentsCache } from '@/lib/cache';
import { AppError, errorMessage } from '@/lib/errors';
import { activeFerment } from '@/lib/fermentCurves';
import { createFerment, updateFerment, type Ferment } from '@/lib/ferments';
import { describeWine, partsOf } from '@/lib/blend';
import { formatFill } from '@/lib/format';
import { parseNumber } from '@/lib/numbers';
import type { ShownTank } from '@/lib/tankOverlay';
import {
  NEW_TANK,
  carriedFerment,
  contentBefore,
  entriesToCarry,
  fermentFits,
  fermentToCarry,
  isEmptyLeft,
  litersLeft,
  planTransfer,
  receive,
  sendOut,
  type TransferErrors,
  type TransferPlan,
} from '@/lib/transfer';
import { VESSEL_KINDS, type VesselKind } from '@/lib/vesselKinds';
import { fonts, spacing, useTheme } from '@/theme';

type Step = 'vessel' | 'entries' | 'carry' | 'more';

/**
 * Wine moves from this vessel to another (an existing one, or a new one that is
 * created on the spot): a transfer entry in each, and the wine in each vessel
 * updated. The receiving vessel can take the grape and vintage; the source keeps
 * its own unless it is now empty, and then it can be deleted or kept empty.
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
  const { id: userId } = useUser();
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
  // The wine's own history (analyses, additions, notes) can follow it into the receiving vessel.
  const carried = entriesToCarry(timeline, fermentList);
  const [carryAnswer, setCarryAnswer] = useState<boolean | null>(null);
  const [emptyAction, setEmptyAction] = useState<'delete' | 'keep'>('delete');
  const deleting = markEmpty && emptyAction === 'delete';
  const [errors, setErrors] = useState<TransferErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  // Kept across retries, so a second tap never creates the vessel or records an entry twice.
  const done = useRef<{ tankId: string | null; tankQueued: boolean; source: boolean; destination: boolean; carried: Set<number> }>({
    tankId: null,
    tankQueued: false,
    source: false,
    destination: false,
    carried: new Set(),
  });

  const existingDestination = others.find((candidate) => candidate.id === destinationId);
  // A new or empty vessel gets the history by default; one that already holds other wine only if asked.
  const receiverHoldsWine = existingDestination !== undefined && contentBefore(existingDestination) !== 0;
  // Wine going into a vessel that already holds wine is a blend; the user sees what it will read.
  const receiverHasWine = existingDestination !== undefined && partsOf(existingDestination).length > 0;
  const resultText = !giveContents
    ? null
    : existingDestination
      ? describeWine(receive(source, existingDestination, moving, true) ?? existingDestination)
      : describeWine(source);
  const carry = (carryAnswer ?? !receiverHoldsWine) && carried.length > 0;
  // The ferment goes with the history, so the receiving vessel's chart continues.
  const fermentCopy = carry ? fermentToCarry(fermentList, timeline) : null;

  const yesNo = [
    { value: 'yes', label: t.transfer.yes },
    { value: 'no', label: t.transfer.no },
  ] as const;

  function changeVolume(text: string) {
    setVolume(text);
    if (!newVolumeTyped.current) setNewVolume(text);
  }

  function handleSave() {
    setError(null);
    const result = planTransfer(source, all, { destinationId, volume, note, newName, newKind, newVolume }, giveContents);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (!deleting) return save(result.plan);
    // Deleting the emptied vessel also deletes its entries: ask first, saying how many.
    const queued = outbox.items.filter((item) => item.kind === 'entry' && item.tankId === source.id).length;
    dialog(t.transfer.deleteTitle(source.name), t.transfer.deleteText(String(timeline.length + queued)), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.transfer.deleteConfirm, style: 'destructive', onPress: () => void save(result.plan) },
    ]);
  }

  async function save(plan: TransferPlan) {
    setSaving(true);
    let destinationTankId = destinationId ?? '';
    try {
      // A new vessel is created first (it works offline: it queues), then both entries.
      if (plan.newTank) {
        setStep('vessel');
        if (done.current.tankId === null) {
          const created = await outbox.createTank(plan.newTank);
          done.current.tankId = created.id;
          done.current.tankQueued = created.result === 'queued';
        }
        destinationTankId = done.current.tankId;
      }
      setStep('entries');
      // A vessel that is about to be deleted keeps no record: its entries go with it.
      if (!deleting && !done.current.source) {
        await outbox.saveEntry(plan.sourceEntry);
        done.current.source = true;
      }
      if (!done.current.destination) {
        await outbox.saveEntry({ ...plan.destinationEntry, tankId: destinationTankId });
        done.current.destination = true;
      }
      if (carry) {
        setStep('carry');
        // Same time stamps as the originals; saved at the same time, each marked done so a retry doesn't copy twice.
        const results = await Promise.allSettled(
          carried.map(async (entry, index) => {
            if (done.current.carried.has(index)) return;
            await outbox.saveEntry(
              { tankId: destinationTankId, type: entry.type, rawText: entry.rawText, parsed: entry.parsed },
              { createdAt: entry.createdAt },
            );
            done.current.carried.add(index);
          }),
        );
        const failed = results.find((outcome) => outcome.status === 'rejected');
        if (failed && failed.status === 'rejected') throw failed.reason;
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
    if (endFerment && running && !deleting) {
      tasks.push(updateFerment(running.id, { name: running.name, startedAt: running.startedAt, endedAt: new Date().toISOString() }));
    }
    if (fermentCopy) {
      const copy = carriedFerment(fermentCopy, endFerment);
      tasks.push(
        (async () => {
          // A vessel still waiting to be created has no server id yet, so the ferment can't be added to it.
          const there = fermentsCache(userId, destinationTankId).read()?.data ?? [];
          if (done.current.tankQueued || !fermentFits(there, copy)) {
            throw new AppError('validation', t.transfer.fermentNotCopied);
          }
          await createFerment(destinationTankId, copy);
        })(),
      );
    }
    const existing = all.find((candidate) => candidate.id === destinationId);
    if (existing) {
      const received = receive(source, existing, plan.volumeLiters, giveContents);
      if (received) tasks.push(outbox.updateTank(existing.id, received));
    }
    // The source keeps its grape and vintage unless it is now empty; then it is deleted or emptied.
    if (deleting) tasks.push(outbox.deleteTank(source.id));
    else {
      const left = sendOut(source, plan.volumeLiters, markEmpty);
      if (left) tasks.push(outbox.updateTank(source.id, left));
    }

    const settled = await Promise.allSettled(tasks);
    const problems = settled.flatMap((outcome) => (outcome.status === 'rejected' ? [errorMessage(outcome.reason)] : []));
    // The deleted vessel's own screen is gone, so go back to the list; otherwise back to the vessel.
    const leave = () => (deleting ? router.dismissTo('/') : router.back()); // the screens refetch on focus
    if (problems.length > 0) {
      dialog(t.transfer.title, t.transfer.partialFailed([...new Set(problems)].join(' ')), [
        { text: 'OK', onPress: leave },
      ]);
    } else {
      leave();
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
                {t.transfer.steps[step]}
              </AppText>
            ) : null}
          </View>
        }
      >
        <OfflineBanner message={t.transfer.offlineNote} />
        <AppText muted variant="caption">
          {t.transfer.inside(source.name, formatFill(source.contentLiters, source.volumeLiters))}
        </AppText>
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

        {existingDestination ? (
          <AppText muted variant="caption">
            {t.transfer.inside(
              existingDestination.name,
              formatFill(existingDestination.contentLiters, existingDestination.volumeLiters),
            )}
          </AppText>
        ) : null}

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
        {carried.length > 0 && destinationId !== null ? (
          <>
            <ChoiceChips
              label={t.transfer.carry}
              choices={yesNo}
              selected={carry ? 'yes' : 'no'}
              onSelect={(value) => setCarryAnswer(value === 'yes')}
              disabled={saving}
            />
            <AppText muted variant="caption">
              {receiverHoldsWine && carryAnswer === null
                ? t.transfer.carryHintMixed(existingDestination?.name ?? '')
                : t.transfer.carryHint(carried.length, existingDestination?.name ?? (newName.trim() || t.transfer.newTank))}
            </AppText>
            {fermentCopy ? (
              <AppText muted variant="caption">
                {t.transfer.carryFermentHint(fermentCopy.name)}
              </AppText>
            ) : null}
          </>
        ) : null}
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
              label={receiverHasWine && existingDestination ? t.transfer.blend(existingDestination.name) : t.transfer.giveGrape}
              choices={yesNo}
              selected={giveContents ? 'yes' : 'no'}
              onSelect={(value) => setGiveContents(value === 'yes')}
              disabled={saving}
            />
            <AppText muted variant="caption">
              {receiverHasWine ? t.transfer.blendHint : t.transfer.giveGrapeHint(source.name)}
            </AppText>
            {resultText ? (
              <AppText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>
                {t.transfer.result(resultText)}
              </AppText>
            ) : null}
          </>
        ) : null}
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
        {markEmpty ? (
          <ChoiceChips
            label={t.transfer.emptyAction}
            choices={[
              { value: 'delete', label: t.transfer.deleteVessel },
              { value: 'keep', label: t.transfer.keepVessel },
            ]}
            selected={emptyAction}
            onSelect={setEmptyAction}
            disabled={saving}
          />
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
