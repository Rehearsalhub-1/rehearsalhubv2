import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import * as Updates from 'expo-updates';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // re-check at most every 30 min when foregrounded

/**
 * useOTAUpdates
 *
 * Silently checks for an EAS OTA (JS bundle) update:
 *  - On app launch (once app is ready)
 *  - Each time the app comes to the foreground, max once per 30 min
 *
 * If an update is found:
 *  - It is downloaded silently in the background
 *  - An Alert prompts the user to restart and apply it
 *
 * In dev mode this is a no-op (expo-updates doesn't function in dev).
 */
export function useOTAUpdates() {
  const lastCheckedAt = useRef<number>(0);
  const isChecking = useRef<boolean>(false);

  const checkAndApplyUpdate = async () => {
    // Skip in Expo Go dev environment — updates only work in production builds
    if (__DEV__ || !Updates.isEnabled) return;
    if (isChecking.current) return;

    const now = Date.now();
    if (now - lastCheckedAt.current < CHECK_INTERVAL_MS) return;

    isChecking.current = true;
    lastCheckedAt.current = now;

    try {
      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable) {
        console.log('[OTA] New update available — downloading silently...');
        await Updates.fetchUpdateAsync();
        console.log('[OTA] Update downloaded. Prompting user to restart.');

        Alert.alert(
          '✨ Update Ready',
          'A new version of Rehearsal Hub has been downloaded and is ready to apply. Restart now for the best experience.',
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => console.log('[OTA] User deferred restart.'),
            },
            {
              text: 'Restart Now',
              style: 'default',
              onPress: async () => {
                try {
                  await Updates.reloadAsync();
                } catch (err) {
                  console.warn('[OTA] Failed to reload after update:', err);
                }
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        console.log('[OTA] App is up to date.');
      }
    } catch (err: any) {
      // Non-critical — silently log, never crash the app
      console.warn('[OTA] Update check failed:', err?.message || err);
    } finally {
      isChecking.current = false;
    }
  };

  useEffect(() => {
    // Initial check on mount
    checkAndApplyUpdate();

    // Re-check whenever the app comes back to the foreground
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkAndApplyUpdate();
      }
    });

    return () => sub.remove();
  }, []);
}
