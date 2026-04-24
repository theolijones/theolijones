import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const readProjectId = (): string | undefined => {
  const cfg = Constants.expoConfig;
  const fromEas =
    (cfg?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (fromEas) return fromEas;
  const legacy = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return legacy;
};

export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const projectId = readProjectId();
  try {
    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const value = token.data;
    await api("/me/push-token", { method: "POST", body: { token: value } });
    return value;
  } catch (e) {
    console.warn("push token registration failed", (e as Error).message);
    return null;
  }
};

export const clearPushToken = async (): Promise<void> => {
  try {
    await api("/me/push-token", { method: "POST", body: { token: null } });
  } catch {
    /* best effort */
  }
};
