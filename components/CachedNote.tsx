import { formatEntryTime } from '@/lib/format';

import { Banner } from './Banner';

type Props = {
  /** When the cached copy was saved; null when the data is fresh from the server. */
  cachedAt: string | null;
  /** The latest load error, if any. */
  error: string | null;
  onRetry: () => void;
};

/**
 * Explains why the data might be out of date: it's the copy saved on the phone
 * because the server couldn't be reached. Renders nothing for fresh data.
 */
export function CachedNote({ cachedAt, error, onRetry }: Props) {
  if (!error) return null;
  if (!cachedAt) return <Banner message={error} onRetry={onRetry} />;
  return (
    <Banner
      tone="info"
      message={`${error} Showing what was saved on this phone (${formatEntryTime(cachedAt)}).`}
      onRetry={onRetry}
    />
  );
}
