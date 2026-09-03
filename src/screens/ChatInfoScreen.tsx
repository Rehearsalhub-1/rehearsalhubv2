import { useWebSocket } from '../hooks/useWebSocket';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, ActivityIndicator, Modal, FlatList, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { DoodleBackground } from '../components/DoodleBackground';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { SyncAvatar } from '../components/SyncAvatar';
import { ShareToChatSheet } from '../components/ShareToChatSheet';
import { useUserStore } from '../hooks/useUser';
import { cleanSenderName } from '../components/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';

const profileCache = new Map<string, { name: string, avatar: string | undefined }>();

export default function ChatInfoScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;

  const [room, setRoom] = useState<any>(route.params?.room || {});
  const isGroup = room.isGroup || room.type === 'group';
  const [muted, setMuted] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaTab, setMediaTab] = useState('Media');
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'docs' | 'links'>('media');
  const [mediaMessages, setMediaMessages] = useState<any[]>([]);
  const [docMessages, setDocMessages] = useState<any[]>([]);
  const [linkMessages, setLinkMessages] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [profileToShare, setProfileToShare] = useState<any>(null);
  const [isChatOpening, setIsChatOpening] = useState(false);

  useWebSocket('chats', room?.id || '', (eventData: any) => {
    if (!eventData) return;
    if (eventData.type === 'room_update') {
      setRoom((prev: any) => ({ ...prev, ...eventData.data }));
    }
  });

  const currentUser = useUserStore(s => s.user);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);

  const otherUserId = useMemo(() => {
    if (isGroup) return null;
    const myId = currentUser?.uid;
    const fromParticipants = (room?.participants || []).find((id: string) => id && id !== myId);
    if (fromParticipants) return fromParticipants;
    if (typeof room?.id === 'string' && room.id.includes('_')) {
      const fromId = room.id.split('_').find((id: string) => id && id !== myId);
      if (fromId) return fromId;
    }
    if (room?.participantDetails) {
      const otherKey = Object.keys(room.participantDetails).find(k => k && k !== myId);
      if (otherKey) return otherKey;
    }
    return null;
  }, [room?.participants, room?.id, room?.participantDetails, currentUser?.uid, isGroup]);

  useEffect(() => {
    if (isGroup || !otherUserId) return;
    api.profiles.get(otherUserId).then(res => {
      if (res?.success && res.data) {
        setOtherUserProfile(res.data);
      }
    }).catch(() => {});
  }, [otherUserId, isGroup]);

  useEffect(() => {
    if (!room?.id) return;
    const fetchRoomDetails = async () => {
      try {
        const res = await api.chats.getById(room.id);
        if (res?.success && res.data) {
          const data = res.data;
          setRoom(data);
          const pIds: string[] = data.participants || [];
          const list = await Promise.all(pIds.map(async (uid: string) => {
            const detail = data.participantDetails?.[uid];
            let name = detail?.name;
            let avatar = detail?.avatar;
            if (!name) {
              const pRes = await api.profiles.get(uid).catch(() => null);
              if (pRes?.data) {
                name = [pRes.data.firstName, pRes.data.lastName].filter(Boolean).join(' ');
                avatar = pRes.data.profile_image_url || pRes.data.avatar;
              }
            }
            return {
              id: uid,
              name: cleanSenderName(name || 'Unknown'),
              avatar,
              role: data.admins?.includes(uid) ? 'Admin' : 'Member',
            };
          }));
          setMembers(list);
          setIsAdmin(data.admins?.includes(currentUser?.uid) || false);
          setLoading(false);
          const mutedBy: string[] = data.mutedBy || [];
          if (currentUser) setMuted(mutedBy.includes(currentUser.uid));
        }
      } catch (e) {
        setLoading(false);
      }
    };
    fetchRoomDetails();
  }, [room?.id, currentUser?.uid]);

  const handleMuteToggle = async (value: boolean) => {
    setMuted(value);
    try {
      await api.chats.updateChat(room.id, { muted: value }).catch(() => {});
    } catch (e) {
      console.error('Failed to update mute state:', e);
      setMuted(!value); // revert on error
    }
  };

  const openMediaGallery = async () => {
    setMediaLoading(true);
    setMediaModalVisible(true);
    try {
      const snap = { docs: [] };
      const allMsg: any[] = [];
      setMediaMessages(allMsg.filter(d => ['image', 'video'].includes(d.type)));
      setDocMessages(allMsg.filter(d => ['document', 'file', 'pdf'].includes(d.type)));
      setLinkMessages(allMsg.filter(d => d.type === 'text' && (d.text?.includes('http://') || d.text?.includes('https://'))));
    } catch (e) {
      console.error('Failed to load media:', e);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Delete all messages in this chat? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            if (!currentUser?.uid) return;
            await api.chats.clearMessages(room.id).catch(() => {});
            await AsyncStorage.removeItem(`chat_msgs_${room.id}`);
            await AsyncStorage.removeItem(`cached_messages_${room.id}`);

            Alert.alert('Success', 'Chat cleared successfully', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (err) {
            console.error('Clear chat error:', err);
            Alert.alert('Error', 'Failed to clear chat');
          }
        }
      }
    ]);
  };

  const handleDeleteChat = () => {
    Alert.alert('Delete Chat', 'Are you sure you want to permanently delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.chats.deleteChat(room.id).catch(() => {});
            if (currentUser?.uid) {
              const stored = await AsyncStorage.getItem(`deleted_chats_${currentUser.uid}`);
              const list: string[] = stored ? JSON.parse(stored) : [];
              if (!list.includes(room.id)) {
                await AsyncStorage.setItem(`deleted_chats_${currentUser.uid}`, JSON.stringify([...list, room.id]));
              }
            }
            await AsyncStorage.removeItem(`chat_msgs_${room.id}`);
            await AsyncStorage.removeItem(`cached_messages_${room.id}`);
            navigation.navigate('ChatRooms');
          } catch {
            Alert.alert('Error', 'Failed to delete chat');
          }
        }
      }
    ]);
  };

  const handleLeaveGroup = () => {
    if (!currentUser) return;
    Alert.alert('Leave Group', `Leave "${room?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await api.chats.removeParticipant(room.id, currentUser.uid).catch(() => {});
            await api.chats.leave(room.id, currentUser.uid).catch(() => {});

            const profile = useUserStore.getState().profile;
            const myName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || (currentUser as any)?.displayName || (currentUser as any)?.name || 'Someone' : 'Someone';
            await api.chats.sendMessage(room.id, { content: `${myName} left the group`, type: 'system' }).catch(() => {});

            navigation.navigate('ChatRooms');
          } catch { Alert.alert('Error', 'Failed to leave group'); }
        }
      }
    ]);
  };

  const handleMemberPress = async (member: { id: string; name: string; avatar?: string; role?: string }) => {
    if (!currentUser) return;
    if (member.id === currentUser.uid) return;
    setSelectedMember(member);
  };

  const toggleAdmin = async (member: { id: string; name: string; role?: string }) => {
    try {
      const newRole = member.role === 'Admin' ? 'member' : 'admin';
      await api.chats.setParticipantRole(room.id, member.id, newRole).catch(() => {});
      const cRes = await api.chats.getById(room.id).catch(() => null);
      const admins = cRes?.data?.admins || [];
      const newAdmins = member.role === 'Admin' ? admins.filter((a: string) => a !== member.id) : [...admins, member.id];
      await api.chats.updateChat(room.id, { admins: newAdmins }).catch(() => {});
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole === 'admin' ? 'Admin' : 'Member' } : m));
      setSelectedMember(null);
      await api.chats.sendMessage(room.id, { content: `${newRole === 'admin' ? 'Promoted' : 'Dismissed'} ${member.name} as admin`, type: 'system' }).catch(() => {});
    } catch (e) {
      Alert.alert('Error', 'Failed to update admin status');
    }
  };

  const removeMember = async (member: { id: string; name: string }) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${member.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.chats.removeParticipant(room.id, member.id);
          const cRes = await api.chats.getById(room.id).catch(() => null);
          const currentAdmins = cRes?.data?.admins || [];
          if (currentAdmins.includes(member.id)) {
            await api.chats.updateChat(room.id, { admins: currentAdmins.filter((a: string) => a !== member.id) }).catch(() => {});
          }
          setMembers(prev => prev.filter(m => m.id !== member.id));
          setSelectedMember(null);
          await api.chats.sendMessage(room.id, { content: `Removed ${member.name} from the group`, type: 'system' }).catch(() => {});
        } catch (e) {
          Alert.alert('Error', 'Failed to remove member');
        }
      }}
    ]);
  };

  const openDirectChat = async (member: { id: string; name: string; avatar?: string }) => {
    setIsChatOpening(true);
    try {
      const chatId = [currentUser?.uid, member.id].sort().join('_');
      const dRes = await api.chats.getById(chatId).catch(() => null);
      const docSnap = { exists: () => !!dRes?.data, data: () => dRes?.data || {} };

      if (docSnap.exists()) {
        const data = docSnap.data();
        const roomObj = {
          id: chatId,
          title: member.name,
          avatar: member.avatar ? { uri: member.avatar } : null,
          isGroup: false,
          type: 'direct',
          participantDetails: data.participantDetails || {
            [currentUser?.uid || '']: { name: (currentUser as any)?.displayName || (currentUser as any)?.name || "Me" || 'You', avatar: '' },
            [member.id]: { name: member.name, avatar: member.avatar || '' },
          },
        };
        (navigation as any).push('ChatRoom', { room: roomObj });
      } else {
        const profile = useUserStore.getState().profile;
        const myName = profile 
          ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') 
          : ((currentUser as any)?.displayName || (currentUser as any)?.name || "Me" || 'You');
        const myAvatar = profile?.avatar || '';

        const newRoomData = {
          type: 'direct',
          participants: [currentUser?.uid, member.id],
          participantDetails: {
            [currentUser?.uid || '']: { name: myName, avatar: myAvatar },
            [member.id]: { name: member.name, avatar: member.avatar || '' },
          },
          createdAt: new Date().toISOString(),
          unreadCount: { [currentUser?.uid || '']: 0, [member.id]: 0 },
          lastMessage: null,
        };

        await api.chats.updateChat(room.id, newRoomData).catch(() => {});

        const roomObj = {
          id: chatId,
          title: member.name,
          avatar: member.avatar ? { uri: member.avatar } : null,
          isGroup: false,
          type: 'direct',
          participantDetails: newRoomData.participantDetails,
        };
        (navigation as any).push('ChatRoom', { room: roomObj });
      }
    } catch (e) {
      console.error('Failed to open/create direct chat:', e);
      Alert.alert('Error', 'Failed to open chat with this member.');
    } finally {
      setIsChatOpening(false);
    }
  };

  const displayName = isGroup
    ? (room?.title || room?.name || 'Group Chat')
    : (otherUserProfile?.displayName || otherUserProfile?.name || ([otherUserProfile?.first_name || otherUserProfile?.firstName, otherUserProfile?.last_name || otherUserProfile?.lastName].filter(Boolean).join(' ')) || room?.title || 'Contact');

  const displayAvatar = isGroup
    ? (room?.avatar?.uri || room?.avatar)
    : (otherUserProfile?.profile_image_url || otherUserProfile?.avatarUrl || otherUserProfile?.avatar || (room?.avatar?.uri || room?.avatar));

  const displayVoicePart = otherUserProfile?.voicePart || otherUserProfile?.designation || '';
  const displayEmail = otherUserProfile?.email || '';
  const displayPhone = otherUserProfile?.phone || otherUserProfile?.phone_number || otherUserProfile?.phoneNumber || '';
  const displayZone = otherUserProfile?.zoneName || otherUserProfile?.zone_name || otherUserProfile?.zoneCode || '';
  const displayChurch = otherUserProfile?.church || '';

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      <DoodleBackground />

      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isGroup ? 'Group Info' : 'Contact Info'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <View style={styles.avatarWrap}>
              <SyncAvatar
                userId={isGroup ? undefined : (otherUserId || undefined)}
                initialAvatar={displayAvatar}
                fallbackName={displayName}
                isGroup={isGroup}
                size={100}
                bgColor={isGroup ? '#00a884' : T.accent}
              />
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            {isGroup ? (
              <Text style={styles.profileSub}>
                {`${members.length} members`}
              </Text>
            ) : displayVoicePart ? (
              <Text style={styles.profileSub}>
                {displayVoicePart} {displayZone ? `· ${displayZone}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.quickRow}>
            {[
              { icon: 'call-outline', label: 'Voice', onPress: () => navigation.navigate('ChatRoom', { room, startCall: 'voice' }) },
              { icon: 'videocam-outline', label: 'Video', onPress: () => navigation.navigate('ChatRoom', { room, startCall: 'video' }) },
              { icon: 'search-outline', label: 'Search', onPress: () => navigation.navigate('ChatRoom', { room, openSearch: true }) },
              { icon: 'notifications-outline', label: muted ? 'Unmute' : 'Mute', onPress: () => handleMuteToggle(!muted) },
            ].map(item => (
              <TouchableOpacity key={item.label} style={styles.quickBtn} onPress={item.onPress}>
                <View style={styles.quickIconWrap}>
                  <Ionicons name={item.icon as any} size={22} color={T.accent} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isGroup && (displayEmail || displayPhone || displayVoicePart || displayZone || displayChurch) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              {displayVoicePart ? (
                <View style={styles.infoRow}>
                  <Ionicons name="mic-outline" size={18} color={T.accent} style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Voice / Role</Text>
                    <Text style={styles.infoValue}>{displayVoicePart}</Text>
                  </View>
                </View>
              ) : null}
              {displayEmail ? (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={T.accent} style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{displayEmail}</Text>
                  </View>
                </View>
              ) : null}
              {displayPhone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={18} color={T.accent} style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{displayPhone}</Text>
                  </View>
                </View>
              ) : null}
              {displayZone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="globe-outline" size={18} color={T.accent} style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Zone</Text>
                    <Text style={styles.infoValue}>{displayZone}</Text>
                  </View>
                </View>
              ) : null}
              {displayChurch ? (
                <View style={styles.infoRow}>
                  <Ionicons name="business-outline" size={18} color={T.accent} style={styles.infoIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Church</Text>
                    <Text style={styles.infoValue}>{displayChurch}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <Ionicons name="notifications-off-outline" size={20} color={T.textSecondary} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Mute notifications</Text>
              <Switch
                value={muted}
                onValueChange={handleMuteToggle}
                trackColor={{ false: T.cardBackground, true: T.accent }}
                thumbColor={theme.colors.textPrimary}
              />
            </View>

            {!isGroup && (
              <TouchableOpacity style={styles.settingRow} onPress={() => {
                setProfileToShare({ id: otherUserId, name: room?.title || 'User', avatar: room?.avatar?.uri || '' } as any);
                setShowShareSheet(true);
              }}>
                <Ionicons name="share-social-outline" size={20} color={T.textSecondary} style={styles.settingIcon} />
                <Text style={styles.settingLabel}>Share contact</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('ChatRoom', { room, openListModal: 'starred' })}>
              <Ionicons name="star-outline" size={20} color={T.textSecondary} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Starred messages</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => {
              navigation.navigate('ChatRoom', { room, openListModal: 'pinned' });
            }}>
              <Ionicons name="pin-outline" size={20} color={T.textSecondary} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Pinned messages</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={openMediaGallery}>
              <Ionicons name="image-outline" size={20} color={T.textSecondary} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>Media, links & docs</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
            </TouchableOpacity>
          </View>
          {isGroup && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Members · {members.length}</Text>
                {isAdmin && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                    onPress={() => navigation.navigate('NewChat', { groupTargetChatId: room?.id })}
                  >
                    <Ionicons name="person-add" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              {loading ? (
                <ActivityIndicator size="small" color={T.accent} style={{ padding: 20 }} />
              ) : (
                members.map(m => {
                  const isMe = m.id === currentUser?.uid;
                  return (
                    <TouchableOpacity 
                      key={m.id} 
                      style={styles.memberRow}
                      disabled={isMe}
                      onPress={() => handleMemberPress(m)}
                      activeOpacity={0.7}
                    >
                      <SyncAvatar userId={m.id} initialAvatar={m.avatar} fallbackName={m.name} size={40} bgColor={T.accent} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.memberName}>{m.name} {isMe ? '(You)' : ''}</Text>
                        <Text style={styles.memberRole}>{m.role}</Text>
                      </View>
                      {!isMe && (
                        isAdmin ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,168,132,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                            <Text style={{ color: '#00a884', fontSize: 12, fontWeight: '700', marginRight: 4 }}>Manage</Text>
                            <Ionicons name="settings-outline" size={14} color="#00a884" />
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                        )
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
          <View style={[styles.section, { marginBottom: 40 }]}>
            <TouchableOpacity style={styles.dangerRow} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Clear chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteChat}>
              <Ionicons name="trash" size={20} color="#ef4444" style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Delete chat</Text>
            </TouchableOpacity>
            {isGroup && (
              <TouchableOpacity style={styles.dangerRow} onPress={handleLeaveGroup}>
                <Ionicons name="exit-outline" size={20} color="#ef4444" style={styles.settingIcon} />
                <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Leave group</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={mediaModalVisible}
        animationType="slide"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={[styles.container, { flex: 1 }]}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <DoodleBackground />

          <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setMediaModalVisible(false)} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Media, Links, and Docs</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
              {['Media', 'Docs', 'Links'].map((tab: any) => (
                <TouchableOpacity 
                  key={tab} 
                  onPress={() => setMediaTab(tab)} 
                  style={{ paddingVertical: 8, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: mediaTab === tab ? T.accent : 'transparent' }}
                >
                  <Text style={{ color: mediaTab === tab ? T.accent : T.textSecondary, fontWeight: 'bold' }}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mediaLoading ? (
              <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
            ) : mediaTab === 'Media' ? (
              mediaMessages.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="images-outline" size={52} color={T.textMuted} />
                  <Text style={{ color: T.textMuted, marginTop: 14, fontSize: 15 }}>No media shared yet</Text>
                </View>
              ) : (
                <FlatList
                  data={mediaMessages}
                  numColumns={3}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: 4 }}
                  renderItem={({ item }) => (
                    <View style={{ flex: 1/3, aspectRatio: 1, padding: 2 }}>
                      <Image
                        source={{ uri: item.imageUrl || item.videoUrl }}
                        style={{ flex: 1, borderRadius: 6 }}
                        contentFit="cover"
                      />
                    </View>
                  )}
                />
              )
            ) : mediaTab === 'Docs' ? (
              docMessages.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-outline" size={52} color={T.textMuted} />
                  <Text style={{ color: T.textMuted, marginTop: 14, fontSize: 15 }}>No documents shared yet</Text>
                </View>
              ) : (
                <FlatList
                  data={docMessages}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8 }}>
                      <Ionicons name={item.type === 'audio' ? 'musical-notes' : 'document'} size={24} color={T.accent} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: T.textPrimary }} numberOfLines={1}>{item.documentName || item.songData?.title || item.playlistData?.name || 'Audio File'}</Text>
                      </View>
                    </View>
                  )}
                />
              )
            ) : (
              linkMessages.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="link-outline" size={52} color={T.textMuted} />
                  <Text style={{ color: T.textMuted, marginTop: 14, fontSize: 15 }}>No links shared yet</Text>
                </View>
              ) : (
                <FlatList
                  data={linkMessages}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => {
                      const match = item.text?.match(/https?:\/\/[^\s]+/);
                      if (match && match[0]) import('react-native').then(m => m.Linking.openURL(match[0]));
                    }} style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8 }}>
                      <Text style={{ color: T.accent, textDecorationLine: 'underline' }} numberOfLines={2}>
                        {item.text?.match(/https?:\/\/[^\s]+/)?.[0] || 'Link'}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )
            )}
          </SafeAreaView>
        </View>
      </Modal>
      <Modal
        visible={!!selectedMember}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedMember(null)} activeOpacity={1}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
          
          <View style={[styles.bottomSheetContent, { backgroundColor: 'transparent' }]}>
            <LinearGradient
              colors={theme.gradients.bgBase}
              locations={theme.gradients.bgBaseLocations}
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}
            />
            <LinearGradient
              colors={theme.gradients.bgGlow}
              locations={theme.gradients.bgGlowLocations}
              start={{ x: 0, y: 0.3 }}
              end={{ x: 1, y: 0.7 }}
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 28, borderTopRightRadius: 28, opacity: 0.6 }]}
            />
            
            <View style={styles.sheetHandle} />
            
            <View style={styles.sheetHeader}>
              <SyncAvatar userId={selectedMember?.id} initialAvatar={selectedMember?.avatar} fallbackName={selectedMember?.name} size={76} bgColor={T.accent} />
              <Text style={styles.sheetTitle}>{selectedMember?.name}</Text>
              <Text style={styles.sheetSub}>{selectedMember?.role}</Text>
              {selectedMemberProfile && (
                <View style={styles.sheetBadgesRow}>
                  {selectedMemberProfile.designation ? (
                    <View style={styles.sheetBadge}>
                      <Ionicons name="briefcase-outline" size={14} color={T.accent} />
                      <Text style={styles.sheetBadgeText}>{selectedMemberProfile.designation}</Text>
                    </View>
                  ) : null}
                  {selectedMemberProfile.church ? (
                    <View style={styles.sheetBadge}>
                      <Ionicons name="business-outline" size={14} color={T.accent} />
                      <Text style={styles.sheetBadgeText}>{selectedMemberProfile.church}</Text>
                    </View>
                  ) : null}
                  {selectedMemberProfile.region ? (
                    <View style={styles.sheetBadge}>
                      <Ionicons name="map-outline" size={14} color={T.accent} />
                      <Text style={styles.sheetBadgeText}>{selectedMemberProfile.region}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetActionBtn} onPress={() => {
                const member = selectedMember;
                setSelectedMember(null);
                setTimeout(() => openDirectChat(member), 300);
              }} activeOpacity={0.7}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                  <Ionicons name="chatbubble-outline" size={22} color={T.textPrimary} />
                </View>
                <Text style={styles.sheetActionText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetActionBtn} onPress={() => {
                const member = selectedMember;
                setSelectedMember(null);
                setTimeout(() => {
                  setProfileToShare(member);
                  setShowShareSheet(true);
                }, 300);
              }} activeOpacity={0.7}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                  <Ionicons name="share-social-outline" size={22} color={T.textPrimary} />
                </View>
                <Text style={styles.sheetActionText}>Share Profile</Text>
              </TouchableOpacity>

              {isAdmin && isGroup && (
                <>
                  <TouchableOpacity style={styles.sheetActionBtn} onPress={() => {
                    const member = selectedMember;
                    setSelectedMember(null);
                    setTimeout(() => toggleAdmin(member), 300);
                  }} activeOpacity={0.7}>
                    <View style={[styles.sheetIconWrap, { backgroundColor: `${T.accent}20` }]}>
                      <Ionicons name={selectedMember?.role === 'Admin' ? 'shield-half-outline' : 'shield-checkmark-outline'} size={22} color={T.accent} />
                    </View>
                    <Text style={[styles.sheetActionText, { color: T.accent }]}>
                      {selectedMember?.role === 'Admin' ? 'Dismiss as Admin' : 'Make Admin'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.sheetActionBtn} onPress={() => {
                    const member = selectedMember;
                    setSelectedMember(null);
                    setTimeout(() => removeMember(member), 300);
                  }} activeOpacity={0.7}>
                    <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                      <Ionicons name="person-remove-outline" size={22} color="#ef4444" />
                    </View>
                    <Text style={[styles.sheetActionText, { color: '#ef4444' }]}>Remove from Group</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={isChatOpening} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={{ color: '#fff', marginTop: 12, fontWeight: '600' }}>Opening Chat...</Text>
        </View>
      </Modal>
      <ShareToChatSheet 
        visible={showShareSheet} 
        profileShare={profileToShare} 
        onClose={() => { setShowShareSheet(false); setTimeout(() => setProfileToShare(null), 300); }} 
      />
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: T.backgroundDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  profileSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap: { marginBottom: 14 },
  profileName: { fontSize: 22, fontWeight: '700', color: T.textPrimary, marginBottom: 4 },
  profileSub: { fontSize: 14, color: T.textSecondary },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingBottom: 24 },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: T.cardBackground, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 12, color: T.textSecondary },
  section: { marginHorizontal: 16, marginBottom: 16, backgroundColor: T.cardBackground, borderRadius: 14, overflow: 'hidden' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: T.textSecondary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  settingIcon: { marginRight: 14 },
  settingLabel: { flex: 1, fontSize: 15, color: T.textPrimary },
  settingValue: { fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  infoIcon: { marginRight: 14, width: 22, textAlign: 'center' },
  infoLabel: { fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15, color: T.textPrimary, fontWeight: '500' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  memberName: { fontSize: 15, fontWeight: '600', color: T.textPrimary },
  memberRole: { fontSize: 12, color: T.textSecondary, marginTop: 2 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  bottomSheetContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 20 },
  sheetHandle: { width: 44, height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { alignItems: 'center', marginBottom: 32 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: T.textPrimary, marginTop: 14, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: T.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '700' },
  sheetBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16, paddingHorizontal: 10 },
  sheetBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sheetBadgeText: { fontSize: 13, color: T.textSecondary, marginLeft: 6, fontWeight: '500' },
  sheetActions: { gap: 12 },
  sheetActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardBackground, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  sheetIconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sheetActionText: { fontSize: 16, fontWeight: '600', color: T.textPrimary },
});
};
