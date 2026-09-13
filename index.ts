import './src/polyfills';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { SafeTrackPlayer as TrackPlayer, SafeNotifee as notifee, isExpoGo } from './src/lib/safeNativeModules';
import { IncomingCallManager } from './src/lib/IncomingCallManager';
import IncomingCallScreen from './src/screens/IncomingCallScreen';

console.log('[Entry] Registering services...');

IncomingCallManager.setup();

notifee.onBackgroundEvent(async ({ type, detail }: any) => {
  const data = detail?.notification?.data || {};
  // type 1 = PRESS, type 3 = ACTION_PRESS
  if ((type === 1 || type === 3) && (data?.callId || data?.screen === 'IncomingCall')) {
    // User tapped the incoming call notification while app was in background
    // IncomingCallManager will have already shown the full-screen UI
    // Just navigate to IncomingCall screen on app open
    const { navigate } = require('./src/navigation/navigationService');
    navigate('IncomingCall', {
      callId: data.callId,
      callerName: data.callerName || 'Unknown',
      callerAvatar: data.callerAvatar || '',
      roomId: data.chatId || data.callId,
      callType: data.callType || 'voice',
      notificationId: detail?.notification?.id,
    });
  }
});

// Register the background track player service
if (!isExpoGo) {
  try {
    TrackPlayer.registerPlaybackService(() => require('./service').default);
  } catch (e) {}
}

// Register the custom full-screen intent component for Android incoming calls
AppRegistry.registerComponent('IncomingCallApp', () => IncomingCallScreen);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
