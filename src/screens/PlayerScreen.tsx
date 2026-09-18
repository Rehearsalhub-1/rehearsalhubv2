import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { optimizeAudio, resolveSongAudioUrls } from '../lib/mediaUtils';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image as RNImage,
  Share,
  Alert,
  Modal,
  Pressable,
  TextInput,
  PanResponder,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoodleBackground } from '../components/DoodleBackground';
import { DoodleLayer } from '../components/DoodleLayer';
import { MiniDoodleCanvas } from '../components/MiniDoodleCanvas';

import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Constants from 'expo-constants';

const TRACK_PLACEHOLDER_VIDEO = require('../../assets/TRACK_PLACEHOLDER.mp4');
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Slider from '@react-native-community/slider';
import RenderHtml from 'react-native-render-html';
import { formatLyricsHtml } from '../utils/lyricsFormatter';
import { useTrackPlayer, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import { SafeTrackPlayer as TrackPlayer } from '../lib/safeNativeModules';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { useAnnotationsAndNotes } from '../hooks/useAnnotationsAndNotes';
import { SongScheduleSheet } from '../components/SongScheduleSheet';
import { useUserStore } from '../hooks/useUser';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLiveSongStore, isLiveSong } from '../stores/liveSongStore';
import { PlayerOptionsMenuModal } from '../components/player/modals/PlayerOptionsMenuModal';
import { PlayerSpeedModal } from '../components/player/modals/PlayerSpeedModal';
import { PlayerSleepTimerModal } from '../components/player/modals/PlayerSleepTimerModal';
import { PlayerQueueModal } from '../components/player/modals/PlayerQueueModal';
import { PlayerMoreAssetsModal } from '../components/player/modals/PlayerMoreAssetsModal';
import { PlayerAddToPlaylistModal } from '../components/player/modals/PlayerAddToPlaylistModal';
import { PlayerAudioPartsModal } from '../components/player/modals/PlayerAudioPartsModal';
import { ABLooperStrip } from '../components/player/ABLooperStrip';
import { PlayerPreviewContent } from '../components/player/PlayerPreviewContent';
import { PlayerBottomTabBar } from '../components/player/PlayerBottomTabBar';
import { ExpandableText } from '../components/player/ExpandableText';
import { ToastHUD, DoubleTapOverlay, PlayerProgressSlider } from '../components/player/PlayerHUDOverlays';
import { PlayerControlsRow } from '../components/player/PlayerControlsRow';
import { PlayerAnnotationFAB } from '../components/player/PlayerAnnotationFAB';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// SPEED_OPTIONS and SLEEP_TIMER_OPTIONS live in their respective modal components.

const isConductorGuideText = (text: string | null | undefined): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('harmony') ||
    lower.includes('harmonies') ||
    lower.includes('unison') ||
    lower.includes('verse 1') ||
    lower.includes('verse 2') ||
    lower.includes('modulate') ||
    lower.includes('modulation') ||
    lower.includes('coda') ||
    lower.includes('refrain') ||
    lower.includes('prechorus') ||
    lower.includes('pre-chorus') ||
    lower.includes('turnaround') ||
    lower.includes('interlude') ||
    (lower.includes('<div') && lower.includes('solo'))
  );
};

// ToastHUD, DoubleTapOverlay, and PlayerProgressSlider live in PlayerHUDOverlays.tsx

