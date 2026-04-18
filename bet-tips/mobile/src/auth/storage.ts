import * as SecureStore from "expo-secure-store";

const ACCESS = "bettips.access";
const REFRESH = "bettips.refresh";

export const storage = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH);
  },
  async set(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};
