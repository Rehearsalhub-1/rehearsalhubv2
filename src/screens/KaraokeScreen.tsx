import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/apiClient';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, { State, usePlaybackState, RepeatMode, Capability, Event, useTrackPlayerEvents } from 'react-native-track-player';
import { useTrackPlayer, waitForPlayerSetup, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import {
  StyleSheet, View, Text, TouchableOpacity, Dimensions, Animated,
  ActivityIndicator, ImageBackground, Modal, FlatList, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import Slider from '@react-native-community/slider';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '../lib/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_SIZE = 20; // songs per page
let cachedLibrary: any[] = [];
let cachedLastDoc: any = null;
let cachedHasMore = true;

interface LyricLine {
  time: number;
  text: string;
}

const parseLRCLyrics = (lrc: string): LyricLine[] => {
  if (!lrc) return [{ time: 0, text: 'No synced lyrics available' }];
  const lines = lrc.split('\n');
  const parsed: LyricLine[] = [];
  const timeRegex = /\[(\d+):(\d{2})(?:\.(\d+))?\]/g;

  lines.forEach(line => {
    let match;
    const matches = [];
    while ((match = timeRegex.exec(line)) !== null) {
      matches.push(match);
    }

    if (matches.length > 0) {
      const text = line.replace(/\[\d+:\d{2}(?:\.\d+)?\]/g, '').trim();
      if (text) {
        matches.forEach(m => {
          const minutes = parseInt(m[1], 10);
          const seconds = parseInt(m[2], 10);
          let ms = 0;
          if (m[3]) {
            ms = parseInt(m[3].padEnd(3, '0').substring(0, 3), 10);
          }
          const timeInSeconds = (minutes * 60) + seconds + (ms / 1000);
          parsed.push({ time: timeInSeconds, text });
        });
      }
    } else {
      const text = line.trim();
      if (text && !text.startsWith('[') && parsed.length > 0) {
        parsed[parsed.length - 1].text += ' ' + text;
      }
    }
  });

  if (parsed.length === 0) {
    parsed.push({ time: 0, text: 'No synced lyrics found' });
  }

  return parsed.sort((a, b) => a.time - b.time);
};

export default function KaraokeScreen({ route, navigation }: any) {
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, themeName, insets);
  const s = styles;
  const T = theme.colors;

  const [activeSong, setActiveSong] = useState<any>(null);

  useEffect(() => {
    if (route.params?.activeTrack) {
      handleSelectSong(route.params.activeTrack);
    }
  }, [route.params?.activeTrack]);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [library, setLibrary] = useState<any[]>(cachedLibrary);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(cachedLastDoc);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePart, setActivePart] = useState<string>('full');
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const { isPlaying, isLoading: isTrackPlayerBuffering, play: tpPlay, pause: tpPause } = useTrackPlayer();
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [takes, setTakes] = useState<any[]>([]);
  const [showTakesModal, setShowTakesModal] = useState(false);
  const [reviewTake, setReviewTake] = useState<any>(null);
  const [isReviewPlaying, setIsReviewPlaying] = useState(false);
  const reviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReviewPlayingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayValue, setSeekDisplayValue] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const bgWasPlayingRef = useRef(false);
  const TAKES_DIR = FileSystem.documentDirectory + 'karaoke_takes/';

  useEffect(() => {
    const initAudioAndTakes = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false, // Changed to false to prevent battery drain
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          shouldDuckAndroid: false,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        });
      } catch (e) {
        console.error('Failed to init audio mode:', e);
      }

      setIsPlayerReady(true);

      const dirInfo = await FileSystem.getInfoAsync(TAKES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(TAKES_DIR, { intermediates: true });
      }
      loadTakes();
    };
    initAudioAndTakes();

    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => { });
        recordingRef.current = null;
      }
      (global as any).isReviewPlaying = false;
      (global as any).isRecording = false;
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // Changed to false to prevent battery drain
        playThroughEarpieceAndroid: false,
      }).catch(() => { });
    };
  }, []);

  const loadTakes = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(TAKES_DIR);
      const takesList = [];
      for (const file of files) {
        if (file.endsWith('.m4a')) {
          const info = await FileSystem.getInfoAsync(TAKES_DIR + file);

          let startPos = 0;
          let latencyMs = 0;
          const matchWithLatency = file.match(/_(\d+)s_(\d+)ms_(\d+)\.m4a$/);
          const matchLegacy = file.match(/_(\d+)s_(\d+)\.m4a$/);

          let timestamp = info.exists ? info.modificationTime || 0 : 0;

          if (matchWithLatency) {
            startPos = parseInt(matchWithLatency[1], 10);
            latencyMs = parseInt(matchWithLatency[2], 10);
            timestamp = parseInt(matchWithLatency[3], 10);
          } else if (matchLegacy) {
            startPos = parseInt(matchLegacy[1], 10);
            timestamp = parseInt(matchLegacy[2], 10);
          }

          takesList.push({
            id: file,
            name: file.replace('.m4a', ''),
            uri: TAKES_DIR + file,
            size: info.exists ? info.size : 0,
            createdAt: timestamp,
            startPos: startPos,
            latencyMs: latencyMs
          });
        }
      }
      setTakes(takesList.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {

    }
  };
  const [recordStartPos, setRecordStartPos] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const reviewSoundRef = useRef<Audio.Sound | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const waveformAnim = useRef(new Animated.Value(0)).current;
  const [isLooping, setIsLooping] = useState(false);
  useEffect(() => {
    if (showSongPicker && library.length === 0) {
      fetchLibrary(PAGE_SIZE);
    }
  }, [showSongPicker]);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setRemoteSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsRemoteSearching(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: any[] }>('/songs?limit=300').catch(() => null);
      const snap = { docs: (res?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };
        const q2 = searchQuery.toLowerCase();
        const results = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter((s: any) =>
            s.title?.toLowerCase().includes(q2) ||
            s.writer?.toLowerCase().includes(q2) ||
            s.leadSinger?.toLowerCase().includes(q2)
          );
        setRemoteSearchResults(results);
      } catch {
      } finally {
        setIsRemoteSearching(false);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const fetchLibrary = async (limitSize: number = PAGE_SIZE, forceRefresh: boolean = false) => {
    if (!forceRefresh && cachedLibrary.length > 0) {
      setLibrary(cachedLibrary);
      setLastDoc(cachedLastDoc);
      setHasMore(cachedHasMore);
      setLoadingLibrary(false);
      return;
    }
    setLoadingLibrary(true);
    try {
      // songs query
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/songs').catch(() => null);
      const snap = { docs: (res?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };
      const songs = snap.docs.map((doc, idx) => ({ id: doc.id, _idx: idx, ...doc.data() }));

      const nextLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      const nextHasMore = snap.docs.length >= limitSize;

      setLastDoc(nextLastDoc);
      setHasMore(nextHasMore);
      cachedLastDoc = nextLastDoc;
      cachedHasMore = nextHasMore;

      setLibrary(songs);
      cachedLibrary = songs;
    } catch (e) {
      console.error('Failed to fetch library:', e);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const getTimeVal = (item: any): number => {
    const val = item.publishedAt || item.createdAt;
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime() || 0;
    if (val.toMillis) return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    return 0;
  };

  const loadMoreLibrary = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    if (searchQuery.trim()) return; // don't paginate during search
    setLoadingMore(true);
    try {
      // songs query
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/songs').catch(() => null);
      const snap = { docs: (res?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };

      const startIdx = cachedLibrary.length;
      const newSongs = snap.docs.map((doc, idx) => ({ id: doc.id, _idx: startIdx + idx, ...doc.data() }));
      const allSongs = [...cachedLibrary, ...newSongs];
      cachedLibrary = allSongs;
      setLibrary(allSongs);

      const nextLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastDoc;
      setLastDoc(nextLastDoc);
      cachedLastDoc = nextLastDoc;

      const nextHasMore = snap.docs.length >= PAGE_SIZE;
      setHasMore(nextHasMore);
      cachedHasMore = nextHasMore;
    } catch (e) {
      console.error('Failed to load more library:', e);
    } finally {
      setLoadingMore(false);
    }
  };
  const [remoteSearchResults, setRemoteSearchResults] = useState<any[]>([]);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);
  const filteredLibrary = searchQuery.trim()
    ? (() => {
      const q = searchQuery.toLowerCase();
      const local = cachedLibrary.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.writer?.toLowerCase().includes(q) ||
        s.leadSinger?.toLowerCase().includes(q)
      );
      const localIds = new Set(local.map((s: any) => s.id));
      const remote = remoteSearchResults.filter((s: any) => !localIds.has(s.id));
      return [...local, ...remote];
    })()
    : library;

  const handleSelectSong = (song: any) => {
    stopAudio();
    setActiveSong(song);
    const initialPart = song.audioUrls?.full ? 'full' : (song.audioUrl ? 'full' : 'none');
    setActivePart(initialPart);
    let parsedLyrics: LyricLine[];
    if (Array.isArray(song.syncedLyrics) && song.syncedLyrics.length > 0) {
      parsedLyrics = [...song.syncedLyrics].sort((a: LyricLine, b: LyricLine) => a.time - b.time);
    } else if (song.karaokeLrcText) {
      parsedLyrics = parseLRCLyrics(song.karaokeLrcText);
    } else {
      parsedLyrics = parseLRCLyrics('');
    }
    setLyrics(parsedLyrics);
    setCurrentLineIndex(0);
    setShowSongPicker(false);
  };
  const { position: tpPos, duration: tpDur } = useTrackPlayerProgress(200);
  useEffect(() => {
    if (!isSeeking && tpPos > 0) {
      setPosition(tpPos / 1000);
    }
    if (tpDur > 0) {
      setDuration(tpDur / 1000);
    }
  }, [tpPos, tpDur, isSeeking]);

  useEffect(() => {
    if (!activeSong || !isPlayerReady) return;
    loadAudioTrack();
  }, [activeSong, activePart, isPlayerReady]);

  const getActiveAudioUrl = () => {
    if (activePart === 'full') return activeSong.audioUrls?.full || activeSong.audioUrl || null;
    if (activeSong.audioUrls?.[activePart]) return activeSong.audioUrls[activePart];
    return activeSong.audioUrl || null;
  };

  const loadAudioTrack = async () => {
    setIsBuffering(true);
    try {
      const rawUrl = getActiveAudioUrl();
      if (!rawUrl) {
        setIsBuffering(false);
        return;
      }

      const urlHash = rawUrl.replace(/[^a-zA-Z0-9]/g, '_');
      const localUri = FileSystem.cacheDirectory + 'karaoke_track_' + urlHash + '.m4a';
      FileSystem.getInfoAsync(localUri).then((fileInfo) => {
        if (!fileInfo.exists) {
          FileSystem.downloadAsync(rawUrl, localUri).catch((err) => {

          });
        }
      });
      await waitForPlayerSetup();
      await TrackPlayer.reset();

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const playUri = fileInfo.exists ? localUri : rawUrl;

      await TrackPlayer.add({
        id: activeSong.id || 'karaoke_track',
        url: playUri,
        title: activeSong.title || 'Karaoke Track',
        artist: activeSong.leadSinger || activeSong.artist || 'Loveworld Singers',
        artwork: activeSong.imageUrl || activeSong.image || undefined,
      });

      setIsBuffering(false);
    } catch (err) {
      console.error('Failed to load track', err);
      setIsBuffering(false);
    }
  };

  const stopAudio = async () => {
    try {
      await tpPause();
      await waitForPlayerSetup();
      await TrackPlayer.reset();
    } catch { }
  };
  useEffect(() => {
    if (lyrics.length === 0 || isSeeking) return;

    let activeIdx = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (position >= lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== currentLineIndex) {
      setCurrentLineIndex(activeIdx);
      Animated.sequence([
        Animated.timing(waveformAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(waveformAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    }
  }, [position, lyrics, isSeeking]);

  const recordLatencyRef = useRef(0);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to record takes.');
        return;
      }
      setRecordStartPos(position);
      const initStartTime = Date.now();

      const createRecordingPromise = (async () => {
        try {
          const unprocessedOptions = {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
            android: {
              ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
              audioSource: 9, // AndroidAudioSource.UNPROCESSED (Raw mic, no AEC)
            }
          };
          return await Audio.Recording.createAsync(unprocessedOptions);
        } catch (e) {
          const micOptions = {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
            android: {
              ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
              audioSource: 1, // AndroidAudioSource.MIC
            }
          };
          return await Audio.Recording.createAsync(micOptions);
        }
      })();

      const [recResult] = await Promise.all([
        createRecordingPromise,
        tpPlay().catch(err => {
          console.warn('TrackPlayer play failed in startRecording:', err);
        })
      ]);

      const initLatencyMs = Date.now() - initStartTime;
      recordLatencyRef.current = initLatencyMs;

      if (recResult && recResult.recording) {
        setRecording(recResult.recording);
        recordingRef.current = recResult.recording;
        setIsRecording(true);
        (global as any).isRecording = true;
      } else {
        throw new Error('Recording object was not created successfully.');
      }
    } catch (err) {
      (global as any).isRecording = false;
      console.error('Failed to start recording', err);
      Alert.alert('Recording Failed', 'Could not start the recording engine.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      (global as any).isRecording = false;
      await recording.stopAndUnloadAsync();
      const rawUri = recording.getURI();
      setRecording(null);
      recordingRef.current = null;

      await tpPause();
      if (rawUri) {
        const timestamp = new Date().getTime();
        const safeTitle = (activeSong?.title || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const takeNum = takes.filter(t => t.name.includes(safeTitle)).length + 1;
        const startSecs = Math.floor(recordStartPos);
        let autoLatencyMs = recordLatencyRef.current || 0;

        if (Platform.OS === 'android') {
          autoLatencyMs += 130;
        }

        const newFileName = `Take_${takeNum}_${safeTitle}_${startSecs}s_${autoLatencyMs}ms_${timestamp}.m4a`;
        const finalPath = TAKES_DIR + newFileName;

        const bgUri = getActiveAudioUrl();

        if (bgUri) {
          setIsBouncing(true);
          try {
            const formData = new FormData();
            formData.append('bgUri', bgUri);
            formData.append('startSecs', startSecs.toString());
            formData.append('latencyMs', autoLatencyMs.toString());
            formData.append('vocals', {
              uri: rawUri,
              name: 'take.m4a',
              type: 'audio/m4a'
            } as any);

            const token = await getAccessToken();
            const res = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/mix-karaoke`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            if (!res.ok) throw new Error('Failed to mix audio on server');
            
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onload = async () => {
              const base64data = (reader.result as string).split(',')[1];
              await FileSystem.writeAsStringAsync(finalPath, base64data, { encoding: FileSystem.EncodingType.Base64 });
              setIsBouncing(false);
              Alert.alert('Recording Saved', `Take ${takeNum} has been saved and perfectly mixed!`);
              loadTakes();
            };
            reader.readAsDataURL(blob);
          } catch (e) {
            console.error('Server mix failed:', e);
            setIsBouncing(false);
            await FileSystem.moveAsync({ from: rawUri, to: finalPath });
            Alert.alert('Recording Saved', `Take ${takeNum} saved (Vocals only)`);
            loadTakes();
          }
        } else {
          await FileSystem.moveAsync({ from: rawUri, to: finalPath });
          Alert.alert('Recording Saved', `Take ${takeNum} has been saved successfully!`);
          loadTakes(); // Refresh list
        }
      }
    } catch (err) {
      setIsBouncing(false);
      console.error('Failed to stop recording', err);
    }
  };

  const [vocalSyncMs, setVocalSyncMs] = useState(0);
  const [expandedTakeId, setExpandedTakeId] = useState<string | null>(null);
  const [shareTake, setShareTake] = useState<any | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [lastViewedTakeCount, setLastViewedTakeCount] = useState(0);
  useTrackPlayerEvents([Event.PlaybackQueueEnded], async () => {
    if (showTakesModal) {
      await stopReviewTake();
    }
  });

  const playReviewTake = async (take: any, manualSyncOffsetMs: number | null = null) => {
    try {
      if (manualSyncOffsetMs === null && isReviewPlaying && reviewTake?.id === take.id) {
        await stopReviewTake();
        return;
      }
      await stopReviewTake();
      if (isReviewPlayingTimeoutRef.current) {
        clearTimeout(isReviewPlayingTimeoutRef.current);
        isReviewPlayingTimeoutRef.current = null;
      }
      (global as any).isReviewPlaying = true;

      setReviewTake(take);
      setIsReviewPlaying(true);

      if (manualSyncOffsetMs === null) {
        setVocalSyncMs(take.latencyMs || 0);
      }
      await waitForPlayerSetup();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: take.id,
        url: take.uri,
        title: take.name || 'My Take',
        artist: 'Karaoke Recording',
      });
      await TrackPlayer.play();

    } catch (e) {
      console.error('Review playback failed:', e);
      setIsReviewPlaying(false);
      (global as any).isReviewPlaying = false;
    }
  };

  const stopReviewTake = async () => {
    try {
      if (reviewTimeoutRef.current) {
        clearTimeout(reviewTimeoutRef.current);
        reviewTimeoutRef.current = null;
      }
      try {
        await waitForPlayerSetup();
        await TrackPlayer.reset();
      } catch { }

      setIsReviewPlaying(false);
      setReviewTake(null);
      if (isReviewPlayingTimeoutRef.current) {
        clearTimeout(isReviewPlayingTimeoutRef.current);
      }
      isReviewPlayingTimeoutRef.current = setTimeout(() => {
        (global as any).isReviewPlaying = false;
        isReviewPlayingTimeoutRef.current = null;
      }, 500);
    } catch (e) {
      (global as any).isReviewPlaying = false;
    }
  };

  const deleteTake = (take: any) => {
    Alert.alert('Delete Take?', `Are you sure you want to delete ${take.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            if (reviewTake?.id === take.id) await stopReviewTake();
            await FileSystem.deleteAsync(take.uri);
            loadTakes();
          } catch (e) {
            console.error('Delete failed:', e);
          }
        }
      }
    ]);
  };

  const togglePlay = async () => {
    if (isReviewPlaying) {
      await stopReviewTake();
      return;
    }
    if (reviewTake) {
      await playReviewTake(reviewTake);
      return;
    }

    if (isPlaying) {
      await tpPause();
      if (isRecording) {
        await stopRecording();
      }
    } else {
      await tpPlay();
    }
  };

  const skipBack = async () => {
    const newPos = Math.max(0, position - 10);
    await TrackPlayer.seekTo(newPos).catch(() => { });
  };

  const skipForward = async () => {
    const newPos = Math.min(duration, position + 10);
    await TrackPlayer.seekTo(newPos).catch(() => { });
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekDisplayValue(position);
  };
  const handleSeekEnd = async (val: number) => {
    await TrackPlayer.seekTo(val).catch(() => { });
    setTimeout(() => {
      setIsSeeking(false);
    }, 400);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const totalSeconds = Math.floor(seconds);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const toggleLoop = async () => {
    const next = !isLooping;
    setIsLooping(next);
    try {
      await TrackPlayer.setRepeatMode(next ? RepeatMode.Track : RepeatMode.Off);
    } catch { }
  };


  const openTakesModal = async () => {
    try {
      await tpPause();
      await TrackPlayer.reset(); // empty queue — nothing left to resume
    } catch { }
    (global as any).isReviewPlaying = true; // block any stray duck-resume
    setLastViewedTakeCount(takes.length);
    setShowTakesModal(true);
  };

  const closeTakesModal = async () => {
    await stopReviewTake();
    setShowTakesModal(false);
    if (activeSong && isPlayerReady) {
      setTimeout(() => {
        loadAudioTrack();
      }, 100);
    }
  };

  const currentLyric = lyrics[currentLineIndex]?.text || ' ';
  const nextLyric = lyrics[currentLineIndex + 1]?.text || '';
  const progress = duration > 0 ? (position / duration) : 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {isBouncing && (
        <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={{ color: '#fff', marginTop: 16, fontSize: 16, fontWeight: 'bold' }}>Mixing Audio...</Text>
        </View>
      )}
      <ImageBackground
        source={require('../../assets/image/home1.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      <View style={styles.overlay} />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeSong ? activeSong.title : 'No Session Active'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={openTakesModal}>
              <View style={[styles.iconBtn, { paddingHorizontal: 10, width: 'auto', height: 32 }]}>
                <Text style={{ fontSize: 8, color: takes.length > 0 ? T.accent : '#ffffff', fontWeight: '900', letterSpacing: 1 }}>PLAYBACK</Text>
                {takes.length > 0 && <View style={[styles.activePartDot, { top: -2, right: -2, backgroundColor: takes.length > lastViewedTakeCount ? T.success : T.accent }]} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSongPicker(true)}>
              <Ionicons name="search" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.stage}>
          {isRecording && (
            <View style={{ position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: 'rgba(255,50,50,0.9)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 100 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' }} />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>REC</Text>
            </View>
          )}
          {!activeSong ? (
            <View style={styles.emptyStage}>
              <Ionicons name="musical-notes-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyStageText}>NO SESSION ACTIVE</Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => setShowSongPicker(true)}>
                <Text style={styles.browseBtnText}>Browse Songs</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.lyricsContainer}>
              <Text style={styles.currentLyricText}>{currentLyric}</Text>
            </View>
          )}
        </View>
        {activeSong && (
          <View style={styles.footer}>
            <View style={styles.controlCard}>
              <View style={styles.timelineContainer}>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={duration}
                  value={isSeeking ? seekDisplayValue : position}
                  onSlidingStart={handleSeekStart}
                  onSlidingComplete={handleSeekEnd}
                  onValueChange={(v) => {
                    setSeekDisplayValue(v);
                  }}
                  minimumTrackTintColor={T.accent}
                  maximumTrackTintColor={T.trackMax}
                  thumbTintColor={T.thumbTint}
                  disabled={isReviewPlaying || !!reviewTake}
                />
                <View style={styles.timecodeRow}>
                  <Text style={styles.timeText}>{formatTime(isSeeking ? seekDisplayValue : position)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>
              <View style={styles.controlsRow}>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowTrackPicker(true)}>
                  <View style={styles.iconBtn}>
                    <Ionicons name="layers-outline" size={20} color="rgba(255,255,255,0.7)" />
                    {activePart !== 'full' && <View style={styles.activePartDot} />}
                  </View>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '800' }}>PARTS</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={skipBack} style={[styles.skipBtn, { marginBottom: 14 }]}>
                  <Ionicons name="play-skip-back" size={24} color="#ffffff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, (isPlaying || isReviewPlaying) && styles.playBtnActive, { marginBottom: 14 }]}>
                  {(isBuffering || isTrackPlayerBuffering) ? (
                    <ActivityIndicator size="small" color={(isPlaying || isReviewPlaying) ? theme.colors.background : '#ffffff'} />
                  ) : (
                    <Ionicons name={(isPlaying || isReviewPlaying) ? 'pause' : 'play'} size={32} color={(isPlaying || isReviewPlaying) ? theme.colors.background : '#ffffff'} style={!(isPlaying || isReviewPlaying) && { marginLeft: 4 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={skipForward} style={[styles.skipBtn, { marginBottom: 14 }]}>
                  <Ionicons name="play-skip-forward" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity style={{ alignItems: 'center' }} onPress={isRecording ? stopRecording : startRecording}>
                  <View style={[styles.iconBtn, { borderColor: isRecording ? 'red' : 'rgba(255,255,255,0.3)' }, isRecording && { backgroundColor: 'rgba(255,0,0,0.1)' }]}>
                    <Ionicons name={isRecording ? "stop" : "radio-button-on"} size={20} color={isRecording ? 'red' : 'rgba(255,255,255,0.7)'} />
                  </View>
                  <Text style={{ fontSize: 9, color: isRecording ? 'red' : 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '800' }}>REC</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
      <Modal visible={showSongPicker} animationType="slide" transparent={true}>
        <View style={styles.bottomSheetWrapper}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSongPicker(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetDragHandle} />
            <Text style={styles.sheetTitle}>Track Library</Text>
            <Text style={styles.sheetSub}>SELECT A TRACK TO PRACTICE</Text>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search songs or artists..."
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredLibrary}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 16 }}
              refreshing={loadingLibrary}
              onRefresh={() => fetchLibrary(PAGE_SIZE, true)}
              ListHeaderComponent={isRemoteSearching ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 8 }}>
                  <ActivityIndicator size="small" color={T.accent} />
                  <Text style={{ color: T.textMuted, fontSize: 12 }}>Searching all songs…</Text>
                </View>
              ) : null}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator color={T.accent} style={{ marginVertical: 20 }} />
                ) : (hasMore && !searchQuery.trim()) ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreLibrary}
                  >
                    <Ionicons name="chevron-down-circle-outline" size={20} color={T.accent} />
                    <Text style={styles.loadMoreText}>LOAD MORE ({library.length} loaded)</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item, index }) => (
                <TouchableOpacity style={styles.libraryRow} onPress={() => handleSelectSong(item)}>
                  <Text style={styles.libraryRowNum}>{index + 1}</Text>
                  <View style={styles.libraryAvatar}>
                    <Ionicons name="musical-notes" size={20} color={theme.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.librarySongTitle}>{item.title}</Text>
                    <Text style={styles.librarySongArtist}>{item.writer || item.leadSinger || 'Loveworld Singers'}</Text>
                  </View>
                  {activeSong?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={T.accent} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !loadingLibrary ? (
                  <View style={styles.emptyLibrary}>
                    <Ionicons name="musical-notes-outline" size={40} color={theme.colors.textMuted} />
                    <Text style={styles.emptyLibraryText}>{searchQuery.trim() ? 'No results found' : 'Library Empty'}</Text>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
      <Modal visible={showTrackPicker} animationType="slide" transparent={true}>
        <View style={styles.bottomSheetWrapper}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTrackPicker(false)} />
          <View style={[styles.bottomSheet, { height: '55%' }]}>
            <View style={styles.sheetDragHandle} />
            <Text style={styles.sheetTitle}>Vocal Tracks</Text>
            <Text style={styles.sheetSub}>ISOLATE YOUR PART</Text>

            <ScrollView contentContainerStyle={{ paddingVertical: 24, gap: 12 }}>
              {(!activeSong?.audioUrls || Object.keys(activeSong.audioUrls).length === 0) ? (
                <View style={styles.emptyLibrary}>
                  <Ionicons name="alert-circle-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={styles.emptyLibraryText}>No stems available</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.stemRow, activePart === 'full' && styles.stemRowActive]}
                    onPress={() => { setActivePart('full'); setShowTrackPicker(false); }}
                  >
                    <View style={[styles.stemAvatar, activePart === 'full' && styles.stemAvatarActive]}>
                      <Ionicons name="layers" size={20} color={activePart === 'full' ? theme.colors.textPrimary : theme.colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stemTitle, activePart === 'full' && { color: theme.colors.textPrimary }]}>
                        Full Mix
                      </Text>
                      {activePart === 'full' && <Text style={styles.stemActiveText}>CURRENTLY PLAYING</Text>}
                    </View>
                    {activePart === 'full' && <View style={styles.stemActiveIndicator} />}
                  </TouchableOpacity>

                  {activeSong.audioUrls && Object.entries(activeSong.audioUrls).map(([partName, url]) => {
                    if (!url || typeof url !== 'string' || partName.toLowerCase() === 'full') return null;
                    const isActive = activePart === partName;
                    return (
                      <TouchableOpacity
                        key={partName}
                        style={[styles.stemRow, isActive && styles.stemRowActive]}
                        onPress={() => { setActivePart(partName); setShowTrackPicker(false); }}
                      >
                        <View style={[styles.stemAvatar, isActive && styles.stemAvatarActive]}>
                          <Ionicons name="mic" size={20} color={isActive ? theme.colors.textPrimary : theme.colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.stemTitle, isActive && { color: theme.colors.textPrimary }]}>
                            {partName.charAt(0).toUpperCase() + partName.slice(1)}
                          </Text>
                          {isActive && <Text style={styles.stemActiveText}>CURRENTLY PLAYING</Text>}
                        </View>
                        {isActive && <View style={styles.stemActiveIndicator} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showTakesModal} animationType="slide" transparent={true}>
        <View style={styles.bottomSheetWrapper}>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeTakesModal} />
          <View style={[styles.bottomSheet, { height: '70%' }]}>
            <View style={styles.sheetDragHandle} />
            <Text style={styles.sheetTitle}>My Takes</Text>
            <Text style={styles.sheetSub}>LISTEN OR DELETE RECORDINGS</Text>

            <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
              {takes.length === 0 ? (
                <View style={styles.emptyLibrary}>
                  <Ionicons name="mic-off-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={styles.emptyLibraryText}>No recordings yet</Text>
                </View>
              ) : (
                <>
                  <View style={{ display: 'none', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>VOCAL SYNC (LATENCY)</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: 'bold' }}>{vocalSyncMs > 0 ? '+' : ''}{vocalSyncMs} ms</Text>
                    </View>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={-500}
                      maximumValue={500}
                      step={10}
                      value={vocalSyncMs}
                      onValueChange={setVocalSyncMs}
                      onSlidingComplete={(val) => {
                        if (isReviewPlaying && reviewTake) playReviewTake(reviewTake, val);
                      }}
                      minimumTrackTintColor={theme.colors.accent}
                      maximumTrackTintColor="rgba(255,255,255,0.1)"
                      thumbTintColor={theme.colors.accent}
                    />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                      If your voice is EARLY, move slider right (+). If your voice is LATE, move left (-).
                    </Text>
                  </View>

                  {takes.map((take) => {
                    const isSelected = reviewTake?.id === take.id;
                    const isExpanded = expandedTakeId === take.id;
                    const isReviewing = isSelected && isReviewPlaying;
                    const takeSizeMB = (take.size / (1024 * 1024)).toFixed(2);
                    return (
                      <View key={take.id} style={{ marginBottom: 12 }}>
                        <TouchableOpacity 
                          style={[styles.takeRow, isExpanded && { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 8 }]}
                          activeOpacity={0.7}
                          onPress={() => setExpandedTakeId(isExpanded ? null : take.id)}
                        >
                          <View style={styles.takePlayBtn}>
                            <Ionicons name="mic-outline" size={20} color={theme.colors.background} />
                          </View>

                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.takeTitle} numberOfLines={1}>{take.name}</Text>
                            <Text style={styles.takeSub}>
                              {new Date(take.createdAt * 1000).toLocaleString()} • {takeSizeMB} MB
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 4 }}>
                            {isReviewing && <Ionicons name="volume-high" size={16} color={theme.colors.accent} />}
                            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={theme.colors.textMuted} />
                          </View>
                        </TouchableOpacity>
                        {isExpanded && (
                          <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ color: theme.colors.textMuted, fontSize: 12, width: 35, textAlign: 'right' }}>{formatTime(isSelected ? (isSeeking ? seekDisplayValue : position) : 0)}</Text>
                                <Slider
                                  style={{ flex: 1, height: 40 }}
                                  minimumValue={0}
                                  maximumValue={isSelected ? (duration || 1) : 1}
                                  value={isSelected ? (isSeeking ? seekDisplayValue : position) : 0}
                                  minimumTrackTintColor={theme.colors.accent}
                                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                                  thumbTintColor={theme.colors.accent}
                                  onSlidingStart={handleSeekStart}
                                  onSlidingComplete={handleSeekEnd}
                                />
                                <Text style={{ color: theme.colors.textMuted, fontSize: 12, width: 35 }}>{formatTime(isSelected ? duration : 0)}</Text>
                             </View>
                             <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, marginTop: 4, position: 'relative' }}>
                                <TouchableOpacity onPress={skipBack}>
                                  <Ionicons name="play-back" size={24} color={theme.colors.textPrimary} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity onPress={() => playReviewTake(take)} style={{ backgroundColor: theme.colors.textPrimary, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name={isReviewing ? "pause" : "play"} size={24} color={theme.colors.background} style={{ marginLeft: isReviewing ? 0 : 2 }} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity onPress={skipForward}>
                                  <Ionicons name="play-forward" size={24} color={theme.colors.textPrimary} />
                                </TouchableOpacity>

                                <TouchableOpacity style={{ position: 'absolute', left: 0 }} onPress={() => { setShareTake(take); setShowShareSheet(true); }}>
                                  <Ionicons name="share-social-outline" size={22} color={theme.colors.accent} />
                                </TouchableOpacity>

                                <TouchableOpacity style={{ position: 'absolute', right: 0 }} onPress={() => deleteTake(take)}>
                                  <Ionicons name="trash-outline" size={22} color="red" />
                                </TouchableOpacity>
                             </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ShareToChatSheet 
        visible={showShareSheet} 
        take={shareTake} 
        onClose={() => { setShowShareSheet(false); setTimeout(() => setShareTake(null), 300); }} 
      />

    </View>
  );
}

const getStyles = (theme: any, themeName: string, insets: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(11, 7, 18, 0.75)'  // always dark mode overlay
    },
    safeArea: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 12,
    },
    iconBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTextWrap: { flex: 1, alignItems: 'center' },
    headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900' },

    stage: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, position: 'relative' },
    loadingContainer: { alignItems: 'center' },
    loadingText: { color: T.accent, marginTop: 16, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

    emptyStage: { alignItems: 'center', gap: 24 },
    emptyStageText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
    browseBtn: { backgroundColor: T.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    browseBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

    lyricsContainer: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 32, position: 'relative' },
    waveformGlow: { position: 'absolute', width: 200, height: 100, backgroundColor: T.accent, shadowColor: T.accent, shadowOpacity: 1, shadowRadius: 50, elevation: 10, opacity: 0, zIndex: -1 },
    currentLyricText: {
      fontSize: 34, fontWeight: '900', color: '#ffffff', textAlign: 'center', lineHeight: 44,
      textShadowColor: 'rgba(139, 92, 246, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
    },
    nextLyricText: {
      fontSize: 22, fontWeight: '800', color: theme.colors.textMuted, textAlign: 'center', lineHeight: 30,
    },

    footer: { paddingHorizontal: 20, paddingBottom: 24 },
    controlCard: {
      backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 32, padding: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    timelineContainer: { marginBottom: 12 },
    timecodeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: -8 },
    timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 0, marginTop: 10 },
    sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    activePartDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent, borderWidth: 2, borderColor: T.background },
    centerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
    skipBtn: { padding: 16, opacity: 0.8 },
    playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, shadowColor: T.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
    playBtnActive: { transform: [{ scale: 0.95 }] },
    bottomSheetWrapper: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: T.backgroundDark, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '80%', paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(24, insets.bottom + 16), borderWidth: 1, borderColor: theme.colors.bottomTabBorder },
    sheetDragHandle: { width: 40, height: 4, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
    sheetTitle: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '900' },
    sheetSub: { color: T.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 4, marginBottom: 20 },

    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 16, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: theme.colors.bottomTabBorder },
    searchInput: { flex: 1, marginLeft: 12, color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },

    libraryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.divider },
    libraryRowNum: { color: T.textMuted, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center', fontFamily: 'monospace' },
    libraryAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    librarySongTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
    librarySongArtist: { color: T.textMuted, fontSize: 12, marginTop: 2 },
    emptyLibrary: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyLibraryText: { color: T.textMuted, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginTop: 12 },

    stemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
    stemRowActive: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' },
    stemAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.colors.cardBackgroundLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    stemAvatarActive: { backgroundColor: T.accent },
    stemTitle: { color: theme.colors.textMuted, fontSize: 16, fontWeight: '800' },
    stemActiveText: { color: T.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
    stemActiveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.accent, shadowColor: T.accent, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
      marginVertical: 10,
      backgroundColor: theme.colors.cardBackgroundLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.bottomTabBorder,
    },
    loadMoreText: {
      color: T.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
    takeRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: T.cardBackgroundLight, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.bottomTabBorder },
    takePlayBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
    takeTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
    takeSub: { color: T.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
    takeActionBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
  });
};

