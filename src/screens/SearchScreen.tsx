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
import { isHQAdmin } from '../config/roles';
import { useZone } from '../hooks/useZone';
import { useUserStore } from '../hooks/useUser';
import { optimizeAudio, resolveSongAudioUrl, resolveSongAudioUrls } from '../lib/mediaUtils';
import { api } from '../services/api';
import { useTrackPlayer, useTrackPlayerProgress } from '../hooks/useTrackPlayer';
import {
  searchSongMatch,
  HighlightedText,
  sanitizeProgramName,
  sanitizeTextNoId,
  SongSearchResult,
} from '../lib/searchUtils';
import { navigateToPlayer } from '../navigation/navigationService';

const MiniPlayerProgressBar = ({ theme }: any) => {
  const { position, duration } = useTrackPlayerProgress(250);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: theme.colors.divider || 'rgba(255,255,255,0.1)' }}>
      <View style={{
        height: '100%',
        width: duration > 0 ? `${Math.min(100, (position / duration) * 100)}%` : '0%',
        backgroundColor: theme.colors.accent,
      }} />
    </View>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Resolved track image: returns real album art only. NEVER falls back to Praise Night banners.
const getTrackImage = (track: any): any => {
  const url = track?.imageUrl || track?.image || track?.coverArt || track?.artwork;
  if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('/banner/')) {
    return { uri: url };
  }
  if (track?.image && typeof track.image === 'object' && track.image.uri && !track.image.uri.includes('/banner/')) {
    return track.image;
  }
  return null;
};

let cachedSearchSongs: any[] | null = null;

