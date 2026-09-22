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
import { useVideoPlayer, VideoView } from 'expo-video';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

const TRACK_PLACEHOLDER_VIDEO = require('../../assets/TRACK_PLACEHOLDER.mp4');
import Svg, { Path } from 'react-native-svg';
import { ZONES, getZoneByInvitationCode, isHQGroup } from '../config/zones';
import { useZone } from '../hooks/useZone';
import { useUserStore, useChurch } from '../hooks/useUser';
import { canAccessArchive, canAccessPreRehearsal, getHiddenFeatures, isHQAdmin } from '../config/roles';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { readCache, writeCache } from '../lib/screenCache';
import { optimizeImage, optimizeAudio, resolveSongAudioUrl, resolveSongAudioUrls } from '../lib/mediaUtils';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { SongScheduleSheet } from '../components/SongScheduleSheet';
import { api, clearCache } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

import { useLiveSongStore, isLiveSong, isSongExplicitlyOff } from '../stores/liveSongStore';
import { StandaloneCountdown } from '../components/rehearsal/StandaloneCountdown';
import { RehearsalSkeletonLoader } from '../components/rehearsal/RehearsalSkeletonLoader';
import { RehearsalEmptyState } from '../components/rehearsal/RehearsalEmptyState';
import { RehearsalCategoryRow } from '../components/rehearsal/RehearsalCategoryRow';
import { RehearsalSongRow } from '../components/rehearsal/RehearsalSongRow';
import { ProgramSwitcherModal } from '../components/rehearsal/ProgramSwitcherModal';
import { RehearsalListHeader } from '../components/rehearsal/RehearsalListHeader';
import { getStyles } from '../components/rehearsal/rehearsalStyles';
import { isInvalidUserCategory, songBelongsToCategory, isSongHeard, getTrackImage, getRehearsalCount } from '../lib/rehearsalUtils';
import { navigateToPlayer } from '../navigation/navigationService';

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


