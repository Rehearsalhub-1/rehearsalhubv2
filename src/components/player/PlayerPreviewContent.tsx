import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { ExpandableText } from './ExpandableText';

export interface PlayerPreviewContentProps {
  activePreviewTab: string;
  activeTrack: any;
  songHistorySummary?: string;
  fromAllSongs?: boolean;
  isHQ?: boolean;
  contentWidth: number;
  parseMarkdown: (text: any) => string;
  isConductorGuideText: (text: string | null | undefined) => boolean;
  navigation: any;
  theme: any;
}

export const PlayerPreviewContent: React.FC<PlayerPreviewContentProps> = ({
  activePreviewTab,
  activeTrack,
  songHistorySummary,
  fromAllSongs,
  isHQ,
  contentWidth,
  parseMarkdown,
  isConductorGuideText,
  navigation,
  theme,
}) => {
  if (!activeTrack) return null;

  const resolvedConductorGuide =
    activeTrack.conductorGuide ||
    (isConductorGuideText(activeTrack.solfa) ? activeTrack.solfa : '');
  const resolvedSolfa = isConductorGuideText(activeTrack.solfa)
    ? ''
    : activeTrack.solfa || '';
  const resolvedHistory =
    songHistorySummary ||
    activeTrack.history ||
    (activeTrack.program
      ? `**Ministered at ${activeTrack.program}**\n\n- **Lead Singer:** ${
          activeTrack.leadSinger || 'Loveworld Singers'
        }\n- **Conductor:** ${activeTrack.conductor || '—'}\n- **Key:** ${
          activeTrack.key || '—'
        } · **Tempo:** ${activeTrack.tempo || '—'}\n- **Rehearsal Count:** x${
          activeTrack.rehearsalCount ?? 0
        }`
      : '');

  return (
    <>
      {activePreviewTab === 'Lyrics' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Lyrics preview
            </Text>
            {activeTrack.lyrics ? (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 320, minHeight: 130 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              >
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: parseMarkdown(activeTrack.lyrics) }}
                  baseStyle={{ ...theme.typography.htmlBase }}
                  tagsStyles={{
                    p: { margin: 0, padding: 0 },
                    strong: { color: theme.colors.accent, fontWeight: '800' },
                    b: { color: theme.colors.accent, fontWeight: '800' },
                  }}
                />
              </ScrollView>
            ) : (
              <View style={{ minHeight: 100, justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                  No lyrics available.
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Lyrics', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {activePreviewTab === 'Conductor' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Conductor preview
            </Text>
            {resolvedConductorGuide ? (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 320, minHeight: 130 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              >
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: parseMarkdown(resolvedConductorGuide) }}
                  baseStyle={{ ...theme.typography.htmlBase }}
                  tagsStyles={{
                    p: { margin: 0, padding: 0 },
                    strong: { color: theme.colors.accent, fontWeight: '800' },
                    b: { color: theme.colors.accent, fontWeight: '800' },
                  }}
                />
              </ScrollView>
            ) : (
              <View style={{ minHeight: 100, justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                  No conductor guide provided.
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Conductor', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {activePreviewTab === 'Solfa' && (!fromAllSongs || isHQ) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Solfa preview
            </Text>
            {resolvedSolfa ? (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 320, minHeight: 130 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              >
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: parseMarkdown(resolvedSolfa) }}
                  baseStyle={{ ...theme.typography.htmlBase }}
                  tagsStyles={{
                    p: { margin: 0, padding: 0 },
                    strong: { color: theme.colors.accent, fontWeight: '800' },
                    b: { color: theme.colors.accent, fontWeight: '800' },
                  }}
                />
              </ScrollView>
            ) : (
              <View style={{ minHeight: 100, justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                  No solfa notation available.
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Solfa', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {activePreviewTab === 'History' && (!fromAllSongs || isHQ) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              History preview
            </Text>
            {resolvedHistory ? (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 320, minHeight: 130 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              >
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: parseMarkdown(resolvedHistory) }}
                  baseStyle={{ ...theme.typography.htmlBase }}
                  tagsStyles={{
                    p: { margin: 0, padding: 0 },
                    strong: { color: theme.colors.accent, fontWeight: '800' },
                    b: { color: theme.colors.accent, fontWeight: '800' },
                  }}
                />
              </ScrollView>
            ) : (
              <View style={{ minHeight: 100, justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                  No history available.
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('History', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {activePreviewTab === 'Comments' && !fromAllSongs && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Comments preview
            </Text>
            {activeTrack.comments ? (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 320, minHeight: 130 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              >
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: parseMarkdown(activeTrack.comments) }}
                  baseStyle={{ ...theme.typography.htmlBase }}
                  tagsStyles={{
                    p: { margin: 0, padding: 0 },
                    strong: { color: theme.colors.accent, fontWeight: '800' },
                    b: { color: theme.colors.accent, fontWeight: '800' },
                  }}
                />
              </ScrollView>
            ) : (
              <View style={{ minHeight: 100, justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                  No comments available.
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Comments', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {activePreviewTab === 'Details' && !fromAllSongs && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 11,
                fontWeight: '800',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Song Details
            </Text>
            <View style={{ maxHeight: 120, overflow: 'hidden' }}>
              <ExpandableText
                style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}
              >
                <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Lead: </Text>
                {activeTrack.leadSinger || 'Unknown'}
              </ExpandableText>
              <ExpandableText
                style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}
              >
                <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Album: </Text>
                {activeTrack.program || 'Unknown'}
              </ExpandableText>
            </View>
          </View>
          <TouchableOpacity
            style={{
              padding: 14,
              backgroundColor: theme.colors.cardBackgroundLight,
              borderRadius: 24,
              marginLeft: 16,
            }}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Details', { activeTrack, backgroundColor: '#8b5cf6' });
            }}
          >
            <Ionicons name="expand" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};
