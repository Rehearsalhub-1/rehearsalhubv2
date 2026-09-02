import { theme } from '../constants/Colors';
import { DoodleBackground } from '../components/DoodleBackground';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Image as RNImage,
  Modal,
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  AppState } from
'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPushNotification, sendLocalNotification } from '../lib/notifications';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { ZONES, getZoneByInvitationCode, isHQGroup } from '../config/zones';
import { useZone } from '../hooks/useZone';
import { useUserStore } from '../hooks/useUser';
import { canAccessArchive, canAccessPreRehearsal, getHiddenFeatures, isHQAdmin } from '../config/roles';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { readCache, writeCache } from '../lib/screenCache';
import { optimizeImage, optimizeAudio, resolveSongAudioUrl, resolveSongAudioUrls } from '../lib/mediaUtils';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { SongScheduleSheet } from '../components/SongScheduleSheet';
import { apiClient, clearCache } from '../lib/apiClient';
import { useWebSocket } from '../hooks/useWebSocket';
import { useProgramStore } from '../stores/programStore';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COVER_IMAGE = require('../../assets/banner/praisenight28.jpg');



const _memCache: Record<string, {
  songs: any[];
  title: string;
  date: string;
  location: string;
  coverImage: any;
  categoryOrder?: string[];
}> = {};

const songBelongsToCategory = (song: any, targetCategory: string) => {
  if (song.categories && Array.isArray(song.categories) && song.categories.length > 0) {
    return song.categories.some((cat: string) => cat.trim() === targetCategory.trim());
  }
  return (song.category || '').trim() === targetCategory.trim();
};

const isSongHeard = (s: any): boolean => {
  if (!s) return false;
  if (s.status === 'heard') return true;
  if (s.status === 'unheard') return false;
  if (s.rehearsalStatus === 'heard') return true;
  if (s.rehearsalStatus === 'unheard') return false;
  if (s.heard === true || s.isHeard === true) return true;
  if (s.heard === false || s.isHeard === false) return false;
  const title = (s.title || '').toLowerCase();
  if (title.includes('(heard)')) return true;
  if (title.includes('(unheard)')) return false;
  return false;
};

const getTrackImage = (track: any, index: number) => {

  if (track.image && typeof track.image === 'string' && track.image.startsWith('http')) return track.image;
  if (track.imageUrl) return track.imageUrl;
  if (track.artworkUrl) return track.artworkUrl;
  if (track.coverImage) return track.coverImage;
  if (track.image && typeof track.image !== 'string') return track.image; // Local require

  return require('../../assets/banner/praisenight28.jpg');
};

