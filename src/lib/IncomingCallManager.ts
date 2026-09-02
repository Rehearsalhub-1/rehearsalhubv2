import { Platform } from 'react-native';
import {
  SafeNotifee as notifee,
  SafeAndroidImportance as AndroidImportance,
  SafeAndroidCategory as AndroidCategory,
  SafeAndroidVisibility as AndroidVisibility,
  SafeCallKeep as RNCallKeep,
} from './safeNativeModules';
import { navigate } from '../navigation/navigationService';

// Stores call metadata keyed by callUUID so the answerCall event
// can pass full details to CallScreen (callkeep events only give us the UUID)
const pendingCalls = new Map<string, {
  callType: string;
  callerName: string;
  callerAvatar?: string;
  chatId?: string;
}>();

export const IncomingCallManager = {
  setup: () => {
    try {
      if (!RNCallKeep?.setup) return;
      RNCallKeep.setup({
        ios: {
          appName: 'RehearsalHub',
          includesCallsInRecents: false,
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'This application needs to access your phone accounts',
          cancelButton: 'Cancel',
          okButton: 'ok',
          additionalPermissions: [],
        },
      }).catch(console.warn);

      // User answered from the native CallKit / lock-screen UI
      RNCallKeep.addEventListener('answerCall', ({ callUUID }: any) => {
        RNCallKeep.backToForeground();
        const meta = pendingCalls.get(callUUID);
        pendingCalls.delete(callUUID);
        navigate('Call', {
          callId: callUUID,
          isIncoming: true,
          callType: meta?.callType || 'voice',
          contactName: meta?.callerName || 'Incoming Call',
          contactAvatar: meta?.callerAvatar,
          roomId: meta?.chatId,
        });
      });

      // User declined from the native CallKit / lock-screen UI
      RNCallKeep.addEventListener('endCall', ({ callUUID }: any) => {
        pendingCalls.delete(callUUID);
        RNCallKeep.endCall(callUUID);
      });
    } catch (e) {
      console.log('IncomingCallManager skipped (running in Expo Go / simulator):', e);
    }
  },

  displayIncomingCall: async (call: {
    id: string;
    type?: string;
    callerName?: string;
    callerAvatar?: string;
    chatId?: string;
  }) => {
    // Always store metadata so answerCall event has it
    pendingCalls.set(call.id, {
      callType: call.type || 'voice',
      callerName: call.callerName || 'Unknown Caller',
      callerAvatar: call.callerAvatar,
      chatId: call.chatId,
    });

    if (Platform.OS === 'ios') {
      // iOS: native CallKit system UI (lock screen, phone app switcher)
      RNCallKeep.displayIncomingCall(
        call.id,
        call.callerName || 'Unknown Caller',
        call.callerName || 'Unknown Caller',
        'generic',
        call.type === 'video'
      );
    } else {
      // Android: notifee full-screen intent launches IncomingCallScreen
      // (CallKeep ConnectionService is less reliable on Android, notifee is the primary path)
      await notifee.requestPermission();

      const channelId = await notifee.createChannel({
        id: 'incoming_calls',
        name: 'Incoming Calls',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        importance: AndroidImportance.HIGH,
        bypassDnd: true,
      });

      await notifee.displayNotification({
        id: call.id,
        title: `Incoming ${call.type === 'video' ? 'Video' : 'Voice'} Call`,
        body: `${call.callerName || 'Someone'} is calling you.`,
        android: {
          channelId,
          category: AndroidCategory.CALL,
          visibility: AndroidVisibility.PUBLIC,
          importance: AndroidImportance.HIGH,
          autoCancel: false,
          ongoing: true,
          fullScreenAction: {
            id: 'default',
            mainComponent: 'IncomingCallApp',
          },
        },
        data: {
          callId: call.id,
          callType: call.type || 'voice',
          callerName: call.callerName || '',
          callerAvatar: call.callerAvatar || '',
          roomId: call.chatId || '',
        }
      });
    }
  },

  endCall: async (callId: string) => {
    pendingCalls.delete(callId);
    if (Platform.OS === 'ios') {
      RNCallKeep.endAllCalls();
    } else {
      await notifee.cancelNotification(callId);
    }
  }
};
