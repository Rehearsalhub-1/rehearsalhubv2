import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, LogBox, Alert, AppState, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { apiClient, clearTokens } from './src/lib/apiClient';
import { disconnect as wsDisconnect } from './src/hooks/useWebSocket';

// Initialize Sentry — captures all unhandled JS + native crashes
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  // Set to 1.0 to capture 100% of transactions for performance monitoring.
  // Reduce in production for high-traffic apps.
  tracesSampleRate: 1.0,
  // Disable in dev to avoid noise
  enabled: !__DEV__,
  // Send user feedback prompts on crashes
  enableAutoSessionTracking: true,
  // Attach screenshots on crash (Android only)
  attachScreenshot: true,
});

// Global Error Handler to catch async errors and promise rejections
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const defaultErrorHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.error('Global Error caught:', error);
    Sentry.captureException(error);
    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }
  });
}

// Enable native screens and screen freezing for off-screen components
enableScreens(true);
enableFreeze(false);

LogBox.ignoreLogs(['expo-av is deprecated', 'Method moveAsync']);
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage, ImageBackground as ExpoImageBackground } from 'expo-image';
import { subscribe as wsSubscribe } from './src/hooks/useWebSocket';
import { sendLocalNotification, sendPushNotification } from './src/lib/notifications';
import { SafeOneSignal as OneSignal } from './src/lib/safeNativeModules';

import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef, navigate, reset } from './src/navigation/navigationService';
import { OfflineBanner } from './src/components/OfflineBanner';
import { AppUpdateChecker } from './src/components/AppUpdateChecker';
import { initializeUserStore, useUserStore } from './src/hooks/useUser';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import SessionResumeBanner from './src/components/SessionResumeBanner';
import { ensureCacheSchema } from './src/lib/ensureCacheSchema';
import { debugSessionLog, flushDebugSessionLogs } from './src/lib/debugSessionLog';
import { IncomingCallManager } from './src/lib/IncomingCallManager';
import { useOTAUpdates } from './src/hooks/useOTAUpdates';

const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');

const disableAnimatedImagePlayback = () => {
  const imageProps = (ExpoImage as any)?.defaultProps ?? {};
  (ExpoImage as any).defaultProps = {
    ...imageProps,
    autoplay: false,
  };

  const backgroundProps = (ExpoImageBackground as any)?.defaultProps ?? {};
  (ExpoImageBackground as any).defaultProps = {
    ...backgroundProps,
    autoplay: false,
  };
};

disableAnimatedImagePlayback();

// Initialize OneSignal with App ID safely (graceful fallback in Expo Go / simulator)
try {
  const onesignalAppId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || "dfbfea23-ddeb-42a8-97d8-8b51fc0756d0";
  if (OneSignal?.initialize) {
    OneSignal.initialize(onesignalAppId);
    OneSignal.Location?.setShared?.(false);
    OneSignal.Notifications?.requestPermission?.(true);

    // Add click listener (handles notification clicks when app is in background or killed)
    OneSignal.Notifications?.addEventListener?.('click', (event: any) => {
      console.log('OneSignal: notification clicked:', event);
      const data = event.notification?.additionalData || {};
      const uid = useUserStore.getState().user?.uid;

      if (data?.zoneCode && uid) {
        apiClient.patch(`/profiles/${uid}`, { zone_code: data.zoneCode }).catch(console.error);
      }

      if (data?.action === 'logout') {
        useUserStore.getState().signOut().then(() => {
          reset({ index: 0, routes: [{ name: 'Login' }] });
        });
      } else if (data?.callId) {
        navigate('Call', {
          callId: data.callId,
          callType: data.callType || 'voice',
          isIncoming: true,
          contactName: data.senderName || data.callerName || 'Incoming Call',
          contactAvatar: data.senderAvatar || data.callerAvatar || '',
          contactId: '',
          roomId: data.roomId,
        });
      } else if (data?.screen) {
        navigate(data.screen, data.params || {});
      } else {
        navigate('Notifications', {});
      }
    });

    // Add foreground notification handler
    OneSignal.Notifications?.addEventListener?.('foregroundWillDisplay', (event: any) => {
      console.log('OneSignal: foregroundWillDisplay:', event);
      event.preventDefault?.();
      event.getNotification?.()?.display?.();
    });
  }
} catch (err) {
  console.log('OneSignal skipped (running in Expo Go / simulator):', err);
}

