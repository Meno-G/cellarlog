import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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
import { moveGrape, planTransfer, type TransferErrors } from '@/lib/transfer';
import { spacing } from '@/theme';

/**
 * Wine moves from this vessel to another: a transfer entry in each, and
 * optionally the running ferment ends and the grape and vintage move too.
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

  const others = tanks.data.filter((candidate) => candidate.id !== id);
  return (
    <TransferEditor
      source={tank.data}
      others={others}
      running={activeFerment(ferments.data ?? [])}
      hero={hero}
    />
  );
}

function TransferEditor({
  source,
  others,
  running,
  hero,
}: {
  source: ShownTank;
  others: ShownTank[];
  running: Ferment | undefined;
  hero: React.ReactNode;
}) {
  const t = useT();
  const dialog = useDialog();
  const outbox = useOutbox();
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [volume, setVolume] = useState('');
  const [note, setNote] = useState('');
  // Usually the wine is done fermenting when it moves, and the grape goes with it.
  const [endFerment, setEndFerment] = useState(true);
  const [moveContents, setMoveContents] = useState(source.variety !== null || source.vintage !== null);
  const [errors, setErrors] = useState<TransferErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Kept across retries, so a second tap never records the same entry twice.
  const saved = useRef({ source: false, destination: false });

  const yesNo = [
    { value: 'yes', label: t.transfer.yes },
    { value: 'no', label: t.transfer.no },
  ] as const;

  async function handleSave() {
    setError(null);
    const result = planTransfer(source, [source, ...others], { destinationId, volume, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // The entries work offline (they queue); the steps below are tried afterwards.
      if (!saved.current.source) {
        await outbox.saveEntry(result.plan.sourceEntry);
        saved.current.source = true;
      }
      if (!saved.current.destination) {
        await outbox.saveEntry(result.plan.destinationEntry);
        saved.current.destination = true;
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
    const grape = moveContents ? moveGrape(source, result.destination) : null;
    if (grape) {
      try {
        // Both queue offline like any tank edit.
        await outbox.updateTank(result.destination.id, grape.destination);
        await outbox.updateTank(source.id, grape.source);
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

  if (others.length === 0) {
    return (
      <Screen hero={hero}>
        <Banner tone="info" message={t.transfer.noOtherTanks} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen hero={hero} footer={<Button title={t.transfer.save} icon="check" onPress={handleSave} loading={saving} />}>
        <OfflineBanner message={t.transfer.offlineNote} />
        {error ? <Banner message={error} onRetry={handleSave} /> : null}

        <ChoiceChips
          label={t.transfer.to}
          choices={others.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          selected={destinationId}
          onSelect={setDestinationId}
          error={errors.destination}
          disabled={saving}
        />
        <TextField
          label={t.transfer.volume}
          value={volume}
          onChangeText={setVolume}
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
        {source.variety !== null || source.vintage !== null ? (
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
