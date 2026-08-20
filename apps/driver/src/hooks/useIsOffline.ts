import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** État de connexion, pour le bandeau hors ligne. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected || state.isInternetReachable === false);
    });
  }, []);

  return offline;
}
