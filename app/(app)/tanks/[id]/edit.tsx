import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankForm } from '@/components/TankForm';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank, useTanks } from '@/hooks/useTanks';
import { AppError } from '@/lib/errors';
import { tankToForm } from '@/lib/tankForm';
import { findDuplicateName } from '@/lib/tankOverlay';
import type { TankInput } from '@/lib/tanks';

export default function EditTankScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const tanks = useTanks();
  const outbox = useOutbox();

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

  return (
    <TankForm
      // Re-initialise the form if a different tank is loaded.
      key={tank.data.id}
      initialValues={tankToForm(tank.data)}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
      offlineMessage="You're offline. Your changes are saved on this phone and upload when you're back online."
    />
  );
}
