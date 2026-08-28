import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
export function OfflineBanner() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [isOffline, setIsOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  useEffect(() => {
    let active = true;
    const refreshQueueCount = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const queueKeys = keys.filter(key => key.startsWith('PENDING_MESSAGES_'));
        const values = await AsyncStorage.multiGet(queueKeys);
        const count = values.reduce((total, [, value]) => {
          try { return total + (value ? JSON.parse(value).length : 0); } catch { return total; }
        }, 0);
        if (active) setQueuedCount(count);
      } catch {}
    };
    refreshQueueCount();
    const interval = setInterval(refreshQueueCount, 5000);
    const appStateSub = AppState.addEventListener('change', refreshQueueCount);
    return () => {
      active = false;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, []);

  if (!isOffline && queuedCount === 0) return null;

  return (
    <Animated.View style={[styles.nudge, { opacity }]} pointerEvents="none">
      <Ionicons name="wifi-outline" size={13} color="rgba(255,255,255,0.8)" style={{ marginRight: 5 }} />
      <Text style={styles.text}>{isOffline ? 'Offline' : 'Sending queued messages'}</Text>
      {queuedCount > 0 && <Text style={styles.queueText}>{queuedCount} queued</Text>}
    </Animated.View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  nudge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,10,40,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
    zIndex: 9999,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  queueText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
});
};
