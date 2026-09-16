import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { Asset } from 'expo-asset';
import { StatusBar } from 'expo-status-bar';

interface AnimatedSplashScreenProps {
  isAppReady?: boolean;
  onAnimationFinish: () => void;
  onFirstFrame?: () => void;
}

const SPLASH_VIDEO = require('../../assets/splash_new.mp4');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

export default function AnimatedSplashScreen({
  isAppReady = true,
  onAnimationFinish,
  onFirstFrame,
}: AnimatedSplashScreenProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  // Animation values
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // State refs
  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const hasSkippedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const isWaitingForAppRef = useRef(false);
  const hasRetriedLocalRef = useRef(false);

  // Pre-check if asset is already downloaded locally
  const initialAsset = Asset.fromModule(SPLASH_VIDEO);
  const initialSource = initialAsset.localUri ? { uri: initialAsset.localUri } : SPLASH_VIDEO;

  const player = useVideoPlayer(initialSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.volume = 1.0;
    try {
      p.play();
    } catch {}
  });

  // Keep player mute state synchronized
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [isMuted, player]);

  // Ensure asset is downloaded locally to device filesystem (bypasses Metro bundler range-streaming issues)
  useEffect(() => {
    let isMounted = true;
    async function ensureLocalAsset() {
      try {
        const a = Asset.fromModule(SPLASH_VIDEO);
        if (!a.localUri) {
          await a.downloadAsync();
        }
        if (isMounted && a.localUri && player) {
          if (!hasStartedRef.current) {
            if (typeof player.replaceAsync === 'function') {
              await player.replaceAsync({ uri: a.localUri });
            } else {
              player.replace({ uri: a.localUri });
            }
            player.muted = isMuted;
            try {
              player.play();
            } catch {}
          }
        }
      } catch (e) {
        console.warn('Splash video local load warning:', e);
      }
    }
    ensureLocalAsset();
    return () => {
      isMounted = false;
    };
  }, [player]);

  // Trigger smooth exit to AppContent
  const triggerFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    if (!isAppReady) {
      // The app is still loading initialRoute/session — hold on screen until ready
      isWaitingForAppRef.current = true;
      return;
    }
    hasFinishedRef.current = true;

    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      try {
        player.pause();
      } catch {}
      onAnimationFinish();
    });
  }, [isAppReady, onAnimationFinish, player, exitOpacity]);

  // If we were waiting for app ready, finish as soon as isAppReady becomes true
  useEffect(() => {
    if (isAppReady && (isWaitingForAppRef.current || hasEndedRef.current || hasSkippedRef.current)) {
      triggerFinish();
    }
  }, [isAppReady, triggerFinish]);

  // Listen to video player events
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) {
      hasStartedRef.current = true;
      setVideoStarted(true);
      if (onFirstFrame) {
        requestAnimationFrame(() => onFirstFrame());
      }
    }
  });

  useEventListener(player, 'playToEnd', () => {
    hasEndedRef.current = true;
    triggerFinish();
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay') {
      try {
        player.play();
      } catch {}
    } else if (status === 'error') {
      console.warn('Splash video error:', error);
      const a = Asset.fromModule(SPLASH_VIDEO);
      if (a.localUri && player && !hasRetriedLocalRef.current) {
        hasRetriedLocalRef.current = true;
        try {
          player.replace({ uri: a.localUri });
          player.play();
          return;
        } catch {}
      }
      setVideoFailed(true);
      if (onFirstFrame) onFirstFrame();
      triggerFinish();
    }
  });

  // Safety timer so the app never hangs indefinitely
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      hasEndedRef.current = true;
      triggerFinish();
    }, 10000);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [triggerFinish]);

  const handleSkip = () => {
    hasSkippedRef.current = true;
    try {
      player.pause();
    } catch {}
    triggerFinish();
  };

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <StatusBar hidden={true} />

      {/* Video Layer (Plays splash_new.mp4 directly in full screen) */}
      {!videoFailed && (
        <View style={styles.videoLayer}>
          <VideoView
            style={styles.videoView}
            player={player}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
            onFirstFrameRender={() => {
              setVideoStarted(true);
              if (onFirstFrame) {
                requestAnimationFrame(() => onFirstFrame());
              }
            }}
          />
        </View>
      )}

      {/* Top Right Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Bottom Right Mute/Unmute Button */}
      {videoStarted && !videoFailed && (
        <TouchableOpacity
          style={styles.muteButton}
          onPress={() => setIsMuted((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color="#ffffff"
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  videoLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10000,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  muteButton: {
    position: 'absolute',
    bottom: 50,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 10000,
  },
});
