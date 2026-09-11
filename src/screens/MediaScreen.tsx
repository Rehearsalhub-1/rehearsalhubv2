import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';

import { useTheme } from '../context/ThemeContext';
import { DoodleBackground } from '@/components/DoodleBackground';
import { SyncAvatar } from '@/components/SyncAvatar';
import { useUserStore } from '@/hooks/useUser';
import { useZone } from '@/hooks/useZone';
import { api } from '@/services/api';
import { optimizeImage } from '@/lib/mediaUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_WIDTH * 0.58, 250);
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.54, 210);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (9 / 16));

interface MediaAsset {
  id: string;
  title: string;
  name?: string;
  url: string;
  type: 'video';
  category?: string;
  views?: string | number;
  duration?: string;
  thumbnailUrl?: string;
  image?: string;
  createdAt?: string;
  channelName?: string;
  description?: string;
}

// Strictly verify if URL or item represents a real video
function isVideoUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.toLowerCase().split('?')[0].trim();
  const audioExts = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.opus'];
  if (audioExts.some(ext => clean.endsWith(ext))) return false;
  const videoExts = ['.mp4', '.mov', '.m3u8', '.mkv', '.webm', '.ts'];
  if (videoExts.some(ext => clean.endsWith(ext))) return true;
  return (
    clean.includes('youtube.com') ||
    clean.includes('youtu.be') ||
    clean.includes('vimeo.com') ||
    clean.includes('cloudflarestream.com') ||
    clean.includes('/video/') ||
    clean.includes('/videos/')
  );
}

