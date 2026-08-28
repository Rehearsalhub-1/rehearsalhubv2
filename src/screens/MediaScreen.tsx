import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, RefreshControl, ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { DoodleBackground } from '@/components/DoodleBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
const FeatherIcon: any = Icon;
import { SyncAvatar } from '@/components/SyncAvatar';
import { useUserStore } from '@/hooks/useUser';
import { useZone } from '@/hooks/useZone';
import { apiClient } from '@/lib/apiClient';
import { optimizeImage, optimizeAudio } from '@/lib/mediaUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  isShort?: boolean;
}

export default function MediaScreen({ navigation }: any) {
  const { theme, themeName } = useTheme();
  const T = theme.colors;
  const user = useUserStore(s => s.user);
  const { currentZone } = useZone();

  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All', 'Rehearsal', 'Praise Night', 'Communion', 'Live']);
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMediaData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const resolvedZoneId = currentZone?.id || '';
      const zoneParam = resolvedZoneId ? `&zoneId=${encodeURIComponent(resolvedZoneId)}` : '';

      const [mediaRes, catRes] = await Promise.all([
        apiClient.get<any>(`/media?limit=50${zoneParam}`).catch(() => null),
        apiClient.get<any>('/media/categories').catch(() => null),
      ]);

      if (catRes?.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
        const catNames = ['All', ...catRes.data.map((c: any) => typeof c === 'string' ? c : c.name || c.title).filter(Boolean)];
        setCategories([...new Set(catNames)]);
      }

      let assets: MediaAsset[] = [];
      if (mediaRes?.success && Array.isArray(mediaRes.data)) {
        assets = mediaRes.data;
      } else if (Array.isArray(mediaRes)) {
        assets = mediaRes;
      }

      const formatted = assets.map((m: any) => ({
        id: m.id || String(Math.random()),
        title: m.title || m.name || 'Loveworld Media',
        url: m.url || '',
        type: m.type || 'video',
        category: m.category || 'General',
        views: m.views ? `${m.views} views` : 'New',
        duration: m.duration || 'Rehearsal',
        thumbnailUrl: m.thumbnailUrl || m.imageUrl || m.image || null,
        createdAt: m.createdAt || m.created_at,
        isShort: Boolean(m.isShort || m.isPortrait || (m.tags && m.tags.includes('shorts'))),
      }));

      setMediaList(formatted);
    } catch (err) {
      console.error('[MediaScreen] fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentZone?.id]);

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
        activeTrack: { id: asset.id, title: asset.title, audioUrl: asset.url, audioFile: asset.url },
        fromAllSongs: false,
      });
      return;
    }
    await Linking.openURL(asset.url).catch(() => {});
  };

  const filteredList = mediaList.filter(item => {
    if (activeCategory === 'All') return true;
    const cat = (item.category || '').toLowerCase();
    return cat.includes(activeCategory.toLowerCase());
  });

  const shortVideos = filteredList.filter(m => m.isShort || m.type === 'video');
  const recentVideos = filteredList.filter(m => !m.isShort);

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
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, paddingTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Image source={require("../../assets/logo/logo.png")} style={{ height: 28, width: 40 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: 'white' }}>Media</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <FeatherIcon.Search stroke="#FFF" height={24} width={24} />
          <SyncAvatar 
            userId={user?.uid}
            fallbackName="Me"
            size={28}
            bgColor="rgba(255,255,255,0.1)"
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, marginTop: 6 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={T.accent} />}
      >
        <View style={{ paddingTop: 6, paddingBottom: 5, paddingHorizontal: 16 }}>
          <ScrollView style={{ paddingHorizontal: 4 }} horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((category, i) => {
              const isActive = category === activeCategory;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setActiveCategory(category)}
                  style={{
                    backgroundColor: isActive ? T.accent : 'rgba(255,255,255,0.15)',
                    borderRadius: 20,
                    paddingVertical: 6,
                    paddingHorizontal: 16,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 13 }}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : (
          <>
            {shortVideos.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 14 }}>Shorts & Clips</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {shortVideos.slice(0, 10).map((video) => (
                    <TouchableOpacity
                      key={video.id}
                      activeOpacity={0.8}
                      onPress={() => openMedia(video)}
                      style={{ width: 140, height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface }}
                    >
                      <Image
                        source={video.thumbnailUrl ? { uri: optimizeImage(video.thumbnailUrl, { width: 300, quality: 60 }) } : require('../../assets/image/home8.jpg')}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 12 }]}
                      >
                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }} numberOfLines={2}>{video.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>{video.views}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ marginTop: 28, marginHorizontal: 16, paddingBottom: 40 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>All Media</Text>
              {filteredList.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>No media files found in this category.</Text>
                </View>
              ) : (
                filteredList.map((video) => (
                  <TouchableOpacity key={video.id} activeOpacity={0.8} onPress={() => openMedia(video)} style={{ marginBottom: 20 }}>
                    <View style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface }}>
                      <Image
                        source={video.thumbnailUrl ? { uri: optimizeImage(video.thumbnailUrl, { width: 600, quality: 65 }) } : require('../../assets/image/home4.png')}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                      <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{video.duration}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{video.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>{video.category} • {video.views}</Text>
                      </View>
                      <TouchableOpacity style={{ padding: 4 }} onPress={() => openMedia(video)}>
                        <FeatherIcon.MoreVertical stroke="rgba(255,255,255,0.7)" width={20} height={20} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
 