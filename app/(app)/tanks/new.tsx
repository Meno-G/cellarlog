import { router } from 'expo-router';

import { TankForm } from '@/components/TankForm';
import { useOutbox } from '@/hooks/useOutbox';
import { useTanks } from '@/hooks/useTanks';
import { AppError } from '@/lib/errors';
import { emptyTankForm } from '@/lib/tankForm';
import { findDuplicateName } from '@/lib/tankOverlay';
import type { TankInput } from '@/lib/tanks';

export default function NewTankScreen() {
  const outbox = useOutbox();
  const tanks = useTanks();

  async function handleSubmit(input: TankInput) {
    // Checked here too, so a duplicate is caught even offline (the server would refuse it later).
    const duplicate = findDuplicateName(input.name, tanks.data ?? [], null);
    if (duplicate) {
      throw new AppError('validation', `You already have a tank called "${duplicate.name}".`, {
        field: 'name',
      });
    }
    // Online it's created now; offline it's kept on this phone and uploads later.
    await outbox.createTank(input);
    router.back(); // the tanks list refreshes on focus
  }

  return (
    <TankForm
      initialValues={emptyTankForm}
      submitLabel="Create tank"
      onSubmit={handleSubmit}
      offlineMessage="You're offline. The tank is saved on this phone and uploads when you're back online."
    />
  );
}
