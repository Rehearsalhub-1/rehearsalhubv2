import { SafeTrackPlayer as TrackPlayer, SafeEvent as Event } from './src/lib/safeNativeModules';

// Track if the user explicitly hit play. Exported so useTrackPlayer.ts can update it when UI play/pause is hit.
export let wasPlayingIntentionally = false;

export const setWasPlayingIntentionally = (isIntentional: boolean) => {
  wasPlayingIntentionally = isIntentional;
};

export default async function () {
  console.log('[PlaybackService] ✅ Service started (v3.2.0)');

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    // This is explicit user action from Control Center / headphones
    wasPlayingIntentionally = true;
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    // Explicit user action to pause
    wasPlayingIntentionally = false;
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    wasPlayingIntentionally = false;
    TrackPlayer.reset();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    wasPlayingIntentionally = true;
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    wasPlayingIntentionally = true;
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (data: any) => {
    TrackPlayer.seekTo(data.position);
  });

  // Audio focus — pause on phone call / other audio taking over, conditionally resume when released
  TrackPlayer.addEventListener(Event.RemoteDuck, async (data: any) => {
    if (data.paused) {
      await TrackPlayer.pause();
      // Note: We DO NOT set wasPlayingIntentionally to false here, because this is an OS interruption, not an explicit user pause.
    } else if (!data.permanent) {
      // The interruption ended. Only auto-resume if the user was intentionally playing before the duck.
      if (wasPlayingIntentionally) {
        await TrackPlayer.play();
      }
    }
  });
};