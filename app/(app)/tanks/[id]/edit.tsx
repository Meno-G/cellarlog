import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankForm } from '@/components/TankForm';
import { useEntries } from '@/hooks/useEntries';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank, useTanks } from '@/hooks/useTanks';
import { TIMELINE_LIMIT } from '@/lib/entries';
import { AppError, errorMessage } from '@/lib/errors';
import { tankToForm } from '@/lib/tankForm';
import { findDuplicateName } from '@/lib/tankOverlay';
import type { TankInput } from '@/lib/tanks';
import { radius, spacing, useTheme } from '@/theme';

export default function EditTankScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const tanks = useTanks();
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(input: TankInput) {
    const duplicate = findDuplicateName(input.name, tanks.data ?? [], id);
    if (duplicate) {
      throw new AppError('validation', `You already have a tank called "${duplicate.name}".`, {
        field: 'name',
      });
    }
    // Online it's saved now; offline (or for a tank not uploaded yet) it waits on this phone.
    await outbox.updateTank(id, input);
    router.back();
  }

  /** "14 entries", "200+ entries", or null when the timeline couldn't be loaded. */
  function entryCountText(): string | null {
    const queued = outbox.items.filter((item) => item.kind === 'entry' && item.tankId === id).length;
    if (!entries.data) return queued > 0 ? `at least ${queued} entries` : null;
    const saved = entries.data.length;
    const total = saved + queued;
    if (saved >= TIMELINE_LIMIT) return `${TIMELINE_LIMIT}+ entries`;
    return total === 1 ? '1 entry' : `${total} entries`;
  }

  async function deleteNow() {
    setDeleteError(null);
    setDeleting(true);
    try {
      // Online it's deleted now; offline it disappears at once and the deletion uploads later.
      await outbox.deleteTank(id);
      router.dismissTo('/');
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  }

  function confirmDelete(name: string) {
    const count = entryCountText();
    const noEntries = count === '0 entries';
    const firstMessage = noEntries
      ? "It has no entries. This can't be undone."
      : `This also deletes ${count ? `its ${count}` : 'all of its entries'}: additions, lab analyses, tastings and notes. This can't be undone.`;
    Alert.alert(`Delete ${name}?`, firstMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete…',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Are you sure?',
            noEntries ? `${name} will be deleted.` : `${name} and ${count ?? 'all its entries'} will be deleted for good.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete tank', style: 'destructive', onPress: () => void deleteNow() },
            ],
          ),
      },
    ]);
  }

  if (tank.loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }

  if (!tank.data) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={tank.error ?? 'Could not load this tank.'}
          onRetry={tank.refresh}
          retrying={tank.refreshing}
        />
      </Screen>
    );
  }

  const name = tank.data.name;

  return (
    <TankForm
      // Re-initialise the form if a different tank is loaded.
      key={tank.data.id}
      initialValues={tankToForm(tank.data)}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
      offlineMessage="You're offline. Your changes are saved on this phone and upload when you're back online."
      footerExtra={
        <View style={[styles.danger, { borderColor: colors.danger }]}>
          <AppText variant="label" style={{ color: colors.danger }}>
            Delete this tank
          </AppText>
          <AppText muted variant="caption">
            Deletes {name} and all of its entries. You&apos;ll be asked to confirm twice.
          </AppText>
          {deleteError ? <Banner message={deleteError} /> : null}
          <Button
            variant="danger"
            title="Delete tank"
            onPress={() => confirmDelete(name)}
            loading={deleting}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  danger: {
    marginTop: spacing.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radius.md,
  },
});
