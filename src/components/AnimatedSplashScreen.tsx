import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';

const T = theme.colors;

export default function AnimatedSplashScreen({ onAnimationFinish }: {onAnimationFinish: () => void;}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const opacity = useRef(new Animated.Value(1)).current;
  const [isFinished, setIsFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Muted by default
  const hasStartedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  const player = useVideoPlayer(require('../../assets/splash_new.mp4'), p => {
    p.loop = false;
    p.muted = true;
    try {
      p.play();
    } catch {}
  });

  useEffect(() => {
    if (player) {
      player.muted = isMuted;
      try {
        player.play();
      } catch (e) {
        console.warn('Error playing splash video:', e);
      }
    }
  }, [isMuted, player]);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) {
      hasStartedRef.current = true;
    }
  });

  useEventListener(player, 'playToEnd', () => {
    const elapsed = (Date.now() - mountTimeRef.current) / 1000;
    if (hasStartedRef.current || elapsed > 3 || (player && player.currentTime > 2)) {
      setIsFinished(true);
    }
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      console.warn('Splash video error:', error);
      setTimeout(() => setIsFinished(true), 2000);
    } else if (status === 'readyToPlay') {
      try {
        player.play();
      } catch (e) {
        console.warn('Error starting splash player:', e);
      }
    }
  });

  useEffect(() => {
    // 10 second safety timer (matches splash_new.mp4 duration)
    const fallbackTimer = setTimeout(() => {
      setIsFinished(true);
    }, 10500);
    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    if (isFinished) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
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
      />
      <TouchableOpacity 
        style={styles.skipButton} 
        onPress={() => {
          if (typeof player.pause === 'function') player.pause();
          player.muted = true;
          setIsFinished(true);
        }}
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
  const T = theme.colors;
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
  }
});
};
