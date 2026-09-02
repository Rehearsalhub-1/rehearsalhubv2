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
  if (type === 1 && detail?.pressAction?.id === 'default') {
    // User tapped notification
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
