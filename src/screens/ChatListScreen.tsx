import { useTheme } from '../context/ThemeContext';
import ThemedHeader from '../components/ThemedHeader';
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SyncAvatar } from '../components/SyncAvatar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../hooks/useUser';
import { cleanSenderName } from '../components/chat';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatRoom {
  id: string;
  title: string;
  sender: string;
  lastMessageSenderId: string;
  lastMessage: string;
  time: string;
  timestampObj: Date;
  unread: number;
  avatar: any;
  isGroup: boolean;
  category: 'Groups' | 'Direct';
  participantDetails?: Record<string, any>;
  clearedAt?: Record<string, any>;
  lastMessageStatus?: 'sending' | 'sent' | 'delivered' | 'read';
  isCleared?: boolean;
  isArchived?: boolean;
  admins?: string[];
  createdById?: string;
  createdBy?: string;
  participants?: string[];
  type?: string;
}

const DEFAULT_AVATAR = require('../../assets/image/home1.jpg');

const ChatItem = memo(({ room, onPress, currentUid, typingUsers }: { room: ChatRoom & { onLongPress?: () => void }; onPress: () => void; currentUid: string | undefined; typingUsers?: string[] }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const APP_THEME = {
    background: 'transparent',
    headerBg: 'transparent',
    inputBg: theme.colors.inputBackground,
    searchBg: theme.colors.inputBackground,
    primaryAccent: theme.colors.accent,
    primaryText: theme.colors.textPrimary,
    secondaryText: theme.colors.textSecondary,
    border: theme.colors.bottomTabBorder,
    tabBarBg: theme.colors.surface,
    purpleAccent: theme.colors.accent,
  };
  
  return (
    <TouchableOpacity style={styles.chatItem} activeOpacity={0.7} onPress={onPress} onLongPress={room.onLongPress}>
      <View style={{ marginRight: 12 }}>
        <SyncAvatar
          userId={
            !room.isGroup
              ? (Object.keys(room.participantDetails || {}).find(id => id !== currentUid)
                 || room.id.split('_').find((id: string) => id !== currentUid))
              : undefined
          }
          initialAvatar={room.avatar?.uri}
          fallbackName={room.title}
          isGroup={room.isGroup}
          size={52}
          bgColor={room.isGroup ? '#00a884' : APP_THEME.primaryAccent}
        />
      </View>
      <View style={[styles.chatItemRight, { borderBottomColor: APP_THEME.border }]}>
        <View style={styles.chatTitleRow}>
          <Text style={[styles.chatTitleText, { color: APP_THEME.primaryText }]} numberOfLines={1}>{room.title}</Text>
          <Text style={[
            styles.chatTimeText,
            { color: room.unread > 0 ? APP_THEME.primaryAccent : APP_THEME.secondaryText },
            room.unread > 0 && { fontWeight: '600' }
          ]}>
            {room.time}
          </Text>
        </View>
        <View style={styles.chatLastMessageRow}>
          <View style={styles.lastMessageTextCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {room.lastMessageSenderId === currentUid && (!typingUsers || typingUsers.length === 0) && (
                room.lastMessageStatus === 'sending' ? (
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color="#8e8e93"
                    style={{ marginRight: 4 }}
                  />
                ) : room.lastMessageStatus === 'sent' ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#8e8e93"
                    style={{ marginRight: 4 }}
                  />
                ) : room.lastMessageStatus === 'delivered' ? (
                  <Ionicons
                    name="checkmark-done"
                    size={16}
                    color="#8e8e93"
                    style={{ marginRight: 4 }}
                  />
                ) : (
                  <Ionicons
                    name="checkmark-done"
                    size={16}
                    color={APP_THEME.primaryAccent}
                    style={{ marginRight: 4 }}
                  />
                )
              )}
              {typingUsers && typingUsers.length > 0 ? (
                <Text style={[styles.lastMessageText, { color: '#00a884', fontStyle: 'italic', fontWeight: '600', flex: 1 }]} numberOfLines={1}>
                  {room.isGroup 
                    ? `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`
                    : 'typing...'}
                </Text>
              ) : room.isGroup && room.sender ? (
                <Text style={[styles.lastMessageText, { color: APP_THEME.secondaryText, flex: 1 }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '500', color: APP_THEME.primaryText }}>
                    {room.lastMessageSenderId === currentUid ? 'You' : room.sender}
                  </Text>
                  : <Text>{room.lastMessage}</Text>
                </Text>
              ) : (
                <Text style={[styles.lastMessageText, { color: APP_THEME.secondaryText, flex: 1 }]} numberOfLines={1}>
                  {room.lastMessage}
                </Text>
              )}
            </View>
          </View>
          {room.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: APP_THEME.primaryAccent }]}>
              <Text style={styles.unreadText}>{room.unread > 99 ? '99+' : room.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const formatTime = (dateInput: Date | string | number | null): string => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!date || typeof date.getTime !== 'function' || isNaN(date.getTime())) return '';
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function ChatListScreen({ route, navigation }: any) {
  const { theme, themeName } = useTheme();
  const styles = getStyles(theme);
  const isFocused = useIsFocused();
  const user = useUserStore(s => s.user);
  const isLight = themeName === 'light';

  const { card } = route?.params || {};
  const bgSource = card?.source;
  const APP_THEME = {
    background: 'transparent',
    headerBg: 'transparent',
    inputBg: theme.colors.inputBackground,
    searchBg: theme.colors.inputBackground,
    primaryAccent: theme.colors.accent,
    primaryText: theme.colors.textPrimary,
    secondaryText: theme.colors.textSecondary,
    border: theme.colors.bottomTabBorder,
    tabBarBg: theme.colors.surface,
    purpleAccent: theme.colors.accent,
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Unread' | 'Groups' | 'Direct' | 'Requests' | 'Archived'>('All');
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);


  // Shimmer animation - DISABLED to reduce CPU heat
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Disabled for performance: const loop = Animated.loop(...)
    // Users see static placeholder instead of shimmer
    return () => {};
  }, [loading]);

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2000);
  };

  useEffect(() => {
    AsyncStorage.getItem('cached_chat_rooms').then(val => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          const revived = parsed.map((r: any) => ({ ...r, timestampObj: new Date(r.timestampObj) }));
          if (loading) { setChatRooms(revived); setLoading(false); }
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    const targetChatId = route?.params?.chatId || route?.params?.conversationId || route?.params?.conversation;
    if (targetChatId && chatRooms.length > 0) {
      const room = chatRooms.find((r) => r.id === targetChatId);
      if (room) {
        const { timestampObj, ...safeRoom } = room;
        navigation.navigate('ChatRoom', { room: safeRoom });
        
        navigation.setParams({ chatId: undefined, conversationId: undefined, conversation: undefined });
      }
    }
  }, [route?.params?.chatId, route?.params?.conversationId, route?.params?.conversation, chatRooms]);

  const fetchChats = useCallback(async (isRefresh: boolean = false) => {
    const currentUser = user;
    if (!currentUser) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);

    try {
      const storedArchived = await AsyncStorage.getItem(`archived_chats_${currentUser.uid}`);
      const archivedIds: string[] = storedArchived ? JSON.parse(storedArchived) : [];

      const storedDeleted = await AsyncStorage.getItem(`deleted_chats_${currentUser.uid}`);
      const deletedIds: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];

      const res = await api.chats.getAll();
      const allRows = res.success && Array.isArray(res.data) ? res.data : [];

      // Strictly filter chats where user is active participant and chat is not deleted
      const rows = allRows.filter((data: any) => {
        if (deletedIds.includes(data.id)) return false;
        const participants: string[] = Array.isArray(data.participants)
          ? data.participants.map(String)
          : Array.isArray(data.memberIds)
            ? data.memberIds.map(String)
            : typeof data.participants === 'object' && data.participants !== null
              ? Object.keys(data.participants)
              : [];
        if (participants.length === 0) return true;
        return participants.includes(currentUser.uid);
      });

      const rooms: ChatRoom[] = rows.map((data: any) => {
        const isGroup = ['group', 'channel', 'announcement'].includes(String(data.type || '').toLowerCase()) || data.isGroup === true || data.category === 'Groups';
        let title = data.title || data.name || (isGroup ? 'Group Chat' : 'Chat');
        
        const participants: string[] = Array.isArray(data.participants)
          ? data.participants.map(String)
          : Array.isArray(data.memberIds)
            ? data.memberIds.map(String)
            : typeof data.participants === 'object' && data.participants !== null
              ? Object.keys(data.participants)
              : [];

        if (!isGroup) {
          const otherUserId = participants.find((id: string) => id !== currentUser.uid)
            || (typeof data.id === 'string' && data.id.includes('_') ? data.id.split('_').find((id: string) => id !== currentUser.uid) : null);
          const otherDetails = otherUserId ? data.participantDetails?.[otherUserId] : null;
          const computedOtherName = (otherDetails?.name && otherDetails.name !== 'Member')
            ? otherDetails.name
            : [otherDetails?.firstName, otherDetails?.lastName].filter(Boolean).join(' ').trim()
              || (otherDetails?.email ? otherDetails.email.split('@')[0] : '');

          if (computedOtherName) {
            title = cleanSenderName(computedOtherName);
          } else if (data.title && data.title !== 'Chat' && data.title !== 'Direct Chat' && data.title !== 'Direct Message' && data.title !== 'Member') {
            title = cleanSenderName(data.title);
          } else if (data.name && data.name !== 'Chat' && data.name !== 'Direct Chat' && data.name !== 'Direct Message' && data.name !== 'Member') {
            title = cleanSenderName(data.name);
          }
        }

        // API returns lastMessage as a string or object, and lastTimestamp as ISO string
        const rawLastMsg = data.lastMessage;
        let lastMsgText: string = typeof rawLastMsg === 'string'
          ? rawLastMsg
          : (rawLastMsg?.text || 'No messages yet');

        // Parse structured JSON payloads
        if (typeof lastMsgText === 'string' && lastMsgText.startsWith('{') && lastMsgText.endsWith('}')) {
          try {
            const parsed = JSON.parse(lastMsgText);
            if (parsed.voiceUrl || parsed.audioUrl) lastMsgText = '🎤 Voice note';
            else if (parsed.mediaUrl || parsed.imageUrl) lastMsgText = '📷 Photo';
            else if (parsed.documentName) lastMsgText = `📄 ${parsed.documentName}`;
            else if (parsed.songData) lastMsgText = `🎵 ${parsed.songData.title || 'Song'}`;
            else if (parsed.text) lastMsgText = parsed.text;
          } catch {}
        }

        const rawTimestamp = data.lastTimestamp || (typeof rawLastMsg === 'object' ? rawLastMsg?.timestamp : null) || data.createdAt;

        // Last sender: can be in rawLastMsg.senderId, data.lastMessageSenderId, or data.rawData
        const lastSenderId: string = (typeof rawLastMsg === 'object' && rawLastMsg?.senderId) || data.lastMessageSenderId || data.rawData?.lastSenderId || '';
        let senderName = '';
        if (lastSenderId === currentUser.uid) {
          senderName = 'You';
        } else if (typeof rawLastMsg === 'object' && rawLastMsg?.senderName && rawLastMsg.senderName !== 'Member') {
          senderName = cleanSenderName(rawLastMsg.senderName).split(' ')[0] || '';
        } else if (data.lastMessageSenderName && data.lastMessageSenderName !== 'Member') {
          senderName = cleanSenderName(data.lastMessageSenderName).split(' ')[0] || '';
        } else if (lastSenderId && data.participantDetails?.[lastSenderId]?.name && data.participantDetails[lastSenderId].name !== 'Member') {
          senderName = cleanSenderName(data.participantDetails[lastSenderId].name).split(' ')[0] || '';
        } else if (lastSenderId && data.participantDetails?.[lastSenderId]?.email) {
          const prefix = data.participantDetails[lastSenderId].email.split('@')[0];
          senderName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }

        let roomAvatar: any = data.avatar ? (typeof data.avatar === 'string' ? { uri: data.avatar } : data.avatar) : null;
        if (!isGroup) {
          const otherId = participants.find((id: string) => id !== currentUser.uid)
            || (typeof data.id === 'string' && data.id.includes('_') ? data.id.split('_').find((id: string) => id !== currentUser.uid) : null);
          if (otherId && data.participantDetails?.[otherId]?.avatar) {
            roomAvatar = { uri: data.participantDetails[otherId].avatar };
          }
        }
        if (!roomAvatar) roomAvatar = { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=1c1c1e&color=ffffff&size=128` };

        // Cleared-at logic
        const clearedAtVal = data.clearedAt?.[currentUser.uid];
        const lastMsgTime = rawTimestamp;
        let isCleared = false;
        let clearedDate: Date | null = null;
        if (clearedAtVal) {
          const cDate = new Date(clearedAtVal);
          clearedDate = cDate;
          if (!lastMsgTime) { isCleared = true; }
          else { isCleared = new Date(lastMsgTime) <= cDate; }
        }

        const previewText = isCleared ? 'No messages yet' : lastMsgText.replace('📷 Image', '📷');
        const isArchived = data.archived?.[currentUser.uid] === true || archivedIds.includes(data.id);
        const dateVal = rawTimestamp ? new Date(rawTimestamp) : (isCleared && clearedDate ? clearedDate : new Date(0));
        const unreadCount = isCleared ? 0 : (typeof data.unreadCount === 'object' ? (data.unreadCount?.[currentUser.uid] || 0) : (data.unreadCount ?? data.unread ?? 0));

        return {
          id: data.id,
          title,
          sender: isCleared ? '' : senderName,
          lastMessageSenderId: isCleared ? '' : lastSenderId,
          lastMessage: isCleared ? 'No messages yet' : previewText,
          time: isCleared ? '' : formatTime(dateVal),
          timestampObj: isCleared ? new Date(0) : dateVal,
          unread: unreadCount,
          avatar: roomAvatar,
          isGroup,
          category: (isGroup ? 'Groups' : 'Direct') as 'Groups' | 'Direct',
          participantDetails: data.participantDetails || {},
          clearedAt: data.clearedAt || {},
          lastMessageStatus: (typeof rawLastMsg === 'object' ? rawLastMsg?.status : null) || data.lastMessage?.status || 'sent',
          isCleared,
          isArchived,
          admins: Array.isArray(data.admins) ? data.admins : [],
          createdById: data.createdById || data.createdBy,
          createdBy: data.createdBy || data.createdById,
          participants: participants,
          type: data.type || (isGroup ? 'group' : 'direct'),
        };
      });

      rooms.sort((a, b) => b.timestampObj.getTime() - a.timestampObj.getTime());
      setChatRooms(rooms);
      AsyncStorage.setItem('cached_chat_rooms', JSON.stringify(rooms)).catch(() => {});
      setLoading(false);
      setRefreshing(false);
    } catch (error: any) {
      if (error?.name === 'SessionExpiredError' || error?.message?.includes('Session expired')) {
        console.log('[ChatListScreen] Session expired; re-authenticating...');
      } else {
        console.error('Error fetching chats:', error);
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Screen focus listener: Re-sync instantaneously whenever returning to ChatList
  useFocusEffect(
    useCallback(() => {
      fetchChats(false);
    }, [fetchChats])
  );

  const handleRefresh = useCallback(() => {
    fetchChats(true);
  }, [fetchChats]);

  // Real-time WebSocket listener: immediately re-fetch when message or chat event occurs
  useWebSocket('chats', user?.uid || '', () => {
    fetchChats(false);
  }, !!user?.uid);

  const filteredRooms = chatRooms.filter((room) => {
    if (room.isCleared) return false;
    if (selectedFilter !== 'Archived' && room.isArchived) return false;
    if (selectedFilter === 'Archived' && !room.isArchived) return false;

    if (selectedFilter === 'Unread' && room.unread === 0) return false;
    if (selectedFilter === 'Groups' && !room.isGroup) return false;
    if (selectedFilter === 'Direct' && room.isGroup) return false;
    if (selectedFilter === 'Requests' && (room.isGroup || room.lastMessageSenderId === user?.uid || room.unread === 0)) return false;

    if (searchQuery.trim()) {
      return room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.sender.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const totalUnreadCount = chatRooms.reduce((acc, curr) => acc + (curr.isArchived ? 0 : curr.unread), 0);
  const unreadPillCount = chatRooms.filter(r => !r.isCleared && !r.isArchived && r.unread > 0).length;
  const groupsPillCount = chatRooms.filter(r => !r.isCleared && !r.isArchived && r.isGroup).length;
  const directPillCount = chatRooms.filter(r => !r.isCleared && !r.isArchived && !r.isGroup).length;
  const requestsPillCount = chatRooms.filter(r => !r.isCleared && !r.isArchived && !r.isGroup && r.lastMessageSenderId !== user?.uid && r.unread > 0).length;
  const archivedPillCount = chatRooms.filter(r => !r.isCleared && r.isArchived).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />

      {}
      {bgSource ? (
        <Image source={bgSource} style={[StyleSheet.absoluteFill, { opacity: isLight ? 0.95 : 0.25 }]} contentFit="cover" />
      ) : (
        <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={isLight
          ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.85)']
          : ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)', 'rgba(0,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {}
        {toastMessage ? (
          <View style={styles.toastContainer}>
            <View style={styles.toastBox}>
              <Ionicons name="information-circle" size={20} color={APP_THEME.purpleAccent} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}

        {}
        <ThemedHeader style={styles.appBar}>
          <TouchableOpacity 
            style={styles.circleBtn} 
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home');
            }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.gradients.headerTextColor} />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) { showToast('Camera permission required'); return; }
              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images as any, quality: 0.8 });
              if (!result.canceled && result.assets?.[0]) showToast('Photo taken — open a chat to send it');
            }}>
              <Ionicons name="camera" size={24} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
              <Ionicons name="people" size={24} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]} onPress={() => navigation.navigate('NewChat')}>
              <Ionicons name="add" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </ThemedHeader>

        {}
        <View style={styles.searchContainerWrapper}>
          <View style={[styles.searchBar, { backgroundColor: APP_THEME.searchBg }]}>
            <Ionicons name="search" size={16} color={APP_THEME.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: APP_THEME.primaryText }]}
              placeholder="Search"
              placeholderTextColor={APP_THEME.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery} />
            
            {searchQuery ? (
              <TouchableOpacity onPress={() => { setSearchQuery(''); }}>
                <Ionicons name="close-circle" size={18} color={APP_THEME.secondaryText} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Pills */}
        <View style={[styles.filterPillsWrapper, { borderBottomColor: APP_THEME.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {[
              { key: 'All', label: 'All', count: null },
              { key: 'Unread', label: 'Unread', count: unreadPillCount },
              { key: 'Groups', label: 'Groups', count: groupsPillCount },
              { key: 'Direct', label: 'Direct', count: directPillCount },
              { key: 'Requests', label: 'Requests', count: requestsPillCount },
              { key: 'Archived', label: 'Archived', count: archivedPillCount },
            ].map(({ key, label, count }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterPill,
                  { backgroundColor: APP_THEME.searchBg },
                  selectedFilter === key && { backgroundColor: theme.colors.cardBackgroundLight }
                ]}
                onPress={() => { setSelectedFilter(key as any); }}>
                <Text style={[
                  styles.filterPillText,
                  { color: APP_THEME.secondaryText },
                  selectedFilter === key && { color: APP_THEME.purpleAccent, fontWeight: 'bold' }
                ]}>
                  {label}
                  {count !== null && count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chats list */}
        <View style={{ flex: 1 }}>
          <FlashList
            data={loading ? [] : filteredRooms}
            keyExtractor={(item, index) => (item?.id ? String(item.id) : `room-${index}`)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatsListContent}
            keyboardShouldPersistTaps="handled"
            // @ts-ignore
            estimatedItemSize={76}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            renderItem={({ item: room }) => {
              if (!room) return null;
              return (
                <ChatItem
                  currentUid={user?.uid}
                  onPress={() => {
                    const { timestampObj, onLongPress, ...safeRoom } = room as any;
                    navigation.navigate('ChatRoom', { room: safeRoom });
                  }}
                  room={{
                    ...room,
                    onLongPress: () => {
                      Alert.alert(
                        room.title,
                        'Choose an action for this conversation',
                        [
                          {
                            text: room.unread > 0 ? 'Mark as Read' : 'Mark as Unread',
                            onPress: async () => {
                              const newUnread = room.unread > 0 ? 0 : 1;
                              setChatRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread: newUnread } : r));
                              try {
                                if (newUnread === 0) {
                                  await api.chats.markRead(room.id);
                                }
                              } catch {}
                            }
                          },
                          {
                            text: room.isArchived ? 'Unarchive Chat' : 'Archive Chat',
                            onPress: async () => {
                              const nextArchived = !room.isArchived;
                              setChatRooms(prev => prev.map(r => r.id === room.id ? { ...r, isArchived: nextArchived } : r));
                              try {
                                await api.chats.archive(room.id, nextArchived);
                                const stored = await AsyncStorage.getItem(`archived_chats_${user?.uid}`);
                                const list = stored ? JSON.parse(stored) : [];
                                const updatedList = nextArchived ? Array.from(new Set([...list, room.id])) : list.filter((id: string) => id !== room.id);
                                await AsyncStorage.setItem(`archived_chats_${user?.uid}`, JSON.stringify(updatedList));
                                showToast(nextArchived ? 'Chat archived' : 'Chat unarchived');
                              } catch {}
                            }
                          },
                          {
                            text: room.isGroup ? 'Leave Group' : 'Delete Chat',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (room.isGroup) {
                                  await api.chats.leave(room.id, user?.uid).catch(() => {});
                                }
                                await api.chats.deleteChat(room.id).catch(() => {});
                                await AsyncStorage.removeItem(`chat_msgs_${room.id}`);
                                await AsyncStorage.removeItem(`cached_messages_${room.id}`);

                                if (user?.uid) {
                                  const stored = await AsyncStorage.getItem(`deleted_chats_${user.uid}`);
                                  const list: string[] = stored ? JSON.parse(stored) : [];
                                  if (!list.includes(room.id)) {
                                    await AsyncStorage.setItem(`deleted_chats_${user.uid}`, JSON.stringify([...list, room.id]));
                                  }
                                }

                                setChatRooms(prev => prev.filter(r => r.id !== room.id));
                                showToast(room.isGroup ? 'Left group' : 'Chat deleted');
                              } catch (err) {
                                Alert.alert('Error', 'Failed to process request');
                              }
                            }
                          },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    }
                  } as any}
                />
              );
            }}
            ListHeaderComponent={loading ? (
              <View>
                {Array.from({ length: 7 }).map((_, i) => (
                  <Animated.View key={i} style={[styles.skeletonRow, { opacity: shimmerOpacity }]}>
                    <View style={styles.skeletonAvatar} />
                    <View style={styles.skeletonContent}>
                      <View style={[styles.skeletonLine, { width: `${55 + (i % 3) * 15}%`, height: 14, marginBottom: 8 }]} />
                      <View style={[styles.skeletonLine, { width: `${40 + (i % 4) * 12}%`, height: 11 }]} />
                    </View>
                    <View style={[styles.skeletonLine, { width: 36, height: 11, borderRadius: 6 }]} />
                  </Animated.View>
                ))}
              </View>
            ) : null}
            ListEmptyComponent={!loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={52} color={APP_THEME.secondaryText} style={{ opacity: 0.4 }} />
                <Text style={styles.emptyTitle}>No chats yet</Text>
                <Text style={styles.emptySub}>Tap + to start a new conversation</Text>
              </View>
            ) : null}
          />
        </View>

        {/* Bottom Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: APP_THEME.tabBarBg, borderTopColor: APP_THEME.border }]}>
          <TouchableOpacity style={styles.tabItem}>
            <View style={{ position: 'relative' }}>
              <Ionicons name="chatbubbles" size={24} color={APP_THEME.primaryAccent} />
              {totalUnreadCount > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: APP_THEME.primaryAccent }]}>
                  <Text style={styles.tabBadgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color: APP_THEME.primaryAccent, fontWeight: '700' }]}>Chats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              navigation.navigate('Calls');
            }}
          >
            <Ionicons name="call-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.tabLabel}>Calls</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.background
  },
  safeArea: {
    flex: 1
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent'
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.inputBackground,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4
  },
  titleText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: T.textPrimary
  },
  searchContainerWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    backgroundColor: T.inputBackground,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  searchIcon: {
    marginRight: 6
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    height: '100%',
    color: T.inputText,
  },
  filterPillsWrapper: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: T.inputBackground,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600'
  },
  chatsList: {
    flex: 1
  },
  chatsListContent: {
    paddingBottom: 20
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  skeletonAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: T.inputBackground,
  },
  skeletonContent: { flex: 1, gap: 0 },
  skeletonLine: {
    backgroundColor: T.inputBackground,
    borderRadius: 8,
  },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary, opacity: 0.6 },
  emptySub: { fontSize: 14, color: T.textSecondary, opacity: 0.5 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  chatItemRight: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingRight: 4
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  chatTitleText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8
  },
  chatTimeText: {
    fontSize: 14
  },
  chatLastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  lastMessageTextCol: {
    flex: 1,
    marginRight: 16
  },
  lastMessageText: {
    fontSize: 14,
    lineHeight: 18
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textPrimary
  },
  tabBar: {
    height: 50,
    backgroundColor: T.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.bottomTabBorder,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 2
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  tabLabel: {
    fontSize: 10,
    color: T.textSecondary,
    marginTop: 3,
    fontWeight: '500'
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: T.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  tabBadgeText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontWeight: 'bold'
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: T.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.bottomTabBorder
  }
});
};
