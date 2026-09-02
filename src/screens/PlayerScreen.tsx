import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { optimizeAudio } from '../lib/mediaUtils';
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
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Slider from '@react-native-community/slider';
import RenderHtml from 'react-native-render-html';
import { useTrackPlayer, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import { SafeTrackPlayer as TrackPlayer } from '../lib/safeNativeModules';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { useAnnotationsAndNotes } from '../hooks/useAnnotationsAndNotes';
import { SongScheduleSheet } from '../components/SongScheduleSheet';
import { useUserStore } from '../hooks/useUser';
import { apiClient } from '../lib/apiClient';
import { useWebSocket } from '../hooks/useWebSocket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SPEED_OPTIONS = [
  { label: '0.75x', value: 0.75, description: 'Very Slow (Practice tempo)' },
  { label: '0.85x', value: 0.85, description: 'Slow' },
  { label: '1.0x', value: 1.0, description: 'Normal Speed' },
  { label: '1.15x', value: 1.15, description: 'Slightly Faster' },
  { label: '1.25x', value: 1.25, description: 'Faster' },
  { label: '1.5x', value: 1.5, description: 'Quick Listen' },
];

const SLEEP_TIMER_OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '60 minutes', minutes: 60 },
  { label: 'End of current song', minutes: -1 },
];

const ExpandableText = ({ style, children, gradientColors }: { style: any, children: React.ReactNode, gradientColors?: readonly [string, string, ...string[]] }) => {
  const [expanded, setExpanded] = useState(false);
  const textProps = {
    numberOfLines: expanded ? undefined : 1,
    ellipsizeMode: "tail" as const,
    onPress: () => setExpanded(!expanded),
    suppressHighlighting: true,
  };

  const textElement = (
    <Text style={style} {...textProps}>
      {children}
    </Text>
  );

  if (gradientColors && gradientColors.length > 0) {
    return (
      <MaskedView maskElement={textElement} style={style}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[style, { opacity: 0 }]} {...textProps}>
          {children}
        </Text>
      </MaskedView>
    );
  }

  return textElement;
};

// Floating HUD Toast for Mode/Gesture Feedback
const ToastHUD = ({ message, opacity, theme }: { message: { text: string; icon?: string } | null; opacity: Animated.Value; theme: any }) => {
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 92,
        alignSelf: 'center',
        zIndex: 999,
        opacity,
        transform: [{
          translateY: opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [-12, 0]
          })
        }],
        backgroundColor: 'rgba(15, 15, 25, 0.92)',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 12,
      }}
    >
      {message.icon && (
        <Ionicons name={message.icon as any} size={18} color={theme.colors.accent} />
      )}
      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
        {message.text}
      </Text>
    </Animated.View>
  );
};

