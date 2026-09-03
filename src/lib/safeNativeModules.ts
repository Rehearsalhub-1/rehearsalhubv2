import Constants from 'expo-constants';
import React from 'react';
import { View } from 'react-native';

export const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  (Constants as any).appOwnership === 'expo';

// ==========================================
// 1. OneSignal Safe Wrapper
// ==========================================
let rawOneSignal: any = null;
if (!isExpoGo) {
  try {
    rawOneSignal = require('react-native-onesignal').OneSignal;
  } catch (e) {
    console.log('[SafeNative] OneSignal native module not available.');
  }
}

export const SafeOneSignal = rawOneSignal || {
  initialize: (appId: string) => {
    console.log('[ExpoGo] OneSignal.initialize simulated with appId:', appId);
  },
  login: (externalId: string) => {
    console.log('[ExpoGo] OneSignal.login simulated with id:', externalId);
  },
  logout: () => {
    console.log('[ExpoGo] OneSignal.logout simulated');
  },
  Location: {
    setShared: (shared: boolean) => {},
  },
  Notifications: {
    requestPermission: async (fallbackToSettings?: boolean) => true,
    addEventListener: (event: string, listener: (...args: any[]) => void) => {},
    removeEventListener: (event: string, listener: (...args: any[]) => void) => {},
  },
  User: {
    addTag: (key: string, value: string) => {},
    removeTag: (key: string) => {},
    addTags: (tags: Record<string, string>) => {},
    removeTags: (keys: string[]) => {},
    getTags: async () => ({}),
  },
};

// ==========================================
// 2. CallKeep Safe Wrapper
// ==========================================
let rawCallKeep: any = null;
if (!isExpoGo) {
  try {
    rawCallKeep = require('react-native-callkeep').default || require('react-native-callkeep');
  } catch (e) {
    console.log('[SafeNative] RNCallKeep native module not available.');
  }
}

export const SafeCallKeep = rawCallKeep || {
  setup: async (options: any) => {},
  addEventListener: (event: string, listener: (...args: any[]) => void) => {},
  removeEventListener: (event: string, listener: (...args: any[]) => void) => {},
  backToForeground: () => {},
  endCall: (uuid: string) => {},
  displayIncomingCall: (uuid: string, handle: string, localizedCallerName?: string, handleType?: string, hasVideo?: boolean) => {},
};

// ==========================================
// 3. Notifee Safe Wrapper
// ==========================================
let rawNotifee: any = null;
if (!isExpoGo) {
  try {
    rawNotifee = require('@notifee/react-native').default || require('@notifee/react-native');
  } catch (e) {
    console.log('[SafeNative] Notifee native module not available.');
  }
}

export const SafeNotifee = rawNotifee || {
  displayNotification: async (notification: any) => '',
  cancelNotification: async (notificationId: string) => {},
  createChannel: async (channel: any) => '',
  onForegroundEvent: (observer: any) => () => {},
  onBackgroundEvent: (observer: any) => () => {},
};

export const SafeAndroidImportance = {
  HIGH: 4,
  DEFAULT: 3,
  LOW: 2,
  MIN: 1,
  NONE: 0,
};

export const SafeAndroidCategory = {
  CALL: 'call',
  MESSAGE: 'msg',
  EVENT: 'event',
  PROMO: 'promo',
  ALARM: 'alarm',
};

export const SafeAndroidVisibility = {
  PUBLIC: 1,
  PRIVATE: 0,
  SECRET: -1,
};

// ==========================================
// 4. LiveKit Safe Wrapper
// ==========================================
let rawLiveKit: any = null;
let rawWebRTC: any = null;

try {
  rawLiveKit = require('@livekit/react-native');
} catch (e) {
  console.log('[SafeNative] LiveKit native module not available.');
}

try {
  rawWebRTC = require('@livekit/react-native-webrtc');
} catch (e) {
  console.log('[SafeNative] WebRTC native module not available.');
}

export const SafeVideoView = rawLiveKit?.VideoView || function FallbackVideoView(props: any) {
  return React.createElement(View, { style: props?.style });
};

export const safeRegisterGlobals = () => {
  try {
    if (rawLiveKit?.registerGlobals) {
      rawLiveKit.registerGlobals();
    }
  } catch (e) {
    console.log('[SafeNative] LiveKit registerGlobals error:', e);
  }

  try {
    if (rawWebRTC?.registerGlobals) {
      rawWebRTC.registerGlobals();
    }
  } catch (e) {
    console.log('[SafeNative] WebRTC registerGlobals error:', e);
  }

  // Fallback: if navigator.mediaDevices is still missing but rawWebRTC.mediaDevices exists
  try {
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices && rawWebRTC?.mediaDevices) {
      (navigator as any).mediaDevices = rawWebRTC.mediaDevices;
    }
  } catch {}
};

