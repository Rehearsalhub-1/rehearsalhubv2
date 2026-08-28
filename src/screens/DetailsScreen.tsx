import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { useWebSocket } from '../hooks/useWebSocket';
import { DoodleBackground } from '../components/DoodleBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetailsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const { activeTrack: initialTrack, bgColor = '#825a1e' } = route.params || {};
  const [activeTrack, setActiveTrack] = useState(initialTrack);
  const [fontSizeModifier, setFontSizeModifier] = useState(0);
  const { isPlaying: isGlobalPlaying, togglePlayback, play: playGlobal, currentTrack, skipToNext, skipToPrevious } = useTrackPlayer();
  useEffect(() => {
    if (currentTrack && currentTrack.id !== activeTrack?.id) {
      setActiveTrack(currentTrack);
    }
  }, [currentTrack]);
  useWebSocket(
    'songs',
    activeTrack?.id || '',
    (data: unknown) => {
      const d = data as any;
      if (!d) return;
      setActiveTrack((prev: any) => ({
        ...prev,
        leadSinger: d.leadSinger || prev.leadSinger,
        writer: d.writer || prev.writer,
        program: d.program || d.subtitle || prev.program,
        arrangement: d.arrangement || prev.arrangement,
        publisher: d.publisher || prev.publisher,
        year: d.year || prev.year,
      }));
    },
    !!activeTrack?.id
  );

  const formatTime = (millis: number) => {

    if (!millis || isNaN(millis)) return "0:00";
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <DoodleBackground />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }}>
        {}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              navigation.goBack();
            }}
            style={styles.headerBtn}>
            
            <Ionicons name="chevron-down" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16 }]} numberOfLines={1} ellipsizeMode="tail">{activeTrack?.title || 'Song Details & Metadata'}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.contentScroll}
          showsVerticalScrollIndicator={false}>
          
          <Text style={styles.fullTextLine}>Lead Vocalist: {activeTrack?.leadSinger || 'Deaconess Angel'}{'\n\n'}</Text>
          <Text style={styles.fullTextLine}>Author & Composer: {activeTrack?.writer || 'Loveworld Singers'}{'\n\n'}</Text>
          <Text style={styles.fullTextLine}>Album & Event: {activeTrack?.program || activeTrack?.subtitle || 'Praise Night 16 Live'}{'\n\n'}</Text>
          <Text style={styles.fullTextLine}>Arrangement: {activeTrack?.arrangement || 'Music Director & Acoustic Team'}{'\n\n'}</Text>
          <Text style={styles.fullTextLine}>Publisher: {activeTrack?.publisher || 'Loveworld Music & Arts Ministry (LMAM)'}{'\n\n'}</Text>
          <Text style={styles.fullTextLine}>Copyright © {activeTrack?.year || '2026'} Loveworld Singers. All Rights Reserved.</Text>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  headerBtn: {
    padding: 4
  },
  headerText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  contentScroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 220
  },
  fullTextLine: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: -0.3
  },
  dockedControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBackgroundLight
  },
  progressContainer: {
    marginBottom: 20
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 2
  },
  progressThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.textPrimary,
    marginLeft: -6
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  dockedControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  dockedPlayPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  }
});
};
