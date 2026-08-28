import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Animated, Dimensions, Platform, ScrollView, ActivityIndicator,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { isHQGroup } from '../config/zones';
import { useZone } from '../hooks/useZone';
import { useUserStore } from '../hooks/useUser';
import { optimizeAudio } from '../lib/mediaUtils';
import { apiClient } from '../lib/apiClient';
import { useTrackPlayer } from '../hooks/useTrackPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getTrackImage = (track: any, index: number) => {
  if (track.image) {
    if (typeof track.image === 'number') return track.image;
    if (typeof track.image === 'string' && track.image.startsWith('http')) return { uri: track.image };
  }
  if (track.imageUrl) return { uri: track.imageUrl };
  
  return require('../../assets/image/song_art.webp');
};

let cachedSearchSongs: any[] | null = null;

export default function SearchScreen({ navigation }: any) {
  const { theme, themeName } = useTheme();
  const styles = getStyles(theme);
  const s = styles;

  const [searchQuery, setSearchQuery] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState<any[]>([]);

  const { currentTrack, play } = useTrackPlayer();
  const { currentZone: contextZone, zoneVersion, isLoading: isZoneLoading } = useZone();
  const user = useUserStore(s => s.user);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);

    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true
    }).start();

    isMountedRef.current = true;

    cachedSearchSongs = null;
    loadData();

    return () => {
      isMountedRef.current = false;
    };
  }, [contextZone?.id, zoneVersion, isZoneLoading, isProfileLoading, user?.uid]);

  const loadData = async (force = false) => {
    if (isFetchingRef.current || isRefreshing) return;
    isFetchingRef.current = true;
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setHasError(false);

    const resolvedZoneId = contextZone?.id || 'zone-001';

    if (!force && cachedSearchSongs) {
      setSongs(cachedSearchSongs);
      setIsLoading(false);
      isFetchingRef.current = false;
      return;
    }

    if (!force && !cachedSearchSongs) {
      try {
        const stored = await AsyncStorage.getItem(`SEARCH_SONGS_CACHE_${resolvedZoneId}`);
        if (stored && isMountedRef.current) {
          cachedSearchSongs = JSON.parse(stored);
          setSongs(cachedSearchSongs!);
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Error reading search cache:", e);
      }
    }

    try {
      const isHQ = isHQGroup(resolvedZoneId);

      const [songsResult, zoneSongsResult, subgroupResult] = await Promise.all([
        apiClient.get<any>('/songs/master'),
        !isHQ ? apiClient.get<any>(`/songs/zone?zoneId=${encodeURIComponent(resolvedZoneId)}`).catch(() => null) : Promise.resolve(null),
        apiClient.get<any>(`/songs/subgroup?zoneId=${encodeURIComponent(resolvedZoneId)}`).catch(() => null),
      ]);
      
      if (!isMountedRef.current) return;

      if (!songsResult || songsResult.success === false) {
        throw new Error('API fetch failed');
      }

      const mainSongs = Array.isArray(songsResult) ? songsResult : (songsResult?.success ? songsResult.data : []);
      const zoneSongs = Array.isArray(zoneSongsResult) ? zoneSongsResult : (zoneSongsResult?.success ? zoneSongsResult.data : []);
      const subSongs = Array.isArray(subgroupResult) ? subgroupResult : (subgroupResult?.success ? subgroupResult.data : []);

      const cachedRehearsalSongs: any[] = [];
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const rehearsalKeys = allKeys.filter(k => k.startsWith('rehearsal_songs_'));
        if (rehearsalKeys.length > 0) {
          const rehearsalCaches = await AsyncStorage.multiGet(rehearsalKeys);
          rehearsalCaches.forEach(([key, value]) => {
            if (value) {
              try {
                const parsed = JSON.parse(value);
                if (parsed && Array.isArray(parsed.songs)) {
                  cachedRehearsalSongs.push(...parsed.songs);
                }
              } catch (e) { }
            }
          });
        }
      } catch (err) {
        console.warn('Failed to read rehearsal cache in SearchScreen', err);
      }

      const allSongsMap = new Map();
      [...mainSongs, ...zoneSongs, ...subSongs, ...cachedRehearsalSongs].forEach(s => {
        if (s.id) allSongsMap.set(s.id, s);
      });
      const rawSongs = Array.from(allSongsMap.values());
      
      const mappedSongs = rawSongs
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
          rehearsalCount: song.rehearsalCount || 0,
          conductorGuide: song.solfas || song.conductorGuide || song.guide || '',
          history: song.history || '',
          comments: song.comments || '',
          leadKeyboardist: song.leadKeyboardist || '',
          drummer: song.drummer || '',
          leadGuitarist: song.leadGuitarist || '',
          createdAt: song.createdAt ? typeof song.createdAt === 'string' ? song.createdAt : new Date().toISOString() : new Date().toISOString(),
          image: getTrackImage(song, index),
          zoneId: resolvedZoneId,
          collectionName: song.subGroupId ? 'subgroup_songs' : (isHQ ? 'praise_night_songs' : 'zone_songs')
        };
      });

      setSongs(mappedSongs);
      cachedSearchSongs = mappedSongs;
      AsyncStorage.setItem(`SEARCH_SONGS_CACHE_${resolvedZoneId}`, JSON.stringify(mappedSongs)).catch(() => {});
    } catch (err) {
      console.error('Error fetching search songs:', err);
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

  const clearSearch = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const openTrack = (track: any) => {
    if (!currentTrack || String(currentTrack.id) !== String(track.id)) {
      play(track, filteredSongs, false);
    }
    navigation.navigate('Player', { activeTrack: track, fromAllSongs: true, zoneId: track.zoneId, queue: filteredSongs });
  };

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredSongs = songs.filter(t => {
    if (!debouncedQuery.trim()) return false;
    const q = debouncedQuery.toLowerCase();
    return t.title?.toLowerCase().includes(q) || t.leadSinger?.toLowerCase().includes(q) || t.program?.toLowerCase().includes(q);
  }).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={themeName === 'light'
          ? [theme.colors.background, theme.colors.backgroundSecondary]
          : [theme.colors.background, '#0a192f']}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.searchBarWrapper}>
            <BlurView intensity={40} tint="light" style={styles.searchBarBlur}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  ref={inputRef}
                  placeholder="Songs, archives or rehearsals..."
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  style={styles.searchInput}
                  selectionColor={theme.colors.textPrimary}
                  value={searchQuery}
                  onChangeText={setSearchQuery} />
                
                {searchQuery.length > 0 &&
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                }
              </View>
            </BlurView>
          </View>
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.resultsArea}>
          {isLoading && !isRefreshing ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : hasError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={60} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>Failed to load songs</Text>
              <Text style={styles.emptySubText}>
                Please check your internet connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => loadData(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : searchQuery.length === 0 ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.emptyState}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadData(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            >
              <Ionicons name="search-outline" size={60} color={theme.colors.textDisabled} />
              <Text style={styles.emptyText}>Find your rehearsal material</Text>
              <Text style={styles.emptySubText}>Search for songs, lyrics, or recorded sessions</Text>
            </ScrollView>
          ) : isSearching ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.emptySubText, { marginTop: 16 }]}>Searching...</Text>
            </View>
          ) : filteredSongs.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.trackList}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadData(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            >
              {filteredSongs.map((track, index) => {
                const isActiveTrack = currentTrack && String(currentTrack.id) === String(track.id);
                const hasAudio = !!track.audioUrl;
                return (
                  <TouchableOpacity
                    key={track.id}
                    style={styles.trackRow}
                    activeOpacity={0.7}
                    onPress={() => openTrack(track)}
                  >
                    <View style={{ position: 'relative' }}>
                      <Image source={track.image} style={styles.trackArt} contentFit="cover" />
                      {!hasAudio && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="volume-mute" size={18} color="rgba(255,255,255,0.8)" />
                        </View>
                      )}
                    </View>
                    <View style={styles.trackInfo}>
                      <Text style={[styles.trackTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.title}</Text>
                      <View style={styles.trackMeta}>
                        {!hasAudio ? (
                          <>
                            <Ionicons name="volume-mute-outline" size={11} color="#fb923c" style={{ marginRight: 4 }} />
                            <Text style={[styles.trackMetaText, { color: '#fb923c' }]} numberOfLines={1}>No audio yet</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="person" size={11} color={isActiveTrack ? theme.colors.accent : theme.colors.accent} style={{ marginRight: 4 }} />
                            <Text style={[styles.trackMetaText, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.leadSinger}</Text>
                          </>
                        )}
                        <Text style={[styles.trackMetaDot, isActiveTrack && { color: theme.colors.accent }]}>·</Text>
                        <Text style={[styles.trackMetaText, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.program}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.emptyState}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadData(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            >
              <Text style={styles.noResultsText}>No results for "{searchQuery}"</Text>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, zIndex: 10 },
  searchBarWrapper: { flex: 1, height: 44, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.inputBorder },
  searchBarBlur: { flex: 1, backgroundColor: theme.colors.inputBackground },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: theme.colors.inputText, fontSize: 16, fontWeight: '500' },
  clearButton: { padding: 4 },
  cancelButton: { marginLeft: 12, paddingVertical: 8 },
  cancelText: { color: theme.colors.accent, fontSize: 17, fontWeight: '500' },
  resultsArea: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 100 },
  emptyText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 20 },
  emptySubText: { color: theme.colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  noResultsText: { color: theme.colors.textMuted, fontSize: 16, fontWeight: '500' },

  trackList: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.bottomTabBorder },
  trackArt: { width: 46, height: 46, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1, justifyContent: 'center', paddingRight: 10 },
  trackTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  trackMeta: { flexDirection: 'row', alignItems: 'center' },
  trackMetaText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '500' },
  trackMetaDot: { color: theme.colors.textMuted, fontSize: 12, marginHorizontal: 5 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retryBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
};
