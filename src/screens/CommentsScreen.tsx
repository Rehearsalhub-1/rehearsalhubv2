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
import RenderHtml from 'react-native-render-html';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { useWebSocket } from '../hooks/useWebSocket';
import { DoodleBackground } from '../components/DoodleBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CommentsScreen({ route, navigation }: any) {
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
        comments: d.comments || prev.comments,
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
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16 }]} numberOfLines={1} ellipsizeMode="tail">{activeTrack?.title || 'Comments'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity onPress={() => { setFontSizeModifier(p => Math.max(p - 2, -8)); }} style={{ padding: 4 }}>
              <Ionicons name="remove-circle-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' }}>Zoom</Text>
            <TouchableOpacity onPress={() => { setFontSizeModifier(p => Math.min(p + 2, 12)); }} style={{ padding: 4 }}>
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.contentScroll}
          showsVerticalScrollIndicator={false}>
          
          {(() => {
            const parseMarkdown = (text: any) => {

              if (!text) return '';
              const str = typeof text === 'string' ? text : JSON.stringify(text);
              return str
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            };

            let parsed = activeTrack?.comments;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) {}
            }
            
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((comment: any, index: number) => (
                <View key={index} style={{ marginBottom: 24 }}>
                  <Text style={[styles.fullTextLine, { color: theme.colors.textMuted, marginBottom: 8 }]}>{comment.author || 'Director Comment'}:</Text>
                  <RenderHtml
                    contentWidth={SCREEN_WIDTH - 48}
                    source={{ html: parseMarkdown(comment.text || comment.comment || '') }}
                    baseStyle={{ ...theme.typography.htmlBase, fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier }}
                    tagsStyles={{ p: { marginBottom: 20 }, strong: { color: theme.colors.accent, fontWeight: '800' }, b: { color: theme.colors.accent, fontWeight: '800' } }}
                  />
                </View>
              ));
            } else if (parsed && typeof parsed === 'object' && parsed.text) {
              return (
                <View style={{ marginBottom: 24 }}>
                  <Text style={[styles.fullTextLine, { color: theme.colors.textMuted, marginBottom: 8 }]}>{parsed.author || 'Director Comment'}:</Text>
                  <RenderHtml
                    contentWidth={SCREEN_WIDTH - 48}
                    source={{ html: parseMarkdown(parsed.text) }}
                    baseStyle={{ ...theme.typography.htmlBase, fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier }}
                    tagsStyles={{ p: { marginBottom: 20 }, strong: { color: theme.colors.accent, fontWeight: '800' }, b: { color: theme.colors.accent, fontWeight: '800' } }}
                  />
                </View>
              );
            } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
              return (
                <RenderHtml
                  contentWidth={SCREEN_WIDTH - 48}
                  source={{ html: parseMarkdown(parsed) }}
                  baseStyle={{ ...theme.typography.htmlBase, fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier }}
                  tagsStyles={{ p: { marginBottom: 20 }, strong: { color: theme.colors.accent, fontWeight: '800' }, b: { color: theme.colors.accent, fontWeight: '800' } }}
                />
              );
            } else {
              return (
                <View style={{ marginBottom: 24 }}>
                  <Text style={[styles.fullTextLine, { color: theme.colors.textMuted }]}>No comments from directors.</Text>
                </View>
              );
            }
          })()}
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
    ...theme.typography.bodyText
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