export default function PlayerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const styles = getStyles(theme, insets, windowWidth);
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isHQ = useUserStore(s => s.isHQ);
  // Read queue dynamically from route.params so new queues from Live Now
  // navigation are always picked up without needing to remount the screen.
  const liveQueue = route.params?.queue;
  const { activeTrack: initialTrack, fromAllSongs } = route.params || {};
  const initialQueue = liveQueue;

  const fallbackTrack = {
    id: '',
    title: 'Now Playing',
    subtitle: '',
    leadSinger: '',
    writer: '',
    conductor: '',
    key: '',
    tempo: '',
    audioUrl: '',
    imageUrl: '',
    lyrics: '',
    solfa: '',
    conductorGuide: '',
    program: '',
    rehearsalCount: 0,
    collectionName: '',
  };

  const paramTrack = route.params?.activeTrack;
  const [activeTrack, setActiveTrack] = useState(paramTrack || initialTrack || fallbackTrack);
  const lastPlayedTrackIdRef = useRef<string | null>(null);

  // Sync activeTrack when navigating with new route params
  useEffect(() => {
    if (paramTrack && paramTrack.id && String(paramTrack.id) !== String(activeTrack?.id)) {
      setActiveTrack(paramTrack);
    }
  }, [paramTrack]);

  // Always hydrate latest full song data from API to ensure updates (lyrics, solfas, key, tempo, audio stems) are reflected
  useEffect(() => {
    if (!activeTrack?.id) return;

    let active = true;
    api.songs.getById(String(activeTrack.id)).then(res => {
      if (!active) return;
      if (res?.success && res.data) {
        const song = res.data;
        const rawAudioUrl = song.audioFile || song.audioUrls?.full || song.audioUrl;
        const songAudioUrl = rawAudioUrl && rawAudioUrl.includes('cloudinary.com') ? optimizeAudio(rawAudioUrl) : rawAudioUrl;
        setActiveTrack((prev: any) => ({
          ...prev,
          ...song,
          audioUrl: songAudioUrl || song.audioFile || prev?.audioUrl,
          lyrics: song.lyrics !== undefined ? song.lyrics : prev?.lyrics,
          solfa: (song.notation || song.solfas || song.solfa) !== undefined ? (song.notation || song.solfas || song.solfa) : prev?.solfa,
          conductorGuide: (song.conductorGuide || song.guide) !== undefined ? (song.conductorGuide || song.guide) : prev?.conductorGuide,
        }));
      }
    }).catch(err => {
      console.warn('[PlayerScreen] Failed to hydrate song:', err);
    });

    return () => {
      active = false;
    };
  }, [activeTrack?.id]);

  const { width } = useWindowDimensions();
  const [activePreviewTab, setActivePreviewTab] = useState('Lyrics');
  const [songHistorySummary, setSongHistorySummary] = useState<string>('');

  useEffect(() => {
    if (!activeTrack?.id) return;
    let active = true;
    api.songs.getHistory(String(activeTrack.id).trim()).then(res => {
      if (!active) return;
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        const lines = res.data.slice(0, 4).map((item: any) => `• **${item.title || item.type}:** ${item.description || item.new_value || ''}`);
        setSongHistorySummary(lines.join('\n\n'));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [activeTrack?.id]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showMoreAssetsModal, setShowMoreAssetsModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showAudioPartsModal, setShowAudioPartsModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showABLooperStrip, setShowABLooperStrip] = useState(false);
  const [isDownloadedOffline, setIsDownloadedOffline] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);

  // Sleep Timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // Toast HUD state
  const [toastMessage, setToastMessage] = useState<{ text: string; icon?: string; id: number } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Double-tap seek state
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const doubleTapAnim = useRef(new Animated.Value(0)).current;
  const lastTapTimeRef = useRef<number>(0);

  // Horizontal swipe gesture for Swiping Songs (Prev/Next)
  const swipeX = useRef(new Animated.Value(0)).current;

  const [isFavorite, setIsFavorite] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [mediaMode, setMediaMode] = useState<'video' | 'art'>('video');

  const showToast = useCallback((text: string, icon?: string) => {
    const id = Date.now();
    setToastMessage({ text, icon, id });
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setToastMessage(prev => (prev?.id === id ? null : prev));
    });
  }, [toastOpacity]);

  const triggerDoubleTapFeedback = useCallback((side: 'left' | 'right') => {
    setDoubleTapSide(side);
    doubleTapAnim.setValue(0);
    Animated.sequence([
      Animated.spring(doubleTapAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.delay(350),
      Animated.timing(doubleTapAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDoubleTapSide(null));
  }, [doubleTapAnim]);

  const isSongHeard = (s: any): boolean => {
    if (!s) return false;
    if (s.status === 'heard') return true;
    if (s.status === 'unheard') return false;
    if (s.rehearsalStatus === 'heard') return true;
    if (s.rehearsalStatus === 'unheard') return false;
    if (s.heard === true || s.isHeard === true) return true;
    if (s.heard === false || s.isHeard === false) return false;
    const title = (s.title || '').toLowerCase();
    if (title.includes('(heard)')) return true;
    if (title.includes('(unheard)')) return false;
    return false;
  };

  // Ref to suppress duplicate WS fires — 'song:{id}' and 'song:all' can both
  // match the same event; we debounce them to a single applySongUpdate call.
  const lastWsUpdateIdRef = useRef<string>('');

  const applySongUpdate = useCallback((updateData: any) => {
    const update = updateData?.data || updateData;
    if (!update || typeof update !== 'object') return;
    setActiveTrack((prev: any) => {
      if (!prev) return prev;
      if (update.id && prev.id && String(update.id) !== String(prev.id)) {
        return prev;
      }
      const rawAudioUrl = update.audioFile || update.audioUrls?.full || null;
      // Only compute a new audioUrl if the incoming event actually carries one
      // that differs from what we already have — avoids re-triggering play().
      const songAudioUrl = rawAudioUrl
        ? (rawAudioUrl.includes('cloudinary.com') ? optimizeAudio(rawAudioUrl) : rawAudioUrl)
        : prev.audioUrl;
      // If nothing meaningful changed, return same ref to skip re-render
      const nextAudioUrl = songAudioUrl || prev.audioUrl;
      return {
        ...prev,
        ...update,
        lyrics: update.lyrics !== undefined ? update.lyrics : prev.lyrics,
        solfa: (update.notation || update.solfas || update.solfa) !== undefined ? (update.notation || update.solfas || update.solfa) : prev.solfa,
        conductorGuide: (update.solfas || update.conductorGuide || update.guide) !== undefined ? (update.solfas || update.conductorGuide || update.guide) : prev.conductorGuide,
        comments: update.comments !== undefined ? update.comments : prev.comments,
        history: update.history !== undefined ? update.history : prev.history,
        // Preserve existing audioUrl when the update doesn't supply a new one
        status: isLiveSong(update) ? 'live' : (isSongHeard(update) ? 'heard' : (update.status || prev.status)),
        isLive: isLiveSong(update) || (update.status === undefined && Boolean(prev?.isLive)),
      };
    });
  }, []);

  // Targeted subscription: handles updates for THIS specific song
  useWebSocket('song', activeTrack?.id ? String(activeTrack.id) : '', useCallback((eventData: any) => {
    const update = eventData?.data || eventData;
    if (update?.id && activeTrack?.id && String(update.id) !== String(activeTrack.id)) return;
    // Record this event as handled so the 'all' sub below skips it
    if (update?.id) lastWsUpdateIdRef.current = String(update.id) + (update._seq || update.sequence || Date.now());
    applySongUpdate(eventData);
  }, [applySongUpdate, activeTrack?.id]), Boolean(activeTrack?.id));

  // Broadcast subscription: only fires if the targeted sub didn't already handle it
  useWebSocket('song', 'all', useCallback((eventData: any) => {
    const update = eventData?.data || eventData;
    if (!update || typeof update !== 'object') return;
    if (!activeTrack?.id) return;
    const idMatch = String(update.id) === String(activeTrack.id);
    if (!idMatch) return;
    // De-duplicate: skip if the targeted handler already processed this event
    const eventSig = String(update.id) + (update._seq || update.sequence || '');
    if (eventSig && lastWsUpdateIdRef.current === eventSig) return;
    applySongUpdate(update);
  }, [applySongUpdate, activeTrack?.id]), Boolean(activeTrack?.id));

  const {
    AnnotationLayer,
    NotesModal,
    isAnnotationMode,
    setIsAnnotationMode,
    isPrivileged,
    annotationTool,
    setAnnotationTool,
    selectedColor,
    setSelectedColor,
    showColorPalette,
    setShowColorPalette,
    getMyColor,
    handleClearMyAnnotations,
    setShowNotesModal,
    personalNote,
  } = useAnnotationsAndNotes(activeTrack?.id, activeTrack?.title, { isPlayer: true });

  const {
    isPlaying,
    isLoading,
    play,
    pause,
    togglePlayback,
    seekTo,
    currentTrack,
    queue,
    queueIndex,
    toggleShuffle,
    isShuffle,
    skipToPrevious,
    skipToNext,
    skipToTrack,
    toggleRepeat,
    repeatMode,
    playbackRate,
    setPlaybackRate,
    abLoop,
    setLoopPointA,
    setLoopPointB,
    toggleABLoop,
    clearABLoop,
    adjustLoopPointA,
    adjustLoopPointB,
  } = useTrackPlayer();

  const placeholderVideoPlayer = useVideoPlayer(TRACK_PLACEHOLDER_VIDEO, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    if (!placeholderVideoPlayer) return;
    if (isPlaying) {
      placeholderVideoPlayer.play();
    } else {
      placeholderVideoPlayer.pause();
    }
  }, [isPlaying, placeholderVideoPlayer]);

  // Sync activeTrack metadata automatically when TrackPlayer advances to next/prev song
  useEffect(() => {
    if (currentTrack && currentTrack.id) {
      const currentId = String(currentTrack.id);
      setActiveTrack((prev: any) => {
        if (prev && String(prev.id) === currentId) {
          return prev;
        }
        lastPlayedTrackIdRef.current = currentId;
        lastPlayedAudioUrlRef.current = currentTrack.audioUrl || '';
        return {
          ...prev,
          ...currentTrack,
          lyrics: currentTrack.lyrics || prev?.lyrics,
          solfa: currentTrack.solfa || currentTrack.solfas || currentTrack.notation || prev?.solfa,
          conductorGuide: currentTrack.conductorGuide || currentTrack.guide || prev?.conductorGuide,
          comments: currentTrack.comments || prev?.comments,
          history: currentTrack.history || prev?.history,
        };
      });
    }
  }, [currentTrack?.id]);

  // Sleep Timer Countdown Interval
  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;
    const interval = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null || prev <= 1) {
          pause();
          setSleepTimerMinutes(null);
          showToast('Sleep Timer: Music paused 🌙', 'moon');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerRemaining, pause, showToast]);

  const handleSelectSleepTimer = (mins: number) => {
    setShowSleepTimerModal(false);
    if (mins === 0) {
      setSleepTimerMinutes(null);
      setSleepTimerRemaining(null);
      showToast('Sleep Timer Off', 'moon-outline');
    } else if (mins === -1) {
      setSleepTimerMinutes(-1);
      setSleepTimerRemaining(null);
      showToast('Sleep Timer: Stop at end of song 🌙', 'moon');
    } else {
      setSleepTimerMinutes(mins);
      setSleepTimerRemaining(mins * 60);
      showToast(`Sleep Timer: ${mins} mins 🌙`, 'moon');
    }
  };

  const handleSelectSpeed = async (rate: number) => {
    setShowSpeedModal(false);
    await setPlaybackRate(rate);
    showToast(`Speed: ${rate}x`, 'speedometer-outline');
  };

  // Repeat Mode Toggle with Rich Toast Feedback
  const handleToggleRepeat = () => {
    toggleRepeat();
    const nextMode = repeatMode === 'off' ? 'playlist' : repeatMode === 'playlist' ? 'track' : 'off';
    if (nextMode === 'track') {
      showToast('Repeat: Current Song (Loop 1)', 'repeat');
    } else if (nextMode === 'playlist') {
      showToast('Repeat: All in Queue', 'repeat');
    } else {
      showToast('Repeat Off', 'close-circle-outline');
    }
  };

  // Shuffle Toggle with Rich Toast Feedback
  const handleToggleShuffle = () => {
    toggleShuffle();
    showToast(!isShuffle ? 'Shuffle On' : 'Shuffle Off', 'shuffle');
  };

  // A-B Looper Control Strip Toggle & Quick Set
  const handleABLoopPress = async () => {
    setShowABLooperStrip(prev => !prev);
    if (abLoop.start === null) {
      const posSec = await TrackPlayer.getPosition().catch(() => 0);
      const posMs = Math.floor(posSec * 1000);
      await setLoopPointA(posMs);
      showToast(`Point A set (${formatTime(posMs)}) • Set Point B to loop`, 'flag');
    }
  };

  // Gesture Swiper PanResponder for Album Art (Swipe Left/Right to change song)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isAnnotationMode) return false;
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        swipeX.setValue(gestureState.dx * 0.45);
      },
      onPanResponderRelease: async (_, gestureState) => {
        if (gestureState.dx < -55) {
          // Swiped Left -> Next Track
          Animated.timing(swipeX, { toValue: -60, duration: 100, useNativeDriver: true }).start(async () => {
            await skipToNext();
            showToast('Next Song', 'play-skip-forward');
            swipeX.setValue(60);
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }).start();
          });
        } else if (gestureState.dx > 55) {
          // Swiped Right -> Previous Track
          Animated.timing(swipeX, { toValue: 60, duration: 100, useNativeDriver: true }).start(async () => {
            await skipToPrevious();
            showToast('Previous Song', 'play-skip-back');
            swipeX.setValue(-60);
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }).start();
          });
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }).start();
        }
      }
    })
  ).current;

  // Double-tap to jump +/- 10s on Album Art
  const handleArtPress = async (evt: any) => {
    if (isAnnotationMode) return;
    const now = Date.now();
    const locationX = evt.nativeEvent.locationX;
    const artWidth = SCREEN_WIDTH;

    if (now - lastTapTimeRef.current < 320) {
      // Double tap detected
      const position = await TrackPlayer.getPosition().catch(() => 0);
      const duration = await TrackPlayer.getDuration().catch(() => 0);
      if (locationX < artWidth * 0.45) {
        // Left side -> Rewind 10s
        const target = Math.max(0, (position - 10) * 1000);
        seekTo(target);
        triggerDoubleTapFeedback('left');
        showToast('-10 seconds', 'refresh-outline');
      } else if (locationX > artWidth * 0.55) {
        // Right side -> Forward 10s
        const target = Math.min(duration * 1000, (position + 10) * 1000);
        seekTo(target);
        triggerDoubleTapFeedback('right');
        showToast('+10 seconds', 'refresh-outline');
      }
    }
    lastTapTimeRef.current = now;
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreatingPlaylist(true);
    try {
      const res = await api.playlists.create({
        name: newPlaylistName.trim(),
        songIds: activeTrack?.id ? [String(activeTrack.id)] : []
      });
      if (res?.success && res.data) {
        const newPl = {
          ...res.data,
          name: res.data.title || res.data.name || newPlaylistName.trim(),
          title: res.data.title || res.data.name || newPlaylistName.trim(),
          songs: res.data.songIds || res.data.songs || (activeTrack?.id ? [String(activeTrack.id)] : []),
          songIds: res.data.songIds || (activeTrack?.id ? [String(activeTrack.id)] : []),
        };
        setPlaylists(prev => [newPl, ...prev.filter((p: any) => p.id !== newPl.id)]);
        showToast('Playlist created & saved to DB!', 'checkmark-circle');
      }
      setNewPlaylistName('');
    } catch {
      Alert.alert('Error', 'Failed to create playlist. Please try again.');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!activeTrack?.id) return;
    try {
      await api.playlists.addSong(playlistId, String(activeTrack.id));
      showToast('Added to playlist!', 'checkmark-circle');
      setPlaylists(prev => prev.map(p => {
        if (p.id === playlistId) {
          const currentSongs = p.songs || p.songIds || [];
          return {
            ...p,
            songs: [...currentSongs, String(activeTrack.id)],
            songIds: [...currentSongs, String(activeTrack.id)],
          };
        }
        return p;
      }));
      setTimeout(() => setShowPlaylistModal(false), 350);
    } catch {
      Alert.alert('Error', 'Failed to add song to playlist');
    }
  };

  const loadUserPlaylists = useCallback(() => {
    if (!user) return;
    api.playlists.getAll().then(res => {
      if (res?.success && Array.isArray(res.data)) {
        const shaped = res.data.map((pl: any) => ({
          ...pl,
          name: pl.title || pl.name || 'Playlist',
          title: pl.title || pl.name || 'Playlist',
          songs: pl.songIds || pl.songs || [],
          songIds: pl.songIds || [],
        }));
        setPlaylists(shaped);
      }
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    loadUserPlaylists();
  }, [loadUserPlaylists]);

  useEffect(() => {
    if (showPlaylistModal) {
      loadUserPlaylists();
    }
  }, [showPlaylistModal, loadUserPlaylists]);

  const toggleFavorite = async () => {
    if (!activeTrack?.id) return;
    try {
      setIsFavorite(prev => !prev);
      if (isFavorite) {
        await api.favorites.remove(activeTrack.id).catch(() => {});
      } else {
        await api.favorites.add(activeTrack.id).catch(() => {});
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const previewTabs = ['Lyrics', 'Comments', 'Conductor'];

  // Track the last audioUrl we actually loaded so WS patches that preserve the
  // same URL string don't retrigger play() and interrupt playback.
  const lastPlayedAudioUrlRef = useRef<string>('');

  useEffect(() => {
    if (!activeTrack?.id) return;
    const currentId = currentTrack?.id ? String(currentTrack.id) : null;
    const activeId = String(activeTrack.id);
    const activeAudioUrl = activeTrack.audioUrl || '';
    const isSameTrack = currentId === activeId;
    // Only reload audio if the URL actually changed to a different value
    const audioUrlChanged = Boolean(activeAudioUrl && activeAudioUrl !== lastPlayedAudioUrlRef.current);
    const needsAudioReload = isSameTrack && !currentTrack?.audioUrl && audioUrlChanged;

    if (isSameTrack && !needsAudioReload) {
      lastPlayedTrackIdRef.current = activeId;
      lastPlayedAudioUrlRef.current = activeAudioUrl;
      return;
    }

    if (lastPlayedTrackIdRef.current === activeId && !needsAudioReload) {
      return;
    }

    lastPlayedTrackIdRef.current = activeId;
    lastPlayedAudioUrlRef.current = activeAudioUrl;
    const shouldAutoplay = route.params?.autoplay === true;
    play(activeTrack, initialQueue || undefined, shouldAutoplay);
  }, [activeTrack?.id, activeTrack?.audioUrl]);

  const handlePlayPause = async () => {
    if (currentTrack && String(currentTrack.id) !== String(activeTrack.id)) {
      await play(activeTrack);
    } else {
      togglePlayback();
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const parseMarkdown = useCallback((text: any) => {
    return formatLyricsHtml(text);
  }, []);

  const getParsedCommentsHtml = () => {
    let comments = activeTrack?.comments;
    if (!comments) return '';
    let parsed = comments;
    if (typeof comments === 'string') {
      try { parsed = JSON.parse(comments); } catch (e) {}
    }
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => parseMarkdown(c.text || c.comment || '')).join('<br><br>');
    } else if (typeof parsed === 'object' && parsed !== null) {
      return parseMarkdown(parsed.text || parsed.comment || '');
    }
    return parseMarkdown(String(parsed));
  };

  const handleShare = async () => {
    try {
      const title = activeTrack?.title || 'Ministered Song';
      const singer = activeTrack?.leadSinger ? ` by ${activeTrack.leadSinger}` : '';
      const program = activeTrack?.program ? `\nFrom: ${activeTrack.program}` : '';
      const keyTempo = (activeTrack?.key || activeTrack?.tempo) ? `\nKey: ${activeTrack?.key || 'N/A'} • Tempo: ${activeTrack?.tempo || 'N/A'}` : '';
      const songUrl = `https://www.loveworldsingersrehearsalhubportal.org/songs/${activeTrack?.id || ''}`;
      
      const shareMessage = `🎵 "${title}"${singer}${program}${keyTempo}\n\nRehearse this song on Rehearsal Hub:\n${songUrl}`;

      await Share.share({
        message: shareMessage,
        url: songUrl,
        title: `${title} | Rehearsal Hub`
      });
    } catch (error) {
      console.error('Error sharing song:', error);
    }
  };

  // Offline Storage: Check if song is downloaded for offline playback
  useEffect(() => {
    if (!activeTrack?.id) return;
    const checkOfflineStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem('offline_cached_songs_v2');
        if (stored) {
          const list = JSON.parse(stored);
          const exists = list.some((item: any) => String(item.id) === String(activeTrack.id));
          setIsDownloadedOffline(exists);
        } else {
          setIsDownloadedOffline(false);
        }
      } catch {
        setIsDownloadedOffline(false);
      }
    };
    checkOfflineStatus();
  }, [activeTrack?.id]);

  // Download / Remove song for offline playback within the app
  const handleToggleOfflineDownload = async () => {
    if (!activeTrack?.audioUrl) {
      showToast('No audio available for offline playback', 'alert-circle');
      return;
    }

    if (isDownloadedOffline) {
      try {
        const stored = await AsyncStorage.getItem('offline_cached_songs_v2');
        let list = stored ? JSON.parse(stored) : [];
        list = list.filter((item: any) => String(item.id) !== String(activeTrack.id));
        await AsyncStorage.setItem('offline_cached_songs_v2', JSON.stringify(list));

        const cleanName = `offline_song_${activeTrack.id}.mp3`;
        const localUri = `${FileSystem.documentDirectory}${cleanName}`;
        await FileSystem.deleteAsync(localUri, { idempotent: true });

        setIsDownloadedOffline(false);
        showToast('Removed from Offline Storage', 'trash-outline');
      } catch {
        showToast('Failed to remove offline file', 'alert-circle');
      }
    } else {
      try {
        setIsDownloadingOffline(true);
        showToast('Downloading for Offline Playback...', 'cloud-download');

        const cleanName = `offline_song_${activeTrack.id}.mp3`;
        const localUri = `${FileSystem.documentDirectory}${cleanName}`;

        const downloadRes = await FileSystem.downloadAsync(activeTrack.audioUrl, localUri);
        if (downloadRes?.uri) {
          const stored = await AsyncStorage.getItem('offline_cached_songs_v2');
          const list = stored ? JSON.parse(stored) : [];
          const songToSave = {
            ...activeTrack,
            localAudioUri: downloadRes.uri,
            downloadedAt: new Date().toISOString()
          };
          list.push(songToSave);
          await AsyncStorage.setItem('offline_cached_songs_v2', JSON.stringify(list));

          setIsDownloadedOffline(true);
          showToast('Downloaded for Offline Playback 📱', 'checkmark-circle');
        }
      } catch (err) {
        console.error('[OfflineDownload] Error:', err);
        showToast('Failed to download for offline playback', 'alert-circle');
      } finally {
        setIsDownloadingOffline(false);
      }
    }
  };

  const handleMoreOptions = () => {
    setShowOptionsModal(true);
  };

  const displayQueue = useMemo(
    () => queue && queue.length > 0 ? queue : (initialQueue || [activeTrack]),
    [queue, initialQueue, activeTrack]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <DoodleBackground />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      {/* Floating HUD Toast */}
      <ToastHUD message={toastMessage} opacity={toastOpacity} theme={theme} />

      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        {/* Top Header */}
        <View style={[styles.header, { top: Math.max(insets.top + 10, 40) }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-down" size={28} color="#ffffff" />
          </TouchableOpacity>
          <ExpandableText 
            style={[
              styles.headerText,
              {
                flex: 1,
                textAlign: 'center',
                marginHorizontal: 16,
                color: '#FFFFFF',
                fontWeight: '800',
                textShadowColor: theme.colors.accent || '#8B5CF6',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              }
            ]} 
          >
            {activeTrack?.title || 'Now Playing'}
          </ExpandableText>

          {/* Sleep Timer Indicator badge if active */}
          {sleepTimerRemaining !== null && (
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginRight: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4
              }}
              onPress={() => setShowSleepTimerModal(true)}
            >
              <Ionicons name="moon" size={12} color={theme.colors.accent} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {Math.ceil(sleepTimerRemaining / 60)}m
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowScheduleSheet(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="calendar-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowNotesModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="document-text" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleMoreOptions} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }} 
          showsVerticalScrollIndicator={false} 
          scrollEnabled={!isAnnotationMode}
        >
          {/* Swipable & Double-Tappable Album Art Container */}
          <Animated.View
            style={[
              styles.artContainer,
              { transform: [{ translateX: swipeX }] }
            ]}
            {...panResponder.panHandlers}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleArtPress}
            >
              {mediaMode === 'art' && (activeTrack?.imageUrl && typeof activeTrack.imageUrl === 'string' && activeTrack.imageUrl.startsWith('http')) ? (
                <Image
                  source={{ uri: activeTrack.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="disk"
                  blurRadius={8}
                />
              ) : (
                <VideoView
                  player={placeholderVideoPlayer}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  nativeControls={false}
                />
              )}
              
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

              {/* Double-tap Seek ±10s Ripple Feedback */}
              <DoubleTapOverlay side={doubleTapSide} anim={doubleTapAnim} theme={theme} />
              
              <View style={styles.overlayContent} pointerEvents="box-none">
                
                <View style={styles.tableContainer}>
                  <View style={styles.tableRowFull}>
                    <Text style={styles.tableLabel}>LEAD SINGER:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.leadSinger?.split(',')[0]?.trim() || 'Unknown'}</ExpandableText>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCellLeft}>
                      <Text style={styles.tableLabel}>WRITER:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.writer?.split(',')[0]?.trim() || 'Unknown'}</ExpandableText>
                    </View>
                    <View style={styles.tableCellRight}>
                      <Text style={styles.tableLabel}>REHEARSALS:</Text>
                      <ExpandableText style={[styles.tableValue, { color: theme.colors.accent }]}>{`x${activeTrack.rehearsalCount ?? 0}`}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCellLeft}>
                      <Text style={styles.tableLabel}>CONDUCTOR:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.conductor?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={styles.tableCellRight}>
                      <Text style={styles.tableLabel}>KEY:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.key || '—'}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCellLeft}>
                      <Text style={styles.tableLabel}>LEAD KEYBOARDIST:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.leadKeyboardist?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={styles.tableCellRight}>
                      <Text style={styles.tableLabel}>TEMPO:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.tempo || '—'}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCellLeft}>
                      <Text style={styles.tableLabel}>DRUMMER:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.drummer?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={[styles.tableCellLeft, { justifyContent: 'flex-end', flex: 1.2 }]}>
                      <Text style={styles.tableLabel}>BASS GUITARIST:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.leadGuitarist?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                  </View>
                </View>

                {/* Preview Tabs bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginTop: 8, marginBottom: 0, paddingHorizontal: 0 }}>
                  {previewTabs.map((tab) => {
                    const getTabIcon = (t: string) => {
                      switch(t) {
                        case 'Lyrics': return 'document-text-outline';
                        case 'Conductor': return 'musical-notes-outline';
                        case 'Solfa': return 'musical-note-outline';
                        case 'History': return 'time-outline';
                        case 'Comments': return 'chatbubbles-outline';
                        case 'Details': return 'information-circle-outline';
                        default: return 'ellipse-outline';
                      }
                    };
                    const isActive = activePreviewTab === tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        style={{ alignItems: 'center', opacity: isActive ? 1 : 0.6 }}
                        activeOpacity={0.8}
                        onPress={() => {
                          setActivePreviewTab(tab);
                        }}
                      >
                        <Ionicons name={getTabIcon(tab)} size={22} color={isActive ? theme.colors.accent : 'rgba(255,255,255,0.7)'} />
                        <Text style={{ color: isActive ? theme.colors.accent : 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                          {tab}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={{ alignItems: 'center', opacity: 0.8 }}
                    activeOpacity={0.8}
                    onPress={() => setShowMoreAssetsModal(true)}
                  >
                    <Ionicons name="ellipsis-vertical" size={22} color="rgba(255,255,255,0.7)" />
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                      More
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={[styles.infoRow, { justifyContent: 'flex-end', marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={{ marginRight: 16 }} onPress={toggleFavorite}>
                  <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={26} color={isFavorite ? theme.colors.accent : theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.cardBackgroundLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                  onPress={() => {
                    setShowPlaylistModal(true);
                  }}>
                  <Ionicons name="albums-outline" size={18} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Tab content: Lyrics / Conductor / Solfa / History / Comments / Details */}
          <PlayerPreviewContent
            activePreviewTab={activePreviewTab}
            activeTrack={activeTrack}
            songHistorySummary={songHistorySummary}
            fromAllSongs={fromAllSongs}
            isHQ={isHQ}
            contentWidth={width - 100}
            parseMarkdown={parseMarkdown}
            isConductorGuideText={isConductorGuideText}
            navigation={navigation}
            theme={theme}
          />

          {/* A-B Section Looper Strip */}
          <ABLooperStrip
            visible={showABLooperStrip || abLoop.active || abLoop.start !== null}
            abLoop={abLoop}
            onClearLoop={() => {
              clearABLoop();
              showToast('Loop Reset', 'trash-outline');
            }}
            onClose={() => setShowABLooperStrip(false)}
            onSetPointA={async () => {
              const posSec = await TrackPlayer.getPosition().catch(() => 0);
              const posMs = Math.floor(posSec * 1000);
              await setLoopPointA(posMs);
              showToast(`Start (A): ${formatTime(posMs)}`, 'flag');
            }}
            onSetPointB={async () => {
              const posSec = await TrackPlayer.getPosition().catch(() => 0);
              const posMs = Math.floor(posSec * 1000);
              if (abLoop.start !== null && posMs <= abLoop.start) {
                showToast('End (B) must be after Start (A)', 'alert-circle');
                return;
              }
              await setLoopPointB(posMs);
              showToast(`End (B): ${formatTime(posMs)}`, 'flag');
            }}
            onToggleLoop={() => {
              toggleABLoop();
              if (!abLoop.active) {
                showToast(`Looping ${formatTime(abLoop.start!)} ⇄ ${formatTime(abLoop.end!)}`, 'infinite');
              } else {
                showToast('Section Loop Paused', 'pause-circle-outline');
              }
            }}
            formatTime={formatTime}
            theme={theme}
            styles={styles}
          />

          {/* Clean, Spacious Player Controls & Progress */}
          <View style={{ marginTop: 'auto', marginBottom: 8 }}>
            <PlayerProgressSlider
              theme={theme}
              styles={styles}
              formatTime={formatTime}
              seekTo={seekTo}
              hasAudio={!!activeTrack?.audioUrl}
              abLoop={abLoop}
            />

            {/* Playback Controls */}
            <PlayerControlsRow
              isShuffle={isShuffle}
              onToggleShuffle={handleToggleShuffle}
              onSkipPrevious={skipToPrevious}
              isLoading={isLoading}
              isPlaying={isPlaying}
              hasAudio={!!activeTrack?.audioUrl}
              onPlayPause={handlePlayPause}
              onSkipNext={skipToNext}
              repeatMode={repeatMode}
              onToggleRepeat={handleToggleRepeat}
              theme={theme}
              styles={styles}
            />
          </View>
          </View>
        </ScrollView>
        
        {AnnotationLayer}

        {/* Annotation FAB */}
        <PlayerAnnotationFAB
          isPrivileged={isPrivileged}
          isAnnotationMode={isAnnotationMode}
          onToggleAnnotationMode={() => setIsAnnotationMode(!isAnnotationMode)}
          showColorPalette={showColorPalette}
          onToggleColorPalette={() => setShowColorPalette(!showColorPalette)}
          selectedColor={selectedColor}
          getMyColor={getMyColor}
          onSelectColor={setSelectedColor}
          annotationTool={annotationTool}
          onSelectTool={setAnnotationTool}
          onClearMyAnnotations={handleClearMyAnnotations}
          theme={theme}
        />
        </View>

        {/* Bottom Tab Bar */}
        <PlayerBottomTabBar
          onOpenQueue={() => setShowQueueModal(true)}
          abLoop={abLoop}
          onABLoopPress={handleABLoopPress}
          onClearABLoop={() => {
            if (abLoop.start !== null || abLoop.active) {
              clearABLoop();
              showToast('Section Loop Cleared', 'trash-outline');
            }
          }}
          formatTime={formatTime}
          playbackRate={playbackRate}
          onOpenSpeed={() => setShowSpeedModal(true)}
          onOpenAudioParts={() => setShowAudioPartsModal(true)}
          onOpenKaraoke={() => navigation.navigate('Karaoke', { activeTrack })}
          insets={insets}
          theme={theme}
          styles={styles}
        />
      </SafeAreaView>

      {/* More Options Modal */}
      <PlayerOptionsMenuModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        abLoop={abLoop}
        onOpenABLooper={() => setShowABLooperStrip(true)}
        onClearABLoop={() => {
          clearABLoop();
          showToast('Section Loop Off', 'close-circle-outline');
        }}
        activeTrack={activeTrack}
        isDownloadedOffline={isDownloadedOffline}
        isDownloadingOffline={isDownloadingOffline}
        onToggleOfflineDownload={handleToggleOfflineDownload}
        sleepTimerRemaining={sleepTimerRemaining}
        onOpenSleepTimer={() => setShowSleepTimerModal(true)}
        onOpenPlaylist={() => setShowPlaylistModal(true)}
        formatTime={formatTime}
        theme={theme}
        styles={styles}
      />

      {/* Playback Speed Modal */}
      <PlayerSpeedModal
        visible={showSpeedModal}
        onClose={() => setShowSpeedModal(false)}
        playbackRate={playbackRate}
        onSelectSpeed={handleSelectSpeed}
        theme={theme}
        styles={styles}
      />

      {/* Sleep Timer Modal */}
      <PlayerSleepTimerModal
        visible={showSleepTimerModal}
        onClose={() => setShowSleepTimerModal(false)}
        sleepTimerMinutes={sleepTimerMinutes}
        onSelectSleepTimer={handleSelectSleepTimer}
        theme={theme}
        styles={styles}
      />

      {/* Up Next Queue Modal */}
      <PlayerQueueModal
        visible={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        displayQueue={displayQueue}
        activeTrack={activeTrack}
        onSelectTrack={async (song) => {
          setShowQueueModal(false);
          await skipToTrack(song);
          showToast(`Playing: ${song.title}`, 'musical-notes');
        }}
        theme={theme}
        styles={styles}
      />

      {/* Song Resources Modal */}
      <PlayerMoreAssetsModal
        visible={showMoreAssetsModal}
        onClose={() => setShowMoreAssetsModal(false)}
        canViewHistory={!fromAllSongs || isHQ}
        onOpenHistory={() => navigation.navigate('History', { activeTrack, backgroundColor: '#8b5cf6' })}
        onOpenSolfa={() => navigation.navigate('Solfa', { activeTrack, backgroundColor: '#8b5cf6' })}
        theme={theme}
        styles={styles}
      />

      {/* Save to Playlist Modal */}
      <PlayerAddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        newPlaylistName={newPlaylistName}
        onChangeNewPlaylistName={setNewPlaylistName}
        isCreatingPlaylist={isCreatingPlaylist}
        onCreatePlaylist={handleCreatePlaylist}
        playlists={playlists}
        activeTrack={activeTrack}
        onAddToPlaylist={handleAddToPlaylist}
        theme={theme}
        styles={styles}
      />

      {/* Audio Parts Modal */}
      <PlayerAudioPartsModal
        visible={showAudioPartsModal}
        onClose={() => setShowAudioPartsModal(false)}
        activeTrack={activeTrack}
        currentTrack={currentTrack}
        onSelectTrack={(trackToPlay) => play(trackToPlay)}
        theme={theme}
        styles={styles}
      />

      <ShareToChatSheet
        visible={showShareSheet}
        song={activeTrack ? {
          ...activeTrack,
          id: activeTrack.id,
          title: activeTrack?.title || 'Untitled',
        } : null}
        onClose={() => setShowShareSheet(false)}
      />

      <SongScheduleSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
      />

      {NotesModal}

    </View>);
}

