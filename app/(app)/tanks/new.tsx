import { router } from 'expo-router';

import { TankForm } from '@/components/TankForm';
import { emptyTankForm } from '@/lib/tankForm';
import { createTank, type TankInput } from '@/lib/tanks';

export default function NewTankScreen() {
  async function handleSubmit(input: TankInput) {
    await createTank(input);
    // The tanks list refetches when it regains focus.
    router.back();
  }

  return <TankForm initialValues={emptyTankForm} submitLabel="Create tank" onSubmit={handleSubmit} />;
}
