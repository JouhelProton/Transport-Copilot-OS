import { networkIsOffline } from "@/hooks/use-connectivity";

describe("connectivity", () => {
  test.each([
    [{ isConnected: false, isInternetReachable: true }, true],
    [{ isConnected: true, isInternetReachable: false }, true],
    [{ isConnected: true, isInternetReachable: true }, false],
    [{ isConnected: undefined, isInternetReachable: undefined }, false],
  ])("maps network state", (state, expected) => expect(networkIsOffline(state)).toBe(expected));
});
