import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../hooks/useUser';
import { apiClient } from '../lib/apiClient';
const avatarCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<any>>();

interface SyncAvatarProps {
  userId?: string;
  initialAvatar?: string | null;
  fallbackName?: string;
  size?: number;
  bgColor?: string;
  isGroup?: boolean;
}

export const SyncAvatar = memo(function SyncAvatar({
  userId,
  initialAvatar,
  fallbackName,
  size = 40,
  bgColor,
  isGroup = false
}: SyncAvatarProps) {
  const { theme } = useTheme();
  const resolvedBgColor = bgColor || theme.colors.accent;
  const styles = getStyles(theme);
  const s = styles;

  const [avatar, setAvatar] = useState<string | null>(initialAvatar || null);

  useEffect(() => {
    if (initialAvatar) {
      setAvatar(initialAvatar);
      return;
    }

    if (!isGroup && userId) {
      const storeUser = useUserStore.getState().user;
      if (storeUser && userId === storeUser.uid) {
        const profile = useUserStore.getState().profile;
        if (profile?.avatar) {
          setAvatar(profile.avatar);
          return;
        }
      }

      if (avatarCache.has(userId)) {
        const cached = avatarCache.get(userId);
        if (cached) setAvatar(cached);
        return;
      }

      if (pendingRequests.has(userId)) {
        pendingRequests.get(userId)?.then((url) => {
          if (url) setAvatar(url);
        }).catch(() => {});
        return;
      }

      const reqPromise = apiClient.get<{ success: boolean; data: any }>(`/profiles/${userId}`)
        .then((res) => {
          const p = res?.success ? res.data : null;
          const url = p?.profile_image_url || p?.avatar_url || p?.photoURL || p?.avatar || p?.profileImage || null;
          avatarCache.set(userId, url);
          pendingRequests.delete(userId);
          if (url) setAvatar(url);
          return url;
        })
        .catch(() => {
          pendingRequests.delete(userId);
          // Silently falls back to initials
          return null;
        });

      pendingRequests.set(userId, reqPromise);
    }
  }, [userId, isGroup, initialAvatar]);

  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: resolvedBgColor }}
        contentFit="cover"
        cachePolicy="disk"
      />
    );
  }

  if (isGroup) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: resolvedBgColor }]}>
        <Ionicons name="people" size={size * 0.5} color={theme.colors.textPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: resolvedBgColor }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>
        {(fallbackName || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
});

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
  }
});
};
