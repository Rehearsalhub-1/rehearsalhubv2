import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // re-check at most every 15 min when foregrounded

export interface OTACheckResult {
  status: 'updated' | 'up_to_date' | 'disabled' | 'error';
  message: string;
}

/**
 * Perform an OTA check & download.
 * @param isManual If true, ignores the 15-minute throttle and provides user-facing feedback.
 */
export async function checkAndApplyUpdate(isManual: boolean = false): Promise<OTACheckResult> {
  console.log('[OTA] Status check:', {
    isEnabled: Updates.isEnabled,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  });

  if (__DEV__ || !Updates.isEnabled) {
    const msg = 'OTA updates are only active in Release builds.';
    console.log(`[OTA] ${msg}`);
    if (isManual) {
      Alert.alert('Updates Disabled', msg);
    }
    return { status: 'disabled', message: msg };
  }

  try {
    const result = await Updates.checkForUpdateAsync();

    if (result.isAvailable) {
      console.log('[OTA] New update available — downloading now...');
      await Updates.fetchUpdateAsync();
      console.log('[OTA] Update downloaded successfully.');

      Alert.alert(
        '✨ Update Ready',
        'A new version of Rehearsal Hub has been downloaded. Restart now to apply the latest updates.',
        [
          {
            text: 'Later',
            style: 'cancel',
          },
          {
            text: 'Restart Now',
            style: 'default',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch (err) {
                console.warn('[OTA] Failed to reload:', err);
              }
            },
          },
        ],
        { cancelable: false }
      );

      return { status: 'updated', message: 'Update downloaded and ready to apply.' };
    } else {
      console.log('[OTA] App is up to date.');
      if (isManual) {
        Alert.alert('Up to Date', 'You are already running the latest version of Rehearsal Hub.');
      }
      return { status: 'up_to_date', message: 'App is already up to date.' };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn('[OTA] Update check failed:', errMsg);
    if (!__DEV__) {
      Sentry.captureMessage(`[OTA] check failed: ${errMsg}`);
    }
    if (isManual) {
      Alert.alert('Update Check Failed', `Could not check for updates: ${errMsg}`);
    }
    return { status: 'error', message: errMsg };
  }
}

/**
 * useOTAUpdates
 *
 * Silently checks for an EAS OTA (JS bundle) update on app launch and foreground transitions.
 */
export function useOTAUpdates() {
  const lastCheckedAt = useRef<number>(0);
  const isChecking = useRef<boolean>(false);

  const runBackgroundCheck = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    if (isChecking.current) return;

    const now = Date.now();
    if (now - lastCheckedAt.current < CHECK_INTERVAL_MS) return;

    isChecking.current = true;
    lastCheckedAt.current = now;

    try {
      await checkAndApplyUpdate(false);
    } finally {
      isChecking.current = false;
    }
  };

  useEffect(() => {
    // Initial silent check on mount
    runBackgroundCheck();

    // Re-check whenever the app comes back to the foreground
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        runBackgroundCheck();
      }
    });

    return () => sub.remove();
  }, []);
}