export default function RehearsalScreen({ navigation, route }: any) {
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme, insets), [theme, insets]);

  const program = route?.params?.program;

  const [isLoading, setIsLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<any>(null);
  const { currentZone: contextZone, isHQ: contextIsHQ, zoneVersion, isLoading: isZoneLoading } = useZone();
  const { currentChurch } = useChurch();
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  const activeLiveSongs = useLiveSongStore(s => s.activeSongs);

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

  const initialPlaceholderAsset = Asset.fromModule(TRACK_PLACEHOLDER_VIDEO);
  const initialPlaceholderSource = initialPlaceholderAsset.localUri ? { uri: initialPlaceholderAsset.localUri } : TRACK_PLACEHOLDER_VIDEO;

  const placeholderVideoPlayer = useVideoPlayer(initialPlaceholderSource, player => {
    player.loop = true;
    player.muted = true;
    try {
      player.play();
    } catch {}
  });

  useEffect(() => {
    let isMounted = true;
    async function ensureLocalPlaceholder() {
      try {
        const a = Asset.fromModule(TRACK_PLACEHOLDER_VIDEO);
        if (!a.localUri) {
          await a.downloadAsync();
        }
        if (isMounted && a.localUri && placeholderVideoPlayer) {
          if (typeof placeholderVideoPlayer.replaceAsync === 'function') {
            await placeholderVideoPlayer.replaceAsync({ uri: a.localUri });
          } else {
            placeholderVideoPlayer.replace({ uri: a.localUri });
          }
          placeholderVideoPlayer.muted = true;
          placeholderVideoPlayer.loop = true;
          try {
            placeholderVideoPlayer.play();
          } catch {}
        }
      } catch (e) {
        console.warn('[RehearsalScreen] Track placeholder video local load warning:', e);
      }
    }
    ensureLocalPlaceholder();
    return () => {
      isMounted = false;
    };
  }, [placeholderVideoPlayer]);


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

  const handledSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    const targetSongId = route?.params?.songId;
    if (!targetSongId) {
      handledSongIdRef.current = null;
      return;
    }
    if (handledSongIdRef.current === String(targetSongId)) return;

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
              const res = await api.songs.getEndpoint(endpoint);
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
              category: songDocData.category || '',
              categories: Array.isArray(songDocData.categories) ? songDocData.categories : (songDocData.category ? [songDocData.category] : []),
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
        handledSongIdRef.current = String(targetSongId);

        if (song.category) {
          setSelectedCategory(song.category);
        }

        if (song.status === 'heard') {
          setActiveTab('heard');
        } else {
          setActiveTab('unheard');
        }

        console.log('[RehearsalScreen] Navigating to Player screen:', song.title);
        navigateToPlayer({ activeTrack: song, zoneId: activeZone?.id || song.zoneId, queue: [song, ...programSongs], autoplay: false });

        navigation.setParams({ songId: undefined });
      }
    }

    handleAutoPlay();

    return () => {
      active = false;
    };
  }, [route?.params?.songId, programSongs, activeZone?.id]);

  // auth listener removed â€” auth state managed via useUserStore

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
    hasCachedDataRef.current = false; // Reset so switching zones/programs reads the correct cache

    clearCache();

    async function loadData() {
      // Include selectedProgramOverride ID in cache key so switching programs
      // never accidentally loads a different program's stale songs.
      const overrideId = selectedProgramOverride?.id || null;
      const cacheKey = `rehearsal_songs_${overrideId || program?.id || 'default'}_${contextZone?.id || 'none'}`;

      const setupCategoriesFromSongs = (songs: any[], categoryOrder: string[] = []) => {
        const allCategoriesList: string[] = [];
        songs.forEach((song: any) => {
          if (song.categories && Array.isArray(song.categories)) {
            allCategoriesList.push(...song.categories.filter((cat: any) => !isInvalidUserCategory(cat)));
          } else if (song.category && !isInvalidUserCategory(song.category)) {
            allCategoriesList.push(song.category.trim());
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

        setCategories(finalCategories);

        setSelectedCategory((prevSelected) => {
          if (prevSelected && uniqueCategories.includes(prevSelected)) {
            return prevSelected;
          }
          return null;
        });
      };


      if (!hasCachedDataRef.current) {
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
              api.programs.getMemberRehearsals().catch(() => null),
              api.subgroups.mine().catch(() => null),
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

            const targetSgId = route?.params?.subgroupId || currentChurch?.id;
            if (targetSgId) {
              selectedRehearsal = subgroupPages.find((p: any) => (p.subGroupId === targetSgId || p.sub_group_id === targetSgId) && p.category === 'ongoing')
                || subgroupPages.find((p: any) => p.subGroupId === targetSgId || p.sub_group_id === targetSgId)
                || subgroupPages.find((p: any) => p.category === 'ongoing')
                || subgroupPages[0]
                || null;
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
            // Always pass the explicit zoneId â€” even for zone-001 (HQ) users.
            // The API's HQ-admin bypass (no zone filter) only applies to server-side
            // admin tokens. Regular singers authenticated in zone-001 must still
            // receive zoneId=zone-001 so the backend scopes results correctly.
            const programsRes = await api.programs.getAll(resolvedZoneId).catch(() => null);

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

            const allAvailable = processPages(programsRes);
            if (active) {
              setAvailablePrograms(allAvailable);
            }

            const targetCategory = (route?.params?.categoryFilter || 'ongoing').toLowerCase().trim();

            // Pick program matching the target category from this zone's programs
            selectedRehearsal = allAvailable.find((p: any) => (p.category || '').toLowerCase().trim() === targetCategory) || null;
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
            const result = await api.songs.getEndpoint(
              `/songs/praise-night?zoneId=${encodeURIComponent(resolvedZoneId)}`
            ).catch(() => null);
            if (result?.success && Array.isArray(result.data)) {
              dbSongs = result.data;
              isSongsFetchSuccessful = true;
            }
          } else if (selectedRehearsal.scope === 'subgroup' || selectedRehearsal.subGroupId || isSubgroupMode) {
            const targetSgId = selectedRehearsal.subGroupId || selectedRehearsal.sub_group_id || route?.params?.subgroupId;
            const [primarySgRes, altSgRes] = await Promise.all([
              targetSgId ? api.subgroups.getSongs(targetSgId).catch(() => null) : null,
              targetSgId ? api.songs.getSubgroupSongs({ subGroupId: targetSgId }).catch(() => null) : null,
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
            const primary = await api.songs.getEndpoint(
              `/songs/praise-night?programId=${encodeURIComponent(selectedRehearsal.id)}${effectiveZone}`
            ).catch(() => null);
            if (primary?.success && Array.isArray(primary.data) && primary.data.length > 0) {
              dbSongs = primary.data;
              isSongsFetchSuccessful = true;
            } else if (Array.isArray(selectedRehearsal.songs) && selectedRehearsal.songs.length > 0) {
              dbSongs = selectedRehearsal.songs;
              isSongsFetchSuccessful = true;
            } else if (Array.isArray(selectedRehearsal.songIds) && selectedRehearsal.songIds.length > 0) {
              const zoneRes = await api.songs.getZoneSongs(resolvedZoneId).catch(() => null);
              if (zoneRes?.success && Array.isArray(zoneRes.data)) {
                dbSongs = zoneRes.data.filter((s: any) => selectedRehearsal.songIds.includes(s.id));
                isSongsFetchSuccessful = true;
              }
            } else if (primary?.success && Array.isArray(primary.data)) {
              dbSongs = primary.data;
              isSongsFetchSuccessful = true;
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
          const isLiveNow = isLiveSong(song);
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
            category: song.category || '',
            categories: Array.isArray(song.categories) ? song.categories : (song.category ? [song.category] : []),
            audioUrl: songAudioUrl,
            lyrics: song.lyrics || '',
            solfa: song.notation || song.solfas || song.solfa || '',
            audioUrls: resolvedAudioUrls,
            status: isLiveNow ? 'live' : (isSongHeard(song) ? 'heard' : 'unheard'),
            isLive: isLiveNow,
            isActive: isLiveNow,
            rehearsalCount: getRehearsalCount(song),
            conductorGuide: song.solfas || song.conductorGuide || song.guide || '',
            history: song.history || '',
            comments: song.comments || '',
            leadKeyboardist: song.leadKeyboardist || '',
            drummer: song.drummer || '',
            leadGuitarist: song.leadGuitarist || '',
            createdAt: song.createdAt ? typeof song.createdAt === 'string' ? song.createdAt : new Date().toISOString() : new Date().toISOString(),
            imageUrl: song.imageUrl || getTrackImage(song) || '',
            image: (song.imageUrl || getTrackImage(song)) ? { uri: song.imageUrl || getTrackImage(song) } : null,
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
            allCategoriesList.push(...song.categories.filter((cat: any) => !isInvalidUserCategory(cat)));
          } else if (song.category && !isInvalidUserCategory(song.category)) {
            allCategoriesList.push(song.category.trim());
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

        const pageCategories = finalCategories.length > 0 ? finalCategories : [];

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
  }, [program, selectedProgramOverride, reloadKey, contextZone?.id, zoneVersion, isZoneLoading, isProfileLoading, user?.uid]);

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
      useLiveSongStore.getState().handleSongUpdate(update);
      return;
    }
    useLiveSongStore.getState().handleSongUpdate(update);

    setProgramSongs((prev: any[]) => {
      const index = prev.findIndex((s: any) => String(s.id) === String(update.id));
      if (index >= 0) {
        const next = [...prev];
        const s = next[index];
        const merged = { ...s, ...update };
        const songAudioUrl = resolveSongAudioUrl(merged);
        const resolvedAudioUrls = resolveSongAudioUrls(merged);
        const updateIsLive = isLiveSong(update);
        const updateIsOff = isSongExplicitlyOff(update);
        const isCurrentlyLive = updateIsLive ? true : (updateIsOff ? false : isLiveSong(s));

        if (isCurrentlyLive && !notifiedActiveSongsRef.current.has(update.id)) {
          notifiedActiveSongsRef.current.add(update.id);
        } else if (!isCurrentlyLive) {
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
          isLive: isCurrentlyLive,
          rehearsalCount: update.rehearsalCount ?? s.rehearsalCount,
          status: isCurrentlyLive
            ? 'live'
            : (isSongHeard(merged) ? 'heard' : (update.status && update.status !== 'live' ? update.status : (s.status === 'live' ? 'unheard' : (s.status || 'unheard')))),
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
          category: update.category || '',
          categories: Array.isArray(update.categories) ? update.categories : (update.category ? [update.category] : []),
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

  useWebSocket('live_song', 'all', handleLiveSongUpdate, true); // fast direct event
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

  const liveRehearsalSongs = useMemo(
    () => programSongs.filter(isLiveSong),
    [programSongs]
  );

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

          <RehearsalSkeletonLoader shimmerOpacity={shimmerOpacity} theme={theme} />
        ) : !isLoading && programSongs.length === 0 ? (
          <RehearsalEmptyState
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            theme={theme}
          />
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
            <RehearsalListHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortAscending={sortAscending}
              onToggleSort={() => setSortAscending(!sortAscending)}
              coverImage={coverImage}
              programTitle={programTitle}
              programDate={programDate}
              programLocation={programLocation}
              programCountdownObj={programCountdownObj}
              programUpdatedAt={programUpdatedAt}
              onPressProgramTitle={() => setShowProgramSwitcher(true)}
              selectedCategory={selectedCategory}
              activeTab={activeTab}
              onSetTab={setActiveTab}
              isHQ={activeZone ? isHQGroup(activeZone.id) : contextIsHQ}
              programSongs={programSongs}
              onShuffle={() => {
                if (programSongs.length > 0) {
                  const randomIdx = Math.floor(Math.random() * programSongs.length);
                  play(programSongs[randomIdx], programSongs, false);
                  navigateToPlayer({ activeTrack: programSongs[randomIdx], zoneId: activeZone?.id, queue: programSongs });
                }
              }}
              isLoading={isLoading}
              shimmerOpacity={shimmerOpacity}
              categories={categories}
              onBackToCategories={() => setSelectedCategory(null)}
              isSelectionMode={isSelectionMode}
              onToggleSelectionMode={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) setSelectedTracks(new Set()); }}
              theme={theme}
              styles={styles}
            />
          }
          renderItem={({ item, index }) => {
            if (!selectedCategory) {
              const cat = item;
              const songCount = categorySongCounts[cat.id] || 0;
              return (
                <RehearsalCategoryRow
                  key={cat.id}
                  cat={cat}
                  songCount={songCount}
                  onPress={() => { setSelectedCategory(cat.id); setActiveTab('unheard'); }}
                  theme={theme}
                  styles={styles}
                />
              );
            }

            const track = item;
            const isActiveTrack = !!(activeTrack && (
              String(activeTrack.id) === String(track.id) ||
              (activeTrack.isHistory && String(activeTrack.originalSongId) === String(track.id))
            ));
            const isLive = isLiveSong(track) || (activeLiveSongs && activeLiveSongs.some((ls: any) => String(ls.id) === String(track.id)));
            const hasAudio = !!track.audioUrl;
            return (
              <RehearsalSongRow
                track={track}
                index={index}
                isActiveTrack={isActiveTrack}
                isPlaying={isPlaying}
                isLive={isLive}
                isSelectionMode={isSelectionMode}
                isSelected={selectedTracks.has(track.id)}
                hasAudio={hasAudio}
                coverImage={coverImage || COVER_IMAGE}
                placeholderVideoPlayer={placeholderVideoPlayer}
                onPress={() => {
                  if (isSelectionMode) { toggleSelection(track.id); return; }
                  const isSameTrack = activeTrack && (
                    String(activeTrack.id) === String(track.id) ||
                    (activeTrack.isHistory && String(activeTrack.originalSongId) === String(track.id))
                  );
                  if (!isSameTrack) {
                    play(track, programSongs, true);
                  } else {
                    navigateToPlayer({ activeTrack: track, zoneId: activeZone?.id, queue: programSongs });
                  }
                }}
                onLongPress={() => { if (!isSelectionMode) setIsSelectionMode(true); toggleSelection(track.id); }}
                onOptionsPress={() => { setSelectedOptionsTrack(track); setShowTrackOptions(true); }}
                theme={theme}
                styles={styles}
              />
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
              navigateToPlayer({ activeTrack: currentActiveTrack, zoneId: activeZone?.id, queue: programSongs });
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
      <ProgramSwitcherModal
        visible={showProgramSwitcher}
        onClose={() => setShowProgramSwitcher(false)}
        availablePrograms={availablePrograms}
        programTitle={programTitle}
        currentActiveTrack={currentActiveTrack}
        categoryFilter={route?.params?.categoryFilter}
        onSelectProgram={(prog) => {
          setSelectedProgramOverride(prog);
          setShowProgramSwitcher(false);
          setSelectedCategory(null);
          setActiveTab('unheard');
          triggerReload();
        }}
        insets={insets}
        theme={theme}
        styles={styles}
      />


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


