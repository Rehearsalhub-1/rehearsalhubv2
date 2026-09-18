import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { VideoView } from 'expo-video';

interface Props {
  track: any;
  index: number;
  isActiveTrack: boolean;
  isPlaying: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  hasAudio: boolean;
  coverImage: any;
  placeholderVideoPlayer: any;
  onPress: () => void;
  onLongPress: () => void;
  onOptionsPress: () => void;
  theme: any;
  styles: any;
}

export const RehearsalSongRow: React.FC<Props> = ({
  track,
  index,
  isActiveTrack,
  isPlaying,
  isSelectionMode,
  isSelected,
  hasAudio,
  coverImage,
  placeholderVideoPlayer,
  onPress,
  onLongPress,
  onOptionsPress,
  theme,
  styles,
}) => (
  <View style={[styles.trackList, { paddingTop: 0, paddingBottom: 0 }]}>
    <TouchableOpacity
      style={[styles.trackItem, isSelected && { backgroundColor: 'rgba(192,132,252,0.12)', borderRadius: 12 }]}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Left indicator: checkbox / equalizer / track number */}
      {isSelectionMode ? (
        <View style={{ width: 28, alignItems: 'center', marginRight: 8 }}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={isSelected ? theme.colors.accent : theme.colors.textMuted}
          />
        </View>
      ) : isActiveTrack && isPlaying ? (
        <View style={{ width: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2, height: 18, marginRight: 8 }}>
          {[1, 0.6, 0.85].map((h, i) => (
            <View key={i} style={{ width: 3, height: 18 * h, backgroundColor: theme.colors.accent, borderRadius: 2 }} />
          ))}
        </View>
      ) : (
        <Text style={{ color: isActiveTrack ? theme.colors.accent : theme.colors.textMuted, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center', marginRight: 8, fontFamily: 'monospace' }}>
          {String(index + 1).padStart(2, '0')}
        </Text>
      )}

      {/* Thumbnail */}
      <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#1C1C26', marginRight: 12 }}>
        {track.imageUrl && typeof track.imageUrl === 'string' && track.imageUrl.startsWith('http') ? (
          <Image source={{ uri: track.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <>
            <Image source={coverImage} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
            <VideoView player={placeholderVideoPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
          </>
        )}
        {!hasAudio && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="volume-mute" size={16} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </View>

      {/* Title + subtitle */}
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1} ellipsizeMode="tail">
          {track.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!hasAudio ? (
            <Ionicons name="volume-mute-outline" size={12} color="#fb923c" style={{ marginRight: 4 }} />
          ) : (
            <Ionicons name={isActiveTrack ? 'volume-high' : 'musical-notes'} size={12} color={isActiveTrack ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.trackSubtitle, { flex: 1 }, isActiveTrack && { color: theme.colors.accent }, !hasAudio && { color: '#fb923c' }]} numberOfLines={1} ellipsizeMode="tail">
            {!hasAudio ? 'No audio yet' : `${track.subtitle} • ${track.category}`}
          </Text>
        </View>
      </View>

      {/* Right: rehearsal count + options */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 'bold' }}>x{track.rehearsalCount}</Text>
        </View>
        {!isSelectionMode && (
          <TouchableOpacity style={styles.trackMoreButton} onPress={onOptionsPress}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  </View>
);
