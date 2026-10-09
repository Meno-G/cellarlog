import { router } from 'expo-router';

import { TankForm } from '@/components/TankForm';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTanks } from '@/hooks/useTanks';
import { AppError } from '@/lib/errors';
import { strings } from '@/lib/i18n';
import { emptyTankForm } from '@/lib/tankForm';
import { findDuplicateName } from '@/lib/tankOverlay';
import type { TankInput } from '@/lib/tanks';

export default function NewTankScreen() {
  const outbox = useOutbox();
  const tanks = useTanks();
  const t = useT();

  async function handleSubmit(input: TankInput) {
    // Checked here too, so a duplicate is caught even offline (the server would refuse it later).
    const duplicate = findDuplicateName(input.name, tanks.data ?? [], null);
    if (duplicate) {
      throw new AppError('validation', strings().messages.duplicateTank(duplicate.name), {
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
      submitLabel={t.tankForm.create}
      onSubmit={handleSubmit}
      offlineMessage={t.tankForm.offlineNew}
    />
  );
}
