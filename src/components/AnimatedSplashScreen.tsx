import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';

interface AnimatedSplashScreenProps {
  videoUri?: string | null;
  onAnimationFinish: () => void;
  onFirstFrame?: () => void;
}

export default function AnimatedSplashScreen({
  videoUri: propVideoUri,
  onAnimationFinish,
  onFirstFrame,
}: AnimatedSplashScreenProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const opacity = useRef(new Animated.Value(1)).current;
  const [isFinished, setIsFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Play intro sound by default
  const [resolvedUri, setResolvedUri] = useState<string | null>(propVideoUri ?? null);
  const hasFinishedRef = useRef(false);
  const firstFrameReportedRef = useRef(false);

  // Resolve local asset to concrete file:// URI if not provided as prop
  useEffect(() => {
    if (propVideoUri) {
      setResolvedUri(propVideoUri);
      return;
    }
    let isMounted = true;
    async function loadSplashAsset() {
      try {
        const asset = Asset.fromModule(require('../../assets/splash_new.mp4'));
        await asset.downloadAsync();
        if (isMounted) {
          setResolvedUri(asset.localUri || asset.uri);
        }
      } catch (err) {
        console.warn('[AnimatedSplashScreen] Failed to resolve splash video asset:', err);
      }
    }
    loadSplashAsset();
    return () => {
      isMounted = false;
    };
  }, [propVideoUri]);

  // Create VideoPlayer instance with resolved file URI
  const player = useVideoPlayer(resolvedUri, p => {
    if (!p) return;
    p.loop = false;
    p.muted = false;
    try {
      p.play();
    } catch {}
  });

  // Keep player muted state in sync with UI toggle
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [isMuted, player]);

  const finishSplash = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    try {
      if (player && typeof player.pause === 'function') {
        player.pause();
      }
      if (player) {
        player.muted = true;
      }
    } catch {}
    setIsFinished(true);
  }, [player]);

  const handleFirstFrame = useCallback(() => {
    if (firstFrameReportedRef.current) return;
    firstFrameReportedRef.current = true;
    if (onFirstFrame) {
      onFirstFrame();
    }
  }, [onFirstFrame]);

  // Listen to playback state changes
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay') {
      try {
        player.play();
      } catch (e) {
        console.warn('[AnimatedSplashScreen] Player play error:', e);
      }
    } else if (status === 'error') {
      console.warn('[AnimatedSplashScreen] Video playback error:', error);
      finishSplash();
    }
  });

  useEventListener(player, 'playToEnd', () => {
    finishSplash();
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    // 10 second video — finish smoothly near end
    if (currentTime > 9.8) {
      finishSplash();
    }
  });

  // Safety fallback timer: max 10.5 seconds
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      finishSplash();
    }, 10500);
    return () => clearTimeout(fallbackTimer);
  }, [finishSplash]);

  // Smooth fade-out animation when finished
  useEffect(() => {
    if (isFinished) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onAnimationFinish();
      });
    }
  }, [isFinished, onAnimationFinish, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <VideoView 
        style={StyleSheet.absoluteFillObject} 
        player={player} 
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={handleFirstFrame}
      />
      <TouchableOpacity 
        style={styles.skipButton} 
        onPress={finishSplash}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="chevron-forward" size={16} color="#ffffff" style={{ marginLeft: 2 }} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.muteButton} 
        onPress={() => setIsMuted(!isMuted)}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={isMuted ? 'volume-mute' : 'volume-high'} 
          size={24} 
          color="#ffffff" 
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (theme: any) => {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    muteButton: {
      position: 'absolute',
      bottom: 50,
      right: 30,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    skipButton: {
      position: 'absolute',
      top: 60,
      right: 24,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    skipText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });
};