// Double-Tap Jump Overlay
const DoubleTapOverlay = ({ side, anim, theme }: { side: 'left' | 'right' | null; anim: Animated.Value; theme: any }) => {
  if (!side) return null;
  const isLeft = side === 'left';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          justifyContent: 'center',
          alignItems: isLeft ? 'flex-start' : 'flex-end',
          paddingHorizontal: 32,
          zIndex: 50,
          opacity: anim,
        }
      ]}
    >
      <Animated.View
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          borderWidth: 1.5,
          borderColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.75, 1.05]
            })
          }],
          shadowColor: theme.colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
        }}
      >
        <Ionicons name={isLeft ? "play-back" : "play-forward"} size={26} color={theme.colors.accent} />
        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', marginTop: 2 }}>
          {isLeft ? '-10s' : '+10s'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const PlayerProgressSlider = ({
  theme,
  styles,
  formatTime,
  seekTo,
  hasAudio,
  abLoop,
}: any) => {
  const progress = useTrackPlayerProgress(200);
  const duration = hasAudio ? progress.duration : 0;
  const position = hasAudio ? progress.position : 0;
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayValue, setSeekDisplayValue] = useState(0);

  const handleSlidingStart = () => {
    setIsSeeking(true);
    setSeekDisplayValue(position);
  };

  const handleSlidingComplete = async (val: number) => {
    await seekTo(val);
    setTimeout(() => {
      setIsSeeking(false);
    }, 150);
  };

  const currentValue = isSeeking ? seekDisplayValue : position;

  const startPercent = (duration > 0 && abLoop?.start !== null) ? Math.min(100, Math.max(0, (abLoop.start / duration) * 100)) : null;
  const endPercent = (duration > 0 && abLoop?.end !== null) ? Math.min(100, Math.max(0, (abLoop.end / duration) * 100)) : null;

  return (
    <View style={styles.progressContainer}>
      <View style={{ position: 'relative', width: '100%', justifyContent: 'center' }}>
        {/* Loop Region Highlight on Scrubber */}
        {startPercent !== null && endPercent !== null && endPercent > startPercent && (
          <View
            style={{
              position: 'absolute',
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
              height: 4,
              backgroundColor: theme.colors.accent,
              borderRadius: 2,
              top: 18,
              zIndex: 1,
              opacity: 0.6,
            }}
          />
        )}

        {/* Marker A Flag */}
        {startPercent !== null && (
          <View
            style={{
              position: 'absolute',
              left: `${startPercent}%`,
              top: 8,
              width: 3,
              height: 24,
              backgroundColor: '#38bdf8',
              borderRadius: 2,
              zIndex: 3,
              marginLeft: -1.5,
            }}
          />
        )}

        {/* Marker B Flag */}
        {endPercent !== null && (
          <View
            style={{
              position: 'absolute',
              left: `${endPercent}%`,
              top: 8,
              width: 3,
              height: 24,
              backgroundColor: '#ec4899',
              borderRadius: 2,
              zIndex: 3,
              marginLeft: -1.5,
            }}
          />
        )}

        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 100}
          value={currentValue}
          minimumTrackTintColor={hasAudio ? theme.colors.trackMin : theme.colors.textMuted}
          maximumTrackTintColor={theme.colors.trackMax}
          thumbTintColor={hasAudio ? theme.colors.thumbTint : 'transparent'}
          onSlidingStart={handleSlidingStart}
          onValueChange={(val) => {
            setSeekDisplayValue(val);
          }}
          onSlidingComplete={handleSlidingComplete}
          disabled={!hasAudio}
        />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{hasAudio ? formatTime(currentValue) : '--:--'}</Text>
        <Text style={styles.timeText}>
          {hasAudio && duration > 0 ? `-${formatTime(Math.max(0, duration - currentValue))}` : '--:--'}
        </Text>
      </View>
    </View>
  );
};

