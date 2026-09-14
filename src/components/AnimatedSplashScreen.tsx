import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Animated, Image, TouchableOpacity, Dimensions } from 'react-native';
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
const LOGO_SOURCE = require('../../assets/logo/logo.png');
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

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
            player.replace({ uri: a.localUri });
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
      // Attempt local file retry if available
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
      // If video fails completely, fallback to branded splash finish
      setTimeout(() => {
        hasEndedRef.current = true;
        triggerFinish();
      }, 2500);
    }
  });

  // Background logo animation for frame 0 and fallback
  useEffect(() => {
    if (onFirstFrame) {
      requestAnimationFrame(() => onFirstFrame());
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // 10-second safety timeout so the app never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      hasEndedRef.current = true;
      triggerFinish();
    }, 10000);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [fadeAnim, scaleAnim, textFadeAnim, triggerFinish, onFirstFrame]);

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

      {/* 1. Underlying Poster/Branding Layer (Guarantees Frame 0 is NEVER blank or black) */}
      <View style={styles.posterContainer}>
        <View style={styles.glowCircle} />

        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image source={LOGO_SOURCE} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.textContainer, { opacity: textFadeAnim }]}>
          <Text style={styles.title}>LOVEWORLD SINGERS</Text>
          <Text style={styles.subtitle}>Rehearsal Hub Portal 2.0</Text>

          <View style={styles.pillBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.pillText}>Live Rehearsal Suite</Text>
          </View>
        </Animated.View>
      </View>

      {/* 2. Hardware Video Layer (Plays splash_new.mp4 in full physical screen) */}
      {!videoFailed && (
        <Animated.View
          style={[
            styles.videoLayer,
            { opacity: videoStarted ? 1 : 0 },
          ]}
        >
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
        </Animated.View>
      )}

      {/* 3. Top Right Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* 4. Bottom Right Mute/Unmute Button */}
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
    backgroundColor: '#070a12',
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
  posterContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
    backgroundColor: 'rgba(56, 189, 248, 0.07)',
  },
  logoWrapper: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 20,
    marginBottom: 24,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 7,
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
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
