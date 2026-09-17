import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // re-check at most every 15 min when foregrounded
// Max time we'll wait for EAS servers before giving up silently — prevents perceived hangs
const OTA_TIMEOUT_MS = 8_000;

/** Wraps a promise with a timeout; resolves to null if the timeout fires first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export interface OTACheckResult {
  status: 'updated' | 'up_to_date' | 'disabled' | 'error';
  message: string;
}

/**
 * useOTAUpdates
 *
 * Silently checks for and downloads EAS OTA (JS bundle) updates on launch and foreground.
 * The update is applied automatically on the NEXT cold launch — no modal, no interruption.
 * A hard 8-second timeout prevents slow EAS network responses from hanging the app.
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
      const result = await withTimeout(Updates.checkForUpdateAsync(), OTA_TIMEOUT_MS);
      if (!result) {
        console.warn('[OTA] checkForUpdateAsync timed out — skipping.');
        return;
      }
      if (result.isAvailable) {
        console.log('[OTA] New update available — downloading silently...');
        const fetched = await withTimeout(Updates.fetchUpdateAsync(), OTA_TIMEOUT_MS);
        if (!fetched) {
          console.warn('[OTA] fetchUpdateAsync timed out — will retry next foreground.');
          return;
        }
        // Cached on disk — automatically applied on next cold start
        console.log('[OTA] Update downloaded. Will apply on next launch.');
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
        return { status: 'updated', message: 'Update downloaded! You\'ll see it next time you open the app.' };
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
    // Kept for backwards compatibility — modal is no longer shown automatically
    showUpdateModal: false as const,
    dismissModal: () => {},
    checkManually,
  };
}
