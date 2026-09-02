import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

import { useTrackPlayer } from '../hooks/useTrackPlayer';

import { DoodleBackground } from '../components/DoodleBackground';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HistoryScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const { activeTrack: initialTrack, bgColor = '#825a1e' } = route.params || {};
  const [activeTrack, setActiveTrack] = useState(initialTrack);
  const [activeTab, setActiveTab] = useState('lyrics');
  const [expandedId, setExpandedId] = useState<string | null>('lyrics-1');
  const { isPlaying: isGlobalPlaying, togglePlayback, play: playGlobal, currentTrack } = useTrackPlayer();

  const handlePlayHistoryAudio = async (trackItem: any, url: string) => {
    if (currentTrack?.id === trackItem.id) {
      await togglePlayback();
      return;
    }
    const historyTrackObj = {
      id: trackItem.id,
      title: trackItem.title || 'Audio Archive Preview',
      artist: activeTrack?.title || 'History Version',
      audioUrl: url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      image: activeTrack?.image,
      isHistory: true,
      originalSongId: activeTrack?.id
    };

    await playGlobal(historyTrackObj, [historyTrackObj]);
  };

  const formatTime = (millis: number) => {

    if (!millis || isNaN(millis)) return "0:00";
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const toggleExpand = (id: string) => {

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeTrack?.id) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    async function loadHistory() {
      try {
        const res = await api.songs.getHistory(String(activeTrack.id).trim());
        if (res?.success && Array.isArray(res.data)) {
          let entries = res.data;
          entries.sort((a: any, b: any) => {
            const timeA = a.created_at?.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at || a.date || 0).getTime();
            const timeB = b.created_at?.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at || b.date || 0).getTime();
            return timeB - timeA;
          });
          setHistoryEntries(entries);
        } else {
          setHistoryEntries([]);
        }
      } catch (err) {
        setHistoryEntries([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [activeTrack?.id]);

  useWebSocket(
    'song_history',
    activeTrack?.id ? String(activeTrack.id) : '',
    (data: unknown) => {
      const update = data as any;
      if (!update) return;
      setHistoryEntries(prev => {
        const existingIndex = prev.findIndex(e => e.id === update.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...update };
          return updated;
        }
        return [update, ...prev];
      });
    },
    !!activeTrack?.id
  );

  const getHistoryData = (tabId: string) => {
    return historyEntries.filter(entry => {
      const type = (entry.type || '').toLowerCase();
      
      if (tabId === 'audio') {
        return type === 'audio' || !!entry.audioUrl;
      }
      if (tabId === 'details') {
        return ['metadata', 'song-details', 'personnel', 'music-details', 'details'].includes(type);
      }
      if (tabId === 'solfa') {
        return ['solfa', 'notation', 'solfa notation'].includes(type);
      }
      if (tabId === 'conductor') {
        return ["conductor's guide", 'conductor guide', 'conductor', 'solfas'].includes(type);
      }
      if (tabId === 'comments') {
        return ['comments', 'comment', 'coordinator comments', 'pastor comments', 'director comment'].includes(type);
      }
      if (tabId === 'lyrics') {
        return ['lyrics', 'lyric'].includes(type);
      }
      return type === tabId;
    });
  };

  const formatDateTime = (createdAt: any) => {

    let date = new Date();
    if (createdAt?.toDate) {
      date = createdAt.toDate();
    } else if (createdAt?.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else if (createdAt) {
      date = new Date(createdAt);
    }
    
    if (isNaN(date.getTime())) return { date: 'Unknown Date', time: '' };
    
    return {
      date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const htmlBaseStyle = {
    ...theme.typography.htmlBase
  };

  const parseMarkdown = (text: any) => {

    if (!text) return '';
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  };

  const renderHistoryContent = (entry: any) => {

    if (['song-details', 'personnel', 'music-details', 'metadata'].includes(entry.type)) {
      try {
        const newObj = JSON.parse(entry.new_value || '{}');
        const oldObj = JSON.parse(entry.old_value || '{}');
        
        return (
          <View style={{ marginTop: 8, gap: 12 }}>
            {Object.keys(newObj || {}).map((key) => {
              const val = newObj[key];
              const oldVal = oldObj[key];
              return (
                <View key={key} style={styles.metadataRow}>
                  <Text style={styles.metadataKey}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}:</Text>
                  <View style={styles.metadataValueContainer}>
                    {oldVal && oldVal !== val && (
                      <>
                        <Text style={styles.metadataOldValue} numberOfLines={1}>{String(oldVal)}</Text>
                        <Ionicons name="arrow-forward" size={14} color={theme.colors.textMuted} style={{ marginHorizontal: 4 }} />
                      </>
                    )}
                    <Text style={styles.metadataNewValue} numberOfLines={1}>{String(val || 'None')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      } catch (e) {
      }
    }

    return (
      <RenderHtml
        contentWidth={SCREEN_WIDTH - 88}
        source={{ html: parseMarkdown(entry.new_value || '') }}
        baseStyle={htmlBaseStyle}
        tagsStyles={{
          p: { marginBottom: 12 },
          strong: { color: theme.colors.accent, fontWeight: '800' },
          b: { color: theme.colors.accent, fontWeight: '800' }
        }}
      />
    );
  };

  const tabs = [
  { id: 'lyrics', label: 'Lyrics History' },
  { id: 'audio', label: 'Audio History' },
  { id: 'conductor', label: 'Conductor History' },
  { id: 'solfa', label: 'Solfa History' },
  { id: 'comments', label: 'Comments History' },
  { id: 'details', label: 'Details History' }];

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
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16 }]} numberOfLines={1} ellipsizeMode="tail">{activeTrack?.title || 'Historical Archive'}</Text>
          <View style={styles.headerBtn} />
        </View>

        {}
        <View style={{ height: 60, marginBottom: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContainer}>
            
            {tabs.map((tab) =>
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, activeTab === tab.id && styles.tabPillActive]}
              onPress={() => {
                setActiveTab(tab.id);

                const items = getHistoryData(tab.id);
                const firstItem = items?.[0];
                setExpandedId(firstItem ? firstItem.id : null);
              }}
              activeOpacity={0.8}>
              
                <Text style={[styles.tabPillText, activeTab === tab.id && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {}
        <ScrollView
          contentContainerStyle={styles.contentScroll}
          showsVerticalScrollIndicator={false}>
          
          {isLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Loading history...</Text>
            </View>
          ) : getHistoryData(activeTab).length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
              <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 16, marginTop: 16 }}>No history available</Text>
            </View>
          ) : activeTab === 'audio' ?
          <>
              <Text style={styles.sectionTitle}>Audio Archive</Text>
              {getHistoryData('audio').map((track: any) => {
              const isExpanded = expandedId === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.accordionCard, isExpanded && styles.accordionCardExpanded]}
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(track.id)}>
                  
                    <View style={styles.accordionHeader}>
                      <View style={styles.audioTrackLeft}>
                        <TouchableOpacity
                        style={styles.audioPlayBtn}
                        onPress={() => handlePlayHistoryAudio(track, track.new_value || track.audioUrl)}>
                        
                          <Ionicons name={currentTrack?.id === track.id && isGlobalPlaying ? "pause" : "play"} size={20} color={theme.colors.background} style={{ marginLeft: currentTrack?.id === track.id && isGlobalPlaying ? 0 : 2 }} />
                        </TouchableOpacity>
                        <View style={styles.audioTrackInfo}>
                          <Text style={styles.accordionTitle}>{track.title}</Text>
                          <View style={styles.badgeRow}>
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{track.type || 'Update'}</Text>
                            </View>
                            <Text style={styles.dateText}>{formatDateTime(track.created_at).date}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.durationText, currentTrack?.id === track.id ? { color: theme.colors.accent } : null]}>
                          {currentTrack?.id === track.id ? (isGlobalPlaying ? 'Playing' : 'Paused') : 'Listen'}
                        </Text>
                        <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.colors.textMuted}
                        style={{ marginLeft: 8 }} />
                      
                      </View>
                    </View>

                    {isExpanded &&
                  <View style={styles.accordionBody}>
                        <Text style={styles.accordionContentText}>{track.description || track.new_value || track.audioUrl || 'No details.'}</Text>
                      </View>
                  }
                  </TouchableOpacity>);

            })}
            </> :

          <>
              <Text style={styles.sectionTitle}>
                {tabs.find((t) => t.id === activeTab)?.label} Archive
              </Text>
              {getHistoryData(activeTab).map((item: any) => {
              const isExpanded = expandedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.accordionCard, isExpanded && styles.accordionCardExpanded]}
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(item.id)}>
                  
                    <View style={styles.accordionHeader}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={styles.accordionTitle}>{item.title || item.version || 'Update'}</Text>
                        <View style={styles.badgeRow}>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.type || 'Update'}</Text>
                          </View>
                          <Text style={styles.dateText}>{formatDateTime(item.created_at).date}</Text>
                        </View>
                      </View>
                      <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={theme.colors.textMuted} />
                    
                    </View>

                    {isExpanded &&
                  <View style={styles.accordionBody}>
                        {renderHistoryContent(item)}
                      </View>
                  }
                  </TouchableOpacity>);

            })}
            </>
          }
        </ScrollView>

      </SafeAreaView>
    </View>);

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
  tabScrollContainer: {
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  tabPill: {
    backgroundColor: theme.colors.cardBackgroundLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  tabPillActive: {
    backgroundColor: theme.colors.textPrimary,
    borderColor: theme.colors.textPrimary
  },
  tabPillText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '700'
  },
  tabPillTextActive: {
    color: theme.colors.background
  },
  contentScroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 220
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3
  },
  accordionCard: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  accordionCardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: theme.colors.bottomTabBorder
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  accordionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginRight: 10
  },
  badgeText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700'
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  accordionBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBackgroundLight
  },
  accordionContentText: {
    ...theme.typography.bodyText
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  metadataKey: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 12
  },
  metadataValueContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  metadataOldValue: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'line-through'
  },
  metadataNewValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right'
  },
  audioTrackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  audioPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  audioTrackInfo: {
    flex: 1
  },
  durationText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600'
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
    justifyContent: 'center'
  },
  dockedPlayPauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  }
});
};
