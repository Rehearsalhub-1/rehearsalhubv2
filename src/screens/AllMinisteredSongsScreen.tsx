import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Dimensions, TextInput, Modal, Pressable, ActivityIndicator,
  FlatList, Platform, RefreshControl, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '../components/DoodleBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { isHQGroup } from '../config/zones';
import { useUserStore } from '../hooks/useUser';
import { getHiddenFeatures } from '../config/roles';
import { useZone } from '../hooks/useZone';
import { optimizeAudio } from '../lib/mediaUtils';
import { apiClient } from '../lib/apiClient';
import { useTrackPlayer, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import { ShareToChatSheet } from '../components/ShareToChatSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


const getTrackImage = (track: any, index: number) => {
  if (track.image && typeof track.image === 'string' && track.image.startsWith('http')) return track.image;
  if (track.imageUrl) return track.imageUrl;
  if (track.image && typeof track.image !== 'string') return track.image; // Local require
  return require('../../assets/image/song_art.webp');
};

const getRehearsalCount = (song: any): number => {
  const raw = song?.rawData || song?.raw_data || song?.metadata || {};
  const value = song?.rehearsalCount ?? song?.rehearsal_count ?? raw.rehearsalCount ?? raw.rehearsal_count ?? raw.metadata?.rehearsalCount;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

let cachedSongs: any[] | null = null;
let cachedSingers: string[] | null = null;
let cachedPrograms: any[] | null = null;
let cachedCategories: string[] | null = null;

const MiniPlayerProgressBar = ({ theme }: any) => {
  const { position, duration } = useTrackPlayerProgress(250);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: theme.colors.divider }}>
      <View style={{
        height: '100%',
        width: duration > 0 ? `${Math.min(100, (position / duration) * 100)}%` : '0%',
        backgroundColor: theme.colors.accent,
      }} />
    </View>
  );
};

export default function AllMinisteredSongsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [songs, setSongs] = useState<any[]>([]);
  const [singers, setSingers] = useState<string[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const { currentTrack: activeTrack, isPlaying, play, togglePlayback } = useTrackPlayer();
  const { currentZone, isLoading: isZoneLoading, zoneVersion } = useZone();
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  const hf = getHiddenFeatures(profile);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterTab, setFilterTab] = useState<'singer' | 'program'>('singer');
  const [selectedSinger, setSelectedSinger] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedOptionsTrack, setSelectedOptionsTrack] = useState<any>(null);
  const [showTrackOptions, setShowTrackOptions] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTrack, setShareTrack] = useState<any>(null);
  const [shareTracks, setShareTracks] = useState<any[] | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [tracksForOptions, setTracksForOptions] = useState<any[]>([]);

  const PAGE_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedSinger, selectedProgramId, searchQuery]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = React.useRef(true);

  const loadData = async (force = false) => {
    if (isFetchingRef.current || isRefreshing) return;
    isFetchingRef.current = true;
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setHasError(false);

    const resolvedZoneId = currentZone?.id || 'zone-001';

    if (!force && cachedSongs && cachedPrograms) {
      setSongs(cachedSongs);
      setSingers(cachedSingers || []);
      setPrograms(cachedPrograms);
      setCategories(cachedCategories || []);
      setIsLoading(false);
      isFetchingRef.current = false;
      return;
    }

    if (!force && !cachedSongs) {
      try {
        const [storedSongs, storedPrograms, storedSingers, storedCategories] = await Promise.all([
          AsyncStorage.getItem(`MINISTERED_SONGS_CACHE_${resolvedZoneId}`),
          AsyncStorage.getItem(`MINISTERED_PROGRAMS_CACHE_${resolvedZoneId}`),
          AsyncStorage.getItem(`MINISTERED_SINGERS_CACHE_${resolvedZoneId}`),
          AsyncStorage.getItem(`MINISTERED_CATEGORIES_CACHE_${resolvedZoneId}`)
        ]);
        if (storedSongs && storedPrograms && isMountedRef.current) {
          cachedSongs = storedSongs ? JSON.parse(storedSongs) : [];
          cachedPrograms = storedPrograms ? JSON.parse(storedPrograms) : [];
          cachedSingers = storedSingers ? JSON.parse(storedSingers) : [];
          cachedCategories = storedCategories ? JSON.parse(storedCategories) : [];
          
          setSongs(cachedSongs || []);
          setPrograms(cachedPrograms || []);
          setSingers(cachedSingers || []);
          setCategories(cachedCategories || []);
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Error reading ministered songs cache:", e);
      }
    }

    try {
      const isHQ = isHQGroup(resolvedZoneId);

      const [songsResult, programsResult] = await Promise.all([
        apiClient.get<any>('/songs/master'),
        apiClient.get<any>('/programs')
      ]);
      
      if (!isMountedRef.current) return;

      const songsFailed = !songsResult || songsResult.success === false;
      const programsFailed = !programsResult || programsResult.success === false;

      if (songsFailed) {
        throw new Error('Songs fetch failed');
      }
      
      const rawSongs = Array.isArray(songsResult) ? songsResult : (songsResult?.success ? (songsResult.data || []) : []);
      const fetchedPrograms = Array.isArray(programsResult) ? programsResult : (programsResult?.success ? (programsResult.data || []) : []);

      const getProgramTime = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val._seconds) return val._seconds * 1000;
        if (val.seconds) return val.seconds * 1000;
        const d = new Date(val).getTime();
        return isNaN(d) ? 0 : d;
      };
      const sortedPrograms = [...fetchedPrograms].sort((a: any, b: any) => {
        const timeA = getProgramTime(a.createdAt || a.timestamp || a.date);
        const timeB = getProgramTime(b.createdAt || b.timestamp || b.date);
        return timeB - timeA;
      }).map(p => {
        const time = getProgramTime(p.createdAt || p.timestamp || p.date);
        if (time > 0) {
           const d = new Date(time);
           p.dateLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        return p;
      });
      
      const mappedSongs = (rawSongs || [])
        .filter((song: any) => isHQ || !song.isHQOnly)
        .map((song: any, index: number) => {
        const songAudioUrl = optimizeAudio(song.audioFile || song.audioUrls?.full || '');
        return {
          id: song.id || `song-${index}`,
          title: song.title || 'Untitled Song',
          subtitle: song.leadSinger || song.writer || 'Loveworld Singers',
          program: song.praiseNightId || song.program || 'Loveworld Singers',
          leadSinger: song.leadSinger || 'Unknown',
          writer: song.writer || 'Unknown',
          conductor: song.conductor || 'Evang. Kathy',
          key: song.key || 'C Major',
          tempo: song.tempo || '70 BPM',
          category: song.category || 'Praise Night',
          categories: song.categories || [song.category || 'Praise Night'],
          audioUrl: songAudioUrl,
          lyrics: song.lyrics || '',
          solfa: song.notation || song.solfas || song.solfa || '',
          audioUrls: song.audioUrls || {},
          status: song.status || 'unheard',
          isActive: song.isActive !== false,
          rehearsalCount: getRehearsalCount(song),
          conductorGuide: song.solfas || song.conductorGuide || song.guide || '',
          history: song.history || '',
          comments: song.comments || '',
          leadKeyboardist: song.leadKeyboardist || '',
          drummer: song.drummer || '',
          leadGuitarist: song.leadGuitarist || '',
          createdAt: song.createdAt ? typeof song.createdAt === 'string' ? song.createdAt : new Date().toISOString() : new Date().toISOString(),
          imageUrl: song.imageUrl || '',
          image: getTrackImage(song, index),
          zoneId: resolvedZoneId,
          collectionName: isHQ ? 'praise_night_songs' : 'zone_songs'
        };
      });

      setSongs(mappedSongs);
      setSingers([...new Set(mappedSongs.map((s: any) => s.leadSinger as string).filter(Boolean))].sort() as string[]);
      setPrograms(sortedPrograms);
      setCategories([...new Set(mappedSongs.map((s: any) => s.category as string).filter(Boolean))].sort() as string[]);
      setIsLoading(false);

      cachedSongs = mappedSongs;
      cachedSingers = [...new Set(mappedSongs.map((s: any) => s.leadSinger as string).filter(Boolean))].sort() as string[];
      cachedPrograms = sortedPrograms;
      cachedCategories = [...new Set(mappedSongs.map((s: any) => s.category as string).filter(Boolean))].sort() as string[];

      Promise.all([
        AsyncStorage.setItem(`MINISTERED_SONGS_CACHE_${resolvedZoneId}`, JSON.stringify(mappedSongs)),
        AsyncStorage.setItem(`MINISTERED_PROGRAMS_CACHE_${resolvedZoneId}`, JSON.stringify(sortedPrograms)),
        AsyncStorage.setItem(`MINISTERED_SINGERS_CACHE_${resolvedZoneId}`, JSON.stringify(cachedSingers)),
        AsyncStorage.setItem(`MINISTERED_CATEGORIES_CACHE_${resolvedZoneId}`, JSON.stringify(cachedCategories))
      ]).catch(() => {});

    } catch (err) {
      console.error('Error fetching ministered songs:', err);
      if (isMountedRef.current) {
        setHasError(true);
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const handleBatchImport = async () => {
    if (selectedTracks.size === 0) return;
    const songIds = Array.from(selectedTracks);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>('/songs/import-from-ministered', { songIds });
      if (res?.success) {
        Alert.alert('Imported', res.message || `${songIds.length} song(s) imported to repertoire.`);
        setIsSelectionMode(false);
        setSelectedTracks(new Set());
      } else {
        Alert.alert('Notice', 'Could not import selected songs.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to import songs.');
    }
  };

  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    isMountedRef.current = true;
    cachedSongs = null; // Invalidate on zone change
    cachedPrograms = null;
    cachedSingers = null;
    cachedCategories = null;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, [currentZone?.id, zoneVersion, isZoneLoading, isProfileLoading, user?.uid]);

  const filteredTracks = (songs || []).filter(t => {
    if (!t) return false;
    if (selectedSinger && t.leadSinger !== selectedSinger) return false;
    if (selectedProgramId) {
      const selectedProgramObj = (programs || []).find((p: any) => p?.id === selectedProgramId);
      if (selectedProgramObj && !selectedProgramObj.songIds?.includes(t.id)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (t.title?.toLowerCase() || '').includes(q) || 
             (t.leadSinger?.toLowerCase() || '').includes(q) || 
             (t.program?.toLowerCase() || '').includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (!a || !b) return 0;
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return sortAsc ? timeB - timeA : timeA - timeB;
  });

  const displayedTracks = filteredTracks.slice(0, visibleCount);

  const hasFilter = !!(selectedSinger || selectedProgramId);

  const openTrack = (track: any, overrideQueue?: any[]) => {
    if (isSelectionMode) {
      toggleSelection(track.id);
      return;
    }
    const q = overrideQueue || filteredTracks;
    if (!activeTrack || String(activeTrack.id) !== String(track.id)) {
      play(track, q, false);
    }
    navigation.navigate('Player', { activeTrack: track, fromAllSongs: true, zoneId: track.zoneId, queue: q });
  };

  const toggleSelection = (trackId: string) => {
    const newSet = new Set(selectedTracks);
    if (newSet.has(trackId)) {
      newSet.delete(trackId);
      if (newSet.size === 0) setIsSelectionMode(false);
    } else {
      newSet.add(trackId);
    }
    setSelectedTracks(newSet);
  };

  return (
    <View style={s.root}>
      {!isProfileLoading && hf.hideMinisteredSongs && (
        <>
          <StatusBar style="light" />
          <LinearGradient
            colors={theme.gradients.bgBase}
            locations={theme.gradients.bgBaseLocations}
            style={StyleSheet.absoluteFill} />
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
            <Ionicons name="lock-closed" size={80} color={theme.colors.accent} style={{ marginBottom: 24 }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>Access Restricted</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
              The Ministered Songs library is not available for your account.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: theme.colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 }}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </>
      )}
      {(isProfileLoading || !hf.hideMinisteredSongs) && (
      <View style={s.root}>
      <StatusBar style="light" />
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
        <View style={s.header}>
          <TouchableOpacity onPress={() => { navigation.goBack(); }} style={s.backBtn}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>All Ministered Songs</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={displayedTracks}
          keyExtractor={track => track.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadData(true)}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ListHeaderComponent={
            <>
          <View style={s.heroBanner}>
            <Image source={require('../../assets/image/home1.jpg')} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.heroContent}>
              <View style={s.heroLogoRow}>
                <Image source={require('../../assets/logo/logo.png')} style={s.heroLogo} contentFit="contain" />
              </View>
              <Text style={s.heroTitle}>Ministered Songs</Text>
              <Text style={s.heroSub}>Complete repertoire archive</Text>
              <View style={s.heroStats}>
                <View style={s.statItem}>
                  <Text style={s.statNum}>{(songs || []).length}</Text>
                  <Text style={s.statLbl}>Songs</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statNum}>{(singers || []).length}</Text>
                  <Text style={s.statLbl}>Soloists</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statNum}>{(categories || []).length}</Text>
                  <Text style={s.statLbl}>Categories</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <Ionicons name="search" size={17} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search songs, singers, programs…"
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); }}>
                  <Ionicons name="close-circle" size={17} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[s.filterBtn, hasFilter && s.filterBtnActive]}
              onPress={() => { setShowFilterModal(true); }}
            >
              <Ionicons name="options-outline" size={18} color={hasFilter ? theme.colors.textPrimary : theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={s.actionRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={s.countText}>{filteredTracks.length} songs</Text>
              {hasFilter && (
                <TouchableOpacity
                  style={s.clearBadge}
                  onPress={() => { setSelectedSinger(null); setSelectedProgramId(null); }}
                >
                  <Text style={s.clearBadgeText}>Clear</Text>
                  <Ionicons name="close" size={12} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) {
                    setSelectedTracks(new Set());
                  }
                }}
                style={[s.sortBtn, isSelectionMode && { backgroundColor: 'rgba(192, 132, 252, 0.15)', borderColor: theme.colors.accent, borderWidth: 1 }]}
              >
                <Ionicons name={isSelectionMode ? "close-circle-outline" : "checkmark-circle-outline"} size={14} color={isSelectionMode ? theme.colors.accent : theme.colors.textMuted} />
                <Text style={[s.sortText, isSelectionMode && { color: theme.colors.accent }]}>{isSelectionMode ? 'Cancel' : 'Select'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSortAsc(p => !p); }}
                style={s.sortBtn}
              >
                <Ionicons name={sortAsc ? 'time-outline' : 'time'} size={14} color={theme.colors.textMuted} />
                <Text style={s.sortText}>{sortAsc ? 'Newest' : 'Oldest'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              {isLoading ? (
                <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginBottom: 12 }} />
              ) : hasError ? (
                <>
                  <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={s.emptyText}>Failed to load songs</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 16, textAlign: 'center', paddingHorizontal: 40 }}>
                    Please check your internet connection and try again.
                  </Text>
                  <TouchableOpacity
                    style={s.retryBtn}
                    onPress={() => loadData(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={s.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="musical-note-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={s.emptyText}>No songs found</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item: track, index }) => {
            const isActiveTrack = activeTrack && String(activeTrack.id) === String(track.id);
            const hasAudio = !!track.audioUrl;
            return (
              <TouchableOpacity
                key={track.id}
                style={[s.trackRow, selectedTracks.has(track.id) && { backgroundColor: 'rgba(192,132,252,0.12)' }]}
                activeOpacity={0.7}
                onPress={() => openTrack(track)}
                onLongPress={() => {
                  if (!isSelectionMode) setIsSelectionMode(true);
                  toggleSelection(track.id);
                }}
              >
                {isSelectionMode ? (
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <Ionicons name={selectedTracks.has(track.id) ? "checkmark-circle" : "ellipse-outline"} size={20} color={selectedTracks.has(track.id) ? theme.colors.accent : theme.colors.textMuted} />
                  </View>
                ) : isActiveTrack && isPlaying ? (
                  <View style={{ width: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2, height: 18 }}>
                    {[1, 0.6, 0.85].map((h, i) => (
                      <View key={i} style={{ width: 3, height: 18 * h, backgroundColor: theme.colors.accent, borderRadius: 2 }} />
                    ))}
                  </View>
                ) : (
                  <Text style={[s.trackIndex, isActiveTrack && { color: theme.colors.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
                )}
                <View style={{ position: 'relative' }}>
                  <Image source={track.image} style={s.trackArt} contentFit="cover" />
                  {!hasAudio && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="volume-mute" size={18} color="rgba(255,255,255,0.8)" />
                    </View>
                  )}
                </View>
                <View style={s.trackInfo}>
                  <Text style={[s.trackTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.title}</Text>
                  <View style={s.trackMeta}>
                    {!hasAudio ? (
                      <>
                        <Ionicons name="volume-mute-outline" size={11} color="#fb923c" style={{ marginRight: 4 }} />
                        <Text style={[s.trackMetaText, { color: '#fb923c' }]} numberOfLines={1}>No audio yet</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="person" size={11} color={isActiveTrack ? theme.colors.accent : theme.colors.accent} style={{ marginRight: 4 }} />
                        <Text style={[s.trackMetaText, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.leadSinger}</Text>
                      </>
                    )}
                    <Text style={[s.trackMetaDot, isActiveTrack && { color: theme.colors.accent }]}>·</Text>
                    <Text style={[s.trackMetaText, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.key}</Text>
                  </View>
                  <Text style={[s.trackProgram, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.program}</Text>
                </View>
                {!isSelectionMode && (
                  <TouchableOpacity
                    style={s.moreBtn}
                    onPress={e => {
                      e.stopPropagation();
                      setSelectedOptionsTrack(track);
                      setTracksForOptions([]);
                      setShowTrackOptions(true);
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            visibleCount < filteredTracks.length ? (
              <TouchableOpacity
                style={s.loadMoreBtn}
                activeOpacity={0.8}
                onPress={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              >
                <Text style={s.loadMoreBtnText}>Load More</Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <View style={{ height: 120 }} />
            )
          }
          />
        {isSelectionMode && (
          <View style={[s.miniPlayer, { backgroundColor: theme.colors.backgroundSecondary, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                {selectedTracks.size} Selected
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const allIds = filteredTracks.map(t => t.id);
                  setSelectedTracks(new Set(allIds));
                }}
                style={{
                  backgroundColor: 'rgba(192, 132, 252, 0.15)',
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTracks(new Set());
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>Reset</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={handleBatchImport} style={{ padding: 4 }}>
                <Ionicons name="download-outline" size={24} color={theme.colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                const tracks = Array.from(selectedTracks).map(id => songs.find(s => s.id === id)).filter(Boolean);
                setSelectedOptionsTrack(null);
                setTracksForOptions(tracks);
                setShowTrackOptions(true);
              }}>
                <Ionicons name="list-outline" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                const tracks = Array.from(selectedTracks).map(id => songs.find(s => s.id === id)).filter(Boolean);
                setShareTracks(tracks);
                setShowShareSheet(true);
              }}>
                <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedTracks(new Set()); }}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {!isSelectionMode && activeTrack && (
          <TouchableOpacity
            style={[s.miniPlayer, { backgroundColor: theme.colors.backgroundSecondary }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Player', { activeTrack, fromAllSongs: true, zoneId: activeTrack.zoneId, queue: filteredTracks })}
          >
            <MiniPlayerProgressBar theme={theme} />
            <Image source={activeTrack.image} style={s.miniArt} contentFit="cover" />
            <View style={s.miniInfo}>
              <Text style={s.miniTitle} numberOfLines={1}>{activeTrack.title}</Text>
              <Text style={s.miniSub} numberOfLines={1}>{activeTrack.leadSinger} · {activeTrack.program}</Text>
            </View>
            <View style={s.miniActions}>
              <TouchableOpacity style={s.miniBtn} onPress={e => { 
                e.stopPropagation(); 
                setShareTrack(activeTrack);
                setShowShareSheet(true);
              }}>
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.miniBtn} onPress={e => { e.stopPropagation(); togglePlayback(); }}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <BlurView intensity={60} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilterModal(false)} />
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filter Songs</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={s.modalTabs}>
              {(['singer', 'program'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[s.modalTab, filterTab === tab && s.modalTabActive]}
                  onPress={() => { setFilterTab(tab); }}
                >
                  <Ionicons
                    name={tab === 'singer' ? 'person-outline' : 'musical-notes-outline'}
                    size={15}
                    color={filterTab === tab ? theme.colors.textPrimary : theme.colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.modalTabText, filterTab === tab && s.modalTabTextActive]}>
                    {tab === 'singer' ? 'Lead Singer' : 'Program'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8, paddingBottom: 16 }}>
                {filterTab === 'singer' ? (
                  [null, ...singers].map(item => (
                    <TouchableOpacity
                      key={item || 'all'}
                      style={[s.filterOption, selectedSinger === item && s.filterOptionActive]}
                      onPress={() => { setSelectedSinger(item); }}
                    >
                      <Text style={[s.filterOptionText, selectedSinger === item && s.filterOptionTextActive]}>
                        {item || 'All Singers'}
                      </Text>
                      {selectedSinger === item && <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />}
                    </TouchableOpacity>
                  ))
                ) : (
                  [null, ...programs].map(item => (
                    <TouchableOpacity
                      key={item ? item.id : 'all'}
                      style={[s.filterOption, selectedProgramId === (item ? item.id : null) && s.filterOptionActive]}
                      onPress={() => { setSelectedProgramId(item ? item.id : null); }}
                    >
                      <Text style={[s.filterOptionText, selectedProgramId === (item ? item.id : null) && s.filterOptionTextActive]}>
                        {item ? item.name : 'All Programs'}
                      </Text>
                      {selectedProgramId === (item ? item.id : null) && <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => { setSelectedSinger(null); setSelectedProgramId(null); setShowFilterModal(false); }}
              >
                <Text style={s.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.applyBtn}
                onPress={() => { setShowFilterModal(false); }}
              >
                <Text style={s.applyBtnText}>Show {filteredTracks.length} songs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      <TrackOptionsModal 
        visible={showTrackOptions} 
        onClose={() => {
          setShowTrackOptions(false);
          setIsSelectionMode(false);
          setSelectedTracks(new Set());
        }} 
        track={selectedOptionsTrack} 
        tracks={tracksForOptions}
        onForwardToChat={() => {
          if (tracksForOptions && tracksForOptions.length > 0) {
            setShareTracks(tracksForOptions);
          } else {
            setShareTrack(selectedOptionsTrack);
          }
          setShowShareSheet(true);
        }}
      />
      <ShareToChatSheet
        visible={showShareSheet}
        song={shareTrack ? {
          ...shareTrack,
          id: shareTrack.id,
          title: shareTrack.title,
        } : null}
        songs={shareTracks}
        onClose={() => {
          setShowShareSheet(false);
          setShareTrack(null);
          setShareTracks(null);
        }}
      />
    </View>
      )}
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: T.background },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: T.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  heroBanner: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.52, position: 'relative', marginBottom: 4 },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  heroLogoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  heroLogo: { width: 22, height: 22, borderRadius: 11 },
  heroLogoText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  statItem: { alignItems: 'center', paddingHorizontal: 16 },
  statNum: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  statLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBackground, borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: T.inputBorder },
  searchInput: { flex: 1, color: T.inputText, fontSize: 14, fontWeight: '500' },
  filterBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.inputBackground, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.inputBorder },
  filterBtnActive: { backgroundColor: T.accent, borderColor: T.accent },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  countText: { color: T.textSecondary, fontSize: 14, fontWeight: '600' },
  clearBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  clearBadgeText: { color: T.textPrimary, fontSize: 12, fontWeight: '600' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.cardBackgroundLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  sortText: { color: T.textMuted, fontSize: 12, fontWeight: '700' },
  shuffleBtn: { padding: 4 },
  playAllBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.accent, justifyContent: 'center', alignItems: 'center', shadowColor: T.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },

  trackList: { paddingHorizontal: 16, gap: 0 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.divider },
  trackIndex: { color: T.textMuted, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center' },
  trackArt: { width: 46, height: 46, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1, justifyContent: 'center' },
  trackTitle: { color: T.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  trackMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  trackMetaText: { color: T.textMuted, fontSize: 12, fontWeight: '500' },
  trackMetaDot: { color: T.textMuted, fontSize: 12, marginHorizontal: 5 },
  trackProgram: { color: T.textMuted, fontSize: 11, fontWeight: '500' },
  moreBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: T.textMuted, fontSize: 15, fontWeight: '600' },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: T.cardBackgroundLight,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
    marginBottom: 120,
  },
  loadMoreBtnText: {
    color: T.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retryBtnText: {
    color: T.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  miniPlayer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.bottomTabBorder, shadowColor: T.background, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  miniArt: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  miniInfo: { flex: 1 },
  miniTitle: { color: T.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  miniSub: { color: T.textSecondary, fontSize: 12 },
  miniActions: { flexDirection: 'row', alignItems: 'center' },
  miniBtn: { marginLeft: 14 },

  modal: { backgroundColor: T.bottomSheetBackground, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, borderWidth: 1, borderColor: T.surfaceBorder },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.cardBackgroundLight, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { color: T.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { padding: 4, backgroundColor: T.cardBackgroundLight, borderRadius: 14 },
  modalTabs: { flexDirection: 'row', backgroundColor: T.inputBackground, borderRadius: 14, padding: 4, marginBottom: 16 },
  modalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  modalTabActive: { backgroundColor: T.accent },
  modalTabText: { color: T.textMuted, fontSize: 14, fontWeight: '600' },
  modalTabTextActive: { color: T.textPrimary, fontWeight: '700' },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.cardBackgroundLight, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: T.surfaceBorder },
  filterOptionActive: { backgroundColor: T.accentSubtle, borderColor: T.accent },
  filterOptionText: { color: T.textPrimary, fontSize: 15, fontWeight: '600' },
  filterOptionTextActive: { color: T.textPrimary, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 16 },
  resetBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: T.cardBackgroundLight, alignItems: 'center' },
  resetBtnText: { color: T.textPrimary, fontSize: 15, fontWeight: '600' },
  applyBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: T.accent, alignItems: 'center', shadowColor: T.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  applyBtnText: { color: T.textPrimary, fontSize: 15, fontWeight: '700' },
});
};