function setupPushSubscriptionObserver(): void {
  try {
    OneSignal?.User?.pushSubscription?.addEventListener?.('change', () => {});
    OneSignal?.Notifications?.requestPermission?.(true);
  } catch (e) {}
}

SplashScreen.preventAutoHideAsync().catch(() => {});
const incomingCallsCache: Record<string, any> = {};

function AppContent({ initialRoute }: { initialRoute: 'Login' | 'Home' }) {
  const { theme, themeName } = useTheme();

  // ── OTA (Over-the-Air) JS bundle update check ──────────────────────────────
  useOTAUpdates();

  useEffect(() => {
    const STALE_CALL_THRESHOLD_MS = 2 * 60 * 1000;
    let callUnsub: (() => void) | null = null;

    const userId = useUserStore.getState().user?.uid;
    if (!userId) return;

    const handleCallEvent = async (data: any) => {
      if (!data || data.status !== 'ringing') return;
      const callId = data.id || data.callId;
      const call = data;

      const createdAt = data.createdAt ? new Date(data.createdAt) : null;
      const callAgeMs = createdAt ? (Date.now() - createdAt.getTime()) : Infinity;

      if (callAgeMs > STALE_CALL_THRESHOLD_MS) {
        apiClient.patch(`/calls/${callId}`, { status: 'missed' }).catch(() => {});
        return;
      }

      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
        IncomingCallManager.displayIncomingCall({
          id: callId,
          type: call.type || 'voice',
          callerName: call.callerName || 'Unknown',
          callerAvatar: call.callerAvatar,
          chatId: call.chatId
        }).catch(() => {});
      } else if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Call', {
          callId, callType: call.type || 'voice', isIncoming: true,
          contactName: call.callerName || 'Unknown', contactAvatar: call.callerAvatar,
          contactId: call.callerId, roomId: call.chatId,
        });
      }
    };

    callUnsub = wsSubscribe('calls', userId, handleCallEvent);

    return () => {
      if (callUnsub) callUnsub();
    };
  }, [useUserStore.getState().user?.uid]);

  // ── Concurrent session login check ─────────────────────────────────────────
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    let lastActiveTime = Date.now();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') lastActiveTime = Date.now();
    });

    const setupPushRegistration = async () => {
      const user = useUserStore.getState().user;
      if (!user) return;

      // OneSignal registration (silent, non-blocking)
      try {
        OneSignal?.login?.(user.uid);
        const subId = await OneSignal?.User?.pushSubscription?.getIdAsync?.();
        if (subId && !subId.startsWith('local-')) {
          await apiClient.patch(`/profiles/${user.uid}/onesignal`, { subscription_id: subId }).catch(() => {});
        }
      } catch (e) {
        // Silently skip if running in Expo Go or native push unattached
      }
    };

    // Run on mount if user is already logged in
    const user = useUserStore.getState().user;
    if (user) {
      setupPushRegistration();
    }

    // Also watch auth state changes via store subscription
    let lastUserId: string | null = useUserStore.getState().user?.uid ?? null;
    const unsubAuth = useUserStore.subscribe((state) => {
      const newUserId = state.user?.uid ?? null;
      if (newUserId === lastUserId) return;
      lastUserId = newUserId;
      if (newUserId) {
        setupPushRegistration();
      } else {
        OneSignal.logout();
        if (navigationRef.isReady()) {
          const currentRouteName = navigationRef.getCurrentRoute()?.name;
          if (currentRouteName && currentRouteName !== 'Login' && currentRouteName !== 'Signup') {
            navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }
      }
    });

    return () => {
      appStateSub.remove();
      unsubAuth();
    };
  }, []);

  const NavTheme = {
    dark: themeName === 'dark',
    colors: {
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.textPrimary,
      border: 'rgba(150,150,150,0.1)',
      notification: theme.colors.accent,
    },
    fonts: {
      regular: { fontFamily: 'sans-serif', fontWeight: 'normal' as const },
      medium: { fontFamily: 'sans-serif', fontWeight: '500' as const },
      bold: { fontFamily: 'sans-serif', fontWeight: 'bold' as const },
      heavy: { fontFamily: 'sans-serif', fontWeight: '900' as const },
    }
  };

  const linking = {
    prefixes: ['rehearsalhub://', 'https://rehearsalhub.net', 'https://www.loveworldsingersrehearsalhubportal.org'],
    config: {
      screens: {
        Rehearsal: 'songs/:songId',
        Player: 'play/:songId',
        ChatRoom: 'join/:roomId',
        ChatInfo: 'profile/:userId'
      }
    }
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar 
        style={themeName === 'dark' ? 'light' : 'dark'} 
        backgroundColor={themeName === 'dark' ? theme.colors.background : '#ffffff'} 
      />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <NavigationContainer theme={NavTheme} ref={navigationRef} linking={linking}>
          <AppNavigator initialRoute={initialRoute} />
        </NavigationContainer>
        <OfflineBanner />
        <SessionResumeBanner />
        <AppUpdateChecker />
      </View>
    </SafeAreaProvider>
  );
}

