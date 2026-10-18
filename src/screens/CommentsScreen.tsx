import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { LinearGradient } from 'expo-linear-gradient';
import { useWebSocket } from '../hooks/useWebSocket';
import { DoodleBackground } from '../components/DoodleBackground';
import { formatLyricsHtml } from '../utils/lyricsFormatter';
import { api } from '../services/api';

export default function CommentsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = getStyles(theme);

  const { activeTrack: initialTrack, bgColor = '#825a1e' } = route.params || {};
  const paramTrack = route.params?.activeTrack;
  const [activeTrack, setActiveTrack] = useState(paramTrack || initialTrack);

  useEffect(() => {
    if (paramTrack && paramTrack.id && String(paramTrack.id) !== String(activeTrack?.id)) {
      setActiveTrack(paramTrack);
    }
  }, [paramTrack]);

  useEffect(() => {
    if (activeTrack?.id && !activeTrack.comments && !activeTrack.notes && !(activeTrack as any).coordinatorComment) {
      api.songs
        .getById(activeTrack.id)
        .then((res: any) => {
          const songData = res?.data || res;
          if (songData) {
            setActiveTrack((prev: any) => ({
              ...prev,
              ...songData,
              comments: songData.comments || songData.notes || songData.coordinatorComment,
            }));
          }
        })
        .catch(() => {});
    }
  }, [activeTrack?.id]);
  const [fontSizeModifier, setFontSizeModifier] = useState(0);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

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
          comments: d.comments !== undefined ? d.comments : prev.comments,
          notes: d.notes !== undefined ? d.notes : prev.notes,
          coordinatorComment: d.coordinatorComment !== undefined ? d.coordinatorComment : prev.coordinatorComment,
          title: d.title !== undefined ? d.title : prev.title,
        };
      });
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
              {activeTrack?.title || 'Comments'}
            </Text>
          </TouchableOpacity>
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
            let raw = activeTrack?.comments || activeTrack?.notes || (activeTrack as any)?.coordinatorComment;
            if (!raw) {
              return (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                  <Text style={[styles.fullTextLine, { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 18 }]}>
                    No comments from directors.
                  </Text>
                </View>
              );
            }

            if (typeof raw === 'string') {
              const trimmed = raw.trim();
              if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                  raw = JSON.parse(trimmed);
                } catch {}
              }
            }

            let htmlContent = '';
            if (Array.isArray(raw)) {
              if (raw.length === 0) {
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                    <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                    <Text style={[styles.fullTextLine, { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 18 }]}>
                      No comments from directors.
                    </Text>
                  </View>
                );
              }
              htmlContent = raw.map((c: any) => {
                const author = typeof c === 'object' && c?.author ? `<strong style="font-size: 16px; color: ${theme.colors.accent}">${c.author}:</strong><br/>` : '';
                const text = typeof c === 'string' ? c : (c?.text || c?.comment || c?.content || '');
                return `${author}${formatLyricsHtml(text)}`;
              }).join('<br/><br/><hr style="opacity: 0.15; margin: 16px 0;" /><br/>');
            } else if (typeof raw === 'object' && raw !== null) {
              const author = raw.author ? `<strong style="font-size: 16px; color: ${theme.colors.accent}">${raw.author}:</strong><br/>` : '';
              const text = raw.text || raw.comment || raw.content || '';
              htmlContent = `${author}${formatLyricsHtml(text)}`;
            } else {
              htmlContent = formatLyricsHtml(String(raw));
            }

            if (!htmlContent.trim()) {
              return (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                  <Text style={[styles.fullTextLine, { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 18 }]}>
                    No comments from directors.
                  </Text>
                </View>
              );
            }

            return (
              <RenderHtml
                contentWidth={windowWidth - 48}
                source={{ html: htmlContent }}
                baseStyle={{
                  ...theme.typography.htmlBase,
                  fontSize: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier,
                  lineHeight: (theme.typography.htmlBase.fontSize || 15) + fontSizeModifier + 8,
                }}
                tagsStyles={{
                  p: { marginBottom: 16 },
                  div: { marginBottom: 12 },
                  strong: { color: theme.colors.accent, fontWeight: '800' },
                  b: { color: theme.colors.accent, fontWeight: '800' },
                  h1: { fontSize: 24, marginBottom: 12, fontWeight: '800' },
                  h2: { fontSize: 20, marginBottom: 10, fontWeight: '700' },
                  h3: { fontSize: 17, marginBottom: 8, fontWeight: '700' },
                  ul: { marginBottom: 12, paddingLeft: 16 },
                  ol: { marginBottom: 12, paddingLeft: 16 },
                  li: { marginBottom: 6 },
                  hr: { borderColor: theme.colors.cardBackgroundLight, marginVertical: 16 },
                }}
              />
            );
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
