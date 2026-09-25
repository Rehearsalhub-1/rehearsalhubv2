import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

const TRACK_PLACEHOLDER = require('../../assets/TRACK_PLACEHOLDER.png');

interface Props {
  track: any;
  index: number;
  isActiveTrack: boolean;
  isPlaying: boolean;
  isLive?: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  hasAudio: boolean;
  coverImage: any;
  onPress: () => void;
  onLongPress: () => void;
  onOptionsPress: () => void;
  theme: any;
  styles: any;
}

export const RehearsalSongRow: React.FC<Props> = React.memo(({
  track,
  index,
  isActiveTrack,
  isPlaying,
  isLive = false,
  isSelectionMode,
  isSelected,
  hasAudio,
  coverImage,
  onPress,
  onLongPress,
  onOptionsPress,
  theme,
  styles,
}) => {
  const purpleAccent = theme.colors.accentBright || theme.colors.accent || '#c084fc';

  return (
    <View style={[styles.trackList, { paddingTop: 0, paddingBottom: 0 }]}>
      <TouchableOpacity
        style={[
          styles.trackItem,
          isLive && {
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            borderColor: 'rgba(192, 132, 252, 0.40)',
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 6,
            marginBottom: 12,
          },
          isSelected && { backgroundColor: 'rgba(192,132,252,0.18)', borderRadius: 12 }
        ]}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {/* Left indicator: checkbox / equalizer / live indicator / track number */}
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
              <View key={i} style={{ width: 3, height: 18 * h, backgroundColor: purpleAccent, borderRadius: 2 }} />
            ))}
          </View>
        ) : isLive ? (
          <View style={{ width: 28, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Ionicons name="radio" size={16} color={purpleAccent} />
          </View>
        ) : (
          <Text style={{ color: isActiveTrack ? purpleAccent : theme.colors.textMuted, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center', marginRight: 8, fontFamily: 'monospace' }}>
            {String(index + 1).padStart(2, '0')}
          </Text>
        )}

        {/* Thumbnail */}
        <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#1C1C26', marginRight: 12 }}>
          <Image
            source={
              (track.imageUrl && typeof track.imageUrl === 'string' && track.imageUrl.startsWith('http') && !track.imageUrl.includes('/banner/'))
                ? { uri: track.imageUrl }
                : (track.image && typeof track.image === 'object' && track.image.uri && !track.image.uri.includes('/banner/'))
                ? track.image
                : (track.image && typeof track.image === 'number')
                ? track.image
                : TRACK_PLACEHOLDER
            }
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
          />
          {!hasAudio && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="volume-mute" size={16} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </View>

        {/* Title + subtitle */}
        <View style={styles.trackInfo}>
          <Text
            style={[
              styles.trackTitle,
              (isActiveTrack || isLive) && { color: purpleAccent, fontWeight: '700' }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {track.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {!hasAudio ? (
              <Ionicons name="volume-mute-outline" size={12} color="#fb923c" style={{ marginRight: 4 }} />
            ) : (
              <Ionicons
                name={isLive ? 'radio' : (isActiveTrack ? 'volume-high' : 'musical-notes')}
                size={12}
                color={(isLive || isActiveTrack) ? purpleAccent : theme.colors.textMuted}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.trackSubtitle,
                { flex: 1 },
                (isLive || isActiveTrack) && { color: purpleAccent },
                !hasAudio && { color: '#fb923c' }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {!hasAudio ? 'No audio yet' : `${track.subtitle || track.leadSinger || 'Loveworld Singers'}${track.category ? ` • ${track.category}` : ''}`}
            </Text>
          </View>
        </View>

        {/* Right: rehearsal count + options */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 'bold' }}>x{track.rehearsalCount ?? 0}</Text>
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
});
