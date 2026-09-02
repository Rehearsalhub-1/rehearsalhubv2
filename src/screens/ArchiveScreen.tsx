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
  ActivityIndicator,
  RefreshControl } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

import { isHQGroup } from '../config/zones';
import { readCache, writeCache } from '../lib/screenCache';
import { optimizeImage } from '../lib/mediaUtils';
import { api, clearCache } from '../services/api';
import { useZone } from '../hooks/useZone';
import { useUserStore } from '../hooks/useUser';
import { isHQAdmin, canAccessArchive, getHiddenFeatures } from '../config/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ArchiveScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { currentZone, isLoading: isZoneLoading, zoneVersion } = useZone();
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);

  const hf = getHiddenFeatures(profile);
  const hasArchiveAccess = !hf.hideArchives && canAccessArchive(profile);

  if (!isProfileLoading && !hasArchiveAccess) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }]}>
          <Ionicons name="lock-closed" size={80} color={theme.colors.accent} style={{ marginBottom: 24 }} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>Access Restricted</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            You do not have permission to access the Archives. Please contact a Central Administrator if you believe this is an error.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: theme.colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 }}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    clearCache();
    setReloadKey(prev => prev + 1);
  };

  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    let active = true;

    async function loadData() {
      const cacheKey = `archive_categories_${currentZone?.id || 'default'}`;
      const cached = await readCache<any[]>(cacheKey);
      if (cached && cached.length > 0 && active) {
        setCategories(cached);
        setIsLoading(false); // show cached data immediately
      }
      try {
        const resolvedZoneId = currentZone?.id || 'zone-001';
        
        const isHQ = isHQGroup(resolvedZoneId);

        const [categoriesResult, programsResult] = await Promise.all([
          api.categories.getPage(isHQ ? undefined : resolvedZoneId).catch(() => null),
          api.programs.getAll(isHQ ? undefined : resolvedZoneId).catch(() => null),
        ]);

        let fetchedCategories: any[] = categoriesResult?.success && Array.isArray(categoriesResult.data) ? categoriesResult.data : [];
        let allPrograms: any[] = [];
        if (programsResult?.success && Array.isArray(programsResult.data)) {
          allPrograms = programsResult.data;
        } else if (Array.isArray(programsResult)) {
          allPrograms = programsResult;
        }

        if (active) {
          const mappedCategories = fetchedCategories.map((cat: any) => {
            const progs = allPrograms.filter((p: any) => {
              const isArchive = p.category === 'archive';
              const matchesCategory = p.pageCategory === cat.name;
              return isArchive && matchesCategory;
            });

            progs.sort((a: any, b: any) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });

            return {
              id: cat.id,
              name: cat.name || cat.title || 'Category',
              description: cat.description || `View recordings and sessions for ${cat.name || 'this category'}.`,
              programCount: `${progs.length} ${progs.length === 1 ? 'Program' : 'Programs'}`,
              image: progs[0]?.bannerImage ? { uri: optimizeImage(progs[0].bannerImage, { width: 600, quality: 60 }) } : cat.image ? { uri: optimizeImage(cat.image, { width: 600, quality: 60 }) } : require('../../assets/image/home9.jpg'),
              programs: progs.map((p: any) => {
                // Extract song count from all possible rawData fields
                const raw = p.rawData || p.raw || {};
                const count =
                  p.songCount ??
                  p.song_count ??
                  raw.songCount ??
                  raw.song_count ??
                  (Array.isArray(raw.songs) ? raw.songs.length : undefined) ??
                  (Array.isArray(p.songs) ? p.songs.length : undefined) ??
                  0;
                return { ...p, songCount: `${count} ${Number(count) === 1 ? 'Song' : 'Songs'}` };
              }),
              orderIndex: cat.orderIndex || 0
            };
          });

          mappedCategories.sort((a, b) => a.orderIndex - b.orderIndex);
          const visibleCategories = mappedCategories.filter((c) => c.programs.length > 0);

          const freshJson = JSON.stringify(visibleCategories.map(c => ({ id: c.id, programCount: c.programCount })));
          const cachedJson = JSON.stringify(cached?.map((c: any) => ({ id: c.id, programCount: c.programCount })) || []);
          if (freshJson !== cachedJson) {
            setCategories(visibleCategories);
          }

          await writeCache(cacheKey, visibleCategories);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[ArchiveScreen] Error loading data:', err);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();
    return () => { active = false; };
  }, [currentZone?.id, reloadKey, isZoneLoading, isProfileLoading, user?.uid, zoneVersion]);

  const [visibleCount, setVisibleCount] = React.useState(10);
  const visibleCategories = categories.slice(0, visibleCount);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            }}
            style={styles.backButton}>
            
            <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Archive Folders</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }>
          
          <Text style={styles.sectionSubtitle}>Page Categories</Text>

          {isLoading ?
          <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 40 }} /> :
          categories.length === 0 ?
          <Text style={{ color: theme.colors.textPrimary, textAlign: 'center', marginTop: 40, opacity: 0.7 }}>No folders available.</Text> :
          visibleCategories.map((category) =>
          <TouchableOpacity
            key={category.id}
            style={styles.cardContainer}
            activeOpacity={0.85}
            onPress={() => {
              navigation.navigate('CategoryPrograms', { category });
            }}>
            
              <View style={styles.cardImageContainer}>
                <Image
                source={category.image}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="disk"
                transition={300}
                />
              
                <LinearGradient
                colors={['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.85)']}
                style={StyleSheet.absoluteFill} />
              
                <View style={styles.badge}>
                  <Ionicons name="folder-open" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.badgeText}>{category.programCount}</Text>
                </View>

                <View style={styles.folderOverlayInfo}>
                  <Text style={styles.folderTitle}>{category.name}</Text>
                  <Text style={styles.folderDesc} numberOfLines={2}>{category.description}</Text>
                </View>
              </View>

              <BlurView intensity={30} tint={theme.colors.background === '#000000' ? 'dark' : 'light'} style={styles.cardBottom}>
                <Text style={styles.openFolderText}>Open Folder</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.textSecondary} />
              </BlurView>
            </TouchableOpacity>
          )}

          {visibleCount < categories.length && (
            <TouchableOpacity 
              style={{ backgroundColor: theme.colors.cardBackgroundLight, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: theme.colors.bottomTabBorder }}
              onPress={() => setVisibleCount(prev => prev + 10)}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>LOAD MORE FOLDERS</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>);

}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  safeArea: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100
  },
  sectionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20
  },
  cardContainer: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    backgroundColor: theme.colors.cardBackgroundLight
  },
  cardImageContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 20
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.7)'
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  folderOverlayInfo: {
    width: '100%'
  },
  folderTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5
  },
  folderDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBackgroundLight
  },
  openFolderText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  }
});
};
