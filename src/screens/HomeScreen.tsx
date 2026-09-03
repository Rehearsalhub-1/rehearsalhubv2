import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { DoodleBackground } from '../components/DoodleBackground';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  Pressable,
  Animated,
  ScrollView,
  StatusBar as RNStatusBar,
  AppState,
  Alert } from
'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { setupNotifications } from '../lib/notifications';
import { SyncAvatar } from '../components/SyncAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser, useUserStore } from '../hooks/useUser';
import { isHQAdmin, canAccessArchive, getHiddenFeatures, isZoneCoordinator } from '../config/roles';
import { useIsFocused, useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.75;

const SLIDE_IMAGES = [
  require('../../assets/image/home1.jpg'),
  require('../../assets/image/home3.png'),
  require('../../assets/image/home4.png'),
  require('../../assets/image/home5.jpg'),
  require('../../assets/image/home8.jpg'),
  require('../../assets/image/home9.jpg'),
  require('../../assets/image/home10.jpg'),
  require('../../assets/image/home1.jpg')
];

const MENU_SECTIONS = [
  {
  header: 'PERSONAL',
  items: [
  { id: 'profile', title: 'Profile', icon: 'person-circle' },
  ]

},
{
  header: 'REHEARSAL',
  items: [
  { id: 'songs', title: 'All Ministered Songs', icon: 'musical-notes' },
  { id: 'ongoing', title: 'Ongoing Rehearsal', icon: 'radio' },
  { id: 'pre-rehearsal', title: 'Pre-Rehearsals', icon: 'calendar-outline' },
  { id: 'archives', title: 'Archives', icon: 'archive' },
  { id: 'subgroups', title: 'Church', icon: 'people' },
  { id: 'submit', title: 'Submit New Song', icon: 'cloud-upload' }]

},
{
  header: 'Audiolab ',
  items:[
    { id: 'studio', title: 'Studio', icon: 'mic' },
  ]
},
{
  header: 'COMMUNITY',
  items: [
  { id: 'media', title: 'Media', icon: 'images' },
  { id: 'chat', title: 'Chat Rooms', icon: 'chatbubbles' },
  { id: 'links', title: 'Links', icon: 'link' }]

},

];

const CLOUD_ASSETS = [
  require('../../assets/video/cloud3_min.webp'), // cloud 3 for first card
  require('../../assets/video/cloud2_min.webp'), // cloud 2 for second card
  require('../../assets/video/cloud4_min.webp'), // cloud 4 for third card (last card)
];

function LoopingOnceImage({ source, durationMs = 15800, style, contentPosition }: { source: any; durationMs?: number; style: any; contentPosition?: any }) {
  const imageRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        imageRef.current?.stopAnimating?.();
      } catch {}
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <Image
      ref={imageRef}
      source={source}
      style={style}
      contentFit="cover"
      contentPosition={contentPosition || { x: 0.5, y: 0.5 }}
      priority="high"
      cachePolicy="memory-disk"
    />
  );
}

