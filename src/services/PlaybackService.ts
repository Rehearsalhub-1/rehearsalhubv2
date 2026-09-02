import {
  SafeTrackPlayer as TrackPlayer,
  SafeEvent as Event,
  SafeState as State,
} from '../lib/safeNativeModules';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event: any) => TrackPlayer.seekTo(event.position));
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event: any) => {
    if (event.paused) {
      const currentState = await TrackPlayer.getState();
      (global as any).wasPlayingBeforeDuck = currentState === State.Playing;
      if (!(global as any).isRecording) {
        await TrackPlayer.pause();
      }
    } else if (!event.permanent) {
      if ((global as any).wasPlayingBeforeDuck && !(global as any).isReviewPlaying) {
        await TrackPlayer.play();
      }
      (global as any).wasPlayingBeforeDuck = false;
    }
  });
}