const getStyles = (theme: any, insets: any, screenWidth: number = SCREEN_WIDTH) => {
  const isTablet = screenWidth >= 768;
  return StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  headerBtn: {
    padding: 4
  },
  headerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  artContainer: {
    width: '100%',
    height: isTablet ? 380 : 310,
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
    backgroundColor: theme.colors.backgroundDark
  },
  overlayContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 72,
    paddingBottom: 12,
    justifyContent: 'flex-end'
  },
  tableContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 3,
    overflow: 'hidden'
  },
  tableRowFull: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingBottom: 5,
    paddingHorizontal: 2,
    marginBottom: 0
  },
  tableRowSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingBottom: 5,
    paddingHorizontal: 2,
    marginBottom: 0
  },
  tableCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tableCellLeft: {
    flex: 1.15,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingRight: 6
  },
  tableCellRight: {
    flex: 0.85,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  tableLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10.5,
    fontWeight: '800',
    marginRight: 4,
    letterSpacing: 0.2,
    flexShrink: 0
  },
  tableValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.5
  },
  artist: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: '600'
  },
  progressContainer: {
    marginBottom: 14
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8
  },
  timeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 20
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  playerTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    paddingTop: 8,
    paddingBottom: 4
  },
  playerTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4
  },
  playerTabLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  lyricsCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginBottom: 24
  },
  lyricsCardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  lyricsCardText: {
    ...theme.typography.bodyText,
    marginBottom: 32
  },
  showLyricsBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24
  },
  showLyricsBtnText: {
    color: theme.colors.backgroundDark,
    fontSize: 14,
    fontWeight: '800'
  },
  previewTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  previewTabActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  previewTabText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  previewTabTextActive: {
    color: theme.colors.backgroundDark,
    fontWeight: '800'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  bottomSheet: {
    backgroundColor: theme.colors.bottomSheetBackground,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Math.max(Platform.OS === 'android' ? 36 : 24, insets.bottom + (Platform.OS === 'android' ? 32 : 16)),
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  bottomSheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  },
  closeModalBtn: {
    padding: 6,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  optionItemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  playlistInput: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  createPlaylistBtn: {
    height: 50,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createPlaylistBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  playlistIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  playlistItemName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3
  },
  playlistItemCount: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  abLooperStrip: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderColor: theme.colors.bottomTabBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  abLooperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  abLooperTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800'
  },
  abLooperSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  abResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#ff453a20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff453a40'
  },
  abResetText: {
    color: '#ff453a',
    fontSize: 11,
    fontWeight: '800'
  },
  abPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  abPointBox: {
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  abPointLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  abPointTime: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2
  },
  nudgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4
  },
  nudgeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  nudgeText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700'
  },
  abLoopToggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.cardBackground,
    borderColor: theme.colors.bottomTabBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  abLoopToggleText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800'
  }
});
};