const INITIAL_CARDS = [
  {
  id: '1',
  title: 'Ongoing Rehearsal',
  subtitle: 'Join Live Rehearsal',
  mainValue: 'LIVE',
  route: 'Rehearsal',
  durationMs: 15800,
  contentPosition: { x: 0.5, y: 0.5 },
},
{
  id: '2',
  title: 'Chat Rooms',
  subtitle: 'Subgroups & Bands Chat',
  mainValue: 'CHAT',
  route: 'ChatRooms',
  durationMs: 15800,
  contentPosition: { x: 0.5, y: 0.3 },
},
{
  id: '3',
  title: 'Calendar',
  subtitle: 'Ministry Programs',
  mainValue: 'LWS',
  route: 'Calendar',
  durationMs: 15800,
  contentPosition: { x: 0.5, y: 0.5 },
},
];

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cards, setCards] = useState([
    { ...INITIAL_CARDS[0], source: CLOUD_ASSETS[0] },
    { ...INITIAL_CARDS[1], source: CLOUD_ASSETS[1] },
    { ...INITIAL_CARDS[2], source: CLOUD_ASSETS[2] },
  ]);

  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: any) => setAppState(next));
    return () => sub.remove();
  }, []);

  const [isSubGroupCoordinator, setIsSubGroupCoordinator] = useState(false);
  const { profile: contextProfile, signOut } = useUser();
  const userProfile = contextProfile?.raw || null;
  const user = useUserStore(s => s.user);
  const [unreadCount, setUnreadCount] = useState(0);

  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const searchPressAnim = useRef(new Animated.Value(1)).current;

  const navigateToSearch = () => {

    Animated.sequence([
    Animated.timing(searchPressAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true
    }),
    Animated.timing(searchPressAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true
    })]
    ).start(() => {
      navigation.navigate('Search');
    });
  };

  useEffect(() => {
    if (!isFocused) return;

    const slideTimer = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (!finished) return; // Prevent state update if animation was interrupted
        setCurrentSlide((prev) => (prev + 1) % SLIDE_IMAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        }).start();
      });
    }, 15000); // Increased from 9000ms to 15000ms to reduce CPU usage

    return () => clearInterval(slideTimer);
  }, [isFocused, fadeAnim]);

  useEffect(() => {
    const cleanupNotifications = setupNotifications();

    const checkCoordinatorStatus = async () => {
      if (!user) return;
      try {
        const isCoordFromRole = Boolean(
          (userProfile as any)?.is_subgroup_coordinator ||
          (userProfile as any)?.role === 'subgroup_admin' ||
          (userProfile as any)?.role === 'zone_admin' ||
          (userProfile as any)?.role === 'hq_admin' ||
          (userProfile as any)?.role === 'admin' ||
          (userProfile as any)?.role === 'boss'
        );
        if (isCoordFromRole) {
          setIsSubGroupCoordinator(true);
          return;
        }
        const res = await api.subgroups.coordinated().catch(() => null);
        const isCoord = Array.isArray(res?.data) && res.data.length > 0;
        setIsSubGroupCoordinator(isCoord);
      } catch (e: any) {
        console.error('Error checking coordinator status:', e);
      }
    };

    checkCoordinatorStatus();

    return () => {
      cleanupNotifications();
    };
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || !isFocused) return;

    api.notifications.getAll().then(res => {
      if (res?.data && Array.isArray(res.data)) {
        const unread = res.data.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      }
    }).catch(() => {});
  }, [user?.uid, isFocused]);

  const toggleSidebar = () => {

    const toValue = isSidebarOpen ? -SIDEBAR_WIDTH : 0;
    const backdropToValue = isSidebarOpen ? 0 : 1;

    setIsSidebarOpen(!isSidebarOpen);

    Animated.parallel([
    Animated.spring(sidebarAnim, {
      toValue,
      damping: 40,
      stiffness: 200,
      useNativeDriver: true
    }),
    Animated.timing(backdropAnim, {
      toValue: backdropToValue,
      duration: 300,
      useNativeDriver: true
    })]
    ).start();
  };

  const mainScale = sidebarAnim.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [1, 0.94]
  });

  const mainRadius = sidebarAnim.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 32]
  });

  return (
    <View style={styles.container}>
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
      {(theme.colors.background !== '#0b0514') && (
        <>
          <LinearGradient
            colors={['rgba(192, 132, 252, 0.22)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(244, 63, 94, 0.12)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.8, y: 0.2 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      <Animated.View
        style={[
        styles.mainContent,
        {
          transform: [{ scale: mainScale }],
          borderRadius: mainRadius,
          overflow: 'hidden'
        }]
        }>
        
        <ScrollView
          style={styles.mainScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mainScrollContent}>
          
            <TouchableOpacity
              style={styles.menuTextLink}
              activeOpacity={0.7}
              onPress={toggleSidebar}>
              <Ionicons name="menu-outline" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoContainer}
              activeOpacity={0.7}
              onPress={toggleSidebar}>
              <Image
                source={require('../../assets/logo/logo.png')}
                style={styles.headerLogo}
                contentFit="cover" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notificationHeaderIcon}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileHeaderIcon}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Settings')}>
              <SyncAvatar 
                userId={user?.uid}
                initialAvatar={contextProfile?.avatar}
                fallbackName={contextProfile?.firstName || userProfile?.first_name || "Me"}
                size={28}
                bgColor="rgba(255,255,255,0.08)"
              />
            </TouchableOpacity>

            <Animated.View style={[styles.searchBarWrapper, { transform: [{ scale: searchPressAnim }] }]}>
              <BlurView intensity={30} tint="light" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
                <Pressable
                onPress={navigateToSearch}
                android_ripple={null}
                style={[styles.searchContainer, { backgroundColor: 'transparent', borderWidth: 0 }]}>
                
                  <Ionicons name="search" size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
                  <Text style={[styles.searchPlaceholderText, { fontSize: 13, flex: 1, backgroundColor: 'transparent' }]}>
                    Search for songs, archives or rehearsals
                  </Text>
                  <TouchableOpacity style={[styles.micButton, { backgroundColor: 'transparent', borderWidth: 0 }]} activeOpacity={1}>
                    <Ionicons name="mic" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </Pressable>
              </BlurView>
            </Animated.View>

          <View style={styles.heroSection}>
            <View style={styles.floatingVideoWrapper}>
              <View style={StyleSheet.absoluteFill}>
                <Image
                  source={SLIDE_IMAGES[currentSlide]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover" />
                
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
                   <Image
                    source={SLIDE_IMAGES[currentSlide]}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover" />
                </Animated.View>
              </View>
            </View>
          </View>

          <View style={styles.smallCardsContainer}>
            {cards.filter(c => !(c.route === 'Rehearsal' && getHiddenFeatures(contextProfile).hideOngoing)).map((card) =>
            <TouchableOpacity
              key={card.id}
              style={styles.smallVideoWrapper}
              onPress={() => {
                if (card.route === 'Rehearsal') {
                  navigation.navigate('Rehearsal', { resetState: true, program: undefined });
                } else {
                  navigation.navigate(card.route, { card });
                }
              }}
              activeOpacity={0.9}>
              
                {card.source && (
                  <LoopingOnceImage
                    source={card.source}
                    durationMs={(card as any).durationMs || 8000}
                    style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
                    contentPosition={(card as any).contentPosition}
                  />
                )}
                <LinearGradient
                  colors={['rgba(11, 7, 18, 0.15)', 'rgba(11, 7, 18, 0.65)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}>
                
                  <View style={styles.weatherCardContent}>
                    <View style={styles.weatherCardLeft}>
                      <Text style={styles.weatherCityText}>{card.title}</Text>
                      <Text style={styles.weatherSubtext}>{card.subtitle}</Text>
                    </View>

                    <View style={styles.weatherCardRight}>
                      <Text style={styles.weatherTempText}>{card.mainValue}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.copyrightContainer}>
            <Text style={styles.copyrightText}>
              © {new Date().getFullYear()} Loveworld Singers Rehearsal Hub Portal 2.0
            </Text>
            <Text style={styles.copyrightText}>All Rights Reserved.</Text>
          </View>

          <View style={{ height: 180 }} />
        </ScrollView>

      </Animated.View>

      {}
      <Animated.View
        style={[
        styles.backdrop,
        {
          opacity: backdropAnim,
          pointerEvents: isSidebarOpen ? 'auto' : 'none'
        }]
        }>
        
        <Pressable style={StyleSheet.absoluteFill} onPress={toggleSidebar} />
      </Animated.View>

      {}
      <Animated.View
        style={[
        styles.sidebar,
        { transform: [{ translateX: sidebarAnim }] }]
        }>
        
        <View style={styles.sidebarSolidBg}>
          <LinearGradient
            colors={theme.gradients.bgBase}
            locations={theme.gradients.bgBaseLocations}
            style={StyleSheet.absoluteFill} />
          {/* DoodleBackground removed from sidebar - already rendered in main bg */}
          <LinearGradient
            colors={theme.gradients.bgGlow}
            locations={theme.gradients.bgGlowLocations}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill} />
          {}
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={styles.sidebarEdgeHighlight} />

          <ScrollView
            style={styles.sidebarContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarScrollContent}>
            
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Loveworld Singers</Text>
              <Text style={styles.sidebarSubtitle}>Rehearsal Hub Portal</Text>
            </View>

            {MENU_SECTIONS.map((section, sIndex) => {
              const hf = getHiddenFeatures(contextProfile);
              const filteredItems = section.items.filter(item => {
                if (item.id === 'pre-rehearsal') {
                  if (hf.hidePreRehearsal) return false;
                  const isHQ = isHQAdmin(contextProfile) || isHQAdmin(userProfile as any);
                  if (isHQ) return false;
                  return isZoneCoordinator(contextProfile) || isZoneCoordinator(userProfile as any) || contextProfile?.canAccessPreRehearsal === true || (userProfile as any)?.can_access_pre_rehearsal === true;
                }
                if (item.id === 'archives') {
                  // Only hide if explicitly flagged; otherwise show to all signed-in users
                  if (hf.hideArchives) return false;
                  return true;
                }
                if (item.id === 'songs' && hf.hideMinisteredSongs) return false;
                if (item.id === 'ongoing' && hf.hideOngoing) return false;
                if (item.id === 'submit' && hf.hideSubmissions) return false;
                if (item.id === 'studio' && hf.hideAudioLab) return false;
                if (item.id === 'media' && hf.hideAudioLab) return false;
                if (item.id === 'subgroups' && hf.hideSubgroups) return false;
                return true;
              });

              if (filteredItems.length === 0) return null;

              return (
              <View key={sIndex} style={styles.sectionContainer}>
                  <Text style={filteredItems.length > 0 ? styles.sectionHeader : { height: 0 }}>{section.header}</Text>
                  {filteredItems.map((item) =>
              <TouchableOpacity
                key={item.id}
                style={item.id === 'songs' ? styles.activeMenuItem : styles.menuItem}
                activeOpacity={0.6}
                onPress={() => {
                  if (item.id === 'ongoing') {
                    toggleSidebar();
                    navigation.navigate('Rehearsal', { resetState: true, program: undefined, categoryFilter: 'ongoing' });
                  } else if (item.id === 'pre-rehearsal') {
                    toggleSidebar();
                    navigation.navigate('Rehearsal', { resetState: true, program: undefined, categoryFilter: 'pre-rehearsal' });
                  } else if (item.id === 'archives') {
                    toggleSidebar();
                    navigation.navigate('Archive');
                  } else if (item.id === 'studio') {
                    toggleSidebar();
                    navigation.navigate('Audiolab');
                  } else if (item.id === 'songs') {
                    toggleSidebar();
                    navigation.navigate('AllSongs');
                  } else if (item.id === 'chat') {
                    toggleSidebar();
                    navigation.navigate('ChatRooms', { card: { source: CLOUD_ASSETS[2] } });
                  } else if (item.id === 'subgroups') {
                    toggleSidebar();
                    navigation.navigate('Rehearsal', { mode: 'subgroup', scope: 'subgroup', resetState: true });
                  } else if (item.id === 'links') {
                    toggleSidebar();
                    navigation.navigate('Links');
                  } else if (item.id === 'profile') {
                    toggleSidebar();
                    navigation.navigate('Settings');
                  } else if (item.id === 'admin') {
                    toggleSidebar();
                    Alert.alert('System Admin', 'Accessing Loveworld Singers Core Management Console...');
                  } else if (item.id === 'submit') {
                    toggleSidebar();
                    navigation.navigate('SubmitSong');
                  } else if (item.id === 'lexicon') {
                    toggleSidebar();
                    navigation.navigate('Lexicon');
                  } else if (item.id === 'media') {
                    toggleSidebar();
                    navigation.navigate('Media');
                  }
                }}>
                
                    <Ionicons name={item.icon as any} size={20} color={item.id === 'songs' ? theme.colors.bottomTabIconActive : theme.colors.bottomTabIconInactive} style={styles.menuIcon} />
                    <Text style={item.id === 'songs' ? styles.activeMenuText : styles.menuText}>{item.title}</Text>
                  </TouchableOpacity>
              )}
              </View>
              );
            })}
            
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={[styles.sidebarFooter, { paddingBottom: 24 + insets.bottom }]}>
            <TouchableOpacity
              style={styles.userProfile}
              activeOpacity={0.8}
              onPress={() => {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out and return to the Login screen?',
                  [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      await signOut();
                      toggleSidebar();
                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    }
                  }]

                );
              }}>
              
              <View style={{ marginRight: 14 }}>
                <SyncAvatar 
                  userId={user?.uid}
                  initialAvatar={contextProfile?.avatar}
                  fallbackName={contextProfile?.firstName || userProfile?.first_name || "Me"}
                  size={42}
                  bgColor="rgba(255,255,255,0.1)"
                />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.userName}>
                    {[contextProfile?.firstName || userProfile?.first_name, contextProfile?.lastName || userProfile?.last_name].filter(Boolean).join(' ') 
                      || contextProfile?.username
                      || (user as any)?.displayName 
                      || "Rehearsal Hub User"}
                  </Text>
                  <Text style={styles.userRole}>
                    {contextProfile?.administration === 'Boss' || userProfile?.administration === 'Boss'
                      ? 'Central Admin' 
                      : (contextProfile?.role === 'boss' || userProfile?.role === 'boss' ? 'Zone Admin' : 'Member Account')}
                  </Text>
                </View>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>);

}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  mainContent: {
    flex: 1
  },
  mainScrollView: {
    flex: 1
  },
  mainScrollContent: {
    paddingTop: 110,
    alignItems: 'center',
    paddingBottom: 120
  },
  heroSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16
  },
  smallCardsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 40
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 60,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 15, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 40
  },
  sidebarEdgeHighlight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 10,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.textMuted,
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  sidebarSolidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background
  },
  sidebarContent: {
    flex: 1
  },
  sidebarScrollContent: {
    paddingTop: 80,
    paddingHorizontal: 28
  },
  sidebarHeader: {
    marginBottom: 40
  },
  sidebarTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1
  },
  sidebarSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  sectionContainer: {
    marginBottom: 32
  },
  sectionHeader: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4
  },
  activeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 12,
    marginLeft: -16,
    marginBottom: 4
  },
  menuIcon: {
    marginRight: 16,
    width: 24
  },
  menuText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  activeMenuText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  sidebarFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: theme.colors.backgroundDark,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBackgroundLight
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },
  userRole: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  menuTextLink: {
    position: 'absolute',
    top: 67,
    left: 20,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoContainer: {
    position: 'absolute',
    top: 67,
    right: 92,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerLogo: {
    width: '100%',
    height: '100%'
  },
  notificationHeaderIcon: {
    position: 'absolute',
    top: 67,
    right: 56,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderIcon: {
    position: 'absolute',
    top: 67,
    right: 20,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationDot: {
    position: 'absolute',
    top: 1,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  floatingVideoWrapper: {
    width: '94%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20
  },
  smallVideoWrapper: {
    width: '94%',
    height: 70,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.cardBackgroundLight
  },
  weatherCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  weatherCardLeft: {
    flex: 1,
    justifyContent: 'center'
  },
  weatherCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  weatherCityText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.4
  },
  weatherSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  weatherTempText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.8
  },

  searchBarWrapper: {
    width: '94%',
    alignSelf: 'center',
    height: 38,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.cardBackgroundLight,
    marginBottom: 12,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10
  },
  searchBarBlur: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15
  },
  searchIcon: {
    marginRight: 10
  },
  searchPlaceholder: {
    flex: 1
  },
  searchPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500'
  },
  micButton: {
    padding: 5
  },
  copyrightContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8
  },
  copyrightText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5
  }
});
};
