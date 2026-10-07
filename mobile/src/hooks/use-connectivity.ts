import { useNetworkState, type NetworkState } from "expo-network";

export function networkIsOffline(state: Pick<NetworkState, "isConnected" | "isInternetReachable">) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function useConnectivity() {
  const state = useNetworkState();
  return { offline: networkIsOffline(state), state };
}