function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Home' | null>(null);

  // ── Blank screen fix: detect app returning from background ─────────────────
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // App came from background — skip re-initialization, restore state
        console.log('[App] Returned from background — restoring state');
        if (!initialRoute) setInitialRoute(useUserStore.getState().user ? 'Home' : 'Login');
        if (!appIsReady) setAppIsReady(true);
        if (!animationFinished) setAnimationFinished(true);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [appIsReady, animationFinished, initialRoute]);

  useEffect(() => {
    // Set up OneSignal push subscription observer for verification dialog
    setupPushSubscriptionObserver();

    // Auto-request notification permissions on boot
    OneSignal?.Notifications?.requestPermission?.(true)?.catch?.((err: any) => {
      console.warn('[App] Failed to request notification permission:', err);
    });

    // Initialize the Zustand user store (auth listener + profile snapshot)
    initializeUserStore();

    async function prepare() {
      try {
        const flushed = await flushDebugSessionLogs();
        if (flushed > 0) {
          debugSessionLog('H9', 'App.tsx:prepare:flush', 'Flushed buffered debug logs from device', { flushed });
        }
        await ensureCacheSchema();
        debugSessionLog('H5', 'App.tsx:prepare:start', 'App prepare started', {
          appState: AppState.currentState,
        });
        // Unified Big Tech Bootstrap: ONE call to hydrate user and route
        const isLoggedIn = await useUserStore.getState().bootstrap();
        if (isLoggedIn) {
          setInitialRoute('Home');
          debugSessionLog('H5', 'App.tsx:prepare:bootstrap', 'User successfully bootstrapped — routing to Home', {
            hasUser: true,
          });
          return;
        }

        setInitialRoute('Login');
        debugSessionLog('H5', 'App.tsx:prepare:bootstrap', 'No active session — routing to Login', {
          hasUser: false,
        });
      } catch (e) {
        console.warn(e);
        setInitialRoute('Login');
      } finally {
        setAppIsReady(true);
        debugSessionLog('H5', 'App.tsx:prepare:finally', 'App prepare finalized', {
          appIsReadySetTo: true,
        });
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady && animationFinished) {
      SplashScreen.hideAsync().catch(() => {});
      debugSessionLog('H5', 'App.tsx:splash:hide', 'Splash hide requested', {
        appIsReady,
        animationFinished,
      });
    }
  }, [appIsReady, animationFinished]);

  const onLayoutRootView = useCallback(async () => {
    // This can stay as a fallback, but the useEffect above guarantees it hides.
    if (appIsReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady || !initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {/* Render AppContent immediately so it loads in the background */}
        <AppContent initialRoute={initialRoute} />

        {/* Overlay the Splash Screen on top until it finishes */}
        {!animationFinished && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} onLayout={onLayoutRootView}>
            <AnimatedSplashScreen onAnimationFinish={() => setAnimationFinished(true)} />
          </View>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default Sentry.wrap(App);
