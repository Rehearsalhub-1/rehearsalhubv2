import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerControlsRowProps {
  isShuffle: boolean;
  onToggleShuffle: () => void;
  onSkipPrevious: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  hasAudio: boolean;
  onPlayPause: () => void;
  onSkipNext: () => void;
  repeatMode: 'off' | 'track' | 'playlist';
  onToggleRepeat: () => void;
  theme: any;
  styles: any;
}

export const PlayerControlsRow: React.FC<PlayerControlsRowProps> = ({
  isShuffle,
  onToggleShuffle,
  onSkipPrevious,
  isLoading,
  isPlaying,
  hasAudio,
  onPlayPause,
  onSkipNext,
  repeatMode,
  onToggleRepeat,
  theme,
  styles,
}) => {
  return (
    <View style={styles.controlsRow}>
      {/* Shuffle */}
      <TouchableOpacity onPress={onToggleShuffle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="shuffle" size={24} color={isShuffle ? theme.colors.accent : theme.colors.textPrimary} />
      </TouchableOpacity>

      {/* Previous */}
      <TouchableOpacity onPress={onSkipPrevious} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="play-skip-back" size={28} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      {/* Play / Pause */}
      <TouchableOpacity style={styles.playPauseBtn} onPress={onPlayPause} activeOpacity={0.8}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.backgroundDark} />
        ) : (
          <Ionicons
            name={!hasAudio ? 'alert-circle' : isPlaying ? 'pause' : 'play'}
            size={28}
            color={theme.colors.backgroundDark}
            style={{ marginLeft: isPlaying || !hasAudio ? 0 : 3 }}
          />
        )}
      </TouchableOpacity>

      {/* Next */}
      <TouchableOpacity onPress={onSkipNext} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="play-skip-forward" size={28} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      {/* Repeat */}
      <TouchableOpacity onPress={onToggleRepeat} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons
            name="repeat"
            size={24}
            color={repeatMode !== 'off' ? theme.colors.accent : theme.colors.textSecondary}
          />
          {repeatMode === 'track' && (
            <View
              style={{
                position: 'absolute',
                backgroundColor: theme.colors.accent,
                borderRadius: 6,
                width: 12,
                height: 12,
                alignItems: 'center',
                justifyContent: 'center',
                top: -4,
                right: -6,
              }}
            >
              <Text style={{ color: theme.colors.backgroundDark, fontSize: 8, fontWeight: '900' }}>1</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};
