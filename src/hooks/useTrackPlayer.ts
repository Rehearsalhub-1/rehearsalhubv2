import { useEffect, useState, useCallback } from 'react';
import {
  SafeTrackPlayer as TrackPlayer,
  SafeCapability as Capability,
  SafeEvent as Event,
  SafeState as State,
  safeUsePlaybackState as usePlaybackState,
  safeUseProgress as useProgress,
  safeUseTrackPlayerEvents as useTrackPlayerEvents,
  SafeRepeatMode as RepeatMode,
  isExpoGo,
} from '../lib/safeNativeModules';
import type { Track } from 'react-native-track-player';
import Constants from 'expo-constants';
import { Image, Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { setWasPlayingIntentionally } from '../../service';


let isPlayerSetup = (global as any).isPlayerSetup || false;
let setupPromise: Promise<void> | null = (global as any).setupPromise || null;
let globalIsPlaying = false;
let globalCurrentTrack: any = null;
let globalIsSimulating = false;
let globalSimulationPosition = 0;
let globalQueue: any[] = [];
let globalOriginalQueue: any[] = [];
let globalQueueIndex: number = -1;
let globalIsShuffle = false;
let globalSimulationInterval: any = null;
let globalPollingInterval: any = null;

const startPollingInterval = () => {
};

const stopPollingInterval = () => {
  if (globalPollingInterval) {
    clearInterval(globalPollingInterval);
    globalPollingInterval = null;
  }
};

const startSimulationInterval = () => {
  if (globalSimulationInterval) return;
  globalSimulationInterval = setInterval(() => {
    if (globalIsPlaying) {
      globalSimulationPosition += 1000;
      if (
        globalABLoop.active &&
        globalABLoop.start !== null &&
        globalABLoop.end !== null &&
        globalABLoop.end > globalABLoop.start
      ) {
        if (globalSimulationPosition >= globalABLoop.end) {
          globalSimulationPosition = globalABLoop.start;
          notifySubscribers();
          return;
        }
      }
      if (globalSimulationPosition >= 240000) {
        globalIsPlaying = false;
        globalSimulationPosition = 0;
        notifySubscribers();
        const nextIndex = globalQueueIndex + 1;
        if (nextIndex < globalQueue.length) {
          globalQueueIndex = nextIndex;
        }
      } else {
        notifySubscribers();
      }
    }
  }, 1000);
};

const stopSimulationInterval = () => {
  if (globalSimulationInterval) {
    clearInterval(globalSimulationInterval);
    globalSimulationInterval = null;
  }
};

const shuffleArray = (array: any[]) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const syncNativeQueue = async () => {
  if (isExpoGo) return;
  try {
    const currentTrack = globalCurrentTrack;
    if (!currentTrack) return;
    
    const rntpTracks = globalQueue
      .filter(t => !!t.audioUrl || (String(t.id) === String(currentTrack.id) && !!currentTrack.audioUrl))
      .map(t => {
        if (String(t.id) === String(currentTrack.id)) {
          return formatTrackForRNTP({ ...t, audioUrl: currentTrack.audioUrl });
        }
        return formatTrackForRNTP(t);
      });
    const nativeQueue = await TrackPlayer.getQueue();
    let currentIdx = -1;
    const currentTrackIdx = await TrackPlayer.getCurrentTrack();
    if (currentTrackIdx !== null && currentTrackIdx !== undefined) {
      currentIdx = currentTrackIdx;
    }
    
    if (currentIdx === -1) return;
    const indicesToRemove = nativeQueue
      .map((_: any, i: any) => i)
      .filter((i: any) => i !== currentIdx)
      .sort((a: any, b: any) => b - a);
      
    if (indicesToRemove.length > 0) {
      try {
        await TrackPlayer.remove(indicesToRemove);
      } catch(e) {
        console.warn('Failed to remove tracks', e);
      }
    }
    const newIdx = rntpTracks.findIndex(t => String(t.id) === String(currentTrack.id));
    if (newIdx === -1) return;

    const beforeTracks = rntpTracks.slice(0, newIdx);
    const afterTracks = rntpTracks.slice(newIdx + 1);
    if (afterTracks.length > 0) {
      await TrackPlayer.add(afterTracks);
    }
    if (beforeTracks.length > 0) {
      await TrackPlayer.add(beforeTracks, 0);
    }
  } catch (error) {
    console.error('Failed to sync native queue:', error);
  }
};
let globalRepeatMode: 'off' | 'track' | 'playlist' = 'off';
let globalPlaybackRate = 1.0;
let globalIsLoading = false;
let globalIsFetching = false;
let globalABLoop: { start: number | null; end: number | null; active: boolean } = {
  start: null,
  end: null,
  active: false,
};
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

const formatTrackForRNTP = (track: any): Track => {
  let imageUri = '';
  if (track.imageUrl && typeof track.imageUrl === 'string') {
    imageUri = track.imageUrl;
  }
  else if (track.image) {
    try {
      if (typeof track.image === 'number') {
        const resolved = Image.resolveAssetSource(track.image);
        imageUri = resolved ? resolved.uri : '';
      } else if (typeof track.image === 'string') {
        imageUri = track.image;
      } else if (track.image.uri) {
        imageUri = track.image.uri;
      }
    } catch (e) {
      console.warn('Failed to resolve track image source:', e);
    }
  }

  return {
    id: track.id || Math.random().toString(),
    url: track.audioUrl || '',
    title: track.title || 'Unknown Title',
    artist: track.leadSinger || track.artist || 'Loveworld Singers',
    artwork: imageUri || undefined,
    album: track.program || 'Loveworld Singers',
    duration: track.duration,

    originalTrack: track
  } as any;
};

export const waitForPlayerSetup = async () => {
  if (setupPromise) await setupPromise;
};

export const useTrackPlayer = () => {
  const playbackState = usePlaybackState();
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const update = () => forceUpdate({});
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);

  useEffect(() => {
    let unmounted = false;

    const setupPlayer = async () => {
      if (isExpoGo) {
        if (!unmounted) {
          notifySubscribers();
        }
        return;
      }

      if (isPlayerSetup) {
        if (!unmounted) {
          notifySubscribers();
        }
        return;
      }

      if (setupPromise) {
        await setupPromise;
        if (!unmounted) {
          notifySubscribers();
        }
        return;
      }

      setupPromise = (async () => {
        let isAlreadyInitialized = false;
        try {
          // Attempt to get playback state. If it succeeds, player is already initialized natively.
          await TrackPlayer.getState();
          isAlreadyInitialized = true;
        } catch (e) {
          isAlreadyInitialized = false;
        }

        try {
          if (!isAlreadyInitialized) {
            await TrackPlayer.setupPlayer();
          }
        } catch (e: any) {
          const msg: string = e?.message ?? '';
          const code: string = e?.code ?? '';
          if (
            code === 'player_already_initialized' ||
            msg.includes('already been initialized') ||
            msg.includes('already initialized') ||
            msg.includes('SimpleCache')
          ) {
          } else {
            throw e;
          }
        }
        
        try {
          await TrackPlayer.updateOptions({
            icon: require('../../assets/icon.png'),
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.SeekTo,
              Capability.Stop,
            ],
            notificationCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.Stop,
            ],
            compactCapabilities: [
              Capability.SkipToPrevious,
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
            ],
            progressUpdateEventInterval: 0.5,  // update every 500ms for smooth slider
          });

        isPlayerSetup = true;
        (global as any).isPlayerSetup = true;
        } catch (e) {
          console.error("Failed to update options:", e);
        }
      })();
      (global as any).setupPromise = setupPromise;
      
      try {
        await setupPromise;
        if (!unmounted) notifySubscribers();
      } catch (error) {
        console.error('Failed to setup TrackPlayer:', error);
      }
    };

    setupPlayer();

    return () => {
      unmounted = true;
    };
  }, []);

  useTrackPlayerEvents([
    Event.PlaybackState, 
    Event.PlaybackTrackChanged,
    Event.PlaybackQueueEnded
  ].filter(Boolean), async (event: any) => {
    if ((global as any).isChatAudio) return;

    if (event.type === Event.PlaybackState) {
      const state = event.state;
      const parsedState = typeof state === 'object' ? (state as any).state : state;

      if (parsedState === State.Playing || parsedState === 'playing') {
        globalIsPlaying = true;
        globalIsLoading = false;
      } else if (
        parsedState === State.Buffering ||
        parsedState === State.Connecting ||
        parsedState === 'loading' ||
        parsedState === 'buffering' ||
        parsedState === 'connecting'
      ) {
        globalIsLoading = true;
      } else {
        if (!globalIsFetching || parsedState === State.Ready || parsedState === 'ready' || parsedState === State.Paused || parsedState === 'paused') {
          globalIsLoading = false;
        }
        if (
          parsedState === State.Paused ||
          parsedState === State.Stopped ||
          parsedState === State.None
        ) {
          globalIsPlaying = false;
        }
      }
      if (parsedState === State.Ready || parsedState === 'ready' || parsedState === State.Playing || parsedState === 'playing') {
        try {
          let idx: any = null;
          idx = await TrackPlayer.getCurrentTrack();
          
          if (idx !== undefined && idx !== null && globalQueue.length > 0) {
            let t: any = null;
            if (typeof idx === 'string') {
              t = globalQueue.find(x => String(x.id) === String(idx));
            } else {
              t = await TrackPlayer.getTrack(idx);
            }
            if (t) {
              const ft = globalQueue.find(x => String(x.id) === String(t.id)) || t.originalTrack || t;
              if (ft) {
                globalCurrentTrack = ft;
                const globalIdx = globalQueue.findIndex(x => String(x.id) === String(ft.id));
                if (globalIdx !== -1) globalQueueIndex = globalIdx;
              }
            }
          }
        } catch (e) {
          console.error('[PlaybackState Ready Handler] Failed to sync track:', e);
        }
      }

      notifySubscribers();
    }

    if (event.type === Event.PlaybackTrackChanged) {
      if ((global as any).isChatAudio) return;
      try {
        let newTrackObj: any = null;
        if ('nextTrack' in event && event.nextTrack !== undefined && event.nextTrack !== null) {
          newTrackObj = await TrackPlayer.getTrack(event.nextTrack as number);
        }
        if (!newTrackObj) {
          const currentIdx = await TrackPlayer.getCurrentTrack();
          if (currentIdx !== null && currentIdx !== undefined) {
            newTrackObj = await TrackPlayer.getTrack(currentIdx);
          }
        }

        if (newTrackObj) {
          const fullTrack = globalQueue.find(t => String(t.id) === String(newTrackObj.id)) || newTrackObj.originalTrack || newTrackObj;
          
          if (fullTrack) {
            globalCurrentTrack = fullTrack;
            const idx = globalQueue.findIndex(t => String(t.id) === String(fullTrack.id));
            if (idx !== -1) globalQueueIndex = idx;
            notifySubscribers();
          }
        }
      } catch (e) {
        console.error('Failed to update active track from RNTP event:', e);
      }
    }
    if (event.type === Event.PlaybackQueueEnded) {
      if ((global as any).isChatAudio) return;
      if (globalRepeatMode === 'track' && globalCurrentTrack) {
        setTimeout(async () => {
          try {
            await TrackPlayer.seekTo(0);
            await TrackPlayer.play();
            globalIsPlaying = true;
            notifySubscribers();
          } catch {}
        }, 200);
      } else if (globalRepeatMode === 'playlist') {
        const nextIndex = globalQueueIndex + 1;
        const targetTrack = nextIndex < globalQueue.length ? globalQueue[nextIndex] : globalQueue[0];
        if (targetTrack) {
          setTimeout(() => {
            (async () => { await play(targetTrack); })();
          }, 300);
        } else {
          globalIsPlaying = false;
          notifySubscribers();
        }
      } else if (globalQueue.length > 1) {
        const nextIndex = globalQueueIndex + 1;
        if (nextIndex < globalQueue.length) {
          const nextTrack = globalQueue[nextIndex];
          if (nextTrack) {
            setTimeout(() => {
              (async () => { await play(nextTrack); })();
            }, 300);
          }
        } else {
          globalIsPlaying = false;
          notifySubscribers();
        }
      } else {
        globalIsPlaying = false;
        notifySubscribers();
      }
    }
  });

  const play = useCallback(async (track?: any, queue?: any[], autoplay: boolean = true) => {
    if (queue && queue.length > 0) {
      globalOriginalQueue = queue;
      if (globalIsShuffle) {
        const rest = queue.filter(t => String(t.id) !== String(track?.id));
        globalQueue = track ? [track, ...shuffleArray(rest)] : shuffleArray(queue);
        globalQueueIndex = track ? 0 : -1;
      } else {
        globalQueue = queue;
        if (track) {
          const idx = queue.findIndex(t => String(t.id) === String(track.id));
          if (idx !== -1) globalQueueIndex = idx;
        }
      }
    } else {
      if (track && globalQueue.length > 0) {
        const idx = globalQueue.findIndex(t => String(t.id) === String(track.id));
        if (idx !== -1) globalQueueIndex = idx;
      }
    }

    if (isExpoGo) {
      if (track) {
        globalCurrentTrack = track;
        const hasAudio = !!track.audioUrl;
        if (!hasAudio) {
          globalIsSimulating = false;
          globalSimulationPosition = 0;
          globalIsPlaying = false;
          setWasPlayingIntentionally(false);
          notifySubscribers();
          if (autoplay) Alert.alert('No Audio', 'There is no audio file uploaded for this song.');
          return;
        }
        globalIsSimulating = autoplay;
        globalSimulationPosition = 0;
      }
      globalIsPlaying = autoplay;
      setWasPlayingIntentionally(autoplay);
      notifySubscribers();
      return;
    }

    try {
      if (setupPromise) {
        await setupPromise;
      }
      
      if (track) {
        globalIsFetching = true;
        globalIsLoading = true;
        notifySubscribers();

        const hasAudio = !!track.audioUrl;

        if (!hasAudio) {
          await TrackPlayer.reset();
          globalCurrentTrack = track;
          globalIsSimulating = false;
          globalSimulationPosition = 0;
          globalIsPlaying = false;
          globalIsLoading = false;
          globalIsFetching = false;
          notifySubscribers();
          if (autoplay) Alert.alert('No Audio', 'There is no audio file uploaded for this song.');
          return;
        }

        globalIsSimulating = false;
        if (globalCurrentTrack?.url && globalCurrentTrack.url === track.audioUrl) {
          globalCurrentTrack = track; // Seamlessly adopt the rich track metadata
          globalIsLoading = false;
          globalIsFetching = false;
          notifySubscribers();
          
          if (autoplay) {
            setWasPlayingIntentionally(true);
            await TrackPlayer.play();
            globalIsPlaying = true;
            notifySubscribers();
          }
          return; // Skip reset and adding!
        }
        await TrackPlayer.reset();

        if (globalQueue.length > 1) {
          const rntpTracks = globalQueue
            .filter(t => !!t.audioUrl || (String(t.id) === String(track.id) && !!track.audioUrl)) // include if it's the target track with a custom audioUrl
            .map(t => {
              if (String(t.id) === String(track.id)) {
                return formatTrackForRNTP({ ...t, audioUrl: track.audioUrl });
              }
              return formatTrackForRNTP(t);
            });
          await TrackPlayer.add(rntpTracks);
          const rntpIndex = rntpTracks.findIndex(t => String(t.id) === String(track.id));
          if (rntpIndex > 0) {
            await TrackPlayer.skip(rntpIndex);
          }
        } else {
          const rntpTrack = formatTrackForRNTP(track);
          await TrackPlayer.add([rntpTrack]);
        }

        if (!isExpoGo) {
          try {
            let nativeMode = RepeatMode.Off;
            if (globalRepeatMode === 'playlist') nativeMode = RepeatMode.Queue;
            else if (globalRepeatMode === 'track') nativeMode = RepeatMode.Track;
            await TrackPlayer.setRepeatMode(nativeMode);
          } catch (e) {
            console.error('Failed to re-apply native repeat mode after reset', e);
          }
          if (globalPlaybackRate !== 1.0) {
            try {
              await TrackPlayer.setRate(globalPlaybackRate);
            } catch (e) {}
          }
        }
      }

      if (autoplay) {
        setWasPlayingIntentionally(true);
        await TrackPlayer.play();
        globalIsPlaying = true;
      } else {
        setWasPlayingIntentionally(false);
        await TrackPlayer.pause();
        globalIsPlaying = false;
        globalIsLoading = false;
      }
      globalIsFetching = false;
      try {
        const pState = await TrackPlayer.getState();
        if (pState === State.Playing || pState === State.Ready || pState === State.Paused) {
          globalIsLoading = false;
        }
      } catch(e) {}
      
      notifySubscribers();
    } catch (error) {
      globalIsLoading = false;
      globalIsFetching = false;
      notifySubscribers();
      console.error('Failed to play track:', error);
    }
  }, []);

  useEffect(() => {
    if (globalIsPlaying) {
      if (globalIsSimulating) {
        startSimulationInterval();
        stopPollingInterval();
      } else {
        stopSimulationInterval();
        startPollingInterval();
      }
    } else {
      stopSimulationInterval();
      stopPollingInterval();
    }
  }, [globalIsPlaying, globalIsSimulating]);

  const pause = useCallback(async () => {
    globalIsPlaying = false;
    setWasPlayingIntentionally(false);
    notifySubscribers();

    if (isExpoGo || globalIsSimulating) {
      return;
    }

    try {
      if (setupPromise) {
        await setupPromise;
      }
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Failed to pause track:', error);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (globalIsPlaying) {
      await pause();
    } else {
      globalIsPlaying = true;
      notifySubscribers();
      await play();
    }
  }, [play, pause]);

  const seekTo = useCallback(async (value: number) => {
    if (isExpoGo || globalIsSimulating) {
      globalSimulationPosition = value;
      notifySubscribers();
      return;
    }

    try {
      if (setupPromise) {
        await setupPromise;
      }
      await TrackPlayer.seekTo(value / 1000);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, []);

  const skipToNext = useCallback(async () => {
    if (globalQueue.length > 0) {
      let nextIndex = globalQueueIndex + 1;
      if (nextIndex >= globalQueue.length) {
        nextIndex = globalRepeatMode === 'playlist' ? 0 : globalQueueIndex;
      }
      if (nextIndex >= 0 && nextIndex < globalQueue.length && nextIndex !== globalQueueIndex) {
        const nextTrack = globalQueue[nextIndex];
        if (nextTrack) {
          await play(nextTrack, undefined, true);
          return;
        }
      }
      if (!isExpoGo) {
        try {
          await TrackPlayer.skipToNext();
        } catch (e) {
          if (globalRepeatMode === 'playlist') {
            try { await TrackPlayer.skip(0); } catch {}
          } else {
            try { 
              await TrackPlayer.seekTo(0);
              await TrackPlayer.pause();
            } catch {}
          }
        }
      } else {
        globalSimulationPosition = 0;
        globalQueueIndex = nextIndex;
        globalCurrentTrack = globalQueue[nextIndex];
        notifySubscribers();
      }
    }
  }, [play]);

  const skipToPrevious = useCallback(async () => {
    if (globalQueue.length > 0) {
      let prevIndex = globalQueueIndex - 1;
      if (prevIndex < 0) {
        prevIndex = globalRepeatMode === 'playlist' ? globalQueue.length - 1 : 0;
      }
      if (prevIndex >= 0 && prevIndex < globalQueue.length && prevIndex !== globalQueueIndex) {
        const prevTrack = globalQueue[prevIndex];
        if (prevTrack) {
          await play(prevTrack, undefined, true);
          return;
        }
      }
      if (!isExpoGo) {
        try {
          await TrackPlayer.skipToPrevious();
        } catch (e) {
          if (globalRepeatMode === 'playlist') {
            try { await TrackPlayer.skip((await TrackPlayer.getQueue()).length - 1); } catch {}
          } else {
            try { await TrackPlayer.seekTo(0); } catch {}
          }
        }
      } else {
        globalSimulationPosition = 0;
        globalQueueIndex = prevIndex;
        globalCurrentTrack = globalQueue[prevIndex];
        notifySubscribers();
      }
    }
  }, [play]);

  const skipToTrack = useCallback(async (track: any) => {
    if (!track) return;
    await play(track, undefined, true);
  }, [play]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    globalPlaybackRate = rate;
    if (!isExpoGo) {
      try {
        await TrackPlayer.setRate(rate);
      } catch (e) {
        console.warn('Failed to set rate:', e);
      }
    }
    notifySubscribers();
  }, []);

  const toggleShuffle = useCallback(() => {
    globalIsShuffle = !globalIsShuffle;
    if (globalIsShuffle) {
      if (globalQueue.length > 0) {
        if (globalOriginalQueue.length === 0) {
          globalOriginalQueue = [...globalQueue];
        }
        const currentTrack = globalCurrentTrack;
        const rest = globalOriginalQueue.filter(t => String(t.id) !== String(currentTrack?.id));
        globalQueue = currentTrack ? [currentTrack, ...shuffleArray(rest)] : shuffleArray(globalOriginalQueue);
        globalQueueIndex = currentTrack ? 0 : -1;
      }
    } else {
      if (globalOriginalQueue.length > 0) {
        globalQueue = [...globalOriginalQueue];
        const currentTrack = globalCurrentTrack;
        if (currentTrack) {
          const idx = globalQueue.findIndex(t => String(t.id) === String(currentTrack.id));
          if (idx !== -1) globalQueueIndex = idx;
        }
      }
    }
    notifySubscribers();
    (async () => {
      await syncNativeQueue();
    })();
  }, []);

  const toggleRepeat = useCallback(() => {
    globalRepeatMode = globalRepeatMode === 'off' ? 'playlist' : globalRepeatMode === 'playlist' ? 'track' : 'off';
    
    if (!isExpoGo) {
      (async () => {
        try {
          let nativeMode = RepeatMode.Off;
          if (globalRepeatMode === 'playlist') nativeMode = RepeatMode.Queue;
          else if (globalRepeatMode === 'track') nativeMode = RepeatMode.Track;
          await TrackPlayer.setRepeatMode(nativeMode);
        } catch (e) {
          console.error('Failed to set native repeat mode', e);
        }
      })();
    }
    
    notifySubscribers();
  }, []);

  const setLoopPointA = useCallback(async (timeMs?: number) => {
    let point = timeMs;
    if (point === undefined) {
      const posSec = await TrackPlayer.getPosition().catch(() => 0);
      point = Math.floor(posSec * 1000);
    }
    const newEnd = globalABLoop.end !== null && globalABLoop.end > point ? globalABLoop.end : null;
    globalABLoop = {
      ...globalABLoop,
      start: point,
      end: newEnd,
      active: point !== null && newEnd !== null && newEnd > point,
    };
    notifySubscribers();
    return point;
  }, []);

  const setLoopPointB = useCallback(async (timeMs?: number) => {
    let point = timeMs;
    if (point === undefined) {
      const posSec = await TrackPlayer.getPosition().catch(() => 0);
      point = Math.floor(posSec * 1000);
    }
    const newStart = globalABLoop.start !== null && globalABLoop.start < point ? globalABLoop.start : 0;
    globalABLoop = {
      ...globalABLoop,
      start: newStart,
      end: point,
      active: newStart !== null && point !== null && point > newStart,
    };
    notifySubscribers();
    return point;
  }, []);

  const toggleABLoop = useCallback(() => {
    if (globalABLoop.start !== null && globalABLoop.end !== null && globalABLoop.end > globalABLoop.start) {
      globalABLoop.active = !globalABLoop.active;
      notifySubscribers();
    }
  }, []);

  const clearABLoop = useCallback(() => {
    globalABLoop = {
      start: null,
      end: null,
      active: false,
    };
    notifySubscribers();
  }, []);

  const adjustLoopPointA = useCallback((deltaMs: number) => {
    if (globalABLoop.start === null) return;
    const newStart = Math.max(0, globalABLoop.start + deltaMs);
    if (globalABLoop.end !== null && newStart >= globalABLoop.end) return;
    globalABLoop = {
      ...globalABLoop,
      start: newStart,
    };
    notifySubscribers();
  }, []);

  const adjustLoopPointB = useCallback((deltaMs: number) => {
    if (globalABLoop.end === null) return;
    const newEnd = Math.max(0, globalABLoop.end + deltaMs);
    if (globalABLoop.start !== null && newEnd <= globalABLoop.start) return;
    globalABLoop = {
      ...globalABLoop,
      end: newEnd,
    };
    notifySubscribers();
  }, []);

  const isActuallyPlaying = globalIsPlaying;
  
  const isLoading = globalIsLoading;

  return {
    isSetupComplete: isPlayerSetup,
    isPlaying: isActuallyPlaying,
    isLoading: isLoading,
    currentTrack: globalCurrentTrack,
    queue: globalQueue,
    queueIndex: globalQueueIndex,
    isShuffle: globalIsShuffle,
    repeatMode: globalRepeatMode,
    playbackRate: globalPlaybackRate,
    abLoop: globalABLoop,
    setLoopPointA,
    setLoopPointB,
    toggleABLoop,
    clearABLoop,
    adjustLoopPointA,
    adjustLoopPointB,
    setPlaybackRate,
    play,
    pause,
    togglePlayback,
    seekTo,
    skipToNext,
    skipToPrevious,
    skipToTrack,
    toggleShuffle,
    toggleRepeat
  };
};

