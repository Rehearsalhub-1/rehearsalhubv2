import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, SectionList, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncAvatar } from '../components/SyncAvatar';
import { api } from '../services/api';
import { useUserStore } from '../hooks/useUser';

const CACHE_KEY_PROFILES = 'cached_all_profiles';
const CACHE_KEY_RECENTS = 'cached_recent_contacts';
const BATCH_SIZE = 20;

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  existingChatId?: string;
  existingRoom?: any;
  lastMessage?: string;
  lastTime?: string;
  lastTimestamp?: number; // epoch ms for reliable sorting
  zoneName?: string;
  voicePart?: string;
}

export default function NewChatScreen({ route, navigation }: any) {
  const { theme, themeName } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;
  const isLight = themeName === 'light';

  const forwardMessage: string | undefined = route.params?.forwardMessage;
  const forwardType: string = route.params?.forwardType || 'text';

  const [search, setSearch] = useState('');
  const [recentContacts, setRecentContacts] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const currentUser = useUserStore(s => s.user);
  useEffect(() => {
    loadCachedData().then(() => loadData());
  }, []);

  const loadCachedData = async () => {
    try {
      const [cachedProfiles, cachedRecents] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY_PROFILES),
        AsyncStorage.getItem(CACHE_KEY_RECENTS),
      ]);
      
      let parsedRecents: UserProfile[] = [];
      const existingChatIds = new Set<string>();
      
      if (cachedRecents) {
        parsedRecents = JSON.parse(cachedRecents);
        if (parsedRecents.length > 0) {
          setRecentContacts(parsedRecents);
          parsedRecents.forEach(r => {
            if (r.existingRoom && r.existingRoom.type === 'direct') {
              const otherId = r.id;
              if (otherId) existingChatIds.add(otherId);
            }
          });
        }
      }

      if (cachedProfiles) {
        const parsed = JSON.parse(cachedProfiles);
        if (parsed.length > 0) {
          setAllUsers(parsed);
        }
      }
      if (cachedProfiles || cachedRecents) setLoading(false);
    } catch {}
  };

  // Live server search across the whole DB when user types
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.profiles.directory(50, trimmed);
        const rawList = res?.data && Array.isArray(res.data) ? res.data : [];
        if (rawList.length > 0) {
          setAllUsers(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newOnes: UserProfile[] = [];
            rawList.forEach((p: any) => {
              if (p.id === currentUser?.uid || existingIds.has(p.id)) return;
              const firstName = p.first_name || p.firstName || '';
              const lastName = p.last_name || p.lastName || '';
              const name = [firstName, lastName].filter(Boolean).join(' ') || p.displayName || p.name || p.email?.split('@')[0] || 'Singer';
              newOnes.push({
                id: p.id,
                name,
                avatar: p.profile_image_url || p.avatar_url || p.photoURL || p.avatar,
                email: p.email,
                voicePart: p.voicePart || p.designation || '',
                zoneName: p.zoneName || p.zone_name || p.zoneCode || '',
              });
            });
            return [...prev, ...newOnes];
          });
        }
      } catch (err) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [search, currentUser?.uid]);

  const loadData = async () => {
    if (!currentUser) { setLoading(false); return; }
    try {
      const chatsRes = await api.chats.getAll().catch(() => null);
      const chatsSnap = { docs: (chatsRes?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };

      const recentMap: Record<string, UserProfile> = {};
      const existingChatIds = new Set<string>();

      (chatsSnap.docs || []).forEach((d: any) => {
        const data = d.data();
        const isGroup = data.type === 'group';
        let rowId = d.id;
        let name = 'Unknown';
        let avatar = undefined;

        if (isGroup) {
          name = data.name || 'Unnamed Group';
          avatar = data.avatar || undefined;
        } else {
          const otherId = (data.participants || []).find((id: string) => id !== currentUser.uid)
            || (typeof d.id === 'string' && d.id.includes('_') ? d.id.split('_').find((id: string) => id !== currentUser.uid) : null);
          if (!otherId) return;
          rowId = otherId;
          existingChatIds.add(otherId);
          const details = data.participantDetails?.[otherId] || {};
          if (details.name && details.name !== 'Member' && details.name !== 'Unknown') {
            name = details.name;
          } else if (data.title && data.title !== 'Chat' && data.title !== 'Direct Chat' && data.title !== 'Direct Message' && data.title !== 'Member') {
            name = data.title;
          } else if (data.name && data.name !== 'Chat' && data.name !== 'Direct Chat' && data.name !== 'Direct Message' && data.name !== 'Member') {
            name = data.name;
          } else if (details.email) {
            const prefix = details.email.split('@')[0];
            name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          } else {
            name = 'Member';
          }
          avatar = details.avatar || undefined;
        }

        const rawTs = data.lastMessage?.timestamp || data.lastTimestamp || data.createdAt || data.created_at;
        let lastTime = '';
        let lastTimestamp = 0;
        let d2: Date | null = null;

        if (rawTs?.toDate && typeof rawTs.toDate === 'function') {
          d2 = rawTs.toDate();
        } else if (rawTs instanceof Date) {
          d2 = rawTs;
        } else if (typeof rawTs === 'number') {
          d2 = new Date(rawTs > 1e11 ? rawTs : rawTs * 1000);
        } else if (typeof rawTs === 'string') {
          d2 = new Date(rawTs);
        } else if (rawTs?.seconds) {
          d2 = new Date(rawTs.seconds * 1000);
        }

        if (d2 && !isNaN(d2.getTime())) {
          lastTimestamp = d2.getTime();
          const now = new Date();
          if (d2.toDateString() === now.toDateString()) {
            lastTime = d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            const yest = new Date(now); yest.setDate(now.getDate() - 1);
            if (d2.toDateString() === yest.toDateString()) {
              lastTime = 'Yesterday';
            } else {
              lastTime = d2.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
          }
        } else {
          lastTimestamp = Date.now();
        }
        
        recentMap[rowId] = {
          id: rowId,
          name,
          avatar,
          existingChatId: d.id,
          existingRoom: {
            id: d.id,
            title: name,
            avatar: avatar ? { uri: avatar } : null,
            isGroup: isGroup,
            type: data.type || 'direct',
            participantDetails: data.participantDetails || {},
          },
          lastMessage: data.lastMessage?.text || (data.lastMessage ? '📷 Photo' : ''),
          lastTime,
          lastTimestamp,
        };
      });

      const sortedRecents = Object.values(recentMap).sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      setRecentContacts(sortedRecents);
      AsyncStorage.setItem(CACHE_KEY_RECENTS, JSON.stringify(
        sortedRecents.map(r => ({ ...r, existingRoom: r.existingRoom }))
      )).catch(() => {});
      const profRes = await api.profiles.directory().catch(() => null);
      const rawList: any[] = profRes?.data && Array.isArray(profRes.data) ? profRes.data : [];
      const allProfiles: UserProfile[] = [];

      rawList.forEach((p: any) => {
        if (p.id === currentUser.uid) return;
        const firstName = p.first_name || p.firstName || '';
        const lastName = p.last_name || p.lastName || '';
        const name = [firstName, lastName].filter(Boolean).join(' ') ||
          p.displayName || p.name || p.fullName || p.email?.split('@')[0] || 'Singer';
        const avatar = p.profile_image_url || p.avatar_url || p.photoURL || p.avatar || p.profileImage;
        const existingChatId = recentMap[p.id]?.existingChatId;
        const existingRoom = recentMap[p.id]?.existingRoom;
        const voicePart = p.voicePart || p.designation || '';
        const zoneName = p.zoneName || p.zone_name || p.zoneCode || '';

        allProfiles.push({
          id: p.id,
          name,
          avatar,
          email: p.email,
          existingChatId,
          existingRoom,
          voicePart,
          zoneName,
        });
      });

      const sorted = allProfiles.sort((a, b) => a.name.localeCompare(b.name));
      await AsyncStorage.setItem(CACHE_KEY_PROFILES, JSON.stringify(sorted));
      await AsyncStorage.setItem('last_profiles_sync_time', Date.now().toString());
      setAllUsers(sorted);
    } catch (e) {
      console.error('NewChatScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const openChat = async (user: UserProfile) => {
    if (!currentUser) return;
    const groupTargetChatId = route.params?.groupTargetChatId;
    if (groupTargetChatId) {
      try {
        await api.chats.addParticipants(groupTargetChatId, [user.id]);
        navigation.goBack();
      } catch (e) {
        console.error('Failed to add member to group', e);
        navigation.goBack();
      }
      return;
    }
    if (user.existingRoom) {
      navigate(user.existingRoom);
      return;
    }
    try {
      const chatId = [currentUser.uid, user.id].sort().join('_');
      const profile = useUserStore.getState().profile;
      const myName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || (currentUser as any)?.displayName || (currentUser as any)?.name || 'Me' : (currentUser as any)?.displayName || (currentUser as any)?.name || 'Me';
      const myAvatar = profile?.avatar || '';

      await api.chats.create({ id: chatId, name: user.name, type: 'direct', participants: [currentUser.uid, user.id] }).catch(() => {});

      const room = {
        id: chatId,
        title: user.name,
        avatar: user.avatar ? { uri: user.avatar } : null,
        isGroup: false,
        type: 'direct',
        participantDetails: {
          [currentUser.uid]: { name: myName, avatar: myAvatar },
          [user.id]: { name: user.name, avatar: user.avatar || '' },
        },
      };
      navigate(room);
    } catch (e) {
      console.error('Failed to create chat', e);
    }
  };

  const sanitizeRoom = (room: any) => {
    const { timestampObj, ...rest } = room;
    return rest;
  };

  const navigate = (room: any) => {
    const safeRoom = sanitizeRoom(room);
    if (forwardMessage) {
      navigation.replace('ChatRoom', {
        room: safeRoom,
        forwardText: forwardMessage,
        forwardType,
        forwardDocumentName: route.params?.forwardDocumentName || null,
        forwardDocumentSize: route.params?.forwardDocumentSize || null,
        forwardSongData: route.params?.forwardSongData || null,
        forwardPlaylistData: route.params?.forwardPlaylistData || null,
      });
    } else {
      navigation.replace('ChatRoom', { room: safeRoom });
    }
  };
  const searchLower = search.toLowerCase();
  const filteredRecent = recentContacts.filter(u =>
    u.name.toLowerCase().includes(searchLower) ||
    (u.lastMessage || '').toLowerCase().includes(searchLower)
  );
  const filteredAll = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchLower) ||
    (u.email || '').toLowerCase().includes(searchLower)
  );
  const isSearching = search.trim().length > 0;
  const displayAll = isSearching ? filteredAll : filteredAll.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < filteredAll.length;

  const sections = [
    ...(filteredRecent.length > 0 ? [{ title: 'Recent', data: filteredRecent }] : []),
    ...(displayAll.length > 0 ? [{ title: `All Members${!isSearching ? ` (${filteredAll.length})` : ''}`, data: displayAll }] : []),
  ];

  const handleLoadMore = () => {
    if (hasMore) {
      setVisibleCount(prev => prev + BATCH_SIZE);
    }
  };

  const renderItem = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity style={styles.userRow} onPress={() => openChat(item)} activeOpacity={0.7}>
      <SyncAvatar
        userId={item.id}
        initialAvatar={item.avatar}
        fallbackName={item.name}
        size={50}
        bgColor={T.accent}
        isGroup={item.existingRoom?.isGroup}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userSub} numberOfLines={1}>
          {item.lastMessage || [item.voicePart, item.zoneName].filter(Boolean).join(' · ') || item.email || ''}
        </Text>
      </View>
      <View style={styles.rightCol}>
        {item.lastTime ? (
          <Text style={styles.timeText}>{item.lastTime}</Text>
        ) : null}
        {item.existingChatId ? (
          <Ionicons name="chatbubble" size={16} color={T.accent} style={{ marginTop: 4 }} />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color={T.accent} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isLight
          ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.25)']
          : ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.80)']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {forwardMessage ? 'Forward to…' : 'New Chat'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={T.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts…"
            placeholderTextColor={T.inputPlaceholder}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : sections.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="people-outline" size={48} color={T.textMuted} />
            <Text style={{ color: T.textMuted, marginTop: 12, fontSize: 15 }}>No contacts found</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                <Text style={styles.loadMoreText}>Load more ({filteredAll.length - visibleCount} remaining)</Text>
                <Ionicons name="chevron-down" size={16} color={T.accent} />
              </TouchableOpacity>
            ) : null}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, backgroundColor: T.inputBackground,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: T.inputBorder,
  },
  searchInput: { flex: 1, fontSize: 15, color: T.inputText },
  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11, gap: 12,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: T.textPrimary },
  userSub: { fontSize: 13, color: T.textSecondary, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', minWidth: 40 },
  timeText: { fontSize: 11, color: T.textMuted },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.bottomTabBorder,
    marginLeft: 78,
  },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, marginHorizontal: 16, marginTop: 4,
    backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 12,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: T.accent },
});
};
