import { useTheme } from '../context/ThemeContext';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, AppState, AppStateStatus, NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
const BACKGROUND_THRESHOLD_MS = 3 * 60 * 60 * 1000;

export default function SessionResumeBanner() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [visible, setVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const handleChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= BACKGROUND_THRESHOLD_MS) {
          showModal();
        }
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, []);

  const showModal = () => {
    setVisible(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideModal = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      cb?.();
    });
  };

  const handleContinue = () => hideModal();

  const handleFresh = () =>
    hideModal(async () => {
      try {
        if (typeof Updates?.reloadAsync === 'function') {
          await Updates.reloadAsync();
        } else if (NativeModules.DevSettings && typeof NativeModules.DevSettings.reload === 'function') {
          NativeModules.DevSettings.reload();
        }
      } catch (e) {
        console.warn('Failed to reload application bundle:', e);
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleContinue}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={32} color={theme.colors.accent} />
          </View>
          <Text style={styles.title}>Welcome back!</Text>
          <Text style={styles.sub}>
            You were away for a while.{'\n'}Would you like to refresh the app?
          </Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.8}>
              <Text style={styles.continueTxt}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.freshBtn} onPress={handleFresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.freshTxt}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    card: {
      width: '100%',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 24,
      paddingHorizontal: 24,
      paddingVertical: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(124,58,237,0.35)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 20,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(124,58,237,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 8,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    continueBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
    },
    continueTxt: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    freshBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    freshTxt: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
};
