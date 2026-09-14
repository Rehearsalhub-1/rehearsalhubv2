import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // re-check at most every 15 min when foregrounded

export interface OTACheckResult {
  status: 'updated' | 'up_to_date' | 'disabled' | 'error';
  message: string;
}

/**
 * useOTAUpdates
 *
 * Silently checks for an EAS OTA (JS bundle) update on app launch and foreground transitions.
 * Returns `showUpdateModal` boolean and `dismissModal` handler to wire into <OTAUpdateModal />.
 */
export function useOTAUpdates() {
  const lastCheckedAt = useRef<number>(0);
  const isChecking = useRef<boolean>(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const runBackgroundCheck = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    if (isChecking.current) return;

    const now = Date.now();
    if (now - lastCheckedAt.current < CHECK_INTERVAL_MS) return;

    isChecking.current = true;
    lastCheckedAt.current = now;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        console.log('[OTA] New update available — downloading...');
        await Updates.fetchUpdateAsync();
        console.log('[OTA] Update downloaded — showing modal.');
        // Show our custom modal instead of Alert, so users see the loading state on restart
        setShowUpdateModal(true);
      } else {
        console.log('[OTA] App is up to date.');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn('[OTA] Background check warning:', msg);
      if (!__DEV__) {
        Sentry.captureMessage(`[OTA] check failed: ${msg}`);
      }
    } finally {
      isChecking.current = false;
    }
  };

  /** Call this from a manual "Check for Updates" button */
  const checkManually = async (): Promise<OTACheckResult> => {
    if (__DEV__ || !Updates.isEnabled) {
      return { status: 'disabled', message: 'OTA updates are only active in Release builds.' };
    }
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setShowUpdateModal(true);
        return { status: 'updated', message: 'Update downloaded and ready to apply.' };
      }
      return { status: 'up_to_date', message: 'App is already up to date.' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      return { status: 'error', message: msg };
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

  return {
    showUpdateModal,
    dismissModal: () => setShowUpdateModal(false),
    checkManually,
  };
}
