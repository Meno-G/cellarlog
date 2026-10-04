import { useNetInfo } from '@react-native-community/netinfo';

/**
 * True only when we know the phone is offline. While NetInfo is still
 * checking (null), assume online so we don't flash an offline banner.
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected === false || isInternetReachable === false;
}
