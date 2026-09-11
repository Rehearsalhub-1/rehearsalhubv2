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

  const player = useVideoPlayer(require('../../assets/splash_new.mp4'), player => {
    player.loop = false;
    player.muted = true;
    if (typeof player.play === 'function') player.play();
  });

  useEffect(() => {
    if (player) {
      player.muted = isMuted;
      try {
        if (typeof player.play === 'function') player.play();
      } catch (e) {
        console.warn('Error playing splash video:', e);
      }
    }
  }, [isMuted, player]);

  useEventListener(player, 'playToEnd', () => {
    setIsFinished(true);
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      console.warn('Splash video error:', error);
      setIsFinished(true);
    } else if (status === 'readyToPlay') {
      try {
        if (typeof player.play === 'function') player.play();
      } catch (e) {
        console.warn('Error starting splash player:', e);
      }
    }
  });

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setIsFinished(true);
    }, 10000);
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
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center'
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
