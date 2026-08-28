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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import Svg, { Path } from 'react-native-svg';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAnnotationsAndNotes } from '../hooks/useAnnotationsAndNotes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoodleBackground } from '../components/DoodleBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LyricsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const { activeTrack: initialTrack, bgColor = '#825a1e' } = route.params || {};
  const [activeTrack, setActiveTrack] = useState(initialTrack);
  const [fontSizeModifier, setFontSizeModifier] = useState(0);

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

  const { isPlaying: isGlobalPlaying, togglePlayback, play: playGlobal, currentTrack, skipToNext, skipToPrevious } = useTrackPlayer();

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
        lyrics: d.lyrics || prev.lyrics,
        title: d.title || prev.title,
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
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16 }]} numberOfLines={1} ellipsizeMode="tail">{activeTrack?.title || 'Lyrics'}</Text>
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
                source={{ html: parseMarkdown(activeTrack.lyrics) }}
                baseStyle={{ ...theme.typography.htmlBase, fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier }}
                tagsStyles={{
                  p: { marginBottom: 20 },
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

        {isPrivileged && (
          <View style={{ position: 'absolute', bottom: 40, right: 24, flexDirection: 'row', alignItems: 'flex-end', zIndex: 101, gap: 12 }} pointerEvents="box-none">
            {isAnnotationMode && showColorPalette && (
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(0,0,0,0.85)', padding: 8, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, marginBottom: 6 }}>
                {['#ff3b30', '#34c759', '#007aff', '#ffcc00', '#af52de', '#ffffff'].map(c => {
                  const isCurrent = (selectedColor || getMyColor()) === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: c,
                        borderWidth: isCurrent ? 2.5 : 0,
                        borderColor: '#fff',
                        transform: [{ scale: isCurrent ? 1.15 : 1 }]
                      }}
                      onPress={() => setSelectedColor(c)}
                    />
                  );
                })}
              </View>
            )}
            <View style={{ alignItems: 'center', gap: 10 }} pointerEvents="box-none">
              {isAnnotationMode && (
                <>
                  <TouchableOpacity 
                    style={{ backgroundColor: 'rgba(255,59,48,0.95)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
                    onPress={handleClearMyAnnotations}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: showColorPalette ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: showColorPalette ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setShowColorPalette(!showColorPalette)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="color-palette-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setAnnotationTool('eraser')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="eraser" size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(0,0,0,0.7)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setAnnotationTool('pen')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: isAnnotationMode ? theme.colors.accent : 'rgba(0,0,0,0.6)',
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 8,
                  borderWidth: 1,
                  borderColor: isAnnotationMode ? theme.colors.accent : 'rgba(255,255,255,0.1)'
                }}
                onPress={() => setIsAnnotationMode(!isAnnotationMode)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="brush" 
                  size={24} 
                  color="#ffffff" 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

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
    paddingBottom: 220
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
