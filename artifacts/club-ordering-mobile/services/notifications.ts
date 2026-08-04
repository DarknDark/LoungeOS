import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationRegistration = {
  permission: Notifications.PermissionStatus;
  token: string | null;
};

export async function getNotificationRegistration(): Promise<NotificationRegistration> {
  const permissions = await Notifications.getPermissionsAsync();
  return { permission: permissions.status, token: null };
}

/**
 * Registers the device only after the user has explicitly enabled notifications.
 * The backend notification-recipient endpoint can consume the returned token later.
 */
export async function requestNotificationRegistration(): Promise<NotificationRegistration> {
  if (Platform.OS === 'web') {
    const permissions = await Notifications.getPermissionsAsync();
    return { permission: permissions.status, token: null };
  }
  const permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) {
    return { permission: permissions.status, token: null };
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return { permission: permissions.status, token: token.data };
  } catch {
    return { permission: permissions.status, token: null };
  }
}