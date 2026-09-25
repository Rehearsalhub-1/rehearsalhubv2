import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerBottomTabBarProps {
  onOpenQueue: () => void;
  abLoop: { active: boolean; start: number | null; end: number | null };
  onABLoopPress: () => void;
  onClearABLoop: () => void;
  formatTime: (secondsOrMs: number) => string;
  playbackRate: number;
  onOpenSpeed: () => void;
  onOpenAudioParts?: () => void;
  onOpenKaraoke: () => void;
  onOpenChat: () => void;
  onShareToChat?: () => void;
  insets: any;
  theme: any;
  styles: any;
}

export const PlayerBottomTabBar: React.FC<PlayerBottomTabBarProps> = ({
  onOpenQueue,
  abLoop,
  onABLoopPress,
  onClearABLoop,
  formatTime,
  playbackRate,
  onOpenSpeed,
  onOpenAudioParts,
  onOpenKaraoke,
  onOpenChat,
  onShareToChat,
  insets,
  theme,
  styles,
}) => {
  const paddingBottom =
    Platform.OS === 'android'
      ? Math.max(10, insets.bottom - 16)
      : Math.max(insets.bottom, 12);

  return (
    <View style={[styles.playerTabBar, { paddingBottom }]}>
      <TouchableOpacity style={styles.playerTabButton} onPress={onOpenQueue}>
        <Ionicons name="list-outline" size={20} color={theme.colors.textSecondary} />
        <Text style={styles.playerTabLabel}>Queue</Text>
      </TouchableOpacity>

      {/* 1-Tap / 2-Tap A-B Section Loop Button */}
      <TouchableOpacity
        style={styles.playerTabButton}
        onPress={onABLoopPress}
        onLongPress={onClearABLoop}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons
            name={
              abLoop.active
                ? 'infinite'
                : abLoop.start !== null
                ? 'flag'
                : 'infinite-outline'
            }
            size={20}
            color={
              abLoop.active || abLoop.start !== null
                ? theme.colors.accent
                : theme.colors.textSecondary
            }
          />
          {abLoop.active && (
            <View
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.accent,
                top: -2,
                right: -4,
              }}
            />
          )}
        </View>
        <Text
          style={[
            styles.playerTabLabel,
            (abLoop.active || abLoop.start !== null) && {
              color: theme.colors.accent,
              fontWeight: '800',
            },
          ]}
        >
          {abLoop.active
            ? `${formatTime(abLoop.start!)} ⇄ ${formatTime(abLoop.end!)}`
            : abLoop.start !== null
            ? `Set End (B)`
            : `A-B Loop`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.playerTabButton} onPress={onOpenSpeed}>
        <Ionicons
          name="speedometer-outline"
          size={20}
          color={playbackRate !== 1.0 ? theme.colors.accent : theme.colors.textSecondary}
        />
        <Text
          style={[
            styles.playerTabLabel,
            playbackRate !== 1.0 && { color: theme.colors.accent, fontWeight: '800' },
          ]}
        >
          {playbackRate === 1.0 ? 'Speed' : `${playbackRate}x`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.playerTabButton} onPress={onOpenKaraoke}>
        <Ionicons name="mic-outline" size={20} color={theme.colors.textSecondary} />
        <Text style={styles.playerTabLabel}>Practice</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.playerTabButton}
        onPress={onOpenChat}
        onLongPress={onShareToChat}
      >
        <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.textSecondary} />
        <Text style={styles.playerTabLabel}>DM</Text>
      </TouchableOpacity>
    </View>
  );
};
