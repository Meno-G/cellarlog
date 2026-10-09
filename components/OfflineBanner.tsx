import { useT } from '@/hooks/useLanguage';
import { useIsOffline } from '@/hooks/useNetworkStatus';

import { Banner } from './Banner';

type Props = { message?: string };

/** Renders nothing while online. */
export function OfflineBanner({ message }: Props) {
  const offline = useIsOffline();
  const t = useT();
  if (!offline) return null;
  return <Banner tone="waiting" icon="wifi-off" message={message ?? t.offline.default} />;
}
