import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { DoodleBackground } from '../components/DoodleBackground';
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  AppState
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
const TRACKS_DB: Record<string, any> = {
  '1': { id: '1', title: 'Global Communion Service', subtitle: 'Live Recording', program: 'Global Communion Service', leadSinger: 'Pastor Saki', writer: 'Pastor Saki', conductor: 'Evang. Kathy', key: 'Eb Major', tempo: '68 BPM', category: 'Global Communion', image: require('../../assets/image/home1.jpg') },
  '2': { id: '2', title: 'Praise Night 18', subtitle: 'Loveworld Singers', program: 'Praise Night 18', leadSinger: 'Evang. Kathy', writer: 'Loveworld Singers', conductor: 'Evang. Kathy', key: 'G Major', tempo: '72 BPM', category: 'Praise Night', image: require('../../assets/image/home9.jpg') },
  '3': { id: '3', title: 'Midweek Service', subtitle: 'Session 1', program: 'Midweek Service', leadSinger: 'Sylvia', writer: 'Loveworld Singers', conductor: 'Evang. Kathy', key: 'C Major', tempo: '65 BPM', category: 'Midweek', image: require('../../assets/banner/praisenight28.jpg') },
  '4': { id: '4', title: 'Sunday Special', subtitle: 'Choir Ministration', program: 'Sunday Special', leadSinger: 'Eli-J', writer: 'Eli-J', conductor: 'Pastor Saki', key: 'D Major', tempo: '80 BPM', category: 'Sunday Special', image: require('../../assets/banner/praisenight28.jpg') },
  '5': { id: '5', title: 'Your Loveworld Specials', subtitle: 'Day 2', program: 'Your Loveworld Specials', leadSinger: 'Rozey', writer: 'Rozey', conductor: 'Pastor Saki', key: 'F Major', tempo: '70 BPM', category: 'Special Events', image: require('../../assets/banner/praisenight28.jpg') },
  '6': { id: '6', title: 'Healing Streams', subtitle: 'Live Service', program: 'Healing Streams Live', leadSinger: 'Chookar', writer: 'Chookar', conductor: 'Evang. Kathy', key: 'A Major', tempo: '75 BPM', category: 'Special Events', image: require('../../assets/banner/praisenight28.jpg') },
  '7': { id: '7', title: 'IPPC 2026', subtitle: 'Choir Session', program: 'IPPC 2026', leadSinger: 'Pastor Saki', writer: 'Loveworld Singers', conductor: 'Pastor Saki', key: 'Bb Major', tempo: '68 BPM', category: 'Special Events', image: require('../../assets/banner/praisenight28.jpg') }
};

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
  const [resolvedTracksCache, setResolvedTracksCache] = useState<Record<string, any>>(TRACKS_DB);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
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

  useEffect(() => {
    if (!user) return;

    const syncUserData = () => {
      // playlists sync
      api.playlists.getAll().then(res => {
        if (res?.success && Array.isArray(res.data)) {
          setPlaylists(res.data);
          setIsLoadingTracks(false);
        }
      }).catch(() => setIsLoadingTracks(false));

      // favorites sync
      api.favorites.getAll().then(res => {
        if (res && res.data) {
          const raw = res.data as any;
          const songIds = Array.isArray(raw) ? raw : Array.isArray(raw?.songs) ? raw.songs : [];
          setFavoriteIds(songIds);
        }
      }).catch(() => {});
    };

    if (AppState.currentState === 'active') {
      syncUserData();
    }

    const appStateSub = AppState.addEventListener('change', (nextState: any) => {
      if (nextState === 'active') {
        syncUserData();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [user]);

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
        style={styles.trackRow}
        activeOpacity={0.7}
        onPress={() => handleTrackPress(track)}>
        <View style={{ position: 'relative' }}>
          <Image source={track.image} style={styles.trackRowImage} contentFit="cover" />
          {!hasAudio && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="volume-mute" size={18} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </View>
        <View style={styles.trackRowInfo}>
          <Text style={[styles.trackRowTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1}>{track.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 120 }}>
              {!hasAudio ? (
                <Ionicons name="volume-mute-outline" size={12} color="#fb923c" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons name={isActiveTrack ? 'volume-high' : 'musical-notes'} size={12} color={isActiveTrack ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.trackRowSubtitle, { flex: 1 }, isActiveTrack && { color: theme.colors.accent }, !hasAudio && { color: '#fb923c' }]} numberOfLines={1}>
                {!hasAudio ? 'No audio yet' : track.leadSinger || 'Unknown Singer'}
              </Text>
            </View>
            {hasAudio && track.program && (
              <View style={{
                backgroundColor: (theme.colors.accent || theme.colors.accent) + '15',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: (theme.colors.accent || theme.colors.accent) + '40',
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 1.5,
              }}>
                <Text style={{ fontSize: 10, color: theme.colors.accent || theme.colors.accent, fontWeight: '600' }} numberOfLines={1}>
                  {track.program}
                </Text>
              </View>
            )}
          </View>
          {playlistSongNote ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(192, 132, 252, 0.08)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              marginTop: 6,
              alignSelf: 'flex-start',
              gap: 4
            }}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color={theme.colors.accent} />
              <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: '500' }}>
                {playlistSongNote}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.trackMoreButton} onPress={(e) => {
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
            <>
              <SafeAreaView edges={['top']} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                    <TouchableOpacity
                      style={{ marginRight: 16 }}
                      onPress={() => {
                        setActiveCollection('library');
                      }}>
                      <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.libraryTitle, { fontSize: 22 }]} numberOfLines={1}>{title}</Text>
                      <Text style={styles.trackRowSubtitle}>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</Text>
                    </View>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {tracks.length > 0 && (
                      <TouchableOpacity onPress={() => {
                         setSharePlaylist({ id: activePlaylistData?.id || 'favs', name: title, songs: tracks });
                         setShowShareSheet(true);
                      }}>
                        <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.textPrimary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </SafeAreaView>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isLoadingTracks ? (
                <Text style={styles.emptyText}>Loading songs...</Text>
              ) : (
                <>
                  <Text style={styles.emptyText}>It's a bit empty here.</Text>
                  <Text style={styles.emptySubtext}>Start adding some songs!</Text>
                </>
              )}
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
      <View style={styles.libraryHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ marginRight: 16 }}
            onPress={() => {
              navigation.goBack();
            }}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.libraryTitle}>Your Playlists</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.content}
        showsVerticalScrollIndicator={false}
        data={playlists}
        keyExtractor={pl => pl.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={[styles.libraryList, { paddingBottom: 100 }]}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.libraryRow}
            activeOpacity={0.8}
            onPress={() => {
              setActiveCollection('favorites');
            }}
          >
            <LinearGradient
              colors={[theme.colors.accent, theme.colors.textPrimary]}
              style={styles.libraryRowArt}
            >
              <Ionicons name="heart" size={32} color={theme.colors.textPrimary} />
            </LinearGradient>
            <View style={styles.libraryRowInfo}>
              <Text style={styles.libraryRowTitle}>Liked Songs</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pin" size={12} color="#1db954" style={{ marginRight: 4 }} />
                <Text style={styles.libraryRowSubtitle}>{favoriteIds.length} songs</Text>
              </View>
            </View>
          </TouchableOpacity>
        }
        renderItem={({ item: pl }) => (
          <TouchableOpacity
            style={styles.libraryRow}
            activeOpacity={0.8}
            onPress={() => {
              setActivePlaylistData(pl);
              setActiveCollection(pl.id);
            }}
          >
            <View style={[styles.libraryRowArt, { backgroundColor: theme.colors.cardBackgroundLight }]}>
              <Ionicons name="albums-outline" size={28} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.libraryRowInfo}>
              <Text style={styles.libraryRowTitle}>{pl.name}</Text>
              <Text style={styles.libraryRowSubtitle}>Playlist • {(pl.songs || []).length} songs</Text>
            </View>
          </TouchableOpacity>
        )}
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

  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  libraryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800'
  },
  libraryList: {
    paddingHorizontal: 16,
    paddingTop: 16
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  libraryRowArt: {
    width: 64,
    height: 64,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  libraryRowInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  libraryRowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  libraryRowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400'
  },

  backButton: {
    paddingHorizontal: 16,
    marginBottom: 20
  },
  tracksContainer: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  trackRowImage: {
    width: 52,
    height: 52,
    marginRight: 12
  },
  trackRowInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  trackRowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  trackRowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  },
  trackMoreButton: {
    padding: 12
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500'
  }
});
};
