import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';

import { useTheme } from '../context/ThemeContext';
import { DoodleBackground } from '@/components/DoodleBackground';
import { SyncAvatar } from '@/components/SyncAvatar';
import { useUserStore } from '@/hooks/useUser';
import { useZone } from '@/hooks/useZone';
import { api } from '@/services/api';
import { optimizeImage } from '@/lib/mediaUtils';

interface MediaAsset {
  id: string;
  title: string;
  name?: string;
  url: string;
  type: 'video' | 'audio' | 'image' | 'document';
  category?: string;
  views?: string | number;
  duration?: string;
  thumbnailUrl?: string;
  image?: string;
  createdAt?: string;
  channelName?: string;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diffInSeconds) || diffInSeconds < 0) return '';
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

function formatViews(views?: string | number): string {
  if (!views && views !== 0) return '';
  const num = typeof views === 'string' ? parseInt(views.replace(/[^0-9]/g, ''), 10) : views;
  if (isNaN(num)) return typeof views === 'string' ? views : '';
  if (num === 0) return '0 views';
  if (num < 1000) return `${num} ${num === 1 ? 'view' : 'views'}`;
  if (num < 1000000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K views`;
  return `${(num / 1000000).toFixed(1)}M views`;
}

// ── In-App Video Modal Player ────────────────────────────────────────────────
function VideoPlayerModal({
  video,
  onClose,
}: {
  video: MediaAsset | null;
  onClose: () => void;
}) {
  if (!video || !video.url) return null;
  return <VideoPlayerInner video={video} onClose={onClose} />;
}

function VideoPlayerInner({
  video,
  onClose,
}: {
  video: MediaAsset;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(video.url, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" backgroundColor="#000000" />
        {/* Top bar */}
        <SafeAreaView
          edges={['top']}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 20,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: '600',
              flex: 1,
              marginHorizontal: 12,
            }}
            numberOfLines={1}
          >
            {video.title}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Video Canvas */}
        <View
          style={{
            flex: 1,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <VideoView
            style={{ width: '100%', height: '100%' }}
            player={player}
            nativeControls={true}
            contentFit="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function MediaScreen({ navigation }: any) {
  const { theme } = useTheme();
  const T = theme.colors;
  const user = useUserStore((s) => s.user);
  const { currentZone } = useZone();

  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeVideo, setActiveVideo] = useState<MediaAsset | null>(null);

  const fetchMediaData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const resolvedZoneId = currentZone?.id || '';
      // Pull videos from media library API service
      const mediaRes = await api.media.getAll(resolvedZoneId, 100).catch(() => null);

      let assets: any[] = [];
      if (mediaRes?.success && Array.isArray(mediaRes.data)) {
        assets = mediaRes.data;
      } else if (Array.isArray(mediaRes)) {
        assets = mediaRes;
      }

      const formatted: MediaAsset[] = assets.map((m: any) => ({
        id: m.id || String(Math.random()),
        title: m.title || m.name || 'Loveworld Media',
        url: m.url || m.videoUrl || '',
        type: (m.type || 'video').toLowerCase(),
        category: m.category || m.folder || 'Rehearsal',
        views: m.views ?? 0,
        duration: m.duration || 'Rehearsal',
        thumbnailUrl: m.thumbnailUrl || m.thumbnail || m.imageUrl || m.image || null,
        createdAt: m.createdAt || m.created_at,
        channelName: m.channelName || currentZone?.name || 'Loveworld Singers',
      }));

      // Strictly videos from media folder/route
      const videosOnly = formatted.filter((item) => item.type === 'video' || item.url);
      setMediaList(videosOnly);
    } catch (err) {
      console.error('[MediaScreen] fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentZone?.id, currentZone?.name]);

  useEffect(() => {
    fetchMediaData();
  }, [fetchMediaData]);

  const onRefresh = () => {
    fetchMediaData(true);
  };

  const openMedia = async (asset: MediaAsset) => {
    if (!asset.url) return;

    if (asset.type === 'audio') {
      navigation.navigate('Player', {
        activeTrack: {
          id: asset.id,
          title: asset.title,
          audioUrl: asset.url,
          audioFile: asset.url,
        },
        fromAllSongs: false,
      });
      return;
    }

    const isYouTube =
      asset.url.includes('youtube.com') ||
      asset.url.includes('youtu.be') ||
      asset.url.includes('m.youtube.com');

    if (isYouTube) {
      await Linking.openURL(asset.url).catch(() => {});
    } else {
      setActiveVideo(asset);
    }
  };

  // Filter videos purely by search query
  const filteredVideos = mediaList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.channelName && item.channelName.toLowerCase().includes(q))
    );
  });

  return (
    <View style={{ backgroundColor: T.background, flex: 1 }}>
      <LinearGradient
        colors={theme.gradients.bgBase as any}
        locations={theme.gradients.bgBaseLocations as any}
        style={StyleSheet.absoluteFill}
      />
      <DoodleBackground />
      <LinearGradient
        colors={theme.gradients.bgGlow as any}
        locations={theme.gradients.bgGlowLocations as any}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Screen strictly wrapped inside SafeAreaView */}
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1 }}>
        <StatusBar style="light" />

        {/* ── Top Bar (Loveworld Singers Branded) ────────────────────────── */}
        <View style={styles.headerBar}>
          {isSearching ? (
            <View style={styles.searchHeaderWrap}>
              <TouchableOpacity
                onPress={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                style={styles.headerIconBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search videos..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.6)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.headerMainRow}>
              {/* Left: Back button + Loveworld Singers Logo + Title */}
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  onPress={() => {
                    if (navigation?.canGoBack && navigation.canGoBack()) {
                      navigation.goBack();
                    } else {
                      navigation.navigate('Home');
                    }
                  }}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.logoTitleWrap}>
                  <Image
                    source={require('../../assets/logo/logo.png')}
                    style={{ height: 26, width: 38 }}
                    contentFit="contain"
                  />
                  <Text style={styles.headerTitle}>Media</Text>
                </View>
              </View>

              {/* Right: Search + User Avatar */}
              <View style={styles.headerRight}>
                <TouchableOpacity
                  onPress={() => setIsSearching(true)}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <SyncAvatar
                  userId={user?.uid}
                  fallbackName="Me"
                  size={30}
                  bgColor="rgba(255, 255, 255, 0.15)"
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Video Feed: Strictly under SafeAreaView with proper margins ──── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={T.accent}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={T.accent} />
              <Text style={styles.loadingText}>Loading videos...</Text>
            </View>
          ) : filteredVideos.length === 0 ? (
            <View style={styles.emptyCenter}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="videocam-outline" size={40} color="rgba(255, 255, 255, 0.4)" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No videos match your search' : 'No videos available yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Couldn't find anything for "${searchQuery}". Try another keyword.`
                  : 'Videos uploaded to your media library will appear here.'}
              </Text>
            </View>
          ) : (
            filteredVideos.map((video) => {
              const viewsText = formatViews(video.views);
              const timeText = formatTimeAgo(video.createdAt);
              const metaParts = [video.channelName || video.category, viewsText, timeText].filter(
                Boolean
              );

              return (
                <TouchableOpacity
                  key={video.id}
                  activeOpacity={0.88}
                  onPress={() => openMedia(video)}
                  style={styles.videoCard}
                >
                  {/* 16:9 Video Thumbnail Preview (Card container with margins) */}
                  <View style={[styles.thumbnailContainer, { backgroundColor: T.surface || '#1C1C1E' }]}>
                    <Image
                      source={
                        video.thumbnailUrl
                          ? { uri: optimizeImage(video.thumbnailUrl, { width: 640, quality: 75 }) }
                          : require('../../assets/image/home4.png')
                      }
                      style={styles.thumbnailImage}
                      contentFit="cover"
                      transition={200}
                    />

                    {/* Play Button Overlay */}
                    <View style={styles.playOverlay}>
                      <View style={[styles.playOverlayCircle, { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: T.accent }]}>
                        <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
                      </View>
                    </View>

                    {/* Duration Badge */}
                    {Boolean(video.duration) && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{video.duration}</Text>
                      </View>
                    )}
                  </View>

                  {/* Video Info Row */}
                  <View style={styles.videoInfoRow}>
                    {/* Channel / Singer Avatar */}
                    <View style={styles.channelAvatar}>
                      <LinearGradient
                        colors={[T.accent, '#4A00E0']}
                        style={styles.channelAvatarGradient}
                      >
                        <Text style={styles.channelAvatarText}>
                          {(video.channelName || video.category || 'L')[0].toUpperCase()}
                        </Text>
                      </LinearGradient>
                    </View>

                    {/* Title & Metadata */}
                    <View style={styles.videoMetaContainer}>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <Text style={styles.videoSubtitle} numberOfLines={1}>
                        {metaParts.join(' • ')}
                      </Text>
                    </View>

                    {/* Options Icon */}
                    <TouchableOpacity
                      style={styles.videoOptionsBtn}
                      onPress={() => openMedia(video)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={18}
                        color="rgba(255, 255, 255, 0.65)"
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* ── Video Player Modal ────────────────────────────────────────── */}
        <VideoPlayerModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 0,
  },
  feedContent: {
    paddingTop: 16,
    paddingBottom: 36,
  },
  videoCard: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  playOverlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  videoInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 12,
  },
  channelAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  channelAvatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  videoMetaContainer: {
    flex: 1,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  videoSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 16,
  },
  videoOptionsBtn: {
    padding: 6,
    marginLeft: 4,
  },
  loadingCenter: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  emptyCenter: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
});