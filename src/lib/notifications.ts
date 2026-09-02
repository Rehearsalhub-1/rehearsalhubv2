import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { navigate } from '../navigation/navigationService';
import { apiClient } from './apiClient';
import { useUserStore } from '../hooks/useUser';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b5cf6',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {

    return;
  }

  if (Device.isDevice) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('EAS Project ID is missing');
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

  } else {

  }

  return token;
}

async function savePushToken(token: string) {
  const user = useUserStore.getState().user;
  if (!user || !token) return;

  try {
    await apiClient.patch(`/profiles/${user.uid}`, {
      expoPushToken: token,
    });
  } catch (error) {
    // Silently ignore transient network errors on push token registration
  }
}

export function setupNotifications() {
  registerForPushNotificationsAsync().then(token => {
    if (token) {
      savePushToken(token);
    }
  });

  const notificationListener = Notifications.addNotificationReceivedListener(notification => {

  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    const data = (response.notification.request.content.data || {}) as any;
    const user = useUserStore.getState().user;
    if (data?.zoneCode && user) {
      apiClient.patch(`/profiles/${user.uid}`, { zone_code: data.zoneCode }).catch(console.error);
    }

    if (data?.screen) {
      navigate(data.screen, data.params || {});
    } else {
      navigate('Notifications', {});
    }
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}

export async function sendLocalNotification(title: string, message: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Failed to send local notification:', error);
  }
}

export async function sendPushNotification(
  recipientUserIds: string | string[],
  title: string,
  body: string,
  data?: any
) {
  const userIds = Array.isArray(recipientUserIds)
    ? recipientUserIds
    : [recipientUserIds];

  // We no longer process 'ExponentPushToken' directly on the client.
  // The backend handles resolving User IDs to tokens.
  const validUserIds = userIds.filter(id => id && !id.startsWith('ExponentPushToken'));

  if (validUserIds.length > 0) {
    try {
      await apiClient.post('/notifications/send', {
        recipientIds: validUserIds,
        title,
        body,
        data: {
          ...data,
          type: data?.screen === 'Call' || data?.callId ? 'call' : 'chat',
          senderName: data?.senderName || data?.contactName || '',
          senderAvatar: data?.senderAvatar || data?.contactAvatar || '',
        }
      });
    } catch (backendErr) {
      console.warn('[sendPushNotification] Backend request failed:', backendErr);
    }
  }
}
