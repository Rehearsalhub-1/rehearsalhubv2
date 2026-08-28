import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { optimizeAudio } from '../lib/mediaUtils';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image as RNImage,
  Share,
  Alert,
  Modal,
  Pressable,
  TextInput,
  PanResponder,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoodleBackground } from '../components/DoodleBackground';
import { DoodleLayer } from '../components/DoodleLayer';
import { MiniDoodleCanvas } from '../components/MiniDoodleCanvas';

import { Image } from 'expo-image';
import Constants from 'expo-constants';

import Slider from '@react-native-community/slider';
import RenderHtml from 'react-native-render-html';
import Svg, { Path } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';
import { useTrackPlayer, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import TrackPlayer from 'react-native-track-player';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { isHQGroup } from '../config/zones';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { useAnnotationsAndNotes } from '../hooks/useAnnotationsAndNotes';
import { SongScheduleSheet } from '../components/SongScheduleSheet';
import { useUserStore } from '../hooks/useUser';
import { apiClient } from '../lib/apiClient';
import { useWebSocket } from '../hooks/useWebSocket';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ExpandableText = ({ style, children, gradientColors }: { style: any, children: React.ReactNode, gradientColors?: readonly [string, string, ...string[]] }) => {
  const [expanded, setExpanded] = useState(false);
  const textProps = {
    numberOfLines: expanded ? undefined : 1,
    ellipsizeMode: "tail" as const,
    onPress: () => setExpanded(!expanded),
    suppressHighlighting: true,
  };

  const textElement = (
    <Text style={style} {...textProps}>
      {children}
    </Text>
  );

  if (gradientColors && gradientColors.length > 0) {
    return (
      <MaskedView maskElement={textElement} style={style}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[style, { opacity: 0 }]} {...textProps}>
          {children}
        </Text>
      </MaskedView>
    );
  }

  return textElement;
};

const PlayerProgressSlider = ({
  theme,
  styles,
  formatTime,
  seekTo,
  hasAudio
}: any) => {
  const progress = useTrackPlayerProgress(250);
  const duration = hasAudio ? progress.duration : 0;
  const position = hasAudio ? progress.position : 0;
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayValue, setSeekDisplayValue] = useState(0);

  const handleSlidingStart = () => {
    setIsSeeking(true);
    setSeekDisplayValue(position);
  };

  const handleSlidingComplete = async (val: number) => {
    await seekTo(val);
    setTimeout(() => {
      setIsSeeking(false);
    }, 150);
  };

  const currentValue = isSeeking ? seekDisplayValue : position;

  return (
    <View style={styles.progressContainer}>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={0}
        maximumValue={duration > 0 ? duration : 100}
        value={currentValue}
        minimumTrackTintColor={hasAudio ? theme.colors.trackMin : theme.colors.textMuted}
        maximumTrackTintColor={theme.colors.trackMax}
        thumbTintColor={hasAudio ? theme.colors.thumbTint : 'transparent'}
        onSlidingStart={handleSlidingStart}
        onValueChange={(val) => {
          setSeekDisplayValue(val);
        }}
        onSlidingComplete={handleSlidingComplete}
        disabled={!hasAudio}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{hasAudio ? formatTime(currentValue) : '--:--'}</Text>
        <Text style={styles.timeText}>
          {hasAudio && duration > 0 ? `-${formatTime(Math.max(0, duration - currentValue))}` : '--:--'}
        </Text>
      </View>
    </View>
  );
};

