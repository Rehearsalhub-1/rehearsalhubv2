import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import { navigate } from '../navigation/navigationService';
import { apiClient } from './apiClient';
import { useUserStore } from '../hooks/useUser';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('[notifications] expo-notifications unavailable in this runtime:', error);
}

const isExpoGo = Constants.appOwnership === 'expo' || !!Constants.expoGoConfig;
const isPushNotificationsSupported = !!Notifications && !isExpoGo;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    }),
  });
}

async function registerForPushNotificationsAsync() {
  if (!Notifications || !isPushNotificationsSupported) {
    return null;
  }

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
    return null;
  }

  if (Device.isDevice) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('EAS Project ID is missing');
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;
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
  if (isPushNotificationsSupported) {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        savePushToken(token);
      }
    });

    const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = (notification.request.content.data || {}) as any;
      if (data?.screen === 'IncomingCall' || data?.type === 'call' || data?.callId) {
        if (AppState.currentState === 'active') {
          navigate('IncomingCall', {
            callId: data.callId,
            callType: data.callType || data.type || 'voice',
            callerName: data.callerName || data.senderName || 'Incoming Call',
            callerAvatar: data.callerAvatar || data.senderAvatar || '',
            roomId: data.roomId || data.chatId || data.callId,
          });
        }
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = (response.notification.request.content.data || {}) as any;
      const user = useUserStore.getState().user;
      if (data?.zoneCode && user) {
        apiClient.patch(`/profiles/${user.uid}`, { zone_code: data.zoneCode }).catch(console.error);
      }

      if (data?.screen === 'IncomingCall' || data?.type === 'call' || data?.callId) {
        navigate('IncomingCall', {
          callId: data.callId,
          callType: data.callType || data.type || 'voice',
          callerName: data.callerName || data.senderName || 'Incoming Call',
          callerAvatar: data.callerAvatar || data.senderAvatar || '',
          roomId: data.roomId || data.chatId || data.callId,
          notificationId: response.notification.request.identifier,
        });
      } else if (data?.screen) {
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

  return () => undefined;
}

export async function sendLocalNotification(title: string, message: string, data?: any) {
  if (!Notifications) {
    return;
  }

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
