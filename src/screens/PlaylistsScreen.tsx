import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { DoodleBackground } from '../components/DoodleBackground';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  AppState,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { useUserStore } from '../hooks/useUser';
import { useZone } from '../hooks/useZone';
import { isHQGroup } from '../config/zones';
import { ShareToChatSheet } from '../components/ShareToChatSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const getTrackImage = (track: any, index: number) => {
  if (track.image) {
    if (typeof track.image === 'number') return track.image;
    if (typeof track.image === 'string' && track.image.startsWith('http')) return { uri: track.image };
  }
  if (track.imageUrl) return { uri: track.imageUrl };
  
  return require('../../assets/banner/praisenight28.jpg');
};

const programCache: Record<string, string> = {};

export default function PlaylistsScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const s = styles;
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<'library' | 'favorites' | string>('library');
  const [activePlaylistData, setActivePlaylistData] = useState<any>(null);

  const [selectedOptionsTrack, setSelectedOptionsTrack] = useState<any>(null);
  const [showTrackOptions, setShowTrackOptions] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTrack, setShareTrack] = useState<any>(null);
  const [sharePlaylist, setSharePlaylist] = useState<any>(null);
  const [resolvedTracksCache, setResolvedTracksCache] = useState<Record<string, any>>({});
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistNameInput, setNewPlaylistNameInput] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredPlaylists = useMemo(() => {
    if (!searchFilter.trim()) return playlists;
    const q = searchFilter.toLowerCase().trim();
    return playlists.filter(pl => pl.name?.toLowerCase().includes(q));
  }, [playlists, searchFilter]);
  
  const { currentTrack, play } = useTrackPlayer();
  const user = useUserStore(s => s.user);
  const { currentZone } = useZone();
  const isHQ = currentZone ? isHQGroup(currentZone.id) : false;
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem('RESOLVED_TRACKS_CACHE');
        if (cached) {
          setResolvedTracksCache(prev => ({ ...prev, ...JSON.parse(cached) }));
        }
      } catch (e) {
        console.error('Failed to load resolved tracks cache:', e);
      }
    };
    loadCache();
  }, []);

  const syncUserData = useCallback(() => {
    if (!user) {
      setIsLoadingPlaylists(false);
      return;
    }
    setIsLoadingPlaylists(true);
    // playlists sync
    api.playlists.getAll().then(res => {
      if (res?.success && Array.isArray(res.data)) {
        const shaped = res.data.map((pl: any) => ({
          ...pl,
          name: pl.title || pl.name || 'Playlist',
          title: pl.title || pl.name || 'Playlist',
          songs: pl.songIds || pl.songs || [],
          songIds: pl.songIds || [],
        }));
        setPlaylists(shaped);
      }
    }).catch(() => {}).finally(() => setIsLoadingPlaylists(false));

    // favorites sync
    api.favorites.getAll().then(res => {
      if (res && res.data) {
        const raw = res.data as any;
        const songIds = Array.isArray(raw) ? raw : Array.isArray(raw?.songs) ? raw.songs : [];
        setFavoriteIds(songIds);
      }
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    syncUserData();
    const appStateSub = AppState.addEventListener('change', (nextState: any) => {
      if (nextState === 'active') {
        syncUserData();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [syncUserData]);

  useEffect(() => {
    const params = route?.params;
    if (!params?.openPlaylistId) return;
    const match = playlists.find((p: any) => p.id === params.openPlaylistId);
    if (match) {
      setActivePlaylistData(match);
      setActiveCollection(match.id);
    } else {
      const songIds: string[] = params.openPlaylistSongs || [];
      const sharedSongs: any[] = params.sharedSongs || [];

      // Immediately seed cache with shared song objects
      if (Array.isArray(sharedSongs) && sharedSongs.length > 0) {
        setResolvedTracksCache(prev => {
          const next = { ...prev };
          sharedSongs.forEach((s: any) => {
            if (s && s.id) {
              next[s.id] = {
                ...s,
                id: s.id,
                title: s.title || 'Unknown Title',
                subtitle: s.leadSinger || s.writer || 'Loveworld Singers',
                audioUrl: s.audioUrl || s.audioFile || '',
                audioUrls: s.audioUrls || {},
                image: getTrackImage({ id: s.id, ...s }, 0),
              };
            }
          });
          return next;
        });
      }

      const effectiveSongs = songIds.length > 0 ? songIds : sharedSongs.map((s: any) => s.id).filter(Boolean);

      setActivePlaylistData({
        id: params.openPlaylistId,
        name: params.openPlaylistName || 'Shared Playlist',
        songs: effectiveSongs,
        songNotes: params.openPlaylistSongNotes || {},
      });
      setActiveCollection(params.openPlaylistId);

      // Also attempt to fetch latest from server if it has an id
      if (params.openPlaylistId && params.openPlaylistId !== 'favs') {
        api.playlists.getById(params.openPlaylistId)
          .then(res => {
            if (res?.data) {
              const p = res.data;
              const serverSongIds = p.songIds || (p.songs || []).map((s: any) => s.id || s);
              if (Array.isArray(p.songs)) {
                setResolvedTracksCache(prev => {
                  const next = { ...prev };
                  p.songs.forEach((s: any) => {
                    if (s && s.id) {
                      next[s.id] = {
                        ...s,
                        id: s.id,
                        title: s.title || 'Unknown Title',
                        subtitle: s.leadSinger || s.writer || 'Loveworld Singers',
                        audioUrl: s.audioUrl || s.audioFile || '',
                        audioUrls: s.audioUrls || {},
                        image: getTrackImage({ id: s.id, ...s }, 0),
                      };
                    }
                  });
                  return next;
                });
              }
              setActivePlaylistData({
                id: p.id,
                name: p.title || p.name || params.openPlaylistName || 'Shared Playlist',
                songs: serverSongIds.length > 0 ? serverSongIds : effectiveSongs,
                songNotes: params.openPlaylistSongNotes || {},
              });
            }
          })
          .catch(() => {});
      }
    }
    navigation.setParams({ openPlaylistId: undefined, openPlaylistName: undefined, openPlaylistSongs: undefined, sharedSongs: undefined, openPlaylistSongNotes: undefined });
  }, [route?.params?.openPlaylistId, playlists]);

  useEffect(() => {
    const fetchMissingTracks = async () => {
      let idsToFetch: string[] = [];
      if (activeCollection === 'favorites') {
        idsToFetch = favoriteIds;
      } else if (activePlaylistData) {
        idsToFetch = activePlaylistData.songs || [];
      }
      
      const missingIds = idsToFetch.filter(id => !resolvedTracksCache[id]);
      if (missingIds.length === 0) return;

      setIsLoadingTracks(true);
      const newCache = { ...resolvedTracksCache };
      
      try {
        await Promise.all(missingIds.map(async (id) => {
          try {
            let songData: any = null;
            try {
              const res = await api.songs.getById(encodeURIComponent(id));
              if (res?.data) {
                songData = res.data;
              }
            } catch {}

            if (songData) {
              const data = songData;
              newCache[id] = {
                ...data,
                id: data.id || id,
                title: data.title || 'Unknown Title',
                subtitle: data.leadSinger || data.writer || 'Loveworld Singers',
                program: data.program || 'Praise Night',
                leadSinger: data.leadSinger || 'Unknown',
                writer: data.writer || 'Unknown',
                audioUrl: data.audioUrl || data.audioFile || '',
                audioUrls: data.audioUrls || {},
                image: getTrackImage({ id, ...data }, 0)
              };
            }
          } catch (e) {
            console.error(`Error resolving track ${id}:`, e);
          }
        }));
        
        setResolvedTracksCache(newCache);
        AsyncStorage.setItem('RESOLVED_TRACKS_CACHE', JSON.stringify(newCache)).catch(() => {});
      } catch (error) {
        console.error('Error resolving tracks:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    fetchMissingTracks();
  }, [activeCollection, activePlaylistData, favoriteIds]);

  const resolveTracks = (trackIds: any[]) => {
    return (trackIds || []).map((item: any) => {
      const id = typeof item === 'string' ? item : item?.id;
      if (!id) return null;
      if (resolvedTracksCache[id]) return resolvedTracksCache[id];
      if (typeof item === 'object' && item.title) {
        return {
          ...item,
          id: item.id || id,
          title: item.title || 'Unknown Title',
          subtitle: item.leadSinger || item.writer || 'Loveworld Singers',
          program: item.program || 'Praise Night',
          leadSinger: item.leadSinger || 'Unknown',
          writer: item.writer || 'Unknown',
          audioUrl: item.audioUrl || item.audioFile || '',
          audioUrls: item.audioUrls || {},
          image: getTrackImage({ id, ...item }, 0),
        };
      }
      return null;
    }).filter(Boolean);
  };

  const getQueue = () => {

    if (activeCollection === 'favorites') return resolveTracks(favoriteIds);
    if (activePlaylistData) return resolveTracks(activePlaylistData.songs || []);
    return [];
  };

  const handleTrackPress = (track: any) => {
    const queue = getQueue();
    if (!currentTrack || String(currentTrack.id) !== String(track.id)) {
      play(track, queue, false);
    }
    navigation.navigate('Player', { activeTrack: track, queue });
  };

  const handleDeletePlaylist = (playlistId: string, playlistName?: string) => {
    if (!playlistId || playlistId === 'favorites') return;
    Alert.alert(
      'Delete playlist',
      `Remove "${playlistName || 'this playlist'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.playlists.delete(playlistId);
              setPlaylists(prev => prev.filter((pl: any) => pl.id !== playlistId));
              if (activeCollection === playlistId) {
                setActiveCollection('library');
                setActivePlaylistData(null);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete playlist. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  const playEntireCollection = () => {

    const songsToPlay = getQueue();
    
    if (songsToPlay.length > 0) {
      play(songsToPlay[0], songsToPlay);
      navigation.navigate('Player', { activeTrack: songsToPlay[0], queue: songsToPlay });
    }
  };

  const handleMoreOptions = (track: any) => {

    setSelectedOptionsTrack(track);
    setShowTrackOptions(true);
  };

  const renderTrackItem = (track: any, index: number) => {
    const isActiveTrack = currentTrack && String(currentTrack.id) === String(track.id);
    const hasAudio = !!track.audioUrl;
    const playlistSongNote = activePlaylistData?.songNotes?.[track.id];

    return (
      <TouchableOpacity
        key={track.id || index}
        style={[styles.trackRow, isActiveTrack && styles.trackRowActive]}
        activeOpacity={0.75}
        onPress={() => handleTrackPress(track)}>
        <View style={{ position: 'relative' }}>
          <Image source={track.image} style={styles.trackRowImage} contentFit="cover" />
          {!hasAudio ? (
            <View style={styles.trackNoAudioOverlay}>
              <Ionicons name="volume-mute" size={16} color="rgba(255,255,255,0.85)" />
            </View>
          ) : isActiveTrack ? (
            <View style={styles.trackActiveOverlay}>
              <Ionicons name="volume-high" size={18} color="#ffffff" />
            </View>
          ) : null}
        </View>
        <View style={styles.trackRowInfo}>
          <Text style={[styles.trackRowTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 120 }}>
              {!hasAudio ? (
                <Ionicons name="volume-mute-outline" size={12} color="#fb923c" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons name={isActiveTrack ? 'volume-high' : 'mic-outline'} size={12} color={isActiveTrack ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.trackRowSubtitle, { flex: 1 }, isActiveTrack && { color: theme.colors.accent }, !hasAudio && { color: '#fb923c' }]} numberOfLines={1}>
                {!hasAudio ? 'No audio track' : track.leadSinger || 'Loveworld Singers'}
              </Text>
            </View>
            {hasAudio && track.program ? (
              <View style={styles.programChip}>
                <Text style={styles.programChipText} numberOfLines={1}>
                  {track.program}
                </Text>
              </View>
            ) : null}
          </View>
          {playlistSongNote ? (
            <View style={styles.songNoteBadge}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color={theme.colors.accent} />
              <Text style={styles.songNoteText} numberOfLines={1}>
                {playlistSongNote}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.trackMoreButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={(e) => {
          e.stopPropagation();
          handleMoreOptions(track);
        }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (activeCollection !== 'library') {
    const isFavorites = activeCollection === 'favorites';
    const title = isFavorites ? 'Liked Songs' : activePlaylistData?.name;
    const songIds = isFavorites ? favoriteIds : (activePlaylistData?.songs || []);
    const tracks = resolveTracks(songIds);
    
    return (
      <View style={styles.container}>
        <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
        <DoodleBackground />
        <FlatList
          style={styles.content}
          showsVerticalScrollIndicator={false}
          data={tracks}
          keyExtractor={(item, index) => item?.id || index.toString()}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          ListHeaderComponent={
            <SafeAreaView edges={['top']} style={styles.detailHeaderArea}>
              <View style={styles.detailNavRow}>
                <TouchableOpacity
                  style={styles.circleBackBtn}
                  onPress={() => setActiveCollection('library')}
                >
                  <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {tracks.length > 0 && (
                    <TouchableOpacity
                      style={styles.circleActionBtn}
                      onPress={() => {
                        setSharePlaylist({ id: activePlaylistData?.id || 'favs', name: title, songs: tracks });
                        setShowShareSheet(true);
                      }}
                    >
                      <Ionicons name="share-social-outline" size={20} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                  {!isFavorites && activePlaylistData?.id && (
                    <TouchableOpacity
                      style={[styles.circleActionBtn, { borderColor: 'rgba(239,68,68,0.5)' }]}
                      onPress={() => handleDeletePlaylist(activePlaylistData.id, activePlaylistData.name)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#f87171" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Banner Card */}
              <LinearGradient
                colors={isFavorites ? [theme.colors.accent, theme.colors.backgroundSecondary] : [theme.colors.accent + '55', theme.colors.backgroundSecondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailBannerCard}
              >
                <View style={styles.detailBannerIconWrap}>
                  <Ionicons name={isFavorites ? 'heart' : 'musical-notes'} size={30} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailBannerBadge}>
                    {isFavorites ? 'PINNED FAVORITES' : 'CUSTOM PLAYLIST'}
                  </Text>
                  <Text style={styles.detailBannerTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.detailBannerSub}>
                    {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
                  </Text>
                </View>
              </LinearGradient>

              {/* Action Buttons */}
              <View style={styles.detailActionRow}>
                <TouchableOpacity
                  style={[styles.detailPlayAllBtn, tracks.length === 0 && { opacity: 0.5 }]}
                  disabled={tracks.length === 0}
                  onPress={() => {
                    if (tracks.length > 0) play(tracks[0], tracks);
                  }}
                >
                  <Ionicons name="play" size={18} color="#ffffff" />
                  <Text style={styles.detailPlayAllText}>PLAY ALL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailShuffleBtn, tracks.length === 0 && { opacity: 0.5 }]}
                  disabled={tracks.length === 0}
                  onPress={() => {
                    if (tracks.length > 0) {
                      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                      play(shuffled[0], shuffled);
                    }
                  }}
                >
                  <Ionicons name="shuffle" size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name={isFavorites ? 'heart-dislike-outline' : 'musical-note-outline'} size={36} color={theme.colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>
                {isLoadingTracks ? 'Loading Songs…' : 'No Songs Here Yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {isLoadingTracks
                  ? 'Fetching audio tracks from your library…'
                  : isFavorites
                  ? 'Tap the heart icon on any song to save it to Liked Songs.'
                  : 'Add songs to this playlist from the player or rehearsal screen.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item, index }) => renderTrackItem(item, index)}
        />
        <TrackOptionsModal 
          visible={showTrackOptions} 
          onClose={() => setShowTrackOptions(false)} 
          track={selectedOptionsTrack} 
          currentPlaylistId={activeCollection !== 'favorites' && activeCollection !== 'library' ? activeCollection : undefined}
          isFavoritesView={activeCollection === 'favorites'}
          onForwardToChat={() => {
            setShareTrack(selectedOptionsTrack);
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
          playlist={sharePlaylist}
          onClose={() => { setShowShareSheet(false); setShareTrack(null); setSharePlaylist(null); }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      <DoodleBackground />

      {/* Sleek Top Header */}
      <View style={styles.libraryHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={styles.circleBackBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.libraryTitle}>Playlists</Text>
            <Text style={styles.librarySubtitle}>
              {playlists.length + (favoriteIds.length > 0 ? 1 : 0)} collections
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newPlaylistPill}
          activeOpacity={0.8}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.newPlaylistPillText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Filter Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search playlists..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchFilter}
          onChangeText={setSearchFilter}
          clearButtonMode="while-editing"
        />
        {searchFilter.length > 0 && (
          <TouchableOpacity onPress={() => setSearchFilter('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        style={styles.content}
        showsVerticalScrollIndicator={false}
        data={filteredPlaylists}
        keyExtractor={pl => pl.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={[styles.libraryList, { paddingBottom: 100 }]}
        ListHeaderComponent={
          !searchFilter.trim() ? (
            <TouchableOpacity
              style={styles.likedHeroCard}
              activeOpacity={0.85}
              onPress={() => setActiveCollection('favorites')}
            >
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.backgroundSecondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.likedHeroGradient}
              >
                <View style={styles.likedHeroContent}>
                  <View style={styles.likedHeroBadge}>
                    <Ionicons name="pin" size={11} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.likedHeroBadgeText}>PINNED COLLECTION</Text>
                  </View>
                  <Text style={styles.likedHeroTitle}>Liked Songs</Text>
                  <Text style={styles.likedHeroSub}>
                    {favoriteIds.length} {favoriteIds.length === 1 ? 'song' : 'songs'} • Personal favorites
                  </Text>
                </View>
                <View style={styles.likedHeroPlayBtn}>
                  <Ionicons name="heart" size={24} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item: pl }) => (
          <TouchableOpacity
            style={styles.playlistCard}
            activeOpacity={0.75}
            onPress={() => {
              setActivePlaylistData(pl);
              setActiveCollection(pl.id);
            }}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.25)', 'rgba(59, 130, 246, 0.15)']}
              style={styles.playlistCardArt}
            >
              <Ionicons name="albums-outline" size={24} color={theme.colors.accent} />
            </LinearGradient>
            <View style={styles.playlistCardInfo}>
              <Text style={styles.playlistCardTitle} numberOfLines={1}>{pl.name}</Text>
              <View style={styles.playlistCardMeta}>
                <View style={styles.trackCountBadge}>
                  <Text style={styles.trackCountText}>
                    {(pl.songs || []).length} {(pl.songs || []).length === 1 ? 'song' : 'songs'}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="albums-outline" size={36} color={theme.colors.accent} />
            </View>
              {isLoadingPlaylists ? (
                <>
                  <ActivityIndicator size="large" color={theme.colors.accent} />
                  <Text style={styles.emptyTitle}>Fetching playlists...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>
                    {searchFilter.trim() ? 'No Matching Playlists' : 'No Playlists Yet'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {searchFilter.trim()
                      ? `No playlists match "${searchFilter}". Try another keyword.`
                      : 'Create custom playlists to organize your rehearsals, ministrations, and favorite song sets.'}
                  </Text>
                </>
              )}
              {!isLoadingPlaylists && !searchFilter.trim() && (
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setShowCreateModal(true)}
              >
                <LinearGradient
                  colors={[theme.colors.accent, '#7c3aed']}
                  style={styles.emptyActionGradient}
                >
                  <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyActionText}>Create Playlist</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <TrackOptionsModal 
        visible={showTrackOptions} 
        onClose={() => setShowTrackOptions(false)} 
        track={selectedOptionsTrack} 
        onForwardToChat={() => {
          setShareTrack(selectedOptionsTrack);
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
        playlist={sharePlaylist}
        onClose={() => { setShowShareSheet(false); setShareTrack(null); setSharePlaylist(null); }}
      />
      {/* Create Playlist Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCreateModal(false); setNewPlaylistNameInput(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.createModalCard}>
            <Text style={styles.createModalTitle}>New Playlist</Text>
            <Text style={styles.createModalSub}>Give your playlist a memorable name</Text>
            <TextInput
              style={styles.createModalInput}
              placeholder="e.g. Praise Night Favorites"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newPlaylistNameInput}
              onChangeText={setNewPlaylistNameInput}
              autoFocus
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowCreateModal(false); setNewPlaylistNameInput(''); }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, (!newPlaylistNameInput.trim() || isCreatingPlaylist) && { opacity: 0.6 }]}
                disabled={isCreatingPlaylist || !newPlaylistNameInput.trim()}
                onPress={async () => {
                  if (!newPlaylistNameInput.trim()) return;
                  setIsCreatingPlaylist(true);
                  try {
                    const res = await api.playlists.create({ name: newPlaylistNameInput.trim() });
                    if (res?.success && res.data) {
                      const newPl = {
                        ...res.data,
                        name: res.data.title || res.data.name || newPlaylistNameInput.trim(),
                        title: res.data.title || res.data.name || newPlaylistNameInput.trim(),
                        songs: res.data.songIds || res.data.songs || [],
                        songIds: res.data.songIds || [],
                      };
                      setPlaylists(prev => [newPl, ...prev.filter((p: any) => p.id !== newPl.id)]);
                    }
                    setShowCreateModal(false);
                    setNewPlaylistNameInput('');
                  } catch {
                    Alert.alert('Error', 'Failed to create playlist. Please try again.');
                  } finally {
                    setIsCreatingPlaylist(false);
                  }
                }}
              >
                <Text style={styles.modalCreateBtnText}>{isCreatingPlaylist ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    content: {
      flex: 1
    },

    // Header
    libraryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    circleBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleActionBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    libraryTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    librarySubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 1,
    },
    newPlaylistPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.accent,
      shadowColor: theme.colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    newPlaylistPillText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    // Search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 14,
      height: 42,
      marginHorizontal: 16,
      marginBottom: 14,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '500',
    },

    libraryList: {
      paddingBottom: 100,
    },

    // Pinned Liked Songs Hero
    likedHeroCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: theme.colors.accent,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    likedHeroGradient: {
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    likedHeroContent: {
      flex: 1,
      paddingRight: 16,
    },
    likedHeroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    likedHeroBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    likedHeroTitle: {
      color: '#ffffff',
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 4,
    },
    likedHeroSub: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12,
      fontWeight: '500',
    },
    likedHeroPlayBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Playlist Card
    playlistCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      borderRadius: 18,
      padding: 12,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    playlistCardArt: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    playlistCardInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    playlistCardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    playlistCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trackCountBadge: {
      backgroundColor: 'rgba(139,92,246,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    trackCountText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '700',
    },

    // Detail View Components
    detailHeaderArea: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
    },
    detailNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    detailBannerCard: {
      borderRadius: 20,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      marginBottom: 14,
    },
    detailBannerIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailBannerBadge: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    detailBannerTitle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 4,
    },
    detailBannerSub: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 12,
      fontWeight: '600',
    },
    detailActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    detailPlayAllBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      shadowColor: theme.colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    detailPlayAllText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 13,
      letterSpacing: 0.5,
    },
    detailShuffleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },

    // Track Rows
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      borderRadius: 16,
      padding: 10,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    trackRowActive: {
      backgroundColor: 'rgba(139,92,246,0.12)',
      borderColor: 'rgba(139,92,246,0.35)',
    },
    trackRowImage: {
      width: 50,
      height: 50,
      borderRadius: 12,
      marginRight: 12,
    },
    trackNoAudioOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 12,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackActiveOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 12,
      bottom: 0,
      backgroundColor: 'rgba(139,92,246,0.6)',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackRowInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    trackRowTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 3,
    },
    trackRowSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    programChip: {
      backgroundColor: 'rgba(139,92,246,0.15)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(139,92,246,0.4)',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
    },
    programChipText: {
      fontSize: 10,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    songNoteBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(192, 132, 252, 0.08)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginTop: 5,
      alignSelf: 'flex-start',
      gap: 4,
    },
    songNoteText: {
      fontSize: 11,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    trackMoreButton: {
      padding: 10,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
      paddingHorizontal: 32,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(139,92,246,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(139,92,246,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtext: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    emptyActionBtn: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    emptyActionGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    emptyActionText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
    },

    // Create Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    createModalCard: {
      backgroundColor: '#1a1025',
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    createModalTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    createModalSub: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13,
      marginBottom: 18,
    },
    createModalInput: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: '#ffffff',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      marginBottom: 20,
    },
    modalCancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.07)',
      alignItems: 'center',
    },
    modalCancelBtnText: {
      color: '#ffffff',
      fontWeight: '600',
    },
    modalCreateBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
    },
    modalCreateBtnText: {
      color: '#ffffff',
      fontWeight: '700',
    },
  });
};
