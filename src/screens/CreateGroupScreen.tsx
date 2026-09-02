import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { SyncAvatar } from '../components/SyncAvatar';
import { api } from '../services/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { Image } from 'expo-image';
import { useUserStore } from '../hooks/useUser';
import { sendPushNotification } from '../lib/notifications';

const CACHE_KEY_MEMBERS = 'cached_all_profiles';
const BATCH_SIZE = 20;

interface Member {
  id: string;
  name: string;
  avatar?: string;
}

export default function CreateGroupScreen({ navigation }: any) {
  const { theme, themeName } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;
  const isLight = themeName === 'light';

  const [step, setStep] = useState<'members' | 'details'>('members');
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const currentUser = useUserStore(s => s.user);

  useEffect(() => {
    loadCachedUsers().then(() => loadUsers());
  }, []);

  const loadCachedUsers = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY_MEMBERS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setAllUsers(parsed.filter((u: any) => u.id !== currentUser?.uid));
          setLoading(false);
        }
      }
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const lastSyncTimeStr = await AsyncStorage.getItem('last_profiles_sync_time');
      const lastSyncTime = lastSyncTimeStr ? parseInt(lastSyncTimeStr, 10) : 0;
      const cachedProfilesStr = await AsyncStorage.getItem(CACHE_KEY_MEMBERS);
      const hasCached = cachedProfilesStr ? JSON.parse(cachedProfilesStr).length > 0 : false;
      const isCacheFresh = Date.now() - lastSyncTime < 30 * 60 * 1000; // 30 minutes

      if (hasCached && isCacheFresh) {

        const parsed = JSON.parse(cachedProfilesStr!);
        setAllUsers(parsed.filter((u: any) => u.id !== currentUser?.uid));
        return;
      }

      const res = await api.profiles.directory();
      const snap = { docs: (res?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };
      const list: Member[] = [];
      (snap.docs || []).forEach((d: any) => {
        if (d.id === currentUser?.uid) return;
        const p = d.data();
        const fn = p.first_name || p.firstName || '';
        const ln = p.last_name || p.lastName || '';
        const name = [fn, ln].filter(Boolean).join(' ') || p.displayName || p.name || p.email?.split('@')[0] || 'Unknown';
        list.push({
          id: d.id, name,
          avatar: p.profile_image_url || p.avatar_url || p.photoURL || p.avatar,
        });
      });
      const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
      setAllUsers(sorted);
      await AsyncStorage.setItem(CACHE_KEY_MEMBERS, JSON.stringify(sorted));
      await AsyncStorage.setItem('last_profiles_sync_time', Date.now().toString());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleMember = (user: Member) => {
    setSelected(prev =>
      prev.find(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    );
  };

  const pickGroupAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images as any, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets?.[0]) {
      try {
        const url = await uploadImageToCloudinary(result.assets[0].uri);
        setGroupAvatar(url);
      } catch { Alert.alert('Error', 'Failed to upload avatar'); }
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) { Alert.alert('Group name required'); return; }
    if (selected.length < 1) { Alert.alert('Add at least 1 member'); return; }
    if (!currentUser) return;

    setCreating(true);
    try {
      const profile = useUserStore.getState().profile;
      const myName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || (currentUser as any)?.displayName || (currentUser as any)?.name || "Me" || 'Me' : (currentUser as any)?.displayName || (currentUser as any)?.name || "Me" || 'Me';
      const myAvatar = profile?.avatar || '';

      const allParticipants = [currentUser.uid, ...selected.map(m => m.id)];
      const participantDetails: Record<string, any> = {
        [currentUser.uid]: { name: myName, avatar: myAvatar },
      };
      selected.forEach(m => {
        participantDetails[m.id] = { name: m.name, avatar: m.avatar || '' };
      });

      const unreadCount: Record<string, number> = {};
      allParticipants.forEach(uid => { unreadCount[uid] = 0; });

      const chatId = `group_${Date.now()}_${currentUser.uid}`;
      const res = await api.chats.create({
        id: chatId,
        name: groupName.trim(),
        avatar: groupAvatar || null,
        type: 'group',
        isGroup: true,
        participants: allParticipants,
        participantDetails,
        admins: [currentUser.uid],
        createdBy: currentUser.uid,
      });
      await api.chats.sendMessage(chatId, {
        content: `${(currentUser as any)?.displayName || (currentUser as any)?.name || "Admin" || 'Admin'} created group "${groupName.trim()}"`,
        type: 'system',
      });
      navigation.replace('ChatRoom', { room: { id: chatId, title: groupName.trim(), avatar: groupAvatar ? { uri: groupAvatar } : null, isGroup: true, participants: allParticipants, participantDetails, admins: [currentUser.uid] } });
    } catch (e) {
      console.error('Create group error', e);
      Alert.alert('Error', 'Failed to create group');
    } finally { setCreating(false); }
  };

  const filtered = allUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSearching = search.trim().length > 0;
  const displayList = isSearching ? filtered : filtered.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < filtered.length;

  const handleLoadMore = () => {
    if (hasMore) setVisibleCount(prev => prev + BATCH_SIZE);
  };
  const ThemedBackground = () => (
    <>
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
    </>
  );
  if (step === 'members') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ThemedBackground />

        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Group</Text>
            <TouchableOpacity
              onPress={() => {
                if (selected.length === 0) { Alert.alert('Select at least 1 member'); return; }
                setStep('details');
              }}
              style={styles.nextBtn}
            >
              <Text style={[styles.nextText, selected.length > 0 && { color: T.accent }]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={selected.length > 0 ? T.accent : T.textMuted} />
            </TouchableOpacity>
          </View>
          {selected.length > 0 && (
            <View style={styles.chipsWrap}>
              {selected.map(m => (
                <TouchableOpacity key={m.id} style={styles.chip} onPress={() => toggleMember(m)}>
                  <SyncAvatar userId={m.id} initialAvatar={m.avatar} fallbackName={m.name} size={28} />
                  <Text style={styles.chipName} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                  <Ionicons name="close-circle" size={14} color={T.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={T.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members…"
              placeholderTextColor={T.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={T.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {!isSearching && filtered.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
              <Text style={{ fontSize: 12, color: T.textMuted, fontWeight: '600' }}>
                {filtered.length} members{!isSearching && visibleCount < filtered.length ? ` · showing ${visibleCount}` : ''}
              </Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={displayList}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = !!selected.find(m => m.id === item.id);
                return (
                  <TouchableOpacity style={styles.userRow} onPress={() => toggleMember(item)} activeOpacity={0.7}>
                    <SyncAvatar userId={item.id} initialAvatar={item.avatar} fallbackName={item.name} size={46} />
                    <Text style={styles.userName}>{item.name}</Text>
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={theme.colors.textPrimary} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={hasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                  <Text style={styles.loadMoreText}>Load more ({filtered.length - visibleCount} remaining)</Text>
                  <Ionicons name="chevron-down" size={16} color={T.accent} />
                </TouchableOpacity>
              ) : null}
            />
          )}
        </SafeAreaView>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ThemedBackground />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('members')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Info</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.detailsBody}>
          <TouchableOpacity style={styles.avatarPicker} onPress={pickGroupAvatar}>
            {groupAvatar ? (
              <Image source={{ uri: groupAvatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera" size={28} color={T.textMuted} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="pencil" size={12} color={theme.colors.textPrimary} />
            </View>
          </TouchableOpacity>
          <View style={styles.nameInputWrap}>
            <TextInput
              style={styles.nameInput}
              placeholder="Group name"
              placeholderTextColor={T.textMuted}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
            />
            <Text style={styles.nameCount}>{groupName.length}/50</Text>
          </View>
          <Text style={styles.membersLabel}>Members: {selected.length + 1}</Text>
          <View style={styles.membersPreview}>
            <View style={styles.memberChip}>
              <SyncAvatar userId={currentUser?.uid} fallbackName="You" size={40} bgColor={T.accent} />
              <Text style={styles.memberChipName}>You</Text>
            </View>
            {selected.slice(0, 6).map(m => (
              <View key={m.id} style={styles.memberChip}>
                <SyncAvatar userId={m.id} initialAvatar={m.avatar} fallbackName={m.name} size={40} />
                <Text style={styles.memberChipName} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
              </View>
            ))}
            {selected.length > 6 && (
              <View style={[styles.memberChip, { alignItems: 'center' }]}>
                <View style={[styles.memberChipMore]}>
                  <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>+{selected.length - 6}</Text>
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.createBtn, (!groupName.trim() || creating) && { opacity: 0.5 }]}
            onPress={createGroup}
            disabled={!groupName.trim() || creating}
          >
            {creating ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.textPrimary} />
                <Text style={styles.createBtnText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
  nextText: { fontSize: 16, fontWeight: '600', color: T.textMuted },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBackground, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, gap: 6, maxWidth: 120 },
  chipName: { fontSize: 13, color: T.textPrimary, flex: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: T.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: T.inputBorder },
  searchInput: { flex: 1, fontSize: 15, color: T.inputText },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 12 },
  userName: { flex: 1, fontSize: 16, fontWeight: '600', color: T.textPrimary },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.textMuted, justifyContent: 'center', alignItems: 'center' },
  checkCircleActive: { backgroundColor: T.accent, borderColor: T.accent },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: T.bottomTabBorder, marginLeft: 74 },
  detailsBody: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  avatarPicker: { position: 'relative', marginBottom: 28 },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: T.inputBackground, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.bottomTabBorder, borderStyle: 'dashed' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: T.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.background },
  nameInputWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 24, borderWidth: 1, borderColor: T.inputBorder },
  nameInput: { flex: 1, fontSize: 17, color: T.inputText, paddingVertical: 12 },
  nameCount: { fontSize: 12, color: T.textMuted },
  membersLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  membersPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', marginBottom: 32 },
  memberChip: { alignItems: 'center', gap: 4, width: 52 },
  memberChipName: { fontSize: 11, color: T.textSecondary, textAlign: 'center' },
  memberChipMore: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.inputBackground, justifyContent: 'center', alignItems: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: T.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, width: '100%' },
  createBtnText: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, marginHorizontal: 16, marginTop: 4,
    backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 12,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: T.accent },
});
};