// ==========================================
// 5. TrackPlayer Safe Wrapper
// ==========================================
let rawTrackPlayerModule: any = null;
if (!isExpoGo) {
  try {
    rawTrackPlayerModule = require('react-native-track-player');
  } catch (e) {
    console.log('[SafeNative] TrackPlayer native module not available.');
  }
}

export const SafeTrackPlayer = rawTrackPlayerModule?.default || {
  setupPlayer: async (options?: any) => {},
  registerPlaybackService: (factory: any) => {},
  add: async (tracks: any[]) => {},
  remove: async (tracks: any) => {},
  skip: async (index: number) => {},
  skipToNext: async () => {},
  skipToPrevious: async () => {},
  removeUpcomingTracks: async () => {},
  reset: async () => {},
  play: async () => {},
  pause: async () => {},
  stop: async () => {},
  seekTo: async (seconds: number) => {},
  setVolume: async (level: number) => {},
  setRate: async (rate: number) => {},
  setRepeatMode: async (mode: any) => {},
  getRepeatMode: async () => 0,
  getQueue: async () => [],
  getActiveTrackIndex: async () => 0,
  getActiveTrack: async () => null,
  getTrack: async (index: number) => null,
  getProgress: async () => ({ position: 0, duration: 0, buffered: 0 }),
  getPlaybackState: async () => ({ state: 'idle' }),
  getState: async () => 'idle',
  addEventListener: (event: string, listener: (...args: any[]) => void) => ({ remove: () => {} }),
};

export const SafeCapability = rawTrackPlayerModule?.Capability || {
  Play: 'play',
  PlayFromId: 'play-from-id',
  PlayFromSearch: 'play-from-search',
  Pause: 'pause',
  Stop: 'stop',
  SeekTo: 'seek-to',
  Skip: 'skip',
  SkipToNext: 'skip-to-next',
  SkipToPrevious: 'skip-to-previous',
  JumpForward: 'jump-forward',
  JumpBackward: 'jump-backward',
  SetRating: 'set-rating',
  Like: 'like',
  Dislike: 'dislike',
  Bookmark: 'bookmark',
};

export const SafeEvent = rawTrackPlayerModule?.Event || {
  PlaybackState: 'playback-state',
  PlaybackError: 'playback-error',
  PlaybackQueueEnded: 'playback-queue-ended',
  PlaybackActiveTrackChanged: 'playback-active-track-changed',
  PlaybackProgressUpdated: 'playback-progress-updated',
  PlaybackPlayWhenReadyChanged: 'playback-play-when-ready-changed',
  RemotePlay: 'remote-play',
  RemotePlayId: 'remote-play-id',
  RemotePlaySearch: 'remote-play-search',
  RemotePause: 'remote-pause',
  RemoteStop: 'remote-stop',
  RemoteSkip: 'remote-skip',
  RemoteNext: 'remote-next',
  RemotePrevious: 'remote-previous',
  RemoteSeek: 'remote-seek',
  RemoteSetRating: 'remote-set-rating',
  RemoteJumpForward: 'remote-jump-forward',
  RemoteJumpBackward: 'remote-jump-backward',
  RemoteDuck: 'remote-duck',
  RemoteLike: 'remote-like',
  RemoteDislike: 'remote-dislike',
  RemoteBookmark: 'remote-bookmark',
};

export const SafeState = rawTrackPlayerModule?.State || {
  None: 'none',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Buffering: 'buffering',
  Loading: 'loading',
  Error: 'error',
  Ended: 'ended',
};

export const SafeRepeatMode = rawTrackPlayerModule?.RepeatMode || {
  Off: 0,
  Track: 1,
  Queue: 2,
};

export const safeUsePlaybackState = () => {
  if (!isExpoGo && rawTrackPlayerModule?.usePlaybackState) {
    try {
      return rawTrackPlayerModule.usePlaybackState();
    } catch (e) {}
  }
  return { state: SafeState.None };
};

export const safeUseProgress = () => {
  if (!isExpoGo && rawTrackPlayerModule?.useProgress) {
    try {
      return rawTrackPlayerModule.useProgress();
    } catch (e) {}
  }
  return { position: 0, duration: 0, buffered: 0 };
};

export const safeUseTrackPlayerEvents = (events: any[], handler: any) => {
  if (!isExpoGo && rawTrackPlayerModule?.useTrackPlayerEvents) {
    try {
      return rawTrackPlayerModule.useTrackPlayerEvents(events, handler);
    } catch (e) {}
  }
};