export default function SearchScreen({ navigation }: any) {
  const { theme, themeName } = useTheme();
  const styles = getStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState<any[]>([]);

  const { currentTrack, isPlaying, play, togglePlayback } = useTrackPlayer();
  const [remoteSearchResults, setRemoteSearchResults] = useState<any[]>([]);
  const { currentZone: contextZone, zoneVersion, isLoading: isZoneLoading } = useZone();
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  const isHQOrPresident = isHQAdmin(profile);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    setTimeout(() => {
      inputRef.current?.focus();
    }, 400);

    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true
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

      // Fetch song databases:
      // Master catalog (All Ministered Songs) -> available to everyone
      // Assigned Zone songs -> available to everyone for their assigned zone
      // Subgroup songs of assigned zone -> available to everyone for their assigned zone
      // Master/Archive programs -> ONLY for HQ Admin and The President!
      const [
        songsResult,
        masterProgramsResult,
        zoneSongsResult,
        subgroupResult,
        allProgramsResult,
      ] = await Promise.all([
        api.songs.getMaster().catch(() => null),
        isHQOrPresident ? api.programs.getMasterPrograms().catch(() => null) : Promise.resolve([]),
        !isHQ ? api.songs.getZoneSongs(resolvedZoneId).catch(() => null) : Promise.resolve(null),
        api.songs.getSubgroupSongs({ zoneId: resolvedZoneId }).catch(() => null),
        api.programs.getAll(resolvedZoneId, true).catch(() => null),
      ]);

      if (!isMountedRef.current) return;

      const mainSongs = Array.isArray(songsResult) ? songsResult : (songsResult?.success ? songsResult.data : []);
      const zoneSongs = Array.isArray(zoneSongsResult) ? zoneSongsResult : (zoneSongsResult?.success ? zoneSongsResult.data : []);
      const subSongs = Array.isArray(subgroupResult) ? subgroupResult : (subgroupResult?.success ? subgroupResult.data : []);
      const masterPrograms = Array.isArray(masterProgramsResult) ? masterProgramsResult : (masterProgramsResult?.success ? masterProgramsResult.data : []);
      const allPrograms = Array.isArray(allProgramsResult) ? allProgramsResult : (allProgramsResult?.success ? allProgramsResult.data : []);

      // Build program ID to human-readable Name map so no IDs are ever displayed
      const programMap: Record<string, string> = {};
      const programSongsFromPrograms: any[] = [];

      [...masterPrograms, ...allPrograms].forEach((p: any) => {
        // Exclude archive programs for regular users (only HQ Admin & President can search Archive)
        const isArchive = p?.category === 'archive' || p?.status === 'archive' || p?.isArchived;
        if (!isHQOrPresident && isArchive) return;

        const pId = p?.id;
        const pName = p?.name || p?.title;
        if (pId && pName) {
          programMap[String(pId)] = String(pName);
        }
        const sList = Array.isArray(p?.songs) ? p.songs : (Array.isArray(p?.programSongs) ? p.programSongs : []);
        sList.forEach((item: any) => {
          const songObj = item?.song || item;
          if (songObj) {
            programSongsFromPrograms.push({
              ...songObj,
              program: pName || songObj.program || songObj.programName,
              programId: pId || songObj.programId,
            });
          }
        });
      });

      // Also read cached Ministered and Rehearsal songs from AsyncStorage
      const cachedStoredSongs: any[] = [];
      try {
        const ministeredStored = await AsyncStorage.getItem(`MINISTERED_SONGS_CACHE_${resolvedZoneId}`);
        if (ministeredStored) {
          const parsed = JSON.parse(ministeredStored);
          if (Array.isArray(parsed)) cachedStoredSongs.push(...parsed);
        }

        const allKeys = await AsyncStorage.getAllKeys();
        const rehearsalKeys = allKeys.filter(k => k.startsWith('rehearsal_songs_'));
        if (rehearsalKeys.length > 0) {
          const rehearsalCaches = await AsyncStorage.multiGet(rehearsalKeys);
          rehearsalCaches.forEach(([, value]) => {
            if (value) {
              try {
                const parsed = JSON.parse(value);
                if (parsed && Array.isArray(parsed.songs)) {
                  cachedStoredSongs.push(...parsed.songs);
                }
              } catch {}
            }
          });
        }
      } catch (err) {
        console.warn('Failed to read local storage in SearchScreen:', err);
      }

      // Deduplicate all songs across master catalog, ministered programs, zone, subgroups, and cache
      const allSongsMap = new Map<string, any>();
      [
        ...mainSongs,
        ...programSongsFromPrograms,
        ...zoneSongs,
        ...subSongs,
        ...cachedStoredSongs,
      ].forEach((s: any, idx: number) => {
        if (!s) return;
        const rawId = s.id ? String(s.id) : `song-${idx}`;
        if (!allSongsMap.has(rawId)) {
          allSongsMap.set(rawId, s);
        } else {
          // Merge to get richest data (lyrics, notes, audio, artwork)
          const existing = allSongsMap.get(rawId);
          allSongsMap.set(rawId, {
            ...existing,
            ...s,
            lyrics: s.lyrics || existing.lyrics,
            comments: s.comments || existing.comments,
            notes: s.notes || existing.notes,
            imageUrl: s.imageUrl || existing.imageUrl,
            audioFile: s.audioFile || existing.audioFile,
            audioUrl: s.audioUrl || existing.audioUrl,
            audioUrls: s.audioUrls || existing.audioUrls,
          });
        }
      });

      const rawSongs = Array.from(allSongsMap.values());

      const mappedSongs = rawSongs
        .filter((song: any) => {
          if (!isHQOrPresident) {
            if (song.isHQOnly || song.status === 'hq_only') return false;
            // Strictly exclude archive songs for regular users
            if (song.status === 'archive' || song.status === 'archived' || song.category === 'archive') return false;
          }
          return isHQ || !song.isHQOnly;
        })
        .map((song: any, index: number) => {
          const songAudioUrl = optimizeAudio(resolveSongAudioUrl(song) || song.audioFile || song.audioUrls?.full || '');
          const resolvedAudioUrls = resolveSongAudioUrls(song);
          const resolvedImage = getTrackImage(song);

          // Guarantee clean human-readable text with NO raw IDs
          const cleanTitle = sanitizeTextNoId(song.title, 'Untitled Song');
          const cleanSinger = sanitizeTextNoId(song.leadSinger, 'Loveworld Singers');
          const rawProg = song.programName || song.praiseNightName || song.program || song.praiseNightId || song.programId;
          const cleanProgram = sanitizeProgramName(rawProg, 'Loveworld Singers', programMap);

          return {
            id: song.id ? String(song.id) : `song-${index}`,
            title: cleanTitle,
            subtitle: cleanSinger,
            program: cleanProgram,
            leadSinger: cleanSinger,
            writer: sanitizeTextNoId(song.writer, 'Loveworld Singers'),
            conductor: song.conductor || 'Evang. Kathy',
            key: song.key || '',
            tempo: song.tempo || '',
            category: song.category || '',
            categories: Array.isArray(song.categories) ? song.categories : (song.category ? [song.category] : []),
            audioUrl: songAudioUrl,
            lyrics: song.lyrics || '',
            solfa: song.notation || song.solfas || song.solfa || '',
            audioUrls: resolvedAudioUrls || song.audioUrls || {},
            status: song.status || 'unheard',
            isActive: song.isActive !== false,
            rehearsalCount: song.rehearsalCount || 0,
            conductorGuide: song.solfas || song.conductorGuide || song.guide || '',
            history: song.history || '',
            comments: song.comments || song.notes || song.coordinatorComment || '',
            leadKeyboardist: song.leadKeyboardist || '',
            drummer: song.drummer || '',
            leadGuitarist: song.leadGuitarist || '',
            createdAt: song.createdAt ? (typeof song.createdAt === 'string' ? song.createdAt : new Date().toISOString()) : new Date().toISOString(),
            image: resolvedImage,
            imageUrl: song.imageUrl || '',
            zoneId: resolvedZoneId,
            collectionName: song.subGroupId ? 'subgroup_songs' : (isHQ ? 'praise_night_songs' : 'zone_songs'),
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
    const isSameTrack = currentTrack && String(currentTrack.id) === String(track.id);
    if (!isSameTrack) {
      play(track, filteredSongs, true);
    } else {
      navigation.navigate('Player', { activeTrack: track, fromAllSongs: true, zoneId: track.zoneId, queue: filteredSongs });
    }
  };

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setDebouncedQuery('');
      setIsSearching(false);
      setRemoteSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Query Backend Universal Search across all 3,746+ songs in database
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setRemoteSearchResults([]);
      return;
    }

    let active = true;
    const resolvedZoneId = contextZone?.id || 'zone-001';
    api.songs.universalSearch(debouncedQuery, 80, resolvedZoneId)
      .then((res: any) => {
        if (!active) return;
        if (res?.success && Array.isArray(res.data)) {
          setRemoteSearchResults(res.data);
        }
      })
      .catch((err: any) => {
        console.warn('Backend universal search error:', err);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, contextZone?.id]);

  // Chat-like Full-Text Search with ranking, punctuation handling, and snippet extraction
  const filteredSongs = React.useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    const matchesMap = new Map<string, any>();

    // 1. Matches from locally loaded songs
    songs.forEach(song => {
      const matchResult = searchSongMatch(song, debouncedQuery);
      if (matchResult.isMatch) {
        matchesMap.set(String(song.id), {
          ...song,
          searchResult: matchResult,
        });
      }
    });

    // 2. Matches from backend universal search
    remoteSearchResults.forEach(remoteSong => {
      // Client-side guard: strictly exclude archive and HQ-only songs for regular users
      if (!isHQOrPresident) {
        if (remoteSong.status === 'archive' || remoteSong.status === 'archived' || remoteSong.category === 'archive') return;
        if (remoteSong.status === 'hq_only' || remoteSong.isHQOnly) return;
      }

      const id = String(remoteSong.id);
      const resolvedImage = getTrackImage(remoteSong);
      const cleanTitle = sanitizeTextNoId(remoteSong.title, 'Untitled Song');
      const cleanSinger = sanitizeTextNoId(remoteSong.leadSinger, 'Loveworld Singers');
      const cleanProgram = sanitizeProgramName(remoteSong.program || remoteSong.programName, 'Loveworld Singers');

      const songObj = {
        ...remoteSong,
        title: cleanTitle,
        subtitle: cleanSinger,
        leadSinger: cleanSinger,
        program: cleanProgram,
        writer: sanitizeTextNoId(remoteSong.writer, 'Loveworld Singers'),
        image: resolvedImage,
        imageUrl: remoteSong.imageUrl || '',
        lyrics: remoteSong.lyrics || '',
        comments: remoteSong.comments || remoteSong.notes || remoteSong.coordinatorComment || '',
      };

      if (!matchesMap.has(id)) {
        const localMatch = searchSongMatch(songObj, debouncedQuery);
        matchesMap.set(id, {
          ...songObj,
          searchResult: remoteSong.searchResult || localMatch,
        });
      } else {
        const existing = matchesMap.get(id);
        matchesMap.set(id, {
          ...existing,
          ...songObj,
          lyrics: songObj.lyrics || existing.lyrics,
          searchResult: (existing.searchResult?.score || 0) >= (remoteSong.searchResult?.score || 0)
            ? existing.searchResult
            : (remoteSong.searchResult || existing.searchResult),
        });
      }
    });

    // Sort by match score descending (exact title > title word > lyrics phrase > lyrics word > comments)
    return Array.from(matchesMap.values()).sort((a, b) => b.searchResult.score - a.searchResult.score);
  }, [songs, debouncedQuery, remoteSearchResults]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={themeName === 'light'
          ? [theme.colors.background, theme.colors.backgroundSecondary]
          : [theme.colors.background, '#0a192f']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.searchBarWrapper}>
            <BlurView intensity={40} tint="light" style={styles.searchBarBlur}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  ref={inputRef}
                  placeholder="Songs, lyrics, notes or rehearsal..."
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  style={styles.searchInput}
                  selectionColor={theme.colors.accent}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
          </View>
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.resultsArea}>
          {isLoading && !isRefreshing ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.emptySubText, { marginTop: 14 }]}>Loading song library...</Text>
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
              <Ionicons name="search-outline" size={56} color={theme.colors.textDisabled} />
              <Text style={styles.emptyText}>Find your rehearsal material</Text>
              <Text style={styles.emptySubText}>
                Search by song title, lyric words, punctuation, director notes, or vocal parts
              </Text>
            </ScrollView>
          ) : isSearching ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.emptySubText, { marginTop: 16 }]}>Searching songs & lyrics...</Text>
            </View>
          ) : filteredSongs.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.trackList}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadData(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            >
              <View style={styles.resultsHeaderRow}>
                <Text style={styles.resultsCountText}>
                  {filteredSongs.length} {filteredSongs.length === 1 ? 'result' : 'results'} found
                </Text>
              </View>

              {filteredSongs.map(track => {
                const isActiveTrack = currentTrack && String(currentTrack.id) === String(track.id);
                const hasAudio = Boolean(track.audioUrl);
                const searchResult: SongSearchResult = track.searchResult;

                return (
                  <TouchableOpacity
                    key={track.id}
                    style={[styles.trackRow, isActiveTrack && styles.trackRowActive]}
                    activeOpacity={0.7}
                    onPress={() => openTrack(track)}
                  >
                    {/* Album Art: Real Artwork Only, or Stylized Vinyl Placeholder (NEVER Praise Night Banner) */}
                    <View style={styles.trackArtWrap}>
                      {track.image ? (
                        <Image source={track.image} style={styles.trackArt} contentFit="cover" />
                      ) : (
                        <LinearGradient
                          colors={['#1e293b', '#0f172a']}
                          style={[styles.trackArt, styles.trackArtPlaceholder]}
                        >
                          <Ionicons name="disc-outline" size={22} color={theme.colors.accent} />
                        </LinearGradient>
                      )}

                      {!hasAudio && (
                        <View style={styles.noAudioBadge}>
                          <Ionicons name="volume-mute" size={14} color="rgba(255,255,255,0.85)" />
                        </View>
                      )}
                    </View>

                    {/* Track Info with Highlighted Search Matches */}
                    <View style={styles.trackInfo}>
                      {/* Song Title with Chat-like Highlighting */}
                      <HighlightedText
                        text={track.title}
                        tokens={searchResult?.matchTokens}
                        style={[styles.trackTitle, isActiveTrack && { color: theme.colors.accent }]}
                        highlightStyle={styles.highlightActive}
                        numberOfLines={1}
                      />

                      {/* Chat-style Matched Excerpt Snippet (when matched in lyrics, notes, or comments) */}
                      {searchResult?.snippet ? (
                        <View style={styles.snippetWrap}>
                          <Ionicons
                            name={searchResult.matchField === 'comments' ? 'chatbubble-ellipses-outline' : 'document-text-outline'}
                            size={11}
                            color={theme.colors.accent}
                            style={{ marginRight: 4, marginTop: 1 }}
                          />
                          <HighlightedText
                            text={searchResult.snippet}
                            tokens={searchResult.matchTokens}
                            style={styles.snippetText}
                            highlightStyle={styles.highlightSnippet}
                            numberOfLines={2}
                          />
                        </View>
                      ) : null}

                      {/* Metadata Row: Lead Singer · Program (No IDs ever shown) */}
                      <View style={styles.trackMeta}>
                        {!hasAudio ? (
                          <>
                            <Ionicons name="volume-mute-outline" size={11} color="#fb923c" style={{ marginRight: 4 }} />
                            <Text style={[styles.trackMetaText, { color: '#fb923c' }]} numberOfLines={1}>No audio yet</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="person" size={11} color={isActiveTrack ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 4 }} />
                            <HighlightedText
                              text={track.leadSinger}
                              tokens={searchResult?.matchTokens}
                              style={[styles.trackMetaText, isActiveTrack && { color: theme.colors.accent }]}
                              highlightStyle={styles.highlightActive}
                              numberOfLines={1}
                            />
                          </>
                        )}

                        {track.program ? (
                          <>
                            <Text style={[styles.trackMetaDot, isActiveTrack && { color: theme.colors.accent }]}>·</Text>
                            <Text style={[styles.trackMetaText, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>
                              {track.program}
                            </Text>
                          </>
                        ) : null}
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
              <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.noResultsText}>No results for "{searchQuery}"</Text>
              <Text style={styles.emptySubText}>
                Try searching for partial words, lyrics, or check for typos
              </Text>
            </ScrollView>
          )}
        </View>

        {/* Persistent MiniPlayer Bar when audio is active */}
        {currentTrack && (
          <TouchableOpacity
            style={styles.miniPlayerBar}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Player', {
              activeTrack: currentTrack,
              fromAllSongs: true,
              zoneId: currentTrack.zoneId,
              queue: filteredSongs.length > 0 ? filteredSongs : [currentTrack]
            })}
          >
            <MiniPlayerProgressBar theme={theme} />
            <View style={styles.miniPlayerInner}>
              <View style={styles.miniPlayerArtWrap}>
                {getTrackImage(currentTrack) ? (
                  <Image source={getTrackImage(currentTrack)} style={styles.miniPlayerArt} contentFit="cover" />
                ) : (
                  <LinearGradient colors={['#7c3aed', '#4f46e5']} style={[styles.miniPlayerArt, styles.trackArtPlaceholder]}>
                    <Ionicons name="disc-outline" size={18} color="#fff" />
                  </LinearGradient>
                )}
              </View>

              <View style={styles.miniPlayerInfo}>
                <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                  {sanitizeTextNoId(currentTrack.title, 'Now Playing')}
                </Text>
                <Text style={styles.miniPlayerSubtitle} numberOfLines={1}>
                  {sanitizeTextNoId(currentTrack.leadSinger || currentTrack.writer, 'Loveworld Singers')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.miniPlayerPlayBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={(e) => {
                  e.stopPropagation();
                  togglePlayback();
                }}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color={theme.colors.accent}
                />
              </TouchableOpacity>

              <Ionicons name="chevron-up" size={18} color={theme.colors.textMuted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, zIndex: 10 },
    searchBarWrapper: { flex: 1, height: 44, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.inputBorder },
    searchBarBlur: { flex: 1, backgroundColor: theme.colors.inputBackground },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: theme.colors.inputText, fontSize: 15, fontWeight: '500' },
    clearButton: { padding: 4 },
    cancelButton: { marginLeft: 12, paddingVertical: 8 },
    cancelText: { color: theme.colors.accent, fontSize: 16, fontWeight: '600' },
    resultsArea: { flex: 1 },
    emptyState: { flex: 1, alignItems: 'center', paddingTop: 90, paddingHorizontal: 24 },
    emptyText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 18, textAlign: 'center' },
    emptySubText: { color: theme.colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 },
    noResultsText: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    countBadgeWrap: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    countBadgeText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },

    resultsHeaderRow: { marginBottom: 8, paddingHorizontal: 2 },
    resultsCountText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    trackList: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 6 },
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.bottomTabBorder || 'rgba(255,255,255,0.08)',
    },
    trackRowActive: {
      backgroundColor: 'rgba(192, 132, 252, 0.08)',
      borderRadius: 10,
      paddingHorizontal: 8,
    },
    trackArtWrap: {
      position: 'relative',
      width: 48,
      height: 48,
      borderRadius: 10,
      overflow: 'hidden',
      marginRight: 12,
    },
    trackArt: {
      width: 48,
      height: 48,
      borderRadius: 10,
    },
    trackArtPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    noAudioBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackInfo: { flex: 1, justifyContent: 'center', paddingRight: 8 },
    trackTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    
    snippetWrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      marginTop: 2,
      marginBottom: 3,
    },
    snippetText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 11.5,
      fontStyle: 'italic',
      lineHeight: 16,
    },

    highlightActive: {
      color: theme.colors.accent,
      fontWeight: '700',
      backgroundColor: 'rgba(192, 132, 252, 0.2)',
      borderRadius: 3,
    },
    highlightSnippet: {
      color: '#38bdf8',
      fontWeight: '700',
      backgroundColor: 'rgba(56, 189, 248, 0.22)',
      borderRadius: 3,
    },

    trackMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
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
    miniPlayerBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.backgroundSecondary || '#1e1b4b',
      borderTopWidth: 1,
      borderTopColor: theme.colors.bottomTabBorder || 'rgba(255,255,255,0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 10,
      zIndex: 50,
    },
    miniPlayerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    miniPlayerArtWrap: {
      width: 40,
      height: 40,
      borderRadius: 8,
      overflow: 'hidden',
      marginRight: 12,
    },
    miniPlayerArt: {
      width: 40,
      height: 40,
      borderRadius: 8,
    },
    miniPlayerInfo: {
      flex: 1,
      justifyContent: 'center',
      marginRight: 10,
    },
    miniPlayerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    miniPlayerSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    miniPlayerPlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};
