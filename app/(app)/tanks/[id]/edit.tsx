import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TankForm } from '@/components/TankForm';
import { useTank } from '@/hooks/useTanks';
import { tankToForm } from '@/lib/tankForm';
import { updateTank, type TankInput } from '@/lib/tanks';

export default function EditTankScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);

  async function handleSubmit(input: TankInput) {
    await updateTank(id, input);
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
    />
  );
}
