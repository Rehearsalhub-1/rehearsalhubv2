import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { formatLyricsHtml } from '../utils/lyricsFormatter';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAnnotationsAndNotes } from '../hooks/useAnnotationsAndNotes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoodleBackground } from '../components/DoodleBackground';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { PlayerProgressSlider } from '../components/player/PlayerHUDOverlays';
import { PlayerControlsRow } from '../components/player/PlayerControlsRow';
import { PlayerAnnotationFAB } from '../components/player/PlayerAnnotationFAB';
import { api } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LyricsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);

  const { activeTrack: initialTrack, bgColor = '#825a1e' } = route.params || {};
  const paramTrack = route.params?.activeTrack;
  const [activeTrack, setActiveTrack] = useState(paramTrack || initialTrack);
  const [fontSizeModifier, setFontSizeModifier] = useState(0);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const {
    isPlaying,
    isLoading,
    togglePlayback,
    seekTo,
    skipToNext,
    skipToPrevious,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    currentTrack,
    abLoop,
  } = useTrackPlayer();

  const hasAudio = !!(activeTrack?.audioUrl || currentTrack?.audioUrl);

  const formatTime = useCallback((millis: number) => {
    if (!millis || isNaN(millis)) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);

  const handlePlayPause = useCallback(async () => {
    try {
      await togglePlayback();
    } catch (e) {
      console.warn('Error toggling playback in LyricsScreen:', e);
    }
  }, [togglePlayback]);

  const handleToggleShuffle = useCallback(() => {
    toggleShuffle();
  }, [toggleShuffle]);

  const handleToggleRepeat = useCallback(() => {
    toggleRepeat();
  }, [toggleRepeat]);

  const handleSkipNext = useCallback(async () => {
    try {
      await skipToNext();
    } catch (e) {
      console.warn('Error skipping next in LyricsScreen:', e);
    }
  }, [skipToNext]);

  const handleSkipPrevious = useCallback(async () => {
    try {
      await skipToPrevious();
    } catch (e) {
      console.warn('Error skipping previous in LyricsScreen:', e);
    }
  }, [skipToPrevious]);

  // Keep activeTrack in sync if player skips to next/previous song
  useEffect(() => {
    if (currentTrack && currentTrack.id && String(currentTrack.id) !== String(activeTrack?.id)) {
      setActiveTrack(currentTrack);
    }
  }, [currentTrack]);

  // If lyrics missing on active track, fetch full song details
  useEffect(() => {
    if (activeTrack?.id && !activeTrack?.lyrics) {
      api.songs
        .getById(activeTrack.id)
        .then((res: any) => {
          const songData = res?.data || res;
          if (songData?.lyrics) {
            setActiveTrack((prev: any) => ({
              ...prev,
              ...songData,
              lyrics: songData.lyrics,
            }));
          }
        })
        .catch(() => {});
    }
  }, [activeTrack?.id]);

  useEffect(() => {
    if (paramTrack && paramTrack.id && String(paramTrack.id) !== String(activeTrack?.id)) {
      setActiveTrack(paramTrack);
    }
  }, [paramTrack]);

  useEffect(() => {
    AsyncStorage.getItem('document_zoom_level').then(val => {
      if (val) setFontSizeModifier(Number(val));
    });
  }, []);

  const handleZoomOut = () => {
    setFontSizeModifier(p => {
      const n = Math.max(p - 2, -8);
      AsyncStorage.setItem('document_zoom_level', String(n));
      return n;
    });
  };

  const handleZoomIn = () => {
    setFontSizeModifier(p => {
      const n = Math.min(p + 2, 12);
      AsyncStorage.setItem('document_zoom_level', String(n));
      return n;
    });
  };

  const {
    isPrivileged,
    isAnnotationMode,
    setIsAnnotationMode,
    setShowNotesModal,
    AnnotationLayer,
    NotesModal,
    strokes,
    handleClearMyAnnotations,
    annotationTool,
    setAnnotationTool,
    selectedColor,
    setSelectedColor,
    getMyColor,
    showColorPalette,
    setShowColorPalette
  } = useAnnotationsAndNotes(activeTrack?.id, activeTrack?.title, { isPlayer: false });

  useWebSocket(
    'songs',
    activeTrack?.id || '',
    (data: unknown) => {
      const d = (data as any)?.data || (data as any);
      if (!d) return;
      if (d.id && activeTrack?.id && String(d.id) !== String(activeTrack.id)) return;
      setActiveTrack((prev: any) => {
        if (!prev) return prev;
        if (d.id && prev.id && String(d.id) !== String(prev.id)) return prev;
        return {
          ...prev,
          lyrics: d.lyrics !== undefined ? d.lyrics : prev.lyrics,
          title: d.title !== undefined ? d.title : prev.title,
        };
      });
    },
    !!activeTrack?.id
  );

  useWebSocket(
    'live_song',
    'all',
    (data: unknown) => {
      const d = (data as any)?.data || (data as any);
      if (!d || !activeTrack?.id) return;
      if (d.id && String(d.id) === String(activeTrack.id)) {
        setActiveTrack((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            lyrics: d.lyrics !== undefined ? d.lyrics : prev.lyrics,
            title: d.title !== undefined ? d.title : prev.title,
          };
        });
      }
    },
    !!activeTrack?.id
  );

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

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              navigation.goBack();
            }}
            style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flex: 1, marginHorizontal: 12, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setIsTitleExpanded(!isTitleExpanded)}
            activeOpacity={0.7}
          >
            <Text 
              style={[
                styles.headerText, 
                { 
                  textAlign: 'center', 
                  color: '#FFFFFF',
                  fontWeight: '700',
                  textShadowColor: theme.colors.accent,
                  textShadowRadius: 6,
                  textShadowOffset: { width: 0, height: 0 },
                }
              ]} 
              numberOfLines={isTitleExpanded ? undefined : 1} 
              ellipsizeMode="tail"
            >
              {activeTrack?.title || 'Lyrics'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>

            <TouchableOpacity onPress={handleZoomOut} style={{ padding: 4 }}>
              <Ionicons name="remove-circle-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' }}>Zoom</Text>
            <TouchableOpacity onPress={handleZoomIn} style={{ padding: 4 }}>
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.fullLyricsScroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isAnnotationMode}>
          {(() => {
            const parseMarkdown = (text: any) => {

              if (!text) return '';
              const str = typeof text === 'string' ? text : JSON.stringify(text);
              return str
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            };

            return activeTrack?.lyrics ? (
              <RenderHtml
                contentWidth={SCREEN_WIDTH - 48}
                source={{ html: formatLyricsHtml(activeTrack.lyrics) }}
                baseStyle={{ ...theme.typography.htmlBase, fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier }}
                tagsStyles={{
                  p: { marginBottom: 20 },
                  div: { marginBottom: 14 },
                  strong: { color: theme.colors.accent, fontWeight: '800' },
                  b: { color: theme.colors.accent, fontWeight: '800' },
                  h1: { fontSize: 26, marginBottom: 16, fontWeight: '800' },
                  h2: { fontSize: 22, marginBottom: 16, fontWeight: '700' }
                }}
              />
            ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <Ionicons name="document-text-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
              <Text style={[styles.fullLyricsLine, { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 20 }]}>
                No lyrics have been added for this song yet.
              </Text>
            </View>
          );
          })()}
        </ScrollView>

        {AnnotationLayer}

        {/* Movable Annotation FAB */}
        <PlayerAnnotationFAB
          isPrivileged={isPrivileged}
          isAnnotationMode={isAnnotationMode}
          onToggleAnnotationMode={() => setIsAnnotationMode(!isAnnotationMode)}
          showColorPalette={showColorPalette}
          onToggleColorPalette={() => setShowColorPalette(!showColorPalette)}
          selectedColor={selectedColor}
          getMyColor={getMyColor}
          onSelectColor={setSelectedColor}
          annotationTool={annotationTool}
          onSelectTool={setAnnotationTool}
          onClearMyAnnotations={handleClearMyAnnotations}
          theme={theme}
          initialBottom={175 + Math.max(insets.bottom, 12)}
          initialRight={20}
        />

        {/* Docked Player Controls */}
        <View style={[styles.dockedControlsContainer, { paddingBottom: Math.max(insets.bottom + 6, 20) }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 45 : 100}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(24, 16, 44, 0.72)', 'rgba(10, 6, 20, 0.94)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={{ alignItems: 'center', marginBottom: 2 }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {activeTrack?.title || 'Now Playing'}
            </Text>
            {!!activeTrack?.leadSinger && (
              <Text
                style={{
                  color: theme.colors.accent,
                  fontSize: 11,
                  fontWeight: '600',
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {activeTrack.leadSinger}
              </Text>
            )}
          </View>

          <PlayerProgressSlider
            theme={theme}
            styles={styles}
            formatTime={formatTime}
            seekTo={seekTo}
            hasAudio={hasAudio}
            abLoop={abLoop}
          />

          <PlayerControlsRow
            isShuffle={isShuffle}
            onToggleShuffle={handleToggleShuffle}
            onSkipPrevious={handleSkipPrevious}
            isLoading={isLoading}
            isPlaying={isPlaying}
            hasAudio={hasAudio}
            onPlayPause={handlePlayPause}
            onSkipNext={handleSkipNext}
            repeatMode={repeatMode}
            onToggleRepeat={handleToggleRepeat}
            theme={theme}
            styles={styles}
          />
        </View>

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
    paddingVertical: 16,
    zIndex: 100
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
  fullLyricsScroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 240
  },
  fullLyricsLineActive: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5
  },
  fullLyricsLine: {
    color: theme.colors.textMuted,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5
  },
  dockedControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 20,
    overflow: 'hidden',
    zIndex: 90,
  },
  progressContainer: {
    marginBottom: 4,
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
    justifyContent: 'space-between',
    marginTop: -8,
  },
  timeText: {
    color: theme.colors.textSecondary || theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  playPauseBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
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