const getRehearsalCount = (song: any): number => {
  const raw = song?.rawData || song?.raw_data || song?.metadata || {};
  const value = song?.rehearsalCount ?? song?.rehearsal_count ?? raw.rehearsalCount ?? raw.rehearsal_count ?? raw.metadata?.rehearsalCount;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const StandaloneCountdown = ({ programDate, programCountdownObj, programUpdatedAt, styles }: any) => {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let interval: NodeJS.Timeout | null = null;

    const parseProgramDate = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      try {
        let cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');
        cleaned = cleaned.replace(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi, '');
        cleaned = cleaned.replace(/,/g, '').trim();

        const now = new Date();
        const currentYear = now.getFullYear();

        let date = new Date(cleaned);

        if (isNaN(date.getTime()) || !/\d{4}/.test(cleaned)) {

          const parts = cleaned.split(' ').filter(Boolean);
          if (parts.length >= 2) {
            const p1 = parts[0];
            const p2 = parts[1];
            const p3 = parts[2] || currentYear;

            if (!isNaN(Number(p1))) {
              date = new Date(`${p2} ${p1}, ${p3}`);
            } else {
              date = new Date(`${p1} ${p2}, ${p3}`);
            }
          }
        }

        if (!isNaN(date.getTime())) {

          if (date.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
            date.setFullYear(date.getFullYear() + 1);
          }
          return date;
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    const initializeCountdown = async () => {
      let targetDate: Date | null = null;
      const now = new Date();

      const parsedProgramDate = parseProgramDate(programDate);
      if (parsedProgramDate) {

        if (programDate && programDate.indexOf(':') === -1 && parsedProgramDate.getHours() === 0) {
          parsedProgramDate.setHours(17, 0, 0, 0);
        }
        if (parsedProgramDate.getTime() > now.getTime()) {
          targetDate = parsedProgramDate;
        }
      }

      if (!targetDate && programCountdownObj) {
        const durationMs =
        (programCountdownObj.days || 0) * 86400000 +
        (programCountdownObj.hours || 0) * 3600000 +
        (programCountdownObj.minutes || 0) * 60000 +
        (programCountdownObj.seconds || 0) * 1000;

        if (durationMs > 0) {
          const baseDate = programUpdatedAt ? new Date(programUpdatedAt).getTime() : now.getTime();
          if (!isNaN(baseDate)) {
            const calculatedTarget = new Date(baseDate + durationMs);
            if (calculatedTarget.getTime() > now.getTime()) {
              targetDate = calculatedTarget;
            }
          }
        }
      }

      if (!active) return;

      if (!targetDate || isNaN(targetDate.getTime())) {
        setCountdown(null);
        return;
      }

      const updateCountdown = () => {

        const now = new Date();
        const diff = targetDate!.getTime() - now.getTime();

        if (diff <= 0) {
          setCountdown(null);
          if (interval) clearInterval(interval);
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60) % 24);
        const mins = Math.floor(diff / 1000 / 60 % 60);
        const secs = Math.floor(diff / 1000 % 60);

        if (days > 0) {
          setCountdown(`${days}d ${hours}h ${mins}m ${secs}s`);
        } else {
          setCountdown(`${hours}h ${mins}m ${secs}s`);
        }
      };

      updateCountdown();
      interval = setInterval(updateCountdown, 1000);
    };

    initializeCountdown();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [programDate, programCountdownObj, programUpdatedAt]);

  if (!countdown) return null;

  return (
    <View style={[
      styles.countdownBadge,
      { position: 'relative', alignSelf: 'flex-start', bottom: 0, right: 0, marginBottom: 12 }
    ]}>
        <Ionicons name="time" size={14} color="#38bdf8" />
        <Text style={styles.countdownText}>{countdown}</Text>
    </View>
  );
};

export default function RehearsalScreen({ navigation, route }: any) {
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme, insets), [theme, insets]);

  const program = route?.params?.program;

  const [isLoading, setIsLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<any>(null);
  const { currentZone: contextZone, isHQ: contextIsHQ, zoneVersion, isLoading: isZoneLoading } = useZone();
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);

  const [programSongs, setProgramSongs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [programTitle, setProgramTitle] = useState('Loveworld Singers Mix');
  const [programDate, setProgramDate] = useState('');
  const [programLocation, setProgramLocation] = useState('Centralized Zonal Rehearsal Platform');
  const [programCountdownObj, setProgramCountdownObj] = useState<any>(null);
  const [programUpdatedAt, setProgramUpdatedAt] = useState<any>(null);
  const [coverImage, setCoverImage] = useState<any>(COVER_IMAGE);

  const [bgColor, setBgColor] = useState(theme.colors.background);
  const [miniPlayerBg, setMiniPlayerBg] = useState(theme.colors.backgroundSecondary);
  const [playerModalBg, setPlayerModalBg] = useState(theme.colors.backgroundDark);

  const [activeTab, setActiveTab] = useState<'heard' | 'unheard'>('unheard');
  const [mainTab, setMainTab] = useState<'home' | 'audiolab' | 'more'>('audiolab');
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);
  const [showProgramSwitcher, setShowProgramSwitcher] = useState(false);
  const [selectedProgramOverride, setSelectedProgramOverride] = useState<any>(null);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [activeProgramScope, setActiveProgramScope] = useState<string | null>(null);
  const [activeProgramSubGroupId, setActiveProgramSubGroupId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(true);

  const { currentTrack: activeTrack, isPlaying, isLoading: isPlayerLoading, play, pause, togglePlayback } = useTrackPlayer();
  const [hideMiniPlayer, setHideMiniPlayer] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hasCachedDataRef = useRef(false);
  const notifiedActiveSongsRef = useRef<Set<string>>(new Set());
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeTrack) {
      setHideMiniPlayer(false);
    }
  }, [activeTrack?.id]);

  useEffect(() => {
    if (route?.params?.resetState) {
      setSelectedCategory(null);
      setActiveTab('unheard');
      setSelectedProgramOverride(null);
      navigation.setParams({ resetState: undefined });
    }
  }, [route?.params?.resetState]);

  useEffect(() => {
    const targetSongId = route?.params?.songId;
    if (!targetSongId) return;

    console.log('[RehearsalScreen] useEffect songId triggered:', {
      targetSongId,
      programSongsLength: programSongs.length,
      activeZoneId: activeZone?.id
    });

    let active = true;

    async function handleAutoPlay() {

      let song = programSongs.find((s: any) => String(s.id) === String(targetSongId));
      console.log('[RehearsalScreen] Search in programSongs result:', song ? song.title : 'NOT FOUND');

      if (!song) {
        try {
          const endpoints = [
            `/songs/zone/${targetSongId}`,
            `/songs/praise-night/${targetSongId}`,
            `/songs/subgroup/${targetSongId}`,
            `/songs/master/${targetSongId}`,
          ];
          let songDocData: any = null;
          for (const endpoint of endpoints) {
            try {
              const res = await apiClient.get<{ success: boolean; data: any }>(endpoint);
              if (res?.success && res.data) {
                songDocData = res.data;
                break;
              }
            } catch {

            }
          }

          if (songDocData && active) {
            const songAudioUrl = resolveSongAudioUrl(songDocData);
            const resolvedAudioUrls = resolveSongAudioUrls(songDocData);

            song = {
              id: songDocData.id,
              title: songDocData.title || 'Untitled Song',
              subtitle: songDocData.leadSinger || songDocData.writer || 'Loveworld Singers',
              program: programTitle || 'Ongoing Rehearsal',
              leadSinger: songDocData.leadSinger || 'Unknown',
              writer: songDocData.writer || 'Unknown',
              conductor: songDocData.conductor || '',
              key: songDocData.key || '',
              tempo: songDocData.tempo || '',
              category: songDocData.category || 'Praise Night',
              categories: songDocData.categories || [songDocData.category || 'Praise Night'],
              audioUrl: songAudioUrl,
              lyrics: songDocData.lyrics || '',
              solfa: songDocData.notation || songDocData.solfas || songDocData.solfa || '',
              audioUrls: resolvedAudioUrls,
              status: songDocData.status || 'unheard',
              isActive: songDocData.isActive !== false,
              rehearsalCount: songDocData.rehearsalCount || 0,
              imageUrl: songDocData.imageUrl || '',
              image: getTrackImage(songDocData, 0),
              zoneId: activeZone?.id || '',
            };
            setProgramSongs(prev => [song, ...prev]);
          }
        } catch (e) {
          console.error('[RehearsalScreen] Error fetching single song:', e);
        }
      }

      if (song && active) {

        if (song.category) {
          setSelectedCategory(song.category);
        }

        if (song.status === 'heard') {
          setActiveTab('heard');
        } else {
          setActiveTab('unheard');
        }

        console.log('[RehearsalScreen] Playing song:', song.title);
        play(song, [song, ...programSongs], false);

        console.log('[RehearsalScreen] Navigating to Player screen');
        navigation.navigate('Player', { activeTrack: song, zoneId: activeZone?.id || song.zoneId, queue: [song, ...programSongs] });

        navigation.setParams({ songId: undefined });
      }
    }

    handleAutoPlay();

    return () => {
      active = false;
    };
  }, [route?.params?.songId, programSongs, activeZone?.id]);

  // auth listener removed — auth state managed via useUserStore

  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.6)).current;
  const waveAnim3 = useRef(new Animated.Value(0.4)).current;
  const waveAnim4 = useRef(new Animated.Value(0.7)).current;
  const waveAnim5 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!isPlaying) return;
    const createWaveLoop = (anim: Animated.Value, min: number, max: number, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: true }),
        Animated.timing(anim, { toValue: min, duration: dur * 0.8, useNativeDriver: true }),
      ]));
    const loops = [
      createWaveLoop(waveAnim1, 0.2, 1, 400),
      createWaveLoop(waveAnim2, 0.3, 0.9, 350),
      createWaveLoop(waveAnim3, 0.15, 1, 500),
      createWaveLoop(waveAnim4, 0.25, 0.85, 300),
      createWaveLoop(waveAnim5, 0.3, 0.95, 450),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [isPlaying]);

  useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading]);

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] }); // tracks if we've ever shown cached/real data
  const [showActiveSongsModal, setShowActiveSongsModal] = useState(false);
  const [selectedOptionsTrack, setSelectedOptionsTrack] = useState<any>(null);
  const [showTrackOptions, setShowTrackOptions] = useState(false);
  const [shareTrack, setShareTrack] = useState<any>(null);
  const [shareTracks, setShareTracks] = useState<any[] | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const triggerReload = () => setReloadKey((prev) => prev + 1);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const cacheKey = `rehearsal_songs_${program?.id || 'default'}_${contextZone?.id || 'none'}`;
    delete _memCache[cacheKey];
    clearCache();
    triggerReload();
  };

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [tracksForOptions, setTracksForOptions] = useState<any[]>([]);

  const toggleSelection = (trackId: string) => {
    const newSet = new Set(selectedTracks);
    if (newSet.has(trackId)) {
      newSet.delete(trackId);
      if (newSet.size === 0) setIsSelectionMode(false);
    } else {
      newSet.add(trackId);
    }
    setSelectedTracks(newSet);
  };


  const categorySongCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => {
      counts[cat.id] = programSongs.filter((track: any) => {
        const matchesCategory = songBelongsToCategory(track, cat.id);
        if (!matchesCategory) return false;
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase();
          return track.title?.toLowerCase().includes(query) ||
                 track.leadSinger?.toLowerCase().includes(query) ||
                 track.writer?.toLowerCase().includes(query);
        }
        return true;
      }).length;
    });
    return counts;
  }, [programSongs, searchQuery, categories]);

  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    let active = true;
    hasCachedDataRef.current = false; // Reset so switching zones reads the correct cache

    clearCache();

    async function loadData() {

      const cacheKey = `rehearsal_songs_${program?.id || 'default'}_${contextZone?.id || 'none'}`;

      const setupCategoriesFromSongs = (songs: any[], categoryOrder: string[] = []) => {
        const allCategoriesList: string[] = [];
        songs.forEach((song: any) => {
          if (song.categories && Array.isArray(song.categories)) {
            allCategoriesList.push(...song.categories.filter((cat: any) => cat && cat.trim()));
          } else if (song.category && song.category.trim()) {
            allCategoriesList.push(song.category);
          }
        });
        const uniqueCategories = [...new Set(allCategoriesList)];

        const categoriesWithActiveSongs = Array.from(new Set(
          songs.filter((song: any) => song.isActive && song.category).map((song: any) => song.category)
        ));

        uniqueCategories.sort((a, b) => {
          const aActive = categoriesWithActiveSongs.includes(a);
          const bActive = categoriesWithActiveSongs.includes(b);
          if (aActive !== bActive) return aActive ? -1 : 1;

          const aOrderIndex = categoryOrder.indexOf(a);
          const bOrderIndex = categoryOrder.indexOf(b);
          if (aOrderIndex !== -1 && bOrderIndex !== -1) return aOrderIndex - bOrderIndex;
          if (aOrderIndex !== -1) return -1;
          if (bOrderIndex !== -1) return 1;

          return a.localeCompare(b);
        });

        const finalCategories = uniqueCategories.map((catName, index) => {
          const icons = ['globe-outline', 'musical-notes-outline', 'calendar-outline', 'sunny-outline', 'star-outline'];
          return {
            id: catName,
            name: catName,
            icon: icons[index % icons.length]
          };
        });

        const pageCategories = finalCategories.length > 0 ? finalCategories : [
          { id: 'Global Communion', name: 'Global Communion', icon: 'globe-outline' },
          { id: 'Praise Night', name: 'Praise Night', icon: 'musical-notes-outline' },
          { id: 'Midweek', name: 'Midweek Rehearsal', icon: 'calendar-outline' },
          { id: 'Sunday Special', name: 'Sunday Special', icon: 'sunny-outline' },
          { id: 'Special Events', name: 'Special Events', icon: 'star-outline' }
        ];

        setCategories(pageCategories);

        setSelectedCategory((prevSelected) => {
          if (prevSelected && uniqueCategories.includes(prevSelected)) {
            return prevSelected;
          }
          return uniqueCategories.length > 0 ? uniqueCategories[0] : null;
        });
      };


      if (_memCache[cacheKey] && _memCache[cacheKey].songs.length > 0) {
        hasCachedDataRef.current = true;
        setProgramSongs(_memCache[cacheKey].songs);
        setProgramTitle(_memCache[cacheKey].title || 'Loveworld Singers Mix');
        setProgramDate(_memCache[cacheKey].date || '');
        setProgramLocation(_memCache[cacheKey].location || 'Centralized Zonal Rehearsal Platform');
        if (_memCache[cacheKey].coverImage) setCoverImage(_memCache[cacheKey].coverImage);
        setupCategoriesFromSongs(_memCache[cacheKey].songs, _memCache[cacheKey].categoryOrder || []);
        setIsLoading(false);
      } else {

        setProgramSongs([]);
        setIsLoading(true);

        const cached = await readCache<{ songs: any[]; title: string; date: string; location: string; coverImage?: any; categoryOrder?: string[] }>(cacheKey);
        if (active) {
          if (cached?.songs && cached.songs.length > 0) {
            hasCachedDataRef.current = true;
            _memCache[cacheKey] = {
              songs: cached.songs,
              title: cached.title || '',
              date: cached.date || '',
              location: cached.location || '',
              coverImage: cached.coverImage || null,
              categoryOrder: cached.categoryOrder || [],
            };
            setProgramSongs(cached.songs);
            setProgramTitle(cached.title || 'Loveworld Singers Rehearsal');
            setProgramDate(cached.date || '');
            setProgramLocation(cached.location || '');
            if (cached.coverImage) setCoverImage(cached.coverImage);
            setupCategoriesFromSongs(cached.songs, cached.categoryOrder || []);
            setIsLoading(false);
          }
        }
      }


      try {
        const resolvedZone = contextZone || (profile?.zoneCode ? getZoneByInvitationCode(profile.zoneCode) : null);
        const resolvedZoneId = resolvedZone?.id || 'zone-001';
        const resolvedZoneName = resolvedZone?.name || 'Your Loveworld Singers';

        if (active && resolvedZone) {
          setActiveZone(resolvedZone);
        }

        let selectedRehearsal: any = null;
        let isRehearsalFetchSuccessful = true;
        const isSubgroupMode = route?.params?.mode === 'subgroup' || route?.params?.scope === 'subgroup' || Boolean(route?.params?.subgroupId);

        if (selectedProgramOverride) {
          selectedRehearsal = selectedProgramOverride;
        } else if (program) {
          selectedRehearsal = program;
        } else if (isSubgroupMode) {
          try {
            const [subgroupRehearsalsRes, userSubgroupsRes] = await Promise.all([
              apiClient.get<{ success: boolean; data: any[] }>('/subgroups/member-rehearsals').catch(() => null),
              apiClient.get<{ success: boolean; data: any[] }>('/subgroups/mine').catch(() => null),
            ]);

            const userSubgroups = userSubgroupsRes?.data || [];
            const subgroupMap = new Map(userSubgroups.map((sg: any) => [sg.id, sg.name || 'Church']));

            const subgroupPages = (subgroupRehearsalsRes?.data || []).map((p: any) => ({
              ...p,
              scope: 'subgroup',
              subGroupId: p.subGroupId || p.sub_group_id,
              name: p.name || p.title || 'Church Rehearsal',
              location: (p.subGroupId && subgroupMap.get(p.subGroupId)) || p.location || 'Your Church Choir',
            }));

            if (active && subgroupPages.length > 0) {
              setAvailablePrograms(subgroupPages);
            }

            if (route?.params?.subgroupId) {
              selectedRehearsal = subgroupPages.find((p: any) => p.subGroupId === route.params.subgroupId) || subgroupPages[0] || null;
            } else {
              const ongoing = subgroupPages.find((p: any) => p.category === 'ongoing');
              selectedRehearsal = ongoing || subgroupPages[0] || null;
            }
          } catch (subgroupErr) {
            console.error('[RehearsalScreen] Subgroup rehearsals fetch error:', subgroupErr);
            isRehearsalFetchSuccessful = false;
          }
        } else {
          try {
            const isHQ = isHQGroup(resolvedZoneId);

            const [zoneResult, hqResult] = await Promise.all([
              !isHQ
                ? apiClient.get<{ success: boolean; data: any[] }>(`/programs?zoneId=${encodeURIComponent(resolvedZoneId)}`).catch(() => null)
                : Promise.resolve(null),
              isHQ ? apiClient.get<{ success: boolean; data: any[] }>('/programs').catch(() => null) : Promise.resolve(null),
            ]);

            const processPages = (res: any) => {
              if (!res) return [];
              let pages = Array.isArray(res)
                ? res
                : (res?.data || res?.combined || []);
              if (!Array.isArray(pages)) pages = [];
              pages = pages.filter((p: any) => p.scope !== 'subgroup' && !p.subGroupId);
              pages.sort((a: any, b: any) => {
                if (a.category === 'ongoing' && b.category !== 'ongoing') return -1;
                if (a.category !== 'ongoing' && b.category === 'ongoing') return 1;
                const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dB - dA;
              });
              return pages;
            };

            const zonePages = !isHQ && zoneResult ? processPages(zoneResult) : [];
            const hqPages = hqResult ? processPages(hqResult) : [];
            const allAvailable = [...zonePages, ...hqPages];
            if (active && allAvailable.length > 0) {
              setAvailablePrograms(allAvailable);
            }

            const targetCategory = (route?.params?.categoryFilter || 'ongoing').toLowerCase().trim();

            // Pick programs matching target category ('ongoing', 'pre-rehearsal', etc.)
            const zoneMatch = zonePages.find((p: any) => (p.category || '').toLowerCase().trim() === targetCategory);
            const hqMatch = hqPages.find((p: any) => (p.category || '').toLowerCase().trim() === targetCategory);
            selectedRehearsal = zoneMatch || hqMatch || null;
          } catch (rehearsalError) {
            console.error('[RehearsalScreen] Rehearsals fetch error:', rehearsalError);
            isRehearsalFetchSuccessful = false;
          }
        }

        if (!isRehearsalFetchSuccessful && hasCachedDataRef.current) {
          console.log('[RehearsalScreen] Rehearsal fetch failed but cache exists. Preserving cache.');
          if (active) setIsLoading(false);
          return;
        }

        if (!selectedRehearsal) {
          if (!active) return;
          const targetCategory = (route?.params?.categoryFilter || 'ongoing').toLowerCase().trim();
          const emptyTitle = isSubgroupMode
            ? 'No Church Rehearsals'
            : (targetCategory === 'pre-rehearsal' ? 'No Pre-Rehearsal Programs' : 'No Ongoing Rehearsal');
          const emptyDate = isSubgroupMode
            ? 'Join or create a Church subgroup to access setlists'
            : (targetCategory === 'pre-rehearsal' ? 'Pre-rehearsal programs will appear here when scheduled' : 'Select a program from the switcher');
          setActiveProgramId(null);
          setActiveProgramScope(null);
          setActiveProgramSubGroupId(null);
          setProgramTitle(emptyTitle);
          setProgramDate(emptyDate);
          setProgramLocation(resolvedZoneName);
          setProgramCountdownObj(null);
          setProgramUpdatedAt(null);
          setCoverImage(COVER_IMAGE);
          setProgramSongs([]);
          setCategories([]);
          setIsLoading(false);
          return;
        }

        if (!active) return;

        setActiveProgramId(selectedRehearsal.id);
        setActiveProgramScope(selectedRehearsal.scope || null);
        setActiveProgramSubGroupId(selectedRehearsal.subGroupId || null);
        setProgramTitle(selectedRehearsal.name || selectedRehearsal.title || 'Loveworld Singers Rehearsal');
        setProgramDate(selectedRehearsal.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
        setProgramLocation(selectedRehearsal.location || resolvedZoneName);

        if (selectedRehearsal.countdown) {
          setProgramCountdownObj(selectedRehearsal.countdown);
          setProgramUpdatedAt(selectedRehearsal.updatedAt || selectedRehearsal.createdAt || null);
        } else {
          setProgramCountdownObj(null);
          setProgramUpdatedAt(null);
        }

        if (selectedRehearsal.bannerImage) {
          setCoverImage({ uri: optimizeImage(selectedRehearsal.bannerImage, { width: 600, quality: 65 }) });
        } else {
          setCoverImage(COVER_IMAGE);
        }

        let dbSongs: any[] = [];
        let isSongsFetchSuccessful = false;
        try {
          if (selectedRehearsal.id === 'fallback-ongoing') {
            const result = await apiClient.get<any>(
              `/songs/praise-night?zoneId=${encodeURIComponent(resolvedZoneId)}`
            ).catch(() => null);
            if (result?.success && Array.isArray(result.data)) {
              dbSongs = result.data;
              isSongsFetchSuccessful = true;
            }
          } else if (selectedRehearsal.scope === 'subgroup' || selectedRehearsal.subGroupId || isSubgroupMode) {
            const targetSgId = selectedRehearsal.subGroupId || selectedRehearsal.sub_group_id || route?.params?.subgroupId;
            const [primarySgRes, altSgRes] = await Promise.all([
              targetSgId ? apiClient.get<any>(`/subgroups/${encodeURIComponent(targetSgId)}/songs`).catch(() => null) : null,
              targetSgId ? apiClient.get<any>(`/songs/subgroup?subGroupId=${encodeURIComponent(targetSgId)}`).catch(() => null) : null,
            ]);
            const sgData = (primarySgRes?.success && Array.isArray(primarySgRes.data) && primarySgRes.data.length > 0)
              ? primarySgRes.data
              : (altSgRes?.data || []);

            if (Array.isArray(sgData)) {
              isSongsFetchSuccessful = true;
              if (selectedRehearsal.songIds && selectedRehearsal.songIds.length > 0) {
                dbSongs = sgData.filter((song: any) => selectedRehearsal.songIds.includes(song.id));
              } else {
                dbSongs = sgData;
              }
            }
          } else {
            const effectiveZone = resolvedZoneId ? `&zoneId=${encodeURIComponent(resolvedZoneId)}` : '';
            if (Array.isArray(selectedRehearsal.songs) && selectedRehearsal.songs.length > 0) {
              dbSongs = selectedRehearsal.songs;
              isSongsFetchSuccessful = true;
            } else {
              const primary = await apiClient.get<any>(
                `/songs/praise-night?programId=${encodeURIComponent(selectedRehearsal.id)}${effectiveZone}`
              ).catch(() => null);
              if (primary?.success && Array.isArray(primary.data) && primary.data.length > 0) {
                dbSongs = primary.data;
                isSongsFetchSuccessful = true;
              } else if (Array.isArray(selectedRehearsal.songIds) && selectedRehearsal.songIds.length > 0) {
                const zoneRes = await apiClient.get<any>(`/songs/zone?zoneId=${encodeURIComponent(resolvedZoneId)}`).catch(() => null);
                if (zoneRes?.success && Array.isArray(zoneRes.data)) {
                  dbSongs = zoneRes.data.filter((s: any) => selectedRehearsal.songIds.includes(s.id));
                  isSongsFetchSuccessful = true;
                }
              } else if (primary?.success && Array.isArray(primary.data)) {
                dbSongs = primary.data;
                isSongsFetchSuccessful = true;
              }
            }
          }
        } catch (songError) {
          console.error('[RehearsalScreen] Songs fetch error:', songError);
        }

        if (!isSongsFetchSuccessful && hasCachedDataRef.current) {
          console.log('[RehearsalScreen] Song fetch failed but cache exists. Preserving cache.');
          if (active) setIsLoading(false);
          return;
        }

        const mappedSongs = dbSongs.map((song: any, index: number) => {
          const songAudioUrl = resolveSongAudioUrl(song);
          const resolvedAudioUrls = resolveSongAudioUrls(song);
          const isLiveNow = song.isActive === true || String(song.isActive) === 'true' || song.isLive === true || song.status === 'live';
          return {
            id: song.id || `song-${index}`,
            title: song.title || 'Untitled Song',
            subtitle: song.leadSinger || song.writer || 'Loveworld Singers',
            program: selectedRehearsal.name || selectedRehearsal.title || 'Ongoing Rehearsal',
            leadSinger: song.leadSinger || 'Unknown',
            writer: song.writer || 'Unknown',
            conductor: song.conductor || '',
            key: song.key || '',
            tempo: song.tempo || '',
            category: song.category || 'Praise Night',
            categories: song.categories || [song.category || 'Praise Night'],
            audioUrl: songAudioUrl,
            lyrics: song.lyrics || '',
            solfa: song.notation || song.solfas || song.solfa || '',
            audioUrls: resolvedAudioUrls,
            status: isSongHeard(song) ? 'heard' : 'unheard',
            isActive: isLiveNow,
            rehearsalCount: getRehearsalCount(song),
            conductorGuide: song.solfas || song.conductorGuide || song.guide || '',
            history: song.history || '',
            comments: song.comments || '',
            leadKeyboardist: song.leadKeyboardist || '',
            drummer: song.drummer || '',
            leadGuitarist: song.leadGuitarist || '',
            createdAt: song.createdAt ? typeof song.createdAt === 'string' ? song.createdAt : new Date().toISOString() : new Date().toISOString(),
            imageUrl: song.imageUrl || '',
            image: getTrackImage(song, index),
            zoneId: resolvedZoneId,
            collectionName: (selectedRehearsal.scope === 'subgroup' || selectedRehearsal.subGroupId)
               ? 'subgroup_songs'
               : (isHQGroup(resolvedZoneId) ? 'praise_night_songs' : 'zone_songs')
          };
        });

        const hf = getHiddenFeatures(profile);
        const userCanSeeArchive = !hf.hideArchives && canAccessArchive(profile);
        const userCanSeePreRehearsal = !hf.hidePreRehearsal && canAccessPreRehearsal(profile);

        let finalSongs = mappedSongs;
        if (!userCanSeeArchive) {
          finalSongs = finalSongs.filter((song: any) => {
            const hasArchive = song.categories?.some((c: string) => c?.toLowerCase() === 'archive') || song.category?.toLowerCase() === 'archive';
            return !hasArchive;
          });
        }

        if (!userCanSeePreRehearsal) {
          finalSongs = finalSongs.filter((song: any) => {
            const hasPre = song.categories?.some((c: string) => c?.toLowerCase() === 'pre-rehearsal') || song.category?.toLowerCase() === 'pre-rehearsal';
            return !hasPre;
          });
        }

        const allCategoriesList: string[] = [];
        finalSongs.forEach((song: any) => {
          if (song.categories && Array.isArray(song.categories)) {
            allCategoriesList.push(...song.categories.filter((cat: any) => cat && cat.trim()));
          } else if (song.category && song.category.trim()) {
            allCategoriesList.push(song.category);
          }
        });
        const uniqueCategories = [...new Set(allCategoriesList)];

        const categoriesWithActiveSongs = Array.from(new Set(
          finalSongs.filter((song: any) => song.isActive && song.category).map((song: any) => song.category)
        ));

        const order = selectedRehearsal.categoryOrder || [];
        uniqueCategories.sort((a, b) => {
          const aActive = categoriesWithActiveSongs.includes(a);
          const bActive = categoriesWithActiveSongs.includes(b);
          if (aActive !== bActive) return aActive ? -1 : 1;

          const aOrderIndex = order.indexOf(a);
          const bOrderIndex = order.indexOf(b);
          if (aOrderIndex !== -1 && bOrderIndex !== -1) return aOrderIndex - bOrderIndex;
          if (aOrderIndex !== -1) return -1;
          if (bOrderIndex !== -1) return 1;

          return a.localeCompare(b);
        });

        const finalCategories = uniqueCategories.map((catName, index) => {
          const icons = ['globe-outline', 'musical-notes-outline', 'calendar-outline', 'sunny-outline', 'star-outline'];
          return {
            id: catName,
            name: catName,
            icon: icons[index % icons.length]
          };
        });

        const pageCategories = finalCategories.length > 0 ? finalCategories : [
        { id: 'Global Communion', name: 'Global Communion', icon: 'globe-outline' },
        { id: 'Praise Night', name: 'Praise Night', icon: 'musical-notes-outline' },
        { id: 'Midweek', name: 'Midweek Rehearsal', icon: 'calendar-outline' },
        { id: 'Sunday Special', name: 'Sunday Special', icon: 'sunny-outline' },
        { id: 'Special Events', name: 'Special Events', icon: 'star-outline' }];

        if (!active) return;
        setCategories(pageCategories);
        setProgramSongs(finalSongs);

        hasCachedDataRef.current = true;
        const cachePayload = {
          songs: finalSongs,
          title: selectedRehearsal.name || selectedRehearsal.title || 'Loveworld Singers Rehearsal',
          date: selectedRehearsal.date || '',
          location: selectedRehearsal.location || resolvedZoneName,
          categoryOrder: selectedRehearsal.categoryOrder || [],
          coverImage: selectedRehearsal.bannerImage
            ? { uri: optimizeImage(selectedRehearsal.bannerImage, { width: 600, quality: 65 }) }
            : null,
        };

        _memCache[cacheKey] = {
          songs: cachePayload.songs,
          title: cachePayload.title,
          date: cachePayload.date,
          location: cachePayload.location,
          coverImage: cachePayload.coverImage,
          categoryOrder: cachePayload.categoryOrder,
        };

        writeCache(cacheKey, cachePayload);

        setSelectedCategory((prevSelected) => {
          if (prevSelected && uniqueCategories.includes(prevSelected)) {
            return prevSelected;
          }
          return null; // Default to categories list
        });

        if (finalSongs.length > 0) {

        }
      } catch (err) {
        console.error('[RehearsalScreen] Data loading error:', err);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [program, reloadKey, contextZone?.id, zoneVersion, isZoneLoading, isProfileLoading, user?.uid]);

  useEffect(() => {

    setBgColor(theme.colors.background);
    setMiniPlayerBg(theme.colors.backgroundSecondary);
    setPlayerModalBg(theme.colors.background);
  }, [activeTrack, theme]);

  const handleLiveSongUpdate = useCallback((data: unknown) => {
    const update = (data as any)?.data || data;
    if (!update || typeof update !== 'object' || !update.id) return;

    // Song deleted or removed
    if (update.deleted || update.isDeleted || update._action === 'removed') {
      setProgramSongs((prev: any[]) => prev.filter((s: any) => String(s.id) !== String(update.id)));
      return;
    }

    setProgramSongs((prev: any[]) => {
      const index = prev.findIndex((s: any) => String(s.id) === String(update.id));
      if (index >= 0) {
        const next = [...prev];
        const s = next[index];
        const merged = { ...s, ...update };
        const songAudioUrl = resolveSongAudioUrl(merged);
        const resolvedAudioUrls = resolveSongAudioUrls(merged);
        const isActiveNow = update.isActive !== undefined ? (update.isActive === true || String(update.isActive) === 'true') : s.isActive;

        if (isActiveNow && !notifiedActiveSongsRef.current.has(update.id)) {
          notifiedActiveSongsRef.current.add(update.id);
        } else if (!isActiveNow) {
          notifiedActiveSongsRef.current.delete(update.id);
        }

        next[index] = {
          ...s,
          ...update,
          title: update.title || s.title,
          lyrics: update.lyrics ?? s.lyrics,
          solfa: (update.notation || update.solfas || update.solfa) ?? s.solfa,
          conductorGuide: (update.solfas || update.conductorGuide || update.guide) ?? s.conductorGuide,
          comments: update.comments ?? s.comments,
          history: update.history ?? s.history,
          leadSinger: update.leadSinger || s.leadSinger,
          writer: update.writer || s.writer,
          conductor: update.conductor || s.conductor,
          key: update.key || s.key,
          tempo: update.tempo || s.tempo,
          category: update.category || s.category,
          categories: update.categories || s.categories,
          audioUrl: songAudioUrl,
          audioUrls: resolvedAudioUrls,
          isActive: isActiveNow,
          rehearsalCount: update.rehearsalCount ?? s.rehearsalCount,
          status: isSongHeard(update) ? 'heard' : (update.status || s.status),
          leadKeyboardist: update.leadKeyboardist || s.leadKeyboardist,
          drummer: update.drummer || s.drummer,
          leadGuitarist: update.leadGuitarist || s.leadGuitarist,
          imageUrl: update.imageUrl || s.imageUrl,
          image: update.imageUrl ? update.imageUrl : s.image,
        };
        return next;
      }

      // If it's a newly created/added song for this active program
      if (
        activeProgramId &&
        (String(update.praiseNightId) === String(activeProgramId) ||
         String(update.programId) === String(activeProgramId) ||
         update._action === 'added')
      ) {
        const songAudioUrl = resolveSongAudioUrl(update);
        const resolvedAudioUrls = resolveSongAudioUrls(update);
        const newSong = {
          id: update.id,
          title: update.title || 'Untitled Song',
          subtitle: update.leadSinger || update.writer || 'Loveworld Singers',
          program: programTitle || 'Ongoing Rehearsal',
          leadSinger: update.leadSinger || 'Unknown',
          writer: update.writer || 'Unknown',
          conductor: update.conductor || '',
          key: update.key || '',
          tempo: update.tempo || '',
          category: update.category || 'Praise Night',
          categories: update.categories || [update.category || 'Praise Night'],
          audioUrl: songAudioUrl,
          lyrics: update.lyrics || '',
          solfa: update.notation || update.solfas || update.solfa || '',
          audioUrls: resolvedAudioUrls,
          status: isSongHeard(update) ? 'heard' : 'unheard',
          isActive: update.isActive !== false,
          rehearsalCount: update.rehearsalCount || 0,
          conductorGuide: update.solfas || update.conductorGuide || update.guide || '',
          comments: update.comments || '',
          history: update.history || '',
          leadKeyboardist: update.leadKeyboardist || '',
          drummer: update.drummer || '',
          leadGuitarist: update.leadGuitarist || '',
          createdAt: update.createdAt || new Date().toISOString(),
          imageUrl: update.imageUrl || '',
          image: getTrackImage(update, prev.length),
          zoneId: activeZone?.id || 'zone-001',
          collectionName: 'praise_night_songs'
        };
        return [...prev, newSong];
      }

      return prev;
    });
  }, [activeProgramId, programTitle, activeZone?.id]);

  useWebSocket('song', activeProgramId || '', handleLiveSongUpdate, Boolean(activeProgramId));
  useWebSocket('songs', activeProgramId || '', handleLiveSongUpdate, Boolean(activeProgramId));
  useWebSocket('song', 'all', handleLiveSongUpdate, true);
  useWebSocket('songs', 'all', handleLiveSongUpdate, true);

  useWebSocket(
    'programs',
    'all',
    () => {
      triggerReload();
    },
    true
  );

  useWebSocket(
    'praise-nights',
    activeProgramId || '',
    (data: unknown) => {
      const d = (data as any)?.data || data;
      if (!d || typeof d !== 'object') return;
      if (d.name || d.title) setProgramTitle(d.name || d.title);
      if (d.date) setProgramDate(d.date);
      if (d.location) setProgramLocation(d.location);
      if (d.bannerImage) {
        setCoverImage({ uri: optimizeImage(d.bannerImage, { width: 600, quality: 65 }) });
      }
      if (d.countdown) {
        setProgramCountdownObj(d.countdown);
        setProgramUpdatedAt(d.updatedAt || d.createdAt || null);
      }
    },
    Boolean(activeProgramId)
  );

  const fallbackTrack = {
    id: 'fallback',
    title: 'Loading songs...',
    subtitle: 'Connecting to server',
    program: 'Loveworld Singers Mix',
    image: COVER_IMAGE
  };
  const currentActiveTrack = (activeTrack?.isHistory && activeTrack.originalSongId)
    ? (programSongs.find((s: any) => String(s.id) === String(activeTrack.originalSongId)) || activeTrack)
    : (activeTrack || (programSongs.length > 0 ? programSongs[0] : fallbackTrack));

  const activeSongs = useMemo(() => programSongs.filter((song: any) => song.isActive), [programSongs]);

  const categoryHeardCount = useMemo(() => programSongs.filter((track: any) => {
    return songBelongsToCategory(track, selectedCategory || '') && track.status === 'heard';
  }).length, [programSongs, selectedCategory]);

  const categoryUnheardCount = useMemo(() => programSongs.filter((track: any) => {
    return songBelongsToCategory(track, selectedCategory || '') && track.status === 'unheard';
  }).length, [programSongs, selectedCategory]);

  const memoizedSongsData = useMemo(() => {
    if (!selectedCategory) {
      return categories;
    }
    return programSongs.filter((track: any) => {
      if (!songBelongsToCategory(track, selectedCategory)) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = track.title?.toLowerCase().includes(query);
        const matchesLead = track.leadSinger?.toLowerCase().includes(query);
        const matchesWriter = track.writer?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesLead && !matchesWriter) return false;
      }
      const isHeardTrack = track.status === 'heard';
      return activeTab === 'heard' ? isHeardTrack : !isHeardTrack;
    }).sort((a: any, b: any) => {
      const titleA = a.title || '';
      const titleB = b.title || '';
      return sortAscending ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
    });
  }, [categories, programSongs, selectedCategory, searchQuery, activeTab, sortAscending]);

  const currentCategoryFilter = (route?.params?.categoryFilter || 'ongoing').toLowerCase().trim();
  const isFeatureRestricted = currentCategoryFilter === 'pre-rehearsal'
    ? getHiddenFeatures(profile).hidePreRehearsal
    : getHiddenFeatures(profile).hideOngoing;

  if (!isProfileLoading && isFeatureRestricted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style="light" />
        <LinearGradient
          colors={theme.gradients.bgBase}
          locations={theme.gradients.bgBaseLocations}
          style={StyleSheet.absoluteFill} />
        <DoodleBackground />
        <LinearGradient
          colors={theme.gradients.bgGlow}
          locations={theme.gradients.bgGlowLocations}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }]}>
          <Ionicons name="lock-closed" size={80} color={theme.colors.accent} style={{ marginBottom: 24 }} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>Access Restricted</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            {currentCategoryFilter === 'pre-rehearsal'
              ? 'Pre-Rehearsals are currently not enabled for your account.'
              : 'Ongoing Rehearsals are currently not enabled for your account.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: theme.colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 }}
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home');
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <DoodleBackground />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {}
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
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
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Playlists');
            }}
            style={[styles.backButton, { alignItems: 'center', flexDirection: 'row', width: 'auto', paddingRight: 8 }]}>
            <Ionicons name="albums-outline" size={20} color={theme.colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Playlists</Text>
          </TouchableOpacity>
        </View>

        {isLoading && programSongs.length === 0 ? (

          <ScrollView style={{ flex: 1 }} scrollEnabled={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Animated.View style={[{
              width: '100%', height: SCREEN_WIDTH * 0.52, borderRadius: 12,
              backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 20,
            }, { opacity: shimmerOpacity }]} />
            <Animated.View style={[{ height: 22, width: '60%', borderRadius: 8, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 10 }, { opacity: shimmerOpacity }]} />
            <Animated.View style={[{ height: 14, width: '40%', borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 24 }, { opacity: shimmerOpacity }]} />
            {[1,2,3,4,5,6].map(i => (
              <Animated.View key={i} style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, { opacity: shimmerOpacity }]}>
                <View style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: theme.colors.cardBackgroundLight, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ height: 14, width: `${55 + (i % 3) * 15}%`, borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 8 }} />
                  <View style={{ height: 11, width: `${35 + (i % 4) * 10}%`, borderRadius: 5, backgroundColor: theme.colors.cardBackgroundLight }} />
                </View>
              </Animated.View>
            ))}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <ActivityIndicator size="small" color="rgba(192,132,252,0.5)" />
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '500' }}>
                Connecting to server…
              </Text>
            </View>
          </ScrollView>
        ) : !isLoading && programSongs.length === 0 ? (
          <ScrollView
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
          >
            <Ionicons name="musical-notes-outline" size={64} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 24, textAlign: 'center' }}>No Ongoing Program</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '500', marginTop: 8, textAlign: 'center' }}>Check back later for updates.</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '400', marginTop: 16, textAlign: 'center' }}>Pull down to retry connecting</Text>
          </ScrollView>
        ) : (
        <FlatList
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
          }
          data={memoizedSongsData}
          keyExtractor={(item: any, index) => item.id || `item-${index}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          ListHeaderComponent={
            <>
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
                      onChangeText={setSearchQuery} />
                  </LinearGradient>
                </View>
                <TouchableOpacity
                  style={[styles.sortButton, { padding: 0, paddingHorizontal: 0, overflow: 'hidden' }]}
                  onPress={() => {
                    setSortAscending(!sortAscending);
                  }}>
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

              <View style={styles.heroContainer}>
                <View style={{ width: SCREEN_WIDTH * 0.92, height: SCREEN_WIDTH * 0.52, borderRadius: 16, overflow: 'hidden' }}>
                  <Image
                    source={coverImage}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="disk"
                    transition={300}
                  />
                </View>
              </View>

              <View style={styles.detailsContainer}>
                  <StandaloneCountdown programDate={programDate} programCountdownObj={programCountdownObj} programUpdatedAt={programUpdatedAt} styles={styles} />
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                  onPress={() => {
                    setShowProgramSwitcher(true);
                  }}
                  activeOpacity={0.7}>
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

              <View style={styles.actionRow}>
                <View style={styles.actionLeft}>
                  <View style={styles.downloadIconWrapper}>
                     <Image source={require('../../assets/logo/logo.png')} style={styles.downloadIcon} contentFit="contain" />
                  </View>
                  {selectedCategory !== null &&
                    <>
                      <TouchableOpacity style={styles.tabIconButton} onPress={() => {setActiveTab('heard');}}>
                        <Ionicons name={activeTab === 'heard' ? 'headset' : 'headset-outline'} size={24} color={activeTab === 'heard' ? '#10b981' : theme.colors.textMuted} />
                        <Text style={[styles.tabIconText, { color: activeTab === 'heard' ? '#10b981' : theme.colors.textMuted }]}>
                          { (activeZone ? isHQGroup(activeZone.id) : contextIsHQ) ? "HEARD" : "REHEARSED" }
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.tabIconButton} onPress={() => {setActiveTab('unheard');}}>
                        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={activeTab === 'unheard' ? 'headset' : 'headset-outline'} size={24} color={activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted} />
                          <View style={{ position: 'absolute', width: 20, height: 2, backgroundColor: activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted, transform: [{ rotate: '45deg' }] }} />
                        </View>
                        <Text style={[styles.tabIconText, { color: activeTab === 'unheard' ? '#10b981' : theme.colors.textMuted }]}>
                          { (activeZone ? isHQGroup(activeZone.id) : contextIsHQ) ? "UNHEARD" : "UNREHEARSED" }
                        </Text>
                      </TouchableOpacity>
                    </>
                  }
                </View>
                <View style={styles.actionRight}>
                  <TouchableOpacity style={styles.iconButton} onPress={() => {
                    if (programSongs.length > 0) {
                      const randomIdx = Math.floor(Math.random() * programSongs.length);
                      play(programSongs[randomIdx], programSongs, false);
                      navigation.navigate('Player', { activeTrack: programSongs[randomIdx], zoneId: activeZone?.id, queue: programSongs });
                    }
                  }}>
                    <Ionicons name="shuffle" size={26} color={theme.colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tabContentContainer}>
                {isLoading && programSongs.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '500' }}>Updating…</Text>
                  </View>
                )}
                {!isLoading && categories.length === 0 && programSongs.length > 0 && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    {[1,2,3].map(i => (
                      <Animated.View key={i} style={[{
                        height: 64, borderRadius: 16, backgroundColor: theme.colors.cardBackgroundLight,
                        marginBottom: 12,
                      }, { opacity: shimmerOpacity }]} />
                    ))}
                  </View>
                )}
                {selectedCategory && (
                  <View style={[styles.trackList, { paddingBottom: 0, marginBottom: 16 }]}>
                    <View style={styles.categoryHeaderRow}>
                      <TouchableOpacity
                        style={styles.backToCategoriesBtn}
                        onPress={() => {
                          setSelectedCategory(null);
                        }}>
                        <Ionicons name="arrow-back" size={16} color={theme.colors.textPrimary} />
                        <Text style={styles.backToCategoriesText}>Categories</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={[styles.backToCategoriesBtn, { backgroundColor: 'transparent' }]}>
                        <Text style={styles.currentCategoryTitle} numberOfLines={1}>
                          {selectedCategory ? selectedCategory.length <= 15 ? selectedCategory : selectedCategory.split(' ').length > 2 ? `${selectedCategory.split(' ')[0]} ${selectedCategory.split(' ')[1]}...` : selectedCategory : ''}
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
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isSelectionMode ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          paddingVertical: 5,
                          paddingHorizontal: 12,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isSelectionMode ? theme.colors.accent : 'rgba(255, 255, 255, 0.1)',
                        }}
                        onPress={() => {
                          setIsSelectionMode(!isSelectionMode);
                          if (isSelectionMode) {
                            setSelectedTracks(new Set());
                          }
                        }}>
                        <Ionicons
                          name={isSelectionMode ? "close-circle-outline" : "checkmark-circle-outline"}
                          size={14}
                          color={isSelectionMode ? theme.colors.accent : theme.colors.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: isSelectionMode ? theme.colors.accent : theme.colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                          {isSelectionMode ? "Cancel" : "Select"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </>
          }
          renderItem={({ item, index }) => {
            if (!selectedCategory) {
              const cat = item;
              const songCount = categorySongCounts[cat.id] || 0;

              return (
                <View style={{ paddingHorizontal: 16 }}>
                  <TouchableOpacity
                    style={styles.categoryListItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      setActiveTab('unheard');
                    }}>
                    <View style={styles.categoryItemLeft}>
                      <View style={styles.categoryIconWrapper}>
                        <Ionicons name={cat.icon as any} size={20} color={theme.colors.textPrimary} />
                      </View>
                      <View style={styles.categoryTextInfo}>
                        <Text style={styles.categoryListTitle} numberOfLines={1} ellipsizeMode="tail">{cat.name}</Text>
                        <Text style={styles.categoryListSubtitle} numberOfLines={1} ellipsizeMode="tail">{songCount} songs available</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            }

            const track = item;
             const isActiveTrack = activeTrack && (
              String(activeTrack.id) === String(track.id) ||
              (activeTrack.isHistory && String(activeTrack.originalSongId) === String(track.id))
            );
            const hasAudio = !!track.audioUrl;
            return (
              <View style={[styles.trackList, { paddingTop: 0, paddingBottom: 0 }]}>
                <TouchableOpacity
                  style={[styles.trackItem, selectedTracks.has(track.id) && { backgroundColor: 'rgba(192,132,252,0.12)', borderRadius: 12 }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isSelectionMode) {
                      toggleSelection(track.id);
                      return;
                    }

                    const isSameTrack = activeTrack && (
                      String(activeTrack.id) === String(track.id) ||
                      (activeTrack.isHistory && String(activeTrack.originalSongId) === String(track.id))
                    );
                    if (!isSameTrack) {
                      play(track, programSongs, false);
                    }
                    navigation.navigate('Player', { activeTrack: track, zoneId: activeZone?.id, queue: programSongs });
                  }}
                  onLongPress={() => {
                    if (!isSelectionMode) setIsSelectionMode(true);
                    toggleSelection(track.id);
                  }}>
                  {isSelectionMode ? (
                    <View style={{ width: 28, alignItems: 'center', marginRight: 8 }}>
                      <Ionicons name={selectedTracks.has(track.id) ? "checkmark-circle" : "ellipse-outline"} size={20} color={selectedTracks.has(track.id) ? theme.colors.accent : theme.colors.textMuted} />
                    </View>
                  ) : isActiveTrack && isPlaying ? (
                    <View style={{ width: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2, height: 18, marginRight: 8 }}>
                      {[1, 0.6, 0.85].map((h, i) => (
                        <View key={i} style={{ width: 3, height: 18 * h, backgroundColor: theme.colors.accent, borderRadius: 2 }} />
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: isActiveTrack ? theme.colors.accent : theme.colors.textMuted, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center', marginRight: 8, fontFamily: 'monospace' }}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  )}
                  <View style={{ position: 'relative' }}>
                    <Image source={track.image} style={styles.trackImage} contentFit="cover" cachePolicy="disk" />
                    {!hasAudio && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="volume-mute" size={18} color="rgba(255,255,255,0.8)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.trackInfo}>
                    <Text style={[styles.trackTitle, isActiveTrack && { color: theme.colors.accent }]} numberOfLines={1} ellipsizeMode="tail">{track.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {!hasAudio ? (
                        <Ionicons name="volume-mute-outline" size={12} color="#fb923c" style={{ marginRight: 4 }} />
                      ) : (
                        <Ionicons name={isActiveTrack ? 'volume-high' : 'musical-notes'} size={12} color={isActiveTrack ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.trackSubtitle, { flex: 1 }, isActiveTrack && { color: theme.colors.accent }, !hasAudio && { color: '#fb923c' }]} numberOfLines={1} ellipsizeMode="tail">
                        {!hasAudio ? 'No audio yet' : `${track.subtitle} • ${track.category}`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 'bold' }}>x{track.rehearsalCount}</Text>
                    </View>
                    {!isSelectionMode && (
                      <TouchableOpacity style={styles.trackMoreButton} onPress={(e) => {
                        e.stopPropagation();
                        setSelectedOptionsTrack(track);
                        setShowTrackOptions(true);
                      }}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            selectedCategory ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-note-outline" size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>No songs found in this category.</Text>
              </View>
            ) : (
              <View style={[styles.emptyContainer, { paddingVertical: 40, alignItems: 'center' }]}>
                <Ionicons name="sparkles-outline" size={48} color={theme.colors.accent} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary }]}>
                  {programTitle === 'No Ongoing Rehearsal' ? 'No Ongoing Rehearsal' : 'No Songs Available'}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 16, paddingHorizontal: 32 }}>
                  {programTitle === 'No Ongoing Rehearsal'
                    ? 'There is no rehearsal actively marked as ongoing. Use the switcher above to view other programs or archives.'
                    : 'No songs have been added to this rehearsal program yet.'}
                </Text>
                {availablePrograms.length > 0 && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.colors.cardBackgroundLight,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.bottomTabBorder,
                    }}
                    onPress={() => setShowProgramSwitcher(true)}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={theme.colors.accent} style={{ marginRight: 8 }} />
                    <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Switch Program</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
        )}
        {isSelectionMode && (
          <View style={[styles.nowPlayingBar, { bottom: 66 + insets.bottom }]}>
            <LinearGradient
              colors={themeName === 'dark' ? ['#1c1c1e', '#0a0a0a'] : ['#FFFFFF', '#F3E8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.nowPlayingCard, { justifyContent: 'space-between', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.12)' }]}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {selectedTracks.size} Selected
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <TouchableOpacity onPress={() => {
                  const tracks = Array.from(selectedTracks).map(id => programSongs.find(s => s.id === id)).filter(Boolean);
                  setSelectedOptionsTrack(null);
                  setTracksForOptions(tracks);
                  setShowTrackOptions(true);
                }}>
                  <Ionicons name="list-outline" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const tracks = Array.from(selectedTracks).map(id => programSongs.find(s => s.id === id)).filter(Boolean);
                  setShareTracks(tracks);
                  setShowShareSheet(true);
                }}>
                  <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedTracks(new Set()); }}>
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}
        {!isSelectionMode && activeTrack && !hideMiniPlayer && (
        <View style={[styles.nowPlayingBar, { bottom: 66 + insets.bottom }]}>
          <TouchableOpacity
            style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.background === '#000000' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(124, 58, 237, 0.12)' }}
            activeOpacity={0.9}
            onPress={() => {
              navigation.navigate('Player', { activeTrack: currentActiveTrack, zoneId: activeZone?.id, queue: programSongs });
            }}>
            <LinearGradient
              colors={theme.colors.background !== '#FFFFFF' && theme.colors.background !== '#ffffff' ? theme.gradients.glassPurple : ['#FFFFFF', '#F3E8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nowPlayingCard}
            >
              <View style={{ marginRight: 12, shadowColor: '#d946ef', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 10 }}>
                <Image source={currentActiveTrack.image} style={[styles.nowPlayingImage, { marginRight: 0 }]} contentFit="cover" cachePolicy="disk" />
              </View>
              <View style={styles.nowPlayingInfo}>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentActiveTrack.title}</Text>
                <Text style={styles.nowPlayingSubtitle} numberOfLines={1}>{currentActiveTrack.subtitle || 'Loveworld Singers'}</Text>
              </View>
              {isPlaying && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 20, marginRight: 6, gap: 2 }}>
                  {[waveAnim1, waveAnim2, waveAnim3, waveAnim4, waveAnim5].map((anim, i) => (
                    <Animated.View key={i} style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: theme.colors.accent, transform: [{ scaleY: anim }] }} />
                  ))}
                </View>
              )}
              <View style={styles.nowPlayingActions}>
                <TouchableOpacity
                  style={styles.nowPlayingBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    togglePlayback();
                  }}>
                  {isPlayerLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                  ) : (
                    <Ionicons name={!currentActiveTrack?.audioUrl ? "alert-circle" : isPlaying ? "pause" : "play"} size={26} color={!currentActiveTrack?.audioUrl ? "#fb923c" : theme.colors.textPrimary} style={{ marginLeft: isPlaying || !currentActiveTrack?.audioUrl ? 0 : 4 }} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nowPlayingBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    pause();
                    setHideMiniPlayer(true);
                  }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={{ position: 'absolute', bottom: 0, left: 0, width: '45%', height: 3, backgroundColor: theme.colors.accent, borderBottomLeftRadius: 18 }} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        )}

      </SafeAreaView>
      <View style={[styles.bottomTabBar, { height: 64 + insets.bottom, paddingBottom: 4 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.bottomTabButton}
          onPress={() => { navigation.navigate('Home'); }}
          activeOpacity={0.7}>
          <Ionicons name={'home-outline'} size={22} color={theme.colors.textMuted} />
          <Text style={styles.bottomTabText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTabButton}
          onPress={() => { navigation.navigate('Audiolab'); }}
          activeOpacity={0.7}>
          <Ionicons name={'radio-outline'} size={22} color={theme.colors.textMuted} />
          <Text style={styles.bottomTabText}>AudioLab</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTabButton}
          onPress={() => { setShowScheduleSheet(true); }}
          activeOpacity={0.7}>
          <Ionicons name={'calendar-outline'} size={22} color={theme.colors.textMuted} />
          <Text style={styles.bottomTabText}>Schedule</Text>
        </TouchableOpacity>

      </View>

      {}
      {activeSongs.length > 0 && !(isSelectionMode || showProgramSwitcher || showActiveSongsModal || showCategoriesDropdown || showTrackOptions || showShareSheet || showScheduleSheet) &&
      <TouchableOpacity
        style={[styles.floatingLiveWidget, (activeTrack && !hideMiniPlayer) && { bottom: 136 + 75 }]}
        activeOpacity={0.9}
        onPress={() => {
          if (activeSongs.length === 1) {
            const liveSong = activeSongs[0];
            play(liveSong, programSongs, false);
            navigation.navigate('Player', { activeTrack: liveSong, zoneId: activeZone?.id, queue: programSongs });
          } else {
            setShowActiveSongsModal(true);
          }
        }}>
        
          <View style={styles.liveWidgetGradient}>
            <View style={styles.liveIndicatorRing}>
              <View style={styles.liveDot} />
            </View>
            <View style={styles.liveWidgetInfo}>
              <Text style={styles.liveTextSmall}>LIVE NOW</Text>
              <Text style={styles.liveTextTitle} numberOfLines={1}>
                {activeSongs.length === 1 ? activeSongs[0].title : `${activeSongs.length} Active Songs`}
              </Text>
            </View>
            <Ionicons name="pulse" size={20} color="#22c55e" style={styles.livePulseIcon} />
          </View>
        </TouchableOpacity>
      }

      {}
      <Modal
        visible={showActiveSongsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActiveSongsModal(false)}>
        
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live Rehearsal Sessions</Text>
              <TouchableOpacity onPress={() => setShowActiveSongsModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {activeSongs.map((song: any, index: number) =>
              <TouchableOpacity
                key={song.id || `live-${index}`}
                style={styles.modalListItem}
                onPress={() => {
                  setShowActiveSongsModal(false);
                  play(song, programSongs, false);
                  navigation.navigate('Player', { activeTrack: song, zoneId: activeZone?.id, queue: programSongs });
                }}>
                
                  <View style={styles.modalItemBadge}>
                    <Text style={styles.modalItemBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalItemTitle}>{song.title}</Text>
                    <Text style={styles.modalItemSubtitle}>{song.category}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {}
      <Modal
        visible={showProgramSwitcher}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProgramSwitcher(false)}>
        
        <BlurView intensity={60} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowProgramSwitcher(false)} />
          
          <View style={[styles.modalContainer, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Switch Program</Text>
              <TouchableOpacity onPress={() => setShowProgramSwitcher(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {availablePrograms
                .filter((prog: any) => {
                  // Mirror the web: only show programs matching the current category tab
                  const targetCat = (route?.params?.categoryFilter || 'ongoing').toLowerCase().trim();
                  return (prog.category || '').toLowerCase().trim() === targetCat;
                })
                .map((prog) => {
                const isActive = prog.id === currentActiveTrack?.program || prog.name === programTitle;
                return (
                  <TouchableOpacity
                    key={prog.id}
                    style={[styles.categoryListItem, isActive && { backgroundColor: 'transparent', borderColor: theme.colors.bottomTabBorder, borderWidth: 1 }]}
                    onPress={() => {
                      setSelectedProgramOverride(prog);
                      setShowProgramSwitcher(false);
                      setSelectedCategory(null);
                      setActiveTab('unheard');
                      triggerReload();
                    }}>
                    
                    <View style={styles.categoryItemLeft}>
                      <View style={[styles.categoryIconWrapper, isActive && { backgroundColor: 'transparent' }]}>
                        <Ionicons name="radio" size={20} color={theme.colors.textPrimary} />
                      </View>
                      <View style={styles.categoryTextInfo}>
                        <Text style={[styles.categoryListTitle, isActive && { color: theme.colors.textPrimary }]} numberOfLines={1}>{prog.name || prog.title}</Text>
                        <Text style={styles.categoryListSubtitle} numberOfLines={1}>{prog.date || new Date(prog.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={24} color={theme.colors.textPrimary} />}
                  </TouchableOpacity>);

              })}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      <TrackOptionsModal 
        visible={showTrackOptions} 
        onClose={() => {
          setShowTrackOptions(false);
          setIsSelectionMode(false);
          setSelectedTracks(new Set());
        }} 
        track={selectedOptionsTrack}
        tracks={tracksForOptions}
        onForwardToChat={() => {
          if (tracksForOptions && tracksForOptions.length > 0) {
            setShareTracks(tracksForOptions);
          } else {
            setShareTrack(selectedOptionsTrack);
          }
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
        songs={shareTracks}
        onClose={() => {
          setShowShareSheet(false);
          setShareTrack(null);
          setShareTracks(null);
        }}
      />
      <SongScheduleSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
      />
    </View>);

}

const getStyles = (theme: any, insets: any) => {
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center'
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center'
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackgroundLight,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500'
  },
  sortButton: {
    backgroundColor: theme.colors.cardBackgroundLight,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sortText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_WIDTH * 0.52,
    borderRadius: 12
  },
  countdownBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    gap: 6
  },
  countdownText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  detailsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  authorLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: theme.colors.background
  },
  authorText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  aboutText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    lineHeight: 18
  },
  durationText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  downloadIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  downloadIcon: {
    width: '100%',
    height: '100%'
  },
  iconButton: {
    marginRight: 20
  },
  tabIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20
  },
  tabIconText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginLeft: 20,
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 12
  },
  trackList: {
    paddingHorizontal: 16
  },
  categoriesListContainer: {
    paddingHorizontal: 16
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginBottom: 12
  },
  categoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16
  },
  categoryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  categoryTextInfo: {
    justifyContent: 'center',
    flex: 1
  },
  categoryListTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  categoryListSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 16
  },
  backToCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20
  },
  backToCategoriesText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4
  },
  currentCategoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 8
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  trackImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  trackSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400'
  },
  trackMoreButton: {
    padding: 8
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 20
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center'
  },
  activeTabButton: {
    backgroundColor: 'rgba(255,255,255,0.0)', // Transparent so we rely on text color
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  activeTabText: {
    color: theme.colors.accent,
    fontWeight: '700'
  },
  tabContentContainer: {
    flex: 1
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between'
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: 110,
    justifyContent: 'flex-end',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  categoryIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
    opacity: 0.3
  },
  categoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  categorySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500'
  },
  nowPlayingBar: {
    position: 'absolute',
    bottom: 66,
    left: 12,
    right: 12,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nowPlayingImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 12
  },
  nowPlayingInfo: {
    flex: 1
  },
  nowPlayingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  nowPlayingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  nowPlayingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  nowPlayingBtn: {
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: theme.colors.bottomTabBackground,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  activeBottomTabButton: {
    opacity: 1
  },
  bottomTabText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4
  },
  activeBottomTabText: {
    color: theme.colors.accent,
    fontWeight: '700'
  },
  dropdownMenuContainer: {
    backgroundColor: theme.colors.background,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 8,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    marginBottom: 4
  },
  dropdownTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold'
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  activeDropdownItem: {
    backgroundColor: theme.colors.cardBackgroundLight
  },
  dropdownItemText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500'
  },
  activeDropdownItemText: {
    color: theme.colors.textPrimary,
    fontWeight: '700'
  },

  playerModalContainer: {
    flex: 1
  },
  playerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  playerModalHeaderBtn: {
    padding: 4
  },
  playerModalHeaderText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  playerModalArtContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 24,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20
  },
  playerModalArt: {
    width: '100%',
    height: '100%'
  },
  playerModalLyricsSnippet: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 32
  },
  playerModalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  playerModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: -0.5
  },
  playerModalArtist: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '500'
  },
  playerModalProgressContainer: {
    marginBottom: 32
  },
  playerModalProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  playerModalProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 2
  },
  playerModalProgressThumb: {
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.textPrimary,
    marginLeft: -6
  },
  playerModalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  playerModalTimeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  playerModalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 36
  },
  playerModalPlayPauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12
  },
  playerModalBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  playerModalLyricsCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  playerModalLyricsCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12
  },
  playerModalLyricsCardText: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26
  },

  heardPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  heardPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  heardPillTextActive: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800'
  },
  heardPillTextInactive: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  unheardPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    borderWidth: 1,
    borderColor: '#fb923c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  unheardPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  unheardPillTextActive: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: '800'
  },
  unheardPillTextInactive: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  statusFilterCenterText: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  floatingLiveWidget: {
    position: 'absolute',
    bottom: 136,
    right: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999
  },
  liveWidgetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  liveIndicatorRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e'
  },
  liveWidgetInfo: {
    marginRight: 10,
    maxWidth: 150
  },
  liveTextSmall: {
    color: '#22c55e',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 1
  },
  liveTextTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800'
  },
  livePulseIcon: {
    marginLeft: 'auto'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,10,20,0.85)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Math.max(24, insets.bottom + 16),
    maxHeight: '70%',
    borderTopWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.3)'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    marginBottom: 16
  },
  modalTitle: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  closeModalBtn: {
    padding: 4
  },
  modalList: {
    width: '100%'
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  modalItemBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  modalItemBadgeText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800'
  },
  modalItemInfo: {
    flex: 1,
    marginRight: 10
  },
  modalItemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1
  },
  modalItemSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '500'
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  modalContainer: {
    backgroundColor: theme.colors.bottomSheetBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Math.max(24, insets.bottom + 16),
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  modalTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  }
});
};
