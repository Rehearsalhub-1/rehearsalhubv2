import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CategoryProgramsScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const category = route?.params?.category || {
    name: 'Praise Nights',
    description: 'Official ministration recordings and rehearsal guides.',
    programs: []
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  const filteredPrograms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const progs = Array.isArray(category.programs) ? category.programs : [];
    if (!q) return progs;

    return progs.filter((program: any) => {
      const name = (program.name || program.title || '').toLowerCase();
      const desc = (program.description || '').toLowerCase();
      const date = (program.date || '').toLowerCase();
      const location = (program.location || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || date.includes(q) || location.includes(q);
    });
  }, [category.programs, searchQuery]);

  const visiblePrograms = filteredPrograms.slice(0, visibleCount);

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
              navigation.goBack();
            }}
            style={styles.backButton}>
            
            <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{category.name}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search programs in this archive..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          
          <Text style={styles.sectionSubtitle}>
            {searchQuery.trim() ? `Search Results (${filteredPrograms.length})` : 'Programs in Folder'}
          </Text>

          {filteredPrograms.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={theme.colors.textMuted} style={{ marginBottom: 10, opacity: 0.6 }} />
              <Text style={{ color: theme.colors.textPrimary, textAlign: 'center', fontSize: 16, fontWeight: '600' }}>
                {searchQuery.trim() ? 'No programs found matching your search.' : 'No programs in this folder.'}
              </Text>
              {searchQuery.trim() ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 4, fontSize: 13 }}>
                  Try searching by program title, session date, or location.
                </Text>
              ) : null}
            </View>
          ) : (
            visiblePrograms.map((program: any) =>
              <TouchableOpacity
                key={program.id}
                style={styles.cardContainer}
                activeOpacity={0.85}
                onPress={() => {
                  navigation.navigate('Rehearsal', { program, resetState: true });
                }}>
                
                  <View style={styles.cardImageContainer}>
                    <Image
                    source={program.bannerImage ? { uri: program.bannerImage } : program.image ? { uri: program.image } : require('../../assets/image/home9.jpg')}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={300}
                    />
                  
                    <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFill} />
                  
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {(() => {
                          if (typeof program.songCount === 'number') {
                            return `${program.songCount} ${program.songCount === 1 ? 'Song' : 'Songs'}`;
                          }
                          if (typeof program.songCount === 'string' && program.songCount.trim()) {
                            return program.songCount.includes('Song') ? program.songCount : `${program.songCount} Songs`;
                          }
                          const count = Array.isArray(program.songs) ? program.songs.length :
                                        Array.isArray(program.songIds) ? program.songIds.length :
                                        Array.isArray(program.song_ids) ? program.song_ids.length : 0;
                          return `${count} ${count === 1 ? 'Song' : 'Songs'}`;
                        })()}
                      </Text>
                    </View>
                  </View>

                  <BlurView intensity={30} tint={theme.colors.background === '#000000' ? 'dark' : 'light'} style={styles.cardBottom}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.programTitle}>{program.name || program.title || 'Untitled Program'}</Text>
                      <Text style={styles.programMeta}>
                        {[program.date, program.location].filter(Boolean).join(' • ') || 'No details'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
                  </BlurView>
                </TouchableOpacity>
            )
          )}

          {visibleCount < filteredPrograms.length && (
            <TouchableOpacity 
              style={{ backgroundColor: theme.colors.cardBackgroundLight, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: theme.colors.bottomTabBorder }}
              onPress={() => setVisibleCount(prev => prev + 10)}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>LOAD MORE PROGRAMS</Text>
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
    backgroundColor: theme.colors.background
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
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
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.6)'
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBackgroundLight
  },
  cardInfo: {
    flex: 1,
    marginRight: 16
  },
  programTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5
  },
  programMeta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500'
  }
});
};
