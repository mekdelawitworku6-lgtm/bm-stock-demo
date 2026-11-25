import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { networkManager, NetworkState } from '../utils/networkUtils';

export const useNetwork = () => {
  const [networkState, setNetworkState] = useState<NetworkState>(
    networkManager.getNetworkState()
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const newState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };
      setNetworkState(newState);
    });

    return unsubscribe;
  }, []);

  return {
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    type: networkState.type,
    isOnline: networkManager.isOnline(),
    checkConnectivity: networkManager.checkConnectivity.bind(networkManager),
    waitForConnection: networkManager.waitForConnection.bind(networkManager),
  };
};
