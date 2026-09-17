import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLiveSongStore, LiveSong } from '../stores/liveSongStore';
import { useZone } from '../hooks/useZone';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { navigationRef, navigate, subscribeToRoute } from '../navigation/navigationService';

const HIDDEN_SCREENS = new Set([
  'Login',
  'Signup',
  'Player',
  'Call',
  'Calls',
  'IncomingCall',
  'ChatRoom',
  'ChatRooms',
  'ChatInfo',
  'NewChat',
  'CreateGroup',
  'ChatSettings',
]);

export default function GlobalLiveSongWidget() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentZone } = useZone();
  const { play, currentTrack } = useTrackPlayer();

  // Use stable primitive selectors so Zustand doesn't return new refs every render
  const activeSongs = useLiveSongStore((state) => state.activeSongs);
  const handleSongUpdate = useLiveSongStore(useCallback((state) => state.handleSongUpdate, []));
  const fetchActiveSongs = useLiveSongStore(useCallback((state) => state.fetchActiveSongs, []));

  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Pulse animation for the green live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  // Animated bottom offset — springs smoothly when mini-player shows/hides
  const bottomAnim = useRef(new Animated.Value(Math.max(90, 75 + insets.bottom))).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.2,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.8,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, opacityAnim]);

  // Track active navigation screen using robust subscriber
  useEffect(() => {
    let isMounted = true;
    const update = (routeName: string | null) => {
      if (isMounted) setCurrentScreen(routeName);
    };

    const unsub = subscribeToRoute(update);

    // Fallback polling if navigation wasn't ready yet on mount
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (!navigationRef.isReady()) {
      pollTimer = setInterval(() => {
        if (navigationRef.isReady()) {
          const route = navigationRef.getCurrentRoute();
          if (route?.name && isMounted) {
            setCurrentScreen(route.name);
          }
          if (pollTimer) clearInterval(pollTimer);
        }
      }, 300);
    }

    return () => {
      isMounted = false;
      unsub();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  // Real-time WebSocket subscription across the entire app
  useWebSocket('song', 'all', handleSongUpdate, true);

  // Initial & Zone-based fetch of active songs
  useEffect(() => {
    fetchActiveSongs(currentZone?.id);
  }, [currentZone?.id, fetchActiveSongs]);

  // Refetch when app returns from background — debounced to avoid racing with WebSocket updates
  useEffect(() => {
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (refetchTimer) clearTimeout(refetchTimer);
        refetchTimer = setTimeout(() => {
          fetchActiveSongs(currentZone?.id);
        }, 2500);
      }
    });
    return () => {
      sub.remove();
      if (refetchTimer) clearTimeout(refetchTimer);
    };
  }, [currentZone?.id, fetchActiveSongs]);

  // Smoothly animate the widget's bottom position when the mini-player appears
  const hasMiniPlayer = Boolean(currentTrack?.id);
  const targetBottom = hasMiniPlayer
    ? Math.max(145, 135 + insets.bottom)
    : Math.max(90, 75 + insets.bottom);

  useEffect(() => {
    Animated.spring(bottomAnim, {
      toValue: targetBottom,
      useNativeDriver: false, // 'bottom' is a layout prop, can't use native driver
      speed: 18,
      bounciness: 4,
    }).start();
  }, [targetBottom, bottomAnim]);

  // Visibility guard:
  // Hide if on a screen that forbids live widget (Chat screens, Calls, Player, Auth),
  // OR if there are no active songs.
  // DO NOT hide if currentScreen is temporarily null/unknown!
  const isHiddenScreen = currentScreen
    ? Boolean(
        HIDDEN_SCREENS.has(currentScreen) ||
        currentScreen.startsWith('Chat') ||
        currentScreen.toLowerCase().includes('call') ||
        currentScreen === 'Player'
      )
    : false;

  const isHidden =
    isHiddenScreen ||
    !activeSongs ||
    activeSongs.length === 0;

  if (isHidden) {
    return null;
  }

  const handleTuneIn = (song: LiveSong) => {
    setShowPickerModal(false);
    navigate('Player', {
      activeTrack: song,
      zoneId: currentZone?.id,
      queue: activeSongs,
      autoplay: false, // Never autoplay automatically when opening a song
    });
  };

  const handleWidgetPress = () => {
    if (activeSongs.length === 1) {
      handleTuneIn(activeSongs[0]);
    } else {
      setShowPickerModal(true);
    }
  };

  const primarySong = activeSongs[0];
  const titleText =
    activeSongs.length === 1
      ? primarySong?.title || 'Live Rehearsal'
      : `${activeSongs.length} Songs Live`;

  return (
    <>
      <Animated.View
        style={[
          styles.floatingLiveWidget,
          {
            backgroundColor: theme.colors.background,
            borderColor: '#22c55e',
            bottom: bottomAnim,
          },
        ]}
      >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handleWidgetPress}
      >
        <View style={styles.liveWidgetContent}>
          {/* Animated pulsing outer ring */}
          <View style={styles.indicatorWrapper}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: opacityAnim,
                },
              ]}
            />
            <View style={styles.liveDot} />
          </View>

          {/* Song info badge */}
          <View style={styles.liveWidgetInfo}>
            <Text style={styles.liveTagText}>LIVE NOW</Text>
            <Text
              style={[styles.liveTitleText, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {titleText}
            </Text>
          </View>

          {/* Pulse wave icon */}
          <Ionicons
            name="pulse"
            size={18}
            color="#22c55e"
            style={styles.livePulseIcon}
          />
        </View>
      </TouchableOpacity>
      </Animated.View>

      {/* Multiple Active Songs Selection Sheet */}
      <Modal
        visible={showPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTap}
            activeOpacity={1}
            onPress={() => setShowPickerModal(false)}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.background,
                paddingBottom: Math.max(28, insets.bottom + 16),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.liveBadgeSmall}>
                  <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                </View>
                <Text style={styles.modalTitle}>Rehearsal Sessions</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPickerModal(false)}
                style={styles.closeModalBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
            >
              {activeSongs.map((song: LiveSong, index: number) => (
                <TouchableOpacity
                  key={song.id || `live-${index}`}
                  style={[
                    styles.modalListItem,
                    {
                      backgroundColor: theme.colors.cardBackgroundLight || '#111827',
                      borderColor: theme.colors.bottomTabBorder || 'rgba(255,255,255,0.08)',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleTuneIn(song)}
                >
                  <View style={styles.modalItemBadge}>
                    <Text style={styles.modalItemBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text
                      style={[styles.modalItemTitle, { color: theme.colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {song.title}
                    </Text>
                    <Text
                      style={[styles.modalItemSubtitle, { color: theme.colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {song.category || song.leadSinger || 'Loveworld Singers'}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="#22c55e"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingLiveWidget: {
    position: 'absolute',
    right: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 44,
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 99999,
  },
  liveWidgetContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  indicatorWrapper: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    overflow: 'visible',
  },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  liveDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
  },
  liveWidgetInfo: {
    marginRight: 10,
    maxWidth: 160,
  },
  liveTagText: {
    color: '#22c55e',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 1,
  },
  liveTitleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  livePulseIcon: {
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 10, 20, 0.78)',
    justifyContent: 'flex-end',
  },
  modalBackdropTap: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '65%',
    borderTopWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadgeSmall: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  liveBadgeSmallText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalTitle: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalList: {
    width: '100%',
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  modalItemBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  modalItemBadgeText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '800',
  },
  modalItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modalItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalItemSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