export default function PlayerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isHQ = useUserStore(s => s.isHQ);
  const { activeTrack: initialTrack, fromAllSongs, queue: initialQueue } = route.params || {};

  const fallbackTrack = {
    id: '',
    title: 'Now Playing',
    subtitle: '',
    leadSinger: '',
    writer: '',
    conductor: '',
    key: '',
    tempo: '',
    audioUrl: '',
    imageUrl: '',
    lyrics: '',
    solfa: '',
    conductorGuide: '',
    program: '',
    rehearsalCount: 0,
    collectionName: '',
  };

    const [activeTrack, setActiveTrack] = useState(initialTrack || fallbackTrack);
  const lastClickedTrackIdRef = useRef<string | null>(initialTrack ? String(initialTrack.id) : null);
  const { width } = useWindowDimensions();
  const [activePreviewTab, setActivePreviewTab] = useState('Lyrics');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showMoreAssetsModal, setShowMoreAssetsModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showAudioPartsModal, setShowAudioPartsModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [liveSong, setLiveSong] = useState<any>(null);
  const isSongHeard = (s: any): boolean => {
    if (!s) return false;
    if (s.status === 'heard') return true;
    if (s.status === 'unheard') return false;
    if (s.rehearsalStatus === 'heard') return true;
    if (s.rehearsalStatus === 'unheard') return false;
    if (s.heard === true || s.isHeard === true) return true;
    if (s.heard === false || s.isHeard === false) return false;
    const title = (s.title || '').toLowerCase();
    if (title.includes('(heard)')) return true;
    if (title.includes('(unheard)')) return false;
    return false;
  };

  const applySongUpdate = useCallback((updateData: any) => {
    const update = updateData?.data || updateData;
    if (!update || typeof update !== 'object') return;
    setActiveTrack((prev: any) => {
      if (!prev) return prev;
      const rawAudioUrl = update.audioFile || update.audioUrls?.full || prev.audioUrl;
      const songAudioUrl = rawAudioUrl && rawAudioUrl.includes('cloudinary.com') ? optimizeAudio(rawAudioUrl) : rawAudioUrl;
      return {
        ...prev,
        ...update,
        lyrics: update.lyrics !== undefined ? update.lyrics : prev.lyrics,
        solfa: (update.notation || update.solfas || update.solfa) !== undefined ? (update.notation || update.solfas || update.solfa) : prev.solfa,
        conductorGuide: (update.solfas || update.conductorGuide || update.guide) !== undefined ? (update.solfas || update.conductorGuide || update.guide) : prev.conductorGuide,
        comments: update.comments !== undefined ? update.comments : prev.comments,
        history: update.history !== undefined ? update.history : prev.history,
        audioUrl: songAudioUrl,
        status: isSongHeard(update) ? 'heard' : (update.status || prev.status),
        isActive: update.isActive !== undefined ? update.isActive : prev.isActive,
      };
    });
  }, []);

  useWebSocket('song', activeTrack?.id ? String(activeTrack.id) : '', (eventData: any) => {
    applySongUpdate(eventData);
  }, Boolean(activeTrack?.id));

  useWebSocket('song', 'all', (eventData: any) => {
    const update = eventData?.data || eventData;
    if (update && typeof update === 'object' && activeTrack?.id && (String(update.id) === String(activeTrack.id) || update.title === activeTrack.title)) {
      applySongUpdate(update);
    }
  }, Boolean(activeTrack?.id));



  const {
    AnnotationLayer,
    NotesModal,
    isAnnotationMode,
    setIsAnnotationMode,
    isPrivileged,
    annotationTool,
    setAnnotationTool,
    selectedColor,
    setSelectedColor,
    showColorPalette,
    setShowColorPalette,
    getMyColor,
    handleClearMyAnnotations,
    setShowNotesModal
  } = useAnnotationsAndNotes(activeTrack?.id, activeTrack?.title, { isPlayer: true });

  const {
    isPlaying,
    isLoading,
    play,
    pause,
    togglePlayback,
    seekTo,
    currentTrack,
    toggleShuffle,
    isShuffle,
    skipToPrevious,
    skipToNext,
    toggleRepeat,
    repeatMode
  } = useTrackPlayer();

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreatingPlaylist(true);
    try {
      await apiClient.post('/playlists', { name: newPlaylistName.trim() });
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/playlists/me');
      if (res?.data) setPlaylists(res.data);
      setNewPlaylistName('');
    } catch {}
    setIsCreatingPlaylist(false);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!activeTrack?.id) return;
    try {
      await apiClient.post(`/playlists/${playlistId}/songs`, { songId: activeTrack.id });
      Alert.alert('Success', 'Added to playlist');
      setShowPlaylistModal(false);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    apiClient.get<{ success: boolean; data: any[] }>('/playlists/me').then(res => {
      if (res?.success && Array.isArray(res.data)) setPlaylists(res.data);
    }).catch(() => {});
  }, [user]);

  const toggleFavorite = async () => {
    if (!activeTrack?.id) return;
    try {
      setIsFavorite(prev => !prev);
      if (isFavorite) {
        await apiClient.delete(`/favorites/${activeTrack.id}`).catch(() => {});
      } else {
        await apiClient.post('/favorites', { songId: activeTrack.id }).catch(() => {});
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };
  const previewTabs = ['Lyrics', 'Comments', 'Conductor'];

  useEffect(() => {
    if (!activeTrack?.id) return;
    const isSameTrack = currentTrack && String(currentTrack.id) === String(activeTrack.id);
    // If already on this track, don't restart it — just let the existing playback state continue
    if (isSameTrack) return;
    // Load the track into the player without autostarting — user taps play manually
    if (!currentTrack || String(currentTrack.id) !== String(activeTrack.id) || (!currentTrack.audioUrl && activeTrack.audioUrl)) {
      play(activeTrack, initialQueue || undefined, false);
    }
  }, [activeTrack?.id]);

  const handlePlayPause = async () => {
    if (currentTrack && String(currentTrack.id) !== String(activeTrack.id)) {
      await play(activeTrack);
    } else {
      togglePlayback();
    }
  };

  const formatTime = (millis: number) => {

    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const parseMarkdown = (text: any) => {

    if (!text) return '';
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  };

  const getParsedCommentsHtml = () => {

    let comments = activeTrack?.comments;
    if (!comments) return '';
    let parsed = comments;
    if (typeof comments === 'string') {
      try { parsed = JSON.parse(comments); } catch (e) {}
    }
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => parseMarkdown(c.text || c.comment || '')).join('<br><br>');
    } else if (typeof parsed === 'object' && parsed !== null) {
      return parseMarkdown(parsed.text || parsed.comment || '');
    }
    return parseMarkdown(String(parsed));
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://www.loveworldsingersrehearsalhubportal.org/songs/${activeTrack.id}`;
      await Share.share({
        message: `Listen to "${activeTrack?.title || 'this song'}" on Rehearsal Hub:\n${shareUrl}`,
        url: shareUrl,
        title: activeTrack?.title || 'Rehearsal Hub'
      });
    } catch (error) {
      console.error('Error sharing song:', error);
    }
  };

  const handleMoreOptions = () => {
    setShowOptionsModal(true);
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

      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        {}
        <View style={[styles.header, { top: Math.max(insets.top + 10, 40) }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color="#ffffff" />
          </TouchableOpacity>
          <ExpandableText 
            style={[styles.headerText, { flex: 1, textAlign: 'center', marginHorizontal: 16, color: '#000000', textShadowColor: 'rgba(255,255,255,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]} 
          >
            {activeTrack?.title || 'Now Playing'}
          </ExpandableText>

          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowNotesModal(true)}>
            <Ionicons name="document-text" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleMoreOptions}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {liveSong && String(liveSong.id) !== String(activeTrack?.id) && (
          <TouchableOpacity 
            style={{
              backgroundColor: theme.colors.accent + '20',
              borderColor: theme.colors.accent,
              borderWidth: 1,
              marginHorizontal: 16,
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onPress={() => {
              setActiveTrack(liveSong);
              play(liveSong, initialQueue || undefined);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent, marginRight: 8 }} />
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 13, flex: 1 }} numberOfLines={1}>
                Live Now: {liveSong.title || 'Unknown'}
              </Text>
            </View>
            <Ionicons name="play-circle" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }} 
          showsVerticalScrollIndicator={false} 
          scrollEnabled={!isAnnotationMode}
        >
          {}
          <View style={styles.artContainer}>
            <Image
              source={activeTrack.imageUrl ? { uri: activeTrack.imageUrl } : activeTrack.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
              blurRadius={8} />
            
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
            
            <View style={styles.overlayContent}>
              
              <View style={styles.tableContainer}>
                {}
                <View style={styles.tableRowFull}>
                  <Text style={styles.tableLabel}>LEAD SINGER:</Text>
                  <ExpandableText style={styles.tableValue}>{activeTrack.leadSinger?.split(',')[0]?.trim() || 'Unknown'}</ExpandableText>
                </View>

                {}
                <View style={styles.tableRowSplit}>
                  <View style={styles.tableCell}>
                    <Text style={styles.tableLabel}>WRITER:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.writer?.split(',')[0]?.trim() || 'Unknown'}</ExpandableText>
                  </View>
                  <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                    <Text style={styles.tableLabel}>REHEARSALS:</Text>
                    <ExpandableText style={[styles.tableValue, { color: theme.colors.accent }]}>{`x${activeTrack.rehearsalCount ?? 0}`}</ExpandableText>
                  </View>
                </View>

                {}
                <View style={styles.tableRowSplit}>
                  <View style={styles.tableCell}>
                    <Text style={styles.tableLabel}>CONDUCTOR:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.conductor?.split(',')[0]?.trim() || '—'}</ExpandableText>
                  </View>
                  <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                    <Text style={styles.tableLabel}>KEY:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.key || '—'}</ExpandableText>
                  </View>
                </View>

                {}
                <View style={styles.tableRowSplit}>
                  <View style={styles.tableCell}>
                    <Text style={styles.tableLabel}>LEAD KEYBOARDIST:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.leadKeyboardist?.split(',')[0]?.trim() || '—'}</ExpandableText>
                  </View>
                  <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 0.8 }]}>
                    <Text style={styles.tableLabel}>TEMPO:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.tempo || '—'}</ExpandableText>
                  </View>
                </View>

                {}
                <View style={styles.tableRowSplit}>
                  <View style={styles.tableCell}>
                    <Text style={styles.tableLabel}>DRUMMER:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.drummer?.split(',')[0]?.trim() || '—'}</ExpandableText>
                  </View>
                  <View style={[styles.tableCell, { justifyContent: 'flex-end', flex: 1.2 }]}>
                    <Text style={styles.tableLabel}>BASS GUITARIST:</Text>
                    <ExpandableText style={styles.tableValue}>{activeTrack.leadGuitarist?.split(',')[0]?.trim() || '—'}</ExpandableText>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginTop: 8, marginBottom: 0, paddingHorizontal: 0 }}>
                {previewTabs.map((tab) => {
                  const getTabIcon = (t: string) => {

                    switch(t) {
                      case 'Lyrics': return 'document-text-outline';
                      case 'Conductor': return 'musical-notes-outline';
                      case 'Solfa': return 'musical-note-outline';
                      case 'History': return 'time-outline';
                      case 'Comments': return 'chatbubbles-outline';
                      case 'Details': return 'information-circle-outline';
                      default: return 'ellipse-outline';
                    }
                  };
                  const isActive = activePreviewTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={{ alignItems: 'center', opacity: isActive ? 1 : 0.6 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        setActivePreviewTab(tab);
                      }}
                    >
                      <Ionicons name={getTabIcon(tab)} size={22} color={isActive ? theme.colors.accent : 'rgba(255,255,255,0.7)'} />
                      <Text style={{ color: isActive ? theme.colors.accent : 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={{ alignItems: 'center', opacity: 0.8 }}
                  activeOpacity={0.8}
                  onPress={() => setShowMoreAssetsModal(true)}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color="rgba(255,255,255,0.7)" />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                    More
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={[styles.infoRow, { justifyContent: 'flex-end', marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={{ marginRight: 16 }} onPress={toggleFavorite}>
                  <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={26} color={isFavorite ? theme.colors.accent : theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.cardBackgroundLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                  onPress={() => {
                    setShowPlaylistModal(true);
                  }}>
                  <Ionicons name="albums-outline" size={18} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          {activePreviewTab === 'Lyrics' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Lyrics preview</Text>
                {activeTrack.lyrics ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.lyrics) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No lyrics available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Lyrics', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Conductor' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Conductor preview</Text>
                {activeTrack.conductorGuide ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.conductorGuide) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No conductor guide provided.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Conductor', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Solfa' && (!fromAllSongs || isHQ) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Solfa preview</Text>
                {activeTrack.solfa ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.solfa) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No solfa notation available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Solfa', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'History' && (!fromAllSongs || isHQ) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>History preview</Text>
                {activeTrack.history ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: parseMarkdown(activeTrack.history) }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No history available.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('History', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Comments' && !fromAllSongs && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Comments preview</Text>
                {activeTrack.comments ? (
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 170, minHeight: 80 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <RenderHtml
                      contentWidth={width - 100}
                      source={{ html: getParsedCommentsHtml() }}
                      baseStyle={{ ...theme.typography.htmlBase }}
                      tagsStyles={{
                        p: { margin: 0, padding: 0 },
                        strong: { color: theme.colors.accent, fontWeight: '800' },
                        b: { color: theme.colors.accent, fontWeight: '800' }
                      }}
                    />
                  </ScrollView>
                ) : (
                  <View style={{ minHeight: 80, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No comments from directors.</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Comments', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {activePreviewTab === 'Details' && !fromAllSongs && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28, paddingHorizontal: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Song Details</Text>
                <View style={{ maxHeight: 80, overflow: 'hidden' }}>
                  <ExpandableText style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Lead: </Text>{activeTrack.leadSinger || 'Unknown'}
                  </ExpandableText>
                  <ExpandableText style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.accent }}>Album: </Text>{activeTrack.program || 'Unknown'}
                  </ExpandableText>
                </View>
              </View>
              <TouchableOpacity
                style={{ padding: 14, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 24, marginLeft: 16 }}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('Details', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                <Ionicons name="expand" size={22} color={theme.colors.accent} />
              </TouchableOpacity>
            </View>
          )}
          <View style={{ marginTop: 'auto', marginBottom: 10 }}>
            <PlayerProgressSlider
              theme={theme}
              styles={styles}
              formatTime={formatTime}
              seekTo={seekTo}
              hasAudio={!!activeTrack?.audioUrl}
            />
            <View style={styles.controlsRow}>
              <TouchableOpacity onPress={() => {
                toggleShuffle();
              }}>
                <Ionicons name="shuffle" size={24} color={isShuffle ? theme.colors.accent : theme.colors.textPrimary} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={async () => {
                await skipToPrevious();
              }}>
                <Ionicons name="play-skip-back" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={async () => {
                const position = await TrackPlayer.getPosition().catch(() => 0);
                seekTo(Math.max(0, (position - 10) * 1000));
              }}>
                <Ionicons name="play-back" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={handlePlayPause}
                activeOpacity={0.8}>
                
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.backgroundDark} />
                ) : (
                  <Ionicons name={!activeTrack?.audioUrl ? "alert-circle" : isPlaying ? "pause" : "play"} size={28} color={theme.colors.backgroundDark} style={{ marginLeft: isPlaying || !activeTrack?.audioUrl ? 0 : 3 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={async () => {
                const position = await TrackPlayer.getPosition().catch(() => 0);
                const duration = await TrackPlayer.getDuration().catch(() => 0);
                seekTo(Math.min(duration * 1000, (position + 10) * 1000));
              }}>
                <Ionicons name="play-forward" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={async () => {
                await skipToNext();
              }}>
                <Ionicons name="play-skip-forward" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => {
                toggleRepeat();
              }}>
                <View>
                  <Ionicons name="repeat" size={24} color={repeatMode !== 'off' ? theme.colors.accent : theme.colors.textSecondary} />
                  {repeatMode === 'track' && (
                    <Text style={{ position: 'absolute', color: theme.colors.accent, fontSize: 10, fontWeight: 'bold', top: 8, left: 10 }}>1</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </ScrollView>
        
        {AnnotationLayer}

        {isPrivileged && (
          <View style={{ position: 'absolute', bottom: 110, right: 20, flexDirection: 'row', alignItems: 'flex-end', zIndex: 101, gap: 12 }} pointerEvents="box-none">
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
        </View>
        <View style={[styles.playerTabBar, { paddingBottom: Platform.OS === 'android' ? Math.max(10, insets.bottom - 16) : Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.playerTabButton} onPress={() => { /* haptics removed */ setShowScheduleSheet(true); }}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={() => { /* haptics removed */ setShowAudioPartsModal(true); }}>
            <Ionicons name="musical-notes-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Parts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playerTabButton} onPress={() => { navigation.navigate('Karaoke', { activeTrack }); }}>
            <Ionicons name="mic-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.playerTabLabel}>Practice Mode</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowOptionsModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setTimeout(() => setShowShareSheet(true), 300);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Forward to Chat</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

             <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowOptionsModal(false);
              setTimeout(() => setShowPlaylistModal(true), 300);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="list-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Add to Playlist</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </View>
        </BlurView>
      </Modal>
      <Modal visible={showMoreAssetsModal} transparent animationType="fade" onRequestClose={() => setShowMoreAssetsModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowMoreAssetsModal(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Song Resources</Text>
              <TouchableOpacity onPress={() => setShowMoreAssetsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {(!fromAllSongs || isHQ) && (
              <>
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMoreAssetsModal(false);
                  navigation.navigate('History', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                  <View style={styles.optionIconBox}>
                    <Ionicons name="time-outline" size={22} color={theme.colors.textPrimary} />
                  </View>
                  <Text style={styles.optionItemText}>Song History</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  setShowMoreAssetsModal(false);
                  navigation.navigate('Solfa', { activeTrack, backgroundColor: "#8b5cf6" });
                }}>
                  <View style={styles.optionIconBox}>
                    <Ionicons name="musical-note-outline" size={22} color={theme.colors.textPrimary} />
                  </View>
                  <Text style={styles.optionItemText}>Solfa Notation</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 24 }} />
          </View>
        </BlurView>
      </Modal>
      <Modal visible={showPlaylistModal} transparent animationType="slide" onRequestClose={() => setShowPlaylistModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowPlaylistModal(false)} />
          <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Save to Playlist</Text>
              <TouchableOpacity onPress={() => setShowPlaylistModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.newPlaylistRow}>
              <TextInput
                style={styles.playlistInput}
                placeholder="New Playlist Name"
                placeholderTextColor={theme.colors.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity
                style={[styles.createPlaylistBtn, !newPlaylistName.trim() && { opacity: 0.5 }]}
                disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                onPress={handleCreatePlaylist}
              >
                {isCreatingPlaylist ? (
                  <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                ) : (
                  <Text style={styles.createPlaylistBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {playlists.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 }}>No playlists yet.</Text>
              ) : (
                playlists.map(pl => {
                  const inPlaylist = pl.songs?.includes(String(activeTrack.id));
                  return (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.playlistItem}
                      onPress={() => handleAddToPlaylist(pl.id)}
                    >
                      <View style={styles.playlistIconBox}>
                        <Ionicons name="musical-notes-outline" size={24} color={theme.colors.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playlistItemName}>{pl.name}</Text>
                        <Text style={styles.playlistItemCount}>{(pl.songs || []).length} songs</Text>
                      </View>
                      {inPlaylist && <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showAudioPartsModal} transparent animationType="slide" onRequestClose={() => setShowAudioPartsModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowAudioPartsModal(false)} />
          <View style={[styles.bottomSheet, { maxHeight: '70%' }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Audio Part</Text>
              <TouchableOpacity onPress={() => setShowAudioPartsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={styles.playlistItem}
                onPress={() => {
                  play(activeTrack);
                  setShowAudioPartsModal(false);
                }}
              >
                <View style={styles.playlistIconBox}>
                  <Ionicons name="musical-notes" size={24} color={theme.colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playlistItemName}>Main Track</Text>
                  <Text style={styles.playlistItemCount}>Full recording</Text>
                </View>
                {currentTrack?.url === activeTrack.audioUrl && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
              {activeTrack.audioUrls && Object.entries(activeTrack.audioUrls).map(([partName, url]) => {
                if (!url || typeof url !== 'string' || partName.toLowerCase() === 'full') return null;
                const isSelected = currentTrack?.url === url;
                
                return (
                  <TouchableOpacity
                    key={partName}
                    style={styles.playlistItem}
                    onPress={() => {
                      play({ ...activeTrack, audioUrl: url });
                      setShowAudioPartsModal(false);
                    }}
                  >
                    <View style={styles.playlistIconBox}>
                      <Ionicons name="mic-outline" size={24} color={theme.colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playlistItemName}>{partName.charAt(0).toUpperCase() + partName.slice(1)}</Text>
                      <Text style={styles.playlistItemCount}>Isolated part</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {(!activeTrack.audioUrls || Object.keys(activeTrack.audioUrls).filter(k => k.toLowerCase() !== 'full').length === 0) && (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 24, fontSize: 13, fontWeight: '500' }}>
                  No isolated parts available for this song.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ShareToChatSheet
        visible={showShareSheet}
        song={activeTrack ? {
          ...activeTrack,
          id: activeTrack.id,
          title: activeTrack?.title || 'Untitled',
        } : null}
        onClose={() => setShowShareSheet(false)}
      />
      <SongScheduleSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
      />
      {NotesModal}

    </View>);

}

const getStyles = (theme: any, insets: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  headerBtn: {
    padding: 4
  },
  headerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  artContainer: {
    width: '100%',
    aspectRatio: SCREEN_WIDTH >= 768 ? 1.8 : 1.10,
    maxHeight: SCREEN_WIDTH >= 768 ? 450 : undefined,
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
    backgroundColor: theme.colors.backgroundDark
  },
  overlayContent: {
    flex: 1,
    padding: 24,
    paddingTop: 95,
    justifyContent: 'flex-end'
  },
  tableContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 6
  },
  tableRowFull: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    marginBottom: 0
  },
  tableRowSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 6,
    marginBottom: 0
  },
  tableCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tableLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6
  },
  tableValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.5
  },
  artist: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: '600'
  },
  progressContainer: {
    marginBottom: 18
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8
  },
  timeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 22
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  playerTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    paddingTop: 8,
    paddingBottom: 4
  },
  playerTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4
  },
  playerTabLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  lyricsCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginBottom: 24
  },
  lyricsCardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  lyricsCardText: {
    ...theme.typography.bodyText,
    marginBottom: 32
  },
  showLyricsBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24
  },
  showLyricsBtnText: {
    color: theme.colors.backgroundDark,
    fontSize: 14,
    fontWeight: '800'
  },
  previewTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  previewTabActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  previewTabText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  previewTabTextActive: {
    color: theme.colors.backgroundDark,
    fontWeight: '800'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  bottomSheet: {
    backgroundColor: theme.colors.bottomSheetBackground,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Math.max(Platform.OS === 'android' ? 36 : 24, insets.bottom + (Platform.OS === 'android' ? 32 : 16)),
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  bottomSheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  },
  closeModalBtn: {
    padding: 6,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  optionItemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  playlistInput: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  createPlaylistBtn: {
    height: 50,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createPlaylistBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  playlistIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  playlistItemName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  playlistItemCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  }
});
};