export const useTrackPlayerProgress = (interval = 200) => {
  const [progress, setProgress] = useState({ position: 0, duration: 0 });
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const update = () => forceUpdate({});
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);

  useEffect(() => {
    let mounted = true;
    let isSeekingLoop = false;
    const poll = async () => {
      try {
        if (!isPlayerSetup) return;
        const posSec = await TrackPlayer.getPosition().catch(() => 0);
        const durSec = await TrackPlayer.getDuration().catch(() => 0);
        const posMs = posSec * 1000;

        // Auto-loop back to Point A when Point B is reached
        if (
          globalABLoop.active &&
          globalABLoop.start !== null &&
          globalABLoop.end !== null &&
          globalABLoop.end > globalABLoop.start
        ) {
          if (posMs >= globalABLoop.end && !isSeekingLoop) {
            isSeekingLoop = true;
            await TrackPlayer.seekTo(globalABLoop.start / 1000).catch(() => {});
            setTimeout(() => { isSeekingLoop = false; }, 250);
            if (mounted) {
              setProgress({ position: globalABLoop.start / 1000, duration: durSec });
            }
            return;
          }
        }

        if (mounted) {
          setProgress({ position: posSec, duration: durSec });
        }
      } catch (e) {}
    };
    const timer = setInterval(poll, interval);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [interval]);

  return {
    position: globalIsSimulating ? globalSimulationPosition : progress.position * 1000,
    duration: globalIsSimulating ? 240000 : progress.duration * 1000,
  };
};
