import './src/polyfills';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import TrackPlayer from 'react-native-track-player';
import notifee, { EventType } from '@notifee/react-native';
import { IncomingCallManager } from './src/lib/IncomingCallManager';
import IncomingCallScreen from './src/screens/IncomingCallScreen';

console.log('[Entry] Registering services...');

IncomingCallManager.setup();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'default') {
    // Usually means the user tapped the notification
  }
});

// Register the background track player service
TrackPlayer.registerPlaybackService(() => require('./service').default);

// Register the custom full-screen intent component for Android incoming calls
AppRegistry.registerComponent('IncomingCallApp', () => IncomingCallScreen);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
