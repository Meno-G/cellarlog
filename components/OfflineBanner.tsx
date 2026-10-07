import { useIsOffline } from '@/hooks/useNetworkStatus';

import { Banner } from './Banner';

type Props = { message?: string };

/** Renders nothing while online. */
export function OfflineBanner({
  message = "You're offline. Loading and saving need internet.",
}: Props) {
  const offline = useIsOffline();
  if (!offline) return null;
  return <Banner tone="waiting" icon="wifi-off" message={message} />;
}
