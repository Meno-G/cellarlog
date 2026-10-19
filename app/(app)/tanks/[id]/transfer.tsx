import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useDialog } from '@/hooks/useDialog';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank, useTanks } from '@/hooks/useTanks';
import { errorMessage } from '@/lib/errors';
import { activeFerment } from '@/lib/fermentCurves';
import { updateFerment, type Ferment } from '@/lib/ferments';
import type { ShownTank } from '@/lib/tankOverlay';
import { VESSEL_KINDS, type VesselKind } from '@/lib/vesselKinds';
import { NEW_TANK, emptied, moveGrape, planTransfer, type TransferErrors } from '@/lib/transfer';
import { spacing } from '@/theme';

/**
 * Wine moves from this vessel to another (an existing one, or a new one that is
 * created on the spot): a transfer entry in each, and optionally the running
 * ferment ends and the grape and vintage move too.
 */
export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const tanks = useTanks();
  const ferments = useFerments(id);
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

  return (
    <TransferEditor
      source={tank.data}
      all={tanks.data}
      running={activeFerment(ferments.data ?? [])}
      hero={hero}
    />
  );
}

function TransferEditor({
  source,
  all,
  running,
  hero,
}: {
  source: ShownTank;
  all: ShownTank[];
  running: Ferment | undefined;
  hero: ReactNode;
}) {
  const t = useT();
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
  // Usually the wine is done fermenting when it moves, and the grape goes with it.
  const [endFerment, setEndFerment] = useState(true);
  const hasContents = source.variety !== null || source.vintage !== null;
  const [moveContents, setMoveContents] = useState(hasContents);
  const [errors, setErrors] = useState<TransferErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    const result = planTransfer(
      source,
      all,
      { destinationId, volume, note, newName, newKind, newVolume },
      moveContents,
    );
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
        if (done.current.tankId === null) done.current.tankId = (await outbox.createTank(result.plan.newTank)).id;
        destinationTankId = done.current.tankId;
      }
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
      return;
    }

    const problems: string[] = [];
    if (endFerment && running) {
      try {
        await updateFerment(running.id, { name: running.name, startedAt: running.startedAt, endedAt: new Date().toISOString() });
      } catch (err) {
        problems.push(errorMessage(err));
      }
    }
    if (moveContents) {
      try {
        // Both queue offline like any tank edit. A new vessel already got the grape when it was created.
        const existing = all.find((candidate) => candidate.id === destinationId);
        if (existing) {
          const moved = moveGrape(source, existing);
          if (moved) {
            await outbox.updateTank(existing.id, moved.destination);
            await outbox.updateTank(source.id, moved.source);
          }
        } else {
          const empty = emptied(source);
          if (empty) await outbox.updateTank(source.id, empty);
        }
      } catch (err) {
        problems.push(errorMessage(err));
      }
    }

    if (problems.length > 0) {
      dialog(t.transfer.title, t.transfer.partialFailed(problems.join(' ')), [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      router.back(); // the screens refetch on focus
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen hero={hero} footer={<Button title={t.transfer.save} icon="check" onPress={handleSave} loading={saving} />}>
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
              label={t.transfer.moveGrape}
              choices={yesNo}
              selected={moveContents ? 'yes' : 'no'}
              onSelect={(value) => setMoveContents(value === 'yes')}
              disabled={saving}
            />
            <AppText muted variant="caption">
              {t.transfer.moveGrapeHint(source.name)}
            </AppText>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { minHeight: 96, paddingTop: spacing.sm },
});