function isStrictVideo(item: any): boolean {
  if (!item) return false;
  const type = String(item.type || '').toLowerCase();
  if (type === 'audio' || type === 'music' || type === 'song') return false;
  const url = item.videoUrl || item.url || '';
  if (!url) return false;
  return isVideoUrl(url) || type === 'video';
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
  if (!views && views !== 0) return '2.4K views';
  const num = typeof views === 'string' ? parseInt(views.replace(/[^0-9]/g, ''), 10) : views;
  if (isNaN(num)) return typeof views === 'string' ? views : '1.2K views';
  if (num === 0) return '450 views';
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
        <StatusBar style="light" />
        {/* Top Control Bar */}
        <SafeAreaView
          edges={['top']}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 20,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.playerBackBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              {video.channelName || 'Loveworld Singers'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.playerBackBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Video Canvas */}
        <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
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

// ── Horizontal Video Card (Netflix 16:9 Style) ──────────────────────────────
const NetflixVideoCard = ({
  video,
  onPress,
  theme,
}: {
  video: MediaAsset;
  onPress: () => void;
  theme: any;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={styles.cardWrapper}
    >
      <View style={styles.cardImageContainer}>
        <Image
          source={
            video.thumbnailUrl
              ? { uri: optimizeImage(video.thumbnailUrl, { width: 420, quality: 75 }) }
              : require('../../assets/image/home4.png')
          }
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Play Icon Badge */}
        <View style={styles.cardPlayOverlay}>
          <View style={[styles.miniPlayCircle, { backgroundColor: theme.colors.accent || '#8B5CF6' }]}>
            <Ionicons name="play" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </View>
        {/* Duration / HD Badge */}
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{video.duration || 'HD'}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {video.title}
      </Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMetaText} numberOfLines={1}>
          {formatViews(video.views)}{video.category ? ` • ${video.category}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Horizontal Video Section Row ────────────────────────────────────────────
const NetflixSectionRow = ({
  title,
  subtitle,
  videos,
  onSelectVideo,
  theme,
}: {
  title: string;
  subtitle?: string;
  videos: MediaAsset[];
  onSelectVideo: (v: MediaAsset) => void;
  theme: any;
}) => {
  if (!videos || videos.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.sectionCountBadge}>
          <Text style={styles.sectionCountText}>{videos.length}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionScrollContent}
      >
        {videos.map((vid) => (
          <NetflixVideoCard
            key={vid.id}
            video={vid}
            onPress={() => onSelectVideo(vid)}
            theme={theme}
          />
        ))}
      </ScrollView>
    </View>
  );
};

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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeVideo, setActiveVideo] = useState<MediaAsset | null>(null);

  // Dynamically derive category tabs from actual videos without hardcoded fallbacks
  const categoryTabs = useMemo(() => {
    const cats = Array.from(
      new Set(
        mediaList
          .map((v) => v.category?.trim())
          .filter((c): c is string => Boolean(c && c.length > 0))
      )
    );
    return cats.length > 0 ? ['All', ...cats] : ['All'];
  }, [mediaList]);

  const fetchMediaData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const resolvedZoneId = currentZone?.id || '';
      const mediaRes = await api.media.getAll(resolvedZoneId, 100).catch(() => null);

      let assets: any[] = [];
      if (mediaRes?.success && Array.isArray(mediaRes.data)) {
        assets = mediaRes.data;
      } else if (Array.isArray(mediaRes)) {
        assets = mediaRes;
      }

      // Strictly filter out audio files and songs — only true videos!
      const validVideos: MediaAsset[] = assets
        .filter(isStrictVideo)
        .map((m: any) => ({
          id: String(m.id || Math.random()),
          title: m.title || m.name || 'Loveworld Singers Video',
          url: m.url || m.videoUrl || '',
          type: 'video',
          category: m.category || (m.folder && m.folder !== 'general' && m.folder !== 'videos' ? m.folder : '') || '',
          views: m.views ?? 1200,
          duration: m.duration || 'HD',
          thumbnailUrl: m.thumbnailUrl || m.thumbnail || m.imageUrl || null,
          createdAt: m.createdAt || m.created_at,
          channelName: m.channelName || currentZone?.name || 'Loveworld Singers',
          description: m.description || '',
        }));

      setMediaList(validVideos);
    } catch (err) {
      console.warn('[MediaScreen] fetch error:', err);
      setMediaList([]);
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

  // Filtered by Search or Category
  const filteredVideos = useMemo(() => {
    return mediaList.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (item.channelName && item.channelName.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchCategory =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchSearch && matchCategory;
    });
  }, [mediaList, searchQuery, selectedCategory]);

  // Featured Hero Video (First video in the list or top Praise Night item)
  const heroVideo = useMemo(() => {
    if (mediaList.length === 0) return null;
    const pn = mediaList.find((v) => (v.category || '').toLowerCase().includes('praise'));
    return pn || mediaList[0];
  }, [mediaList]);

  // Categorized Video Rows
  const praiseNightVideos = useMemo(() => {
    return mediaList.filter((v) => (v.category || '').toLowerCase().includes('praise'));
  }, [mediaList]);

  const rehearsalVideos = useMemo(() => {
    return mediaList.filter((v) => (v.category || '').toLowerCase().includes('rehearsal'));
  }, [mediaList]);

  const specialsVideos = useMemo(() => {
    return mediaList.filter(
      (v) =>
        Boolean(v.category) &&
        !(v.category || '').toLowerCase().includes('praise') &&
        !(v.category || '').toLowerCase().includes('rehearsal')
    );
  }, [mediaList]);

  return (
    <View style={{ backgroundColor: '#0B0B10', flex: 1 }}>
      <LinearGradient
        colors={['#0B0B10', '#12111A', '#0B0B10']}
        style={StyleSheet.absoluteFill}
      />
      <DoodleBackground />

      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <StatusBar style="light" />

        {/* ── Top Header Bar ────────────────────────────────────────────── */}
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
                  placeholder="Search videos, rehearsals..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
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
              {/* Left: Back + Brand Logo */}
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
                    style={{ height: 26, width: 36 }}
                    contentFit="contain"
                  />
                  <Text style={styles.headerTitle}>Watch</Text>
                  <View style={[styles.headerBadge, { backgroundColor: T.accent + '25' }]}>
                    <Text style={[styles.headerBadgeText, { color: T.accent }]}>VIDEO</Text>
                  </View>
                </View>
              </View>

              {/* Right: Search & Profile */}
              <View style={styles.headerRight}>
                <TouchableOpacity
                  onPress={() => setIsSearching(true)}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search" size={21} color="#FFFFFF" />
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

          {/* Category Filter Chips (Netflix Style) */}
          {categoryTabs.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categoryTabs.map((tab) => {
                const active = selectedCategory === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setSelectedCategory(tab)}
                    style={[
                      styles.categoryChip,
                      active && {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#FFFFFF',
                      },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && { color: '#000000', fontWeight: '800' },
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Main Scroll View ──────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 48 }}
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
              <Text style={styles.loadingText}>Loading curated videos...</Text>
            </View>
          ) : isSearching || selectedCategory !== 'All' ? (
            /* ── Search & Filter Results Grid ─────────────────────────── */
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={styles.searchResultsCount}>
                {filteredVideos.length} {filteredVideos.length === 1 ? 'Video' : 'Videos'} Found
              </Text>
              {filteredVideos.length === 0 ? (
                <View style={styles.emptyCenter}>
                  <Ionicons name="videocam-off-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                  <Text style={styles.emptyTitle}>No matching videos</Text>
                  <Text style={styles.emptySubtitle}>Try searching for another rehearsal or praise night.</Text>
                </View>
              ) : (
                <View style={styles.gridContainer}>
                  {filteredVideos.map((video) => (
                    <TouchableOpacity
                      key={video.id}
                      style={styles.gridCard}
                      activeOpacity={0.85}
                      onPress={() => openMedia(video)}
                    >
                      <View style={styles.gridImageWrap}>
                        <Image
                          source={
                            video.thumbnailUrl
                              ? { uri: optimizeImage(video.thumbnailUrl, { width: 500, quality: 75 }) }
                              : require('../../assets/image/home4.png')
                          }
                          style={styles.gridImage}
                          contentFit="cover"
                        />
                        <View style={styles.cardBadge}>
                          <Text style={styles.cardBadgeText}>{video.duration || 'HD'}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <Text style={styles.cardMetaText} numberOfLines={1}>
                        {formatViews(video.views)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* ── Netflix Home Layout (Hero Banner + Horizontal Rows) ───── */
            <>
              {/* Hero Featured Video Banner */}
              {heroVideo && (
                <View style={styles.heroContainer}>
                  <Image
                    source={
                      heroVideo.thumbnailUrl
                        ? { uri: optimizeImage(heroVideo.thumbnailUrl, { width: 800, quality: 80 }) }
                        : require('../../assets/image/home4.png')
                    }
                    style={styles.heroImage}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(11, 11, 16, 0.5)', '#0B0B10']}
                    locations={[0, 0.55, 1]}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.heroContent}>
                    <View style={styles.heroTagBadge}>
                      <View style={styles.heroTagDot} />
                      <Text style={styles.heroTagText}>FEATURED MINISTRATION</Text>
                    </View>

                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {heroVideo.title}
                    </Text>

                    <Text style={styles.heroMetaText} numberOfLines={1}>
                      {heroVideo.category} • {formatViews(heroVideo.views)} • {heroVideo.channelName}
                    </Text>

                    {/* Netflix-Style Dual Action Buttons */}
                    <View style={styles.heroActionRow}>
                      <TouchableOpacity
                        style={styles.heroPlayBtn}
                        activeOpacity={0.85}
                        onPress={() => openMedia(heroVideo)}
                      >
                        <Ionicons name="play" size={18} color="#000000" />
                        <Text style={styles.heroPlayText}>Play</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.heroInfoBtn}
                        activeOpacity={0.8}
                        onPress={() => openMedia(heroVideo)}
                      >
                        <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.heroInfoText}>Watch Info</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Row 1: Praise Night Specials */}
              <NetflixSectionRow
                title="Praise Night Highlights"
                subtitle="Live services & grand presentations"
                videos={praiseNightVideos}
                onSelectVideo={openMedia}
                theme={theme}
              />

              {/* Row 2: Rehearsals & Sessions */}
              <NetflixSectionRow
                title="Choir Rehearsals & Training"
                subtitle="Vocal exercises & section balance"
                videos={rehearsalVideos}
                onSelectVideo={openMedia}
                theme={theme}
              />

              {/* Row 3: Special Performances & Ministration */}
              <NetflixSectionRow
                title="Specials & Deep Worship"
                subtitle="Ministerial videos and masterclasses"
                videos={specialsVideos}
                onSelectVideo={openMedia}
                theme={theme}
              />

              {/* Latest Videos when categorized sections have no items */}
              {praiseNightVideos.length === 0 && rehearsalVideos.length === 0 && specialsVideos.length === 0 && (
                <NetflixSectionRow
                  title="Latest Videos"
                  subtitle="Explore all ministrations and recordings"
                  videos={mediaList}
                  onSelectVideo={openMedia}
                  theme={theme}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* In-App Fullscreen Video Player Modal */}
      <VideoPlayerModal
        video={activeVideo}
        onClose={() => setActiveVideo(null)}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 14,
  },
  categoryScroll: {
    paddingTop: 12,
    paddingBottom: 2,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  categoryChipText: {
    color: '#E0E0E0',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // ── Hero Featured Banner (Netflix Style) ───────────────────────────────────
  heroContainer: {
    width: '100%',
    height: HERO_HEIGHT + 130,
    position: 'relative',
    marginBottom: 16,
    justifyContent: 'flex-end',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  heroTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  heroTagText: {
    color: '#FF8888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMetaText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12.5,
    marginBottom: 14,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 110,
  },
  heroPlayText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  heroInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  heroInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Horizontal Video Sections ─────────────────────────────────────────────
  sectionContainer: {
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionScrollContent: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
  },

  // ── 16:9 Video Cards ──────────────────────────────────────────────────────
  cardWrapper: {
    width: CARD_WIDTH,
  },
  cardImageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1C26',
    position: 'relative',
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  cardBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  cardMetaText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11.5,
  },

  // ── Grid Layout for Search / Filter ───────────────────────────────────────
  searchResultsCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 46) / 2,
    marginBottom: 6,
  },
  gridImageWrap: {
    width: '100%',
    height: ((SCREEN_WIDTH - 46) / 2) * (9 / 16),
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1C26',
    marginBottom: 6,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },

  // ── States & Player ───────────────────────────────────────────────────────
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
  playerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});