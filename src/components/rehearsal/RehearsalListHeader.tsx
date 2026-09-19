import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { songBelongsToCategory } from '../../lib/rehearsalUtils';
import { StandaloneCountdown } from './StandaloneCountdown';

const LOGO = require('../../../assets/logo/logo.png');

export interface RehearsalListHeaderProps {
  // Search/sort
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortAscending: boolean;
  onToggleSort: () => void;
  // Cover image + program info
  coverImage: any;
  programTitle: string;
  programDate: string;
  programLocation: string;
  programCountdownObj: any;
  programUpdatedAt: any;
  onPressProgramTitle: () => void;
  // Heard/Unheard tabs
  selectedCategory: string | null;
  activeTab: 'heard' | 'unheard';
  onSetTab: (tab: 'heard' | 'unheard') => void;
  isHQ: boolean;
  // Shuffle
  programSongs: any[];
  onShuffle: () => void;
  // Loading/shimmer
  isLoading: boolean;
  shimmerOpacity: Animated.AnimatedInterpolation<string | number>;
  categories: any[];
  // Category breadcrumb
  onBackToCategories: () => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  theme: any;
  styles: any;
}

export const RehearsalListHeader: React.FC<RehearsalListHeaderProps> = ({
  searchQuery,
  onSearchChange,
  sortAscending,
  onToggleSort,
  coverImage,
  programTitle,
  programDate,
  programLocation,
  programCountdownObj,
  programUpdatedAt,
  onPressProgramTitle,
  selectedCategory,
  activeTab,
  onSetTab,
  isHQ,
  programSongs,
  onShuffle,
  isLoading,
  shimmerOpacity,
  categories,
  onBackToCategories,
  isSelectionMode,
  onToggleSelectionMode,
  theme,
  styles,
}) => (
  <>
    {/* Search + Sort */}
    <View style={styles.searchRow}>
      <View style={[styles.searchContainer, { padding: 0, paddingHorizontal: 0, overflow: 'hidden' }]}>
        <LinearGradient
          colors={['transparent', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}
        >
          <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find on this page"
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
        </LinearGradient>
      </View>
      <TouchableOpacity
        style={[styles.sortButton, { padding: 0, paddingHorizontal: 0, overflow: 'hidden' }]}
        onPress={onToggleSort}
      >
        <LinearGradient
          colors={['transparent', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}
        >
          <Text style={styles.sortText}>Sort ({sortAscending ? 'A-Z' : 'Z-A'})</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>

    {/* Hero cover */}
    <View style={styles.heroContainer}>
      <View style={{ width: '92%' as any, aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', alignSelf: 'center' }}>
        <Image source={coverImage} style={{ width: '100%', height: '100%' } as any} contentFit="contain" cachePolicy="disk" transition={300} />
      </View>
    </View>

    {/* Program details */}
    <View style={styles.detailsContainer}>
      <StandaloneCountdown programDate={programDate} programCountdownObj={programCountdownObj} programUpdatedAt={programUpdatedAt} styles={styles} />
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
        onPress={onPressProgramTitle}
        activeOpacity={0.7}
      >
        <Text style={[styles.titleText, { marginBottom: 0, flexShrink: 1, textTransform: 'uppercase' }]} numberOfLines={1}>{programTitle}</Text>
        <View style={{ borderRadius: 14, width: 30, height: 30, overflow: 'hidden', marginLeft: 10 }}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
            style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-down" size={18} color={theme.colors.textPrimary} />
          </LinearGradient>
        </View>
      </TouchableOpacity>
      <View style={styles.authorRow}>
        <Text style={styles.authorText}>{programDate}</Text>
      </View>
      <Text style={styles.aboutText}>{programLocation}</Text>
    </View>

    {/* Actions row */}
    <View style={styles.actionRow}>
      <View style={styles.actionLeft}>
        <View style={styles.downloadIconWrapper}>
          <Image source={LOGO} style={styles.downloadIcon} contentFit="contain" />
        </View>
        {selectedCategory !== null && (
          <>
            <TouchableOpacity style={styles.tabIconButton} onPress={() => onSetTab('heard')}>
              <Ionicons name={activeTab === 'heard' ? 'headset' : 'headset-outline'} size={24} color={activeTab === 'heard' ? '#10b981' : theme.colors.textMuted} />
              <Text style={[styles.tabIconText, { color: activeTab === 'heard' ? '#10b981' : theme.colors.textMuted }]}>
                {isHQ ? 'HEARD' : 'REHEARSED'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabIconButton} onPress={() => onSetTab('unheard')}>
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={activeTab === 'unheard' ? 'headset' : 'headset-outline'} size={24} color={activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted} />
                <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted, transform: [{ rotate: '45deg' }] }} />
              </View>
              <Text style={[styles.tabIconText, { color: activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted }]}>
                {isHQ ? 'UNHEARD' : 'UNREHEARSED'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <View style={styles.actionRight}>
        <TouchableOpacity style={styles.iconButton} onPress={onShuffle}>
          <Ionicons name="shuffle" size={26} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>
    </View>

    {/* Category content area */}
    <View style={styles.tabContentContainer}>
      {isLoading && programSongs.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '500' }}>Updating…</Text>
        </View>
      )}
      {!isLoading && categories.length === 0 && programSongs.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {[1, 2, 3].map(i => (
            <Animated.View key={i} style={[{ height: 64, borderRadius: 16, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 12 }, { opacity: shimmerOpacity }]} />
          ))}
        </View>
      )}
      {selectedCategory && (
        <View style={[styles.trackList, { paddingBottom: 0, marginBottom: 16 }]}>
          <View style={styles.categoryHeaderRow}>
            <TouchableOpacity style={styles.backToCategoriesBtn} onPress={onBackToCategories}>
              <Ionicons name="arrow-back" size={16} color={theme.colors.textPrimary} />
              <Text style={styles.backToCategoriesText}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backToCategoriesBtn, { backgroundColor: 'transparent' }]}>
              <Text style={styles.currentCategoryTitle} numberOfLines={1}>
                {selectedCategory.length <= 15
                  ? selectedCategory
                  : selectedCategory.split(' ').length > 2
                  ? `${selectedCategory.split(' ')[0]} ${selectedCategory.split(' ')[1]}...`
                  : selectedCategory}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textPrimary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: -8, marginBottom: 8 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
              {programSongs.filter((track: any) => songBelongsToCategory(track, selectedCategory)).length} songs
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isSelectionMode ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
                borderWidth: 1, borderColor: isSelectionMode ? theme.colors.accent : 'rgba(255, 255, 255, 0.1)',
              }}
              onPress={onToggleSelectionMode}
            >
              <Ionicons
                name={isSelectionMode ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={14}
                color={isSelectionMode ? theme.colors.accent : theme.colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: isSelectionMode ? theme.colors.accent : theme.colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                {isSelectionMode ? 'Cancel' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  </>
);