export default function PlayerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isHQ = useUserStore(s => s.isHQ);
  const { activeTrack: initialTrack, fromAllSongs, queue: initialQueue } = route.params || {};

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

  const [activeTrack, setActiveTrack] = useState(initialTrack || fallbackTrack);
  const { width } = useWindowDimensions();
  const [activePreviewTab, setActivePreviewTab] = useState('Lyrics');
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
  const [liveSong, setLiveSong] = useState<any>(null);

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

  const applySongUpdate = useCallback((updateData: any) => {
    const update = updateData?.data || updateData;
    if (!update || typeof update !== 'object') return;
    setActiveTrack((prev: any) => {
      if (!prev) return prev;
      const rawAudioUrl = update.audioFile || update.audioUrls?.full || prev.audioUrl;
      const songAudioUrl = rawAudioUrl && rawAudioUrl.includes('cloudinary.com') ? optimizeAudio(rawAudioUrl) : rawAudioUrl;
      return {
        ...prev,
        ...update,
        lyrics: update.lyrics !== undefined ? update.lyrics : prev.lyrics,
        solfa: (update.notation || update.solfas || update.solfa) !== undefined ? (update.notation || update.solfas || update.solfa) : prev.solfa,
        conductorGuide: (update.solfas || update.conductorGuide || update.guide) !== undefined ? (update.solfas || update.conductorGuide || update.guide) : prev.conductorGuide,
        comments: update.comments !== undefined ? update.comments : prev.comments,
        history: update.history !== undefined ? update.history : prev.history,
        audioUrl: songAudioUrl,
        status: isSongHeard(update) ? 'heard' : (update.status || prev.status),
        isActive: update.isActive !== undefined ? (update.isActive === true || String(update.isActive) === 'true' || update.isLive === true || update.status === 'live') : Boolean(prev?.isActive),
      };
    });
  }, []);

  useWebSocket('song', activeTrack?.id ? String(activeTrack.id) : '', (eventData: any) => {
    applySongUpdate(eventData);
  }, Boolean(activeTrack?.id));

  useWebSocket('song', 'all', (eventData: any) => {
    const update = eventData?.data || eventData;
    if (update && typeof update === 'object' && activeTrack?.id && (String(update.id) === String(activeTrack.id) || update.title === activeTrack.title)) {
      applySongUpdate(update);
    }
  }, Boolean(activeTrack?.id));

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
    setShowNotesModal
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

  // Sync activeTrack metadata automatically when TrackPlayer advances to next/prev song
  useEffect(() => {
    if (currentTrack && currentTrack.id && String(currentTrack.id) !== String(activeTrack?.id)) {
      setActiveTrack((prev: any) => ({
        ...prev,
        ...currentTrack,
        lyrics: currentTrack.lyrics || prev?.lyrics,
        solfa: currentTrack.solfa || currentTrack.solfas || currentTrack.notation || prev?.solfa,
        conductorGuide: currentTrack.conductorGuide || currentTrack.guide || prev?.conductorGuide,
        comments: currentTrack.comments || prev?.comments,
        history: currentTrack.history || prev?.history,
      }));
    }
  }, [currentTrack]);

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
      await apiClient.post('/playlists', { name: newPlaylistName.trim() });
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/playlists/me');
      if (res?.data) setPlaylists(res.data);
      setNewPlaylistName('');
    } catch {}
    setIsCreatingPlaylist(false);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!activeTrack?.id) return;
    try {
      await apiClient.post(`/playlists/${playlistId}/songs`, { songId: activeTrack.id });
      Alert.alert('Success', 'Added to playlist');
      setShowPlaylistModal(false);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    apiClient.get<{ success: boolean; data: any[] }>('/playlists/me').then(res => {
      if (res?.success && Array.isArray(res.data)) setPlaylists(res.data);
    }).catch(() => {});
  }, [user]);

  const toggleFavorite = async () => {
    if (!activeTrack?.id) return;
    try {
      setIsFavorite(prev => !prev);
      if (isFavorite) {
        await apiClient.delete(`/favorites/${activeTrack.id}`).catch(() => {});
      } else {
        await apiClient.post('/favorites', { songId: activeTrack.id }).catch(() => {});
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const previewTabs = ['Lyrics', 'Comments', 'Conductor'];

  useEffect(() => {
    if (!activeTrack?.id) return;
    const isSameTrack = currentTrack && String(currentTrack.id) === String(activeTrack.id);
    if (isSameTrack) return;
    if (!currentTrack || String(currentTrack.id) !== String(activeTrack.id) || (!currentTrack.audioUrl && activeTrack.audioUrl)) {
      play(activeTrack, initialQueue || undefined, false);
    }
  }, [activeTrack?.id]);

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

  const parseMarkdown = (text: any) => {
    if (!text) return '';
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  };

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

  const displayQueue = queue && queue.length > 0 ? queue : (initialQueue || [activeTrack]);

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
            style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16, color: '#000000', textShadowColor: 'rgba(255,255,255,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]} 
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

        {liveSong && String(liveSong.id) !== String(activeTrack?.id) && (
          <TouchableOpacity 
            style={{
              backgroundColor: theme.colors.accent + '20',
              borderColor: theme.colors.accent,
              borderWidth: 1,
              marginHorizontal: 16,
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onPress={() => {
              setActiveTrack(liveSong);
              play(liveSong, initialQueue || undefined);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent, marginRight: 8 }} />
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 13, flex: 1 }} numberOfLines={1}>
                Live Now: {liveSong.title || 'Unknown'}
              </Text>
            </View>
            <Ionicons name="play-circle" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        )}

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
              <Image
                source={activeTrack.imageUrl ? { uri: activeTrack.imageUrl } : activeTrack.image}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="disk"
                blurRadius={8} />
              
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
                    <View style={styles.tableCell}>
                      <Text style={styles.tableLabel}>WRITER:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.writer?.split(',')[0]?.trim() || 'Unknown'}</ExpandableText>
                    </View>
                    <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                      <Text style={styles.tableLabel}>REHEARSALS:</Text>
                      <ExpandableText style={[styles.tableValue, { color: theme.colors.accent }]}>{`x${activeTrack.rehearsalCount ?? 0}`}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCell}>
                      <Text style={styles.tableLabel}>CONDUCTOR:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.conductor?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                      <Text style={styles.tableLabel}>KEY:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.key || '—'}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCell}>
                      <Text style={styles.tableLabel}>LEAD KEYBOARDIST:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.leadKeyboardist?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                      <Text style={styles.tableLabel}>TEMPO:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.tempo || '—'}</ExpandableText>
                    </View>
                  </View>

                  <View style={styles.tableRowSplit}>
                    <View style={styles.tableCell}>
                      <Text style={styles.tableLabel}>DRUMMER:</Text>
                      <ExpandableText style={styles.tableValue}>{activeTrack.drummer?.split(',')[0]?.trim() || '—'}</ExpandableText>
                    </View>
                    <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 1.2 }]}>
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

          {activePreviewTab === 'Lyrics' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Lyrics preview</Text>
                {activeTrack.lyrics ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.lyrics) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No lyrics available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Lyrics', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Conductor' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Conductor preview</Text>
                {activeTrack.conductorGuide ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.conductorGuide) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No conductor guide provided.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Conductor', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Solfa' && (!fromAllSongs || isHQ) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Solfa preview</Text>
                {activeTrack.solfa ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.solfa) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No solfa notation available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Solfa', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'History' && (!fromAllSongs || isHQ) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>History preview</Text>
                {activeTrack.history ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.history) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No history available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('History', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Comments' && !fromAllSongs && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Comments preview</Text>
                {activeTrack.comments ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: getParsedCommentsHtml() }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No comments from directors.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Comments', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Details' && !fromAllSongs && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Song Details</Text>
                <View style={{ maxHeight: 80, overflow: 'hidden' }}>
                  <ExpandableText style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Lead: </Text>{activeTrack.leadSinger || 'Unknown'}
                  </ExpandableText>
                  <ExpandableText style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Album: </Text>{activeTrack.program || 'Unknown'}
                  </ExpandableText>
                </View>
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Details', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {/* Crystal-Clear Section Looper Panel */}
          {(showABLooperStrip || abLoop.active || abLoop.start !== null) && (
            <View style={styles.abLooperStrip}>
              {/* Header with Title and Reset */}
              <View style={styles.abLooperHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="infinite" size={16} color={theme.colors.accent} />
                  <Text style={styles.abLooperTitle}>Section Looper</Text>
                  <Text style={styles.abLooperSubtitle}>
                    {abLoop.active
                      ? `(${formatTime(abLoop.start!)} ⇄ ${formatTime(abLoop.end!)})`
                      : abLoop.start !== null
                      ? '• Tap End (B) to loop'
                      : '• Tap Start (A) to begin'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {(abLoop.start !== null || abLoop.end !== null || abLoop.active) && (
                    <TouchableOpacity
                      onPress={() => {
                        clearABLoop();
                        showToast('Section Loop Reset', 'trash-outline');
                      }}
                      style={styles.abResetBtn}
                    >
                      <Ionicons name="trash-outline" size={12} color="#ff453a" />
                      <Text style={styles.abResetText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowABLooperStrip(false)}
                    style={{ padding: 4 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Set Point A & Point B Controls */}
              <View style={styles.abPointsRow}>
                {/* Point A */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={[
                      styles.abPointBox,
                      abLoop.start !== null && { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.15)' }
                    ]}
                    onPress={async () => {
                      const posSec = await TrackPlayer.getPosition().catch(() => 0);
                      const posMs = Math.floor(posSec * 1000);
                      await setLoopPointA(posMs);
                      showToast(`Point A: ${formatTime(posMs)}`, 'flag');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="flag" size={12} color={abLoop.start !== null ? '#38bdf8' : theme.colors.textMuted} />
                      <Text style={styles.abPointLabel}>START (A)</Text>
                    </View>
                    <Text style={[styles.abPointTime, abLoop.start !== null && { color: '#38bdf8' }]}>
                      {abLoop.start !== null ? formatTime(abLoop.start) : 'Set Current'}
                    </Text>
                  </TouchableOpacity>
                  {abLoop.start !== null && (
                    <View style={styles.nudgeRow}>
                      <TouchableOpacity onPress={() => adjustLoopPointA(-1000)} style={styles.nudgeBtn}>
                        <Text style={styles.nudgeText}>-1s</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => adjustLoopPointA(1000)} style={styles.nudgeBtn}>
                        <Text style={styles.nudgeText}>+1s</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <Ionicons name="arrow-forward" size={14} color={theme.colors.textMuted} style={{ marginTop: abLoop.start !== null ? -14 : 0 }} />

                {/* Point B */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={[
                      styles.abPointBox,
                      abLoop.end !== null && { borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.15)' }
                    ]}
                    onPress={async () => {
                      const posSec = await TrackPlayer.getPosition().catch(() => 0);
                      const posMs = Math.floor(posSec * 1000);
                      if (abLoop.start !== null && posMs <= abLoop.start) {
                        showToast('Point B must be after Point A', 'alert-circle');
                        return;
                      }
                      await setLoopPointB(posMs);
                      showToast(`Point B: ${formatTime(posMs)}`, 'flag');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="flag" size={12} color={abLoop.end !== null ? '#ec4899' : theme.colors.textMuted} />
                      <Text style={styles.abPointLabel}>END (B)</Text>
                    </View>
                    <Text style={[styles.abPointTime, abLoop.end !== null && { color: '#ec4899' }]}>
                      {abLoop.end !== null ? formatTime(abLoop.end) : (abLoop.start !== null ? 'Set Current' : '--:--')}
                    </Text>
                  </TouchableOpacity>
                  {abLoop.end !== null && (
                    <View style={styles.nudgeRow}>
                      <TouchableOpacity onPress={() => adjustLoopPointB(-1000)} style={styles.nudgeBtn}>
                        <Text style={styles.nudgeText}>-1s</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => adjustLoopPointB(1000)} style={styles.nudgeBtn}>
                        <Text style={styles.nudgeText}>+1s</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Loop / Pause Button */}
                <TouchableOpacity
                  style={[
                    styles.abLoopToggleBtn,
                    abLoop.active && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                    !(abLoop.start !== null && abLoop.end !== null && abLoop.end > abLoop.start) && { opacity: 0.45 },
                    { marginTop: abLoop.start !== null ? -14 : 0 }
                  ]}
                  disabled={!(abLoop.start !== null && abLoop.end !== null && abLoop.end > abLoop.start)}
                  onPress={() => {
                    toggleABLoop();
                    if (!abLoop.active) {
                      showToast(`Looping ${formatTime(abLoop.start!)} ➔ ${formatTime(abLoop.end!)}`, 'infinite');
                    } else {
                      showToast('Section Loop Paused', 'pause-circle-outline');
                    }
                  }}
                >
                  <Ionicons
                    name={abLoop.active ? "pause" : "play"}
                    size={16}
                    color={abLoop.active ? theme.colors.backgroundDark : theme.colors.textPrimary}
                  />
                  <Text style={[
                    styles.abLoopToggleText,
                    abLoop.active && { color: theme.colors.backgroundDark }
                  ]}>
                    {abLoop.active ? 'Looping' : 'Loop'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

            {/* Pristine 5-Button Controls Row */}
            <View style={styles.controlsRow}>
              {/* Shuffle Button */}
              <TouchableOpacity onPress={handleToggleShuffle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="shuffle" size={24} color={isShuffle ? theme.colors.accent : theme.colors.textPrimary} />
              </TouchableOpacity>
              
              {/* Previous Track */}
              <TouchableOpacity onPress={async () => {
                await skipToPrevious();
              }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="play-skip-back" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              
              {/* Main Play / Pause Button */}
              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={handlePlayPause}
                activeOpacity={0.8}>
                
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.backgroundDark} />
                ) : (
                  <Ionicons name={!activeTrack?.audioUrl ? "alert-circle" : isPlaying ? "pause" : "play"} size={28} color={theme.colors.backgroundDark} style={{ marginLeft: isPlaying || !activeTrack?.audioUrl ? 0 : 3 }} />
                )}
              </TouchableOpacity>
              
              {/* Next Track */}
              <TouchableOpacity onPress={async () => {
                await skipToNext();
              }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="play-skip-forward" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              
              {/* Repeat / Loop Button */}
              <TouchableOpacity onPress={handleToggleRepeat} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="repeat" size={24} color={repeatMode !== 'off' ? theme.colors.accent : theme.colors.textSecondary} />
                  {repeatMode === 'track' && (
                    <View style={{
                      position: 'absolute',
                      backgroundColor: theme.colors.accent,
                      borderRadius: 6,
                      width: 12,
                      height: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      top: -4,
                      right: -6
                    }}>
                      <Text style={{ color: theme.colors.backgroundDark, fontSize: 8, fontWeight: '900' }}>1</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </ScrollView>
        
        {AnnotationLayer}

        {isPrivileged && (
          <View style={{ position: 'absolute', bottom: 110, right: 20, flexDirection: 'row', alignItems: 'flex-end', zIndex: 101, gap: 12 }} pointerEvents="box-none">
            {isAnnotationMode && showColorPalette && (
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(0,0,0,0.85)', padding: 8, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, marginBottom: 6 }}>
                {['#ff3b30', '#34c759', '#007aff', '#ffcc00', '#af52de', '#ffffff'].map(c => {
                  const isCurrent = (selectedColor || getMyColor()) === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: c,
                        borderWidth: isCurrent ? 2.5 : 0,
                        borderColor: '#fff',
                        transform: [{ scale: isCurrent ? 1.15 : 1 }]
                      }}
                      onPress={() => setSelectedColor(c)}
                    />
                  );
                })}
              </View>
            )}
            <View style={{ alignItems: 'center', gap: 10 }} pointerEvents="box-none">
              {isAnnotationMode && (
                <>
                  <TouchableOpacity 
                    style={{ backgroundColor: 'rgba(255,59,48,0.95)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
                    onPress={handleClearMyAnnotations}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: showColorPalette ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: showColorPalette ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setShowColorPalette(!showColorPalette)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="color-palette-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setAnnotationTool('eraser')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="eraser" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setAnnotationTool('pen')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: isAnnotationMode ? theme.colors.accent : 'rgba(0,0,0,0.6)',
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 8,
                  borderWidth: 1,
                  borderColor: isAnnotationMode ? theme.colors.accent : 'rgba(255,255,255,0.1)'
                }}
                onPress={() => setIsAnnotationMode(!isAnnotationMode)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="brush" 
                  size={24} 
                  color="#ffffff" 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        </View>

        {/* Clean Bottom Actions Bar */}
        <View style={[styles.playerTabBar, { paddingBottom: Platform.OS === 'android' ? Math.max(10, insets.bottom - 16) : Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.playerTabButton} onPress={() => setShowQueueModal(true)}>
            <Ionicons name="list-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Queue</Text>
          </TouchableOpacity>

          {/* 1-Tap / 2-Tap A-B Section Loop Button */}
          <TouchableOpacity
            style={styles.playerTabButton}
            onPress={handleABLoopPress}
            onLongPress={() => {
              if (abLoop.start !== null || abLoop.active) {
                clearABLoop();
                showToast('Section Loop Cleared', 'trash-outline');
              }
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons
                name={abLoop.active ? "infinite" : abLoop.start !== null ? "flag" : "infinite-outline"}
                size={20}
                color={abLoop.active || abLoop.start !== null ? theme.colors.accent : theme.colors.textSecondary}
              />
              {abLoop.active && (
                <View style={{
                  position: 'absolute',
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.accent,
                  top: -2,
                  right: -4
                }} />
              )}
            </View>
            <Text style={[
              styles.playerTabLabel,
              (abLoop.active || abLoop.start !== null) && { color: theme.colors.accent, fontWeight: '800' }
            ]}>
              {abLoop.active
                ? `${formatTime(abLoop.start!)} ⇄ ${formatTime(abLoop.end!)}`
                : abLoop.start !== null
                ? `Set End (B)`
                : `A-B Loop`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={() => setShowSpeedModal(true)}>
            <Ionicons name="speedometer-outline" size={20} color={playbackRate !== 1.0 ? theme.colors.accent : theme.colors.textSecondary} />
            <Text style={[styles.playerTabLabel, playbackRate !== 1.0 && { color: theme.colors.accent, fontWeight: '800' }]}>
              {playbackRate === 1.0 ? 'Speed' : `${playbackRate}x`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={() => setShowAudioPartsModal(true)}>
            <Ionicons name="musical-notes-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Parts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={() => { navigation.navigate('Karaoke', { activeTrack }); }}>
            <Ionicons name="mic-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Practice</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* More Options Modal */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowOptionsModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Section Looper Option */}
            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setShowABLooperStrip(true);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="infinite" size={22} color={abLoop.active ? theme.colors.accent : theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionItemText}>Section Looper (A-B)</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {abLoop.active ? `Active: ${formatTime(abLoop.start!)} – ${formatTime(abLoop.end!)}` : 'Set A-B repeat region'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Clear Section Loop if active */}
            {(abLoop.active || abLoop.start !== null) && (
              <TouchableOpacity style={styles.optionItem} onPress={() => {
                setShowOptionsModal(false);
                clearABLoop();
                showToast('Section Loop Off', 'close-circle-outline');
              }}>
                <View style={styles.optionIconBox}>
                  <Ionicons name="trash-outline" size={22} color="#ff453a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionItemText, { color: '#ff453a' }]}>Reset Section Loop</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {abLoop.active ? `${formatTime(abLoop.start!)} – ${formatTime(abLoop.end!)}` : 'Point A is set'}
                  </Text>
                </View>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Share Song */}
            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              handleShare();
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="share-social-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionItemText}>Share Song</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Share link with song info</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Download for Offline Playback */}
            {activeTrack?.audioUrl && (
              <TouchableOpacity style={styles.optionItem} onPress={handleToggleOfflineDownload} disabled={isDownloadingOffline}>
                <View style={[styles.optionIconBox, isDownloadedOffline && { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  {isDownloadingOffline ? (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  ) : (
                    <Ionicons
                      name={isDownloadedOffline ? "checkmark-circle" : "cloud-download-outline"}
                      size={22}
                      color={isDownloadedOffline ? "#22c55e" : theme.colors.accent}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionItemText, isDownloadedOffline && { color: '#22c55e', fontWeight: '700' }]}>
                    {isDownloadedOffline ? 'Downloaded (Offline Ready)' : 'Download for Offline Playback'}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {isDownloadedOffline ? 'Tap to remove from device' : 'Save track to play without internet'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Sleep Timer Option */}
            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setTimeout(() => setShowSleepTimerModal(true), 300);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="moon-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionItemText}>Sleep Timer</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {sleepTimerRemaining !== null ? `${Math.ceil(sleepTimerRemaining / 60)} mins remaining` : 'Off'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Forward to Chat */}
            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setTimeout(() => setShowShareSheet(true), 300);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Forward to Chat</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Add to Playlist */}
            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setTimeout(() => setShowPlaylistModal(true), 300);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="list-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Add to Playlist</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </View>
        </BlurView>
      </Modal>

      {/* Playback Speed Modal */}
      <Modal visible={showSpeedModal} transparent animationType="slide" onRequestClose={() => setShowSpeedModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowSpeedModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Playback Speed</Text>
              <TouchableOpacity onPress={() => setShowSpeedModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {SPEED_OPTIONS.map(opt => {
                const isSelected = Math.abs(playbackRate - opt.value) < 0.01;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.playlistItem, isSelected && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 }]}
                    onPress={() => handleSelectSpeed(opt.value)}
                  >
                    <View style={[styles.playlistIconBox, isSelected && { backgroundColor: theme.colors.accent + '33' }]}>
                      <Ionicons name="speedometer" size={22} color={isSelected ? theme.colors.accent : theme.colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.playlistItemName, isSelected && { color: theme.colors.accent, fontWeight: '800' }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.playlistItemCount}>{opt.description}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Sleep Timer Modal */}
      <Modal visible={showSleepTimerModal} transparent animationType="slide" onRequestClose={() => setShowSleepTimerModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowSleepTimerModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Sleep Timer</Text>
              <TouchableOpacity onPress={() => setShowSleepTimerModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {SLEEP_TIMER_OPTIONS.map(opt => {
                const isSelected = sleepTimerMinutes === opt.minutes;
                return (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[styles.playlistItem, isSelected && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 }]}
                    onPress={() => handleSelectSleepTimer(opt.minutes)}
                  >
                    <View style={[styles.playlistIconBox, isSelected && { backgroundColor: theme.colors.accent + '33' }]}>
                      <Ionicons name="moon" size={22} color={isSelected ? theme.colors.accent : theme.colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.playlistItemName, isSelected && { color: theme.colors.accent, fontWeight: '800' }]}>
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Up Next Queue Modal */}
      <Modal visible={showQueueModal} transparent animationType="slide" onRequestClose={() => setShowQueueModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowQueueModal(false)} />
          <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
            <View style={styles.bottomSheetHeader}>
              <View>
                <Text style={styles.bottomSheetTitle}>Up Next Queue</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  {displayQueue.length} {displayQueue.length === 1 ? 'song' : 'songs'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowQueueModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {displayQueue.map((song: any, index: number) => {
                const isCurrent = String(song.id) === String(activeTrack?.id);
                return (
                  <TouchableOpacity
                    key={song.id || index}
                    style={[
                      styles.playlistItem,
                      isCurrent && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 }
                    ]}
                    onPress={async () => {
                      setShowQueueModal(false);
                      await skipToTrack(song);
                      showToast(`Playing: ${song.title}`, 'musical-notes');
                    }}
                  >
                    <View style={[styles.playlistIconBox, isCurrent && { backgroundColor: theme.colors.accent + '33' }]}>
                      <Text style={{ color: isCurrent ? theme.colors.accent : theme.colors.textMuted, fontWeight: '700', fontSize: 14 }}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.playlistItemName, isCurrent && { color: theme.colors.accent, fontWeight: '800' }]} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={styles.playlistItemCount} numberOfLines={1}>
                        {song.leadSinger || song.writer || 'Loveworld Singers'}
                      </Text>
                    </View>
                    {isCurrent && (
                      <Ionicons name="volume-high" size={22} color={theme.colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Song Resources Modal */}
      <Modal visible={showMoreAssetsModal} transparent animationType="fade" onRequestClose={() => setShowMoreAssetsModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowMoreAssetsModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Song Resources</Text>
              <TouchableOpacity onPress={() => setShowMoreAssetsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {(!fromAllSongs || isHQ) && (
              <>
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMoreAssetsModal(false);
                  navigation.navigate('History', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                  <View style={styles.optionIconBox}>
                    <Ionicons name="time-outline" size={22} color={theme.colors.textPrimary} />
                  </View>
                  <Text style={styles.optionItemText}>Song History</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMoreAssetsModal(false);
                  navigation.navigate('Solfa', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                  <View style={styles.optionIconBox}>
                    <Ionicons name="musical-note-outline" size={22} color={theme.colors.textPrimary} />
                  </View>
                  <Text style={styles.optionItemText}>Solfa Notation</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 24 }} />
          </View>
        </BlurView>
      </Modal>

      {/* Save to Playlist Modal */}
      <Modal visible={showPlaylistModal} transparent animationType="slide" onRequestClose={() => setShowPlaylistModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowPlaylistModal(false)} />
          <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Save to Playlist</Text>
              <TouchableOpacity onPress={() => setShowPlaylistModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.newPlaylistRow}>
              <TextInput
                style={styles.playlistInput}
                placeholder="New Playlist Name"
                placeholderTextColor={theme.colors.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity
                style={[styles.createPlaylistBtn, !newPlaylistName.trim() && { opacity: 0.5 }]}
                disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                onPress={handleCreatePlaylist}
              >
                {isCreatingPlaylist ? (
                  <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                ) : (
                  <Text style={styles.createPlaylistBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {playlists.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 }}>No playlists yet.</Text>
              ) : (
                playlists.map(pl => {
                  const inPlaylist = pl.songs?.includes(String(activeTrack.id));
                  return (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.playlistItem}
                      onPress={() => handleAddToPlaylist(pl.id)}
                    >
                      <View style={styles.playlistIconBox}>
                        <Ionicons name="musical-notes-outline" size={24} color={theme.colors.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playlistItemName}>{pl.name}</Text>
                        <Text style={styles.playlistItemCount}>{(pl.songs || []).length} songs</Text>
                      </View>
                      {inPlaylist && <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Audio Parts Modal */}
      <Modal visible={showAudioPartsModal} transparent animationType="slide" onRequestClose={() => setShowAudioPartsModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowAudioPartsModal(false)} />
          <View style={[styles.bottomSheet, { maxHeight: '70%' }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Audio Part</Text>
              <TouchableOpacity onPress={() => setShowAudioPartsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={styles.playlistItem}
                onPress={() => {
                  play(activeTrack);
                  setShowAudioPartsModal(false);
                }}
              >
                <View style={styles.playlistIconBox}>
                  <Ionicons name="musical-notes" size={24} color={theme.colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playlistItemName}>Main Track</Text>
                  <Text style={styles.playlistItemCount}>Full recording</Text>
                </View>
                {currentTrack?.url === activeTrack.audioUrl && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
              {(() => {
                const parts = activeTrack.audioUrls || activeTrack.audio_urls || {};
                const entries = Object.entries(parts).filter(([partName, url]) => (
                  url && typeof url === 'string' && partName.toLowerCase() !== 'full'
                ));
                if (entries.length === 0) {
                  return (
                    <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 24, fontSize: 13, fontWeight: '500' }}>
                      No isolated parts available for this song.
                    </Text>
                  );
                }
                return entries.map(([partName, url]) => {
                  const isSelected = currentTrack?.url === url;
                  return (
                    <TouchableOpacity
                      key={partName}
                      style={styles.playlistItem}
                      onPress={() => {
                        play({ ...activeTrack, audioUrl: url as string });
                        setShowAudioPartsModal(false);
                      }}
                    >
                      <View style={styles.playlistIconBox}>
                        <Ionicons name="mic-outline" size={24} color={theme.colors.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playlistItemName}>{partName.charAt(0).toUpperCase() + partName.slice(1)}</Text>
                        <Text style={styles.playlistItemCount}>Isolated part</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

const getStyles = (theme: any, insets: any) => {
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
    aspectRatio: SCREEN_WIDTH >= 768 ? 1.8 : 1.10,
    maxHeight: SCREEN_WIDTH >= 768 ? 450 : undefined,
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
    padding: 24,
    paddingTop: 95,
    justifyContent: 'flex-end'
  },
  tableContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 6
  },
  tableRowFull: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    marginBottom: 0
  },
  tableRowSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    marginBottom: 0
  },
  tableCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tableLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6
  },
  tableValue: {
    color: '#ffffff',
    fontSize: 15,
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
