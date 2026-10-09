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
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank, useTanks } from '@/hooks/useTanks';
import { TIMELINE_LIMIT } from '@/lib/entries';
import { AppError, errorMessage } from '@/lib/errors';
import { strings } from '@/lib/i18n';
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
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(input: TankInput) {
    const duplicate = findDuplicateName(input.name, tanks.data ?? [], id);
    if (duplicate) {
      throw new AppError('validation', strings().messages.duplicateTank(duplicate.name), {
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
    if (!entries.data) return queued > 0 ? t.editTank.entryCountAtLeast(queued) : null;
    const saved = entries.data.length;
    const total = saved + queued;
    if (saved >= TIMELINE_LIMIT) return t.editTank.entryCountMany(TIMELINE_LIMIT);
    return t.editTank.entryCount(total);
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
    const noEntries = count === t.editTank.entryCount(0);
    const firstMessage = noEntries ? t.editTank.noEntries : t.editTank.withEntries(count);
    Alert.alert(t.editTank.confirmTitle(name), firstMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.editTank.deleteEllipsis,
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            t.editTank.sureTitle,
            noEntries ? t.editTank.willBeDeleted(name) : t.editTank.willBeDeletedWith(name, count),
            [
              { text: t.common.cancel, style: 'cancel' },
              { text: t.editTank.deleteButton, style: 'destructive', onPress: () => void deleteNow() },
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
          message={tank.error ?? t.messages.loadTankFailed}
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
      submitLabel={t.common.saveChanges}
      onSubmit={handleSubmit}
      offlineMessage={t.tankForm.offlineEdit}
      footerExtra={
        <View style={[styles.danger, { borderColor: colors.danger }]}>
          <AppText variant="label" style={{ color: colors.danger }}>
            {t.editTank.dangerTitle}
          </AppText>
          <AppText muted variant="caption">
            {t.editTank.dangerText(name)}
          </AppText>
          {deleteError ? <Banner message={deleteError} /> : null}
          <Button
            variant="danger"
            title={t.editTank.deleteButton}
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
