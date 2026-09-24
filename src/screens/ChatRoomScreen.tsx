import { useTheme } from '../context/ThemeContext';
import ThemedHeader from '../components/ThemedHeader';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Dimensions, Modal,
  ActivityIndicator, Animated, ScrollView,
  AppState, Alert, RefreshControl, Linking, FlatList,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { DoodleBackground } from '../components/DoodleBackground';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { resolveMediaUrl } from '../lib/mediaUtils';
import { AudioModule, setAudioModeAsync, AudioRecorder, RecordingPresets } from 'expo-audio'; // kept for recording only — playback uses TrackPlayer
import {
  SafeTrackPlayer as TrackPlayer,
  SafeState as State,
  SafeEvent as Event,
  safeUseTrackPlayerEvents as useTrackPlayerEvents,
} from '../lib/safeNativeModules';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';

import { FlashList } from '@shopify/flash-list';
import { SyncAvatar } from '../components/SyncAvatar';
import { useTrackPlayer } from '../hooks/useTrackPlayer';
import { useUserStore } from '../hooks/useUser';
import { getStyles } from './ChatRoomStyles';
import { sendPushNotification } from '../lib/notifications';
import { useIsMounted } from '../hooks/useIsMounted';
import * as Sentry from '@sentry/react-native';
import { debugSessionLog } from '../lib/debugSessionLog';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import {
  ChatMessage,
  getSenderColor,
  isOnlyEmojis,
  TypingBubble,
  VoiceWaveformVisualizer,
  LocalAudioSlider,
  TickIcon,
  AudioFileCard,
  SongShareCard,
  PlaylistShareCard,
  ProfileShareCard,
  GroupCallCard,
  VoiceNoteCard,
  cleanSenderName,
} from '../components/chat';
import ChatVideoModal from '../components/chat/ChatVideoModal';
import CustomLinkPreview, { renderTextWithLinks } from '../components/chat/CustomLinkPreview';
import ChatImageViewerModal from '../components/chat/ChatImageViewerModal';
import ChatViewOnceModal from '../components/chat/ChatViewOnceModal';
import ChatAttachMenuModal from '../components/chat/ChatAttachMenuModal';
import ChatMediaPreviewModal from '../components/chat/ChatMediaPreviewModal';
import ChatMessageActionSheet from '../components/chat/ChatMessageActionSheet';
import ChatMessageInfoModal from '../components/chat/ChatMessageInfoModal';
import ChatOptionsMenuModal from '../components/chat/ChatOptionsMenuModal';
import ChatInputDeck from '../components/chat/ChatInputDeck';
import ChatHeaderBar from '../components/chat/ChatHeaderBar';
import ChatMessageBubble from '../components/chat/ChatMessageBubble';

export default function ChatRoomScreen({ route, navigation }: any) {

    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifLoading, setGifLoading] = useState(false);
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [showContactShareModal, setShowContactShareModal] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [disappearingTimer, setDisappearingTimer] = useState<number | null>(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [chatWallpaperOpacity, setChatWallpaperOpacity] = useState(0.8);
  const [chatWallpaperUri, setChatWallpaperUri] = useState<string | null>(null);
  const [showJoinLinkModal, setShowJoinLinkModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [chatMenuVisible, setChatMenuVisible] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [listenerRetryKey, setListenerRetryKey] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [imgViewerVisible, setImgViewerVisible] = useState(false);
  const [imgViewerUri, setImgViewerUri] = useState<string | null>(null);
  const [videoViewerUri, setVideoViewerUri] = useState<string | null>(null);
  const [viewOnceVisible, setViewOnceVisible] = useState(false);
  const [viewOnceUri, setViewOnceUri] = useState<string | null>(null);
  const [viewOnceTimer, setViewOnceTimer] = useState(7); // 7s to match the actual countdown reset
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [previewMediaList, setPreviewMediaList] = useState<any[] | null>(null);
  const [previewViewOnce, setPreviewViewOnce] = useState(false);
  const [previewCaption, setPreviewCaption] = useState('');
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [callVisible, setCallVisible] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [viewOnceMsgId, setViewOnceMsgId] = useState<string | null>(null);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);



  

  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const isMountedRef = useIsMounted();
  
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const styles = getStyles(theme, insets);

  const APP_THEME = {
    headerBg: 'transparent',
    inputBg: theme.colors.chatInputBg,
    cardBg: theme.colors.backgroundDark,
    searchBg: theme.colors.inputBackground,
    primaryAccent: theme.colors.accent,
    primaryText: theme.colors.textPrimary,
    secondaryText: theme.colors.textSecondary,
    outgoingBubble: theme.colors.bubbleOutgoing,
    incomingBubble: theme.colors.bubbleIncoming,
    outgoingText: theme.colors.bubbleOutgoingText,
    incomingText: theme.colors.bubbleIncomingText,
    border: theme.colors.bottomTabBorder,
    datePill: theme.colors.datePillBg,
    chatWallpaper: 'transparent',
    tickColor: theme.colors.tickSent,
    tickColorRead: theme.colors.tickRead,
  };

  const { room: incomingRoom, roomId: deepLinkRoomId, chatId, card } = route.params || {};
  const bgSource = card?.source;
  const effectiveRoomId = deepLinkRoomId || chatId;
  const [room, setRoom] = useState<any>(incomingRoom);
  const [isLoadingDeepLink, setIsLoadingDeepLink] = useState(!incomingRoom && !!effectiveRoomId);

  useEffect(() => {
    const targetRoomId = incomingRoom?.id || effectiveRoomId;
    if (targetRoomId) {
      api.chats.getById(targetRoomId).then(res => {
        if (res?.success && res.data) {
          setRoom((prev: any) => ({ ...prev, ...res.data }));
        }
      }).catch(() => {
        // If room is direct and not found on backend yet, create it eagerly in background
        if (targetRoomId.includes('_')) {
          const parts = targetRoomId.split('_');
          api.chats.create({
            id: targetRoomId,
            name: incomingRoom?.title || 'Direct Message',
            type: 'direct',
            participants: parts,
          }).then(createRes => {
            if (createRes?.success && createRes.data) {
              setRoom((prev: any) => ({ ...prev, ...createRes.data }));
            }
          }).catch(() => {});
        }
      });
    }
  }, [incomingRoom?.id, deepLinkRoomId]);

  const { isSetupComplete } = useTrackPlayer();
  const currentUser = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const myId = currentUser?.uid || (currentUser as any)?.id || (profile as any)?.id || '';
  const myName = cleanSenderName(
    profile 
      ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') 
      : ((currentUser as any)?.displayName || (currentUser as any)?.name || "Me" || '')
  );
  const isGroup: boolean = room?.isGroup || room?.type === 'group' || room?.category === 'Groups';

  const isGroupAdmin = useMemo(() => {
    if (!isGroup || !myId) return false;
    const adminList: string[] = Array.isArray(room?.admins) ? room.admins : [];
    const isCreator = room?.createdById === myId || room?.createdBy === myId;
    const isRoleAdmin = 
      (currentUser as any)?.role === 'hq_admin' || 
      (currentUser as any)?.role === 'admin' || 
      profile?.role === 'hq_admin' || 
      profile?.role === 'admin' ||
      profile?.role === 'boss' ||
      profile?.role === 'zone_admin' ||
      profile?.role === 'coordinator' ||
      profile?.isZoneCoordinator === true ||
      profile?.administration === 'Boss';
    return adminList.includes(myId) || isCreator || isRoleAdmin;
  }, [isGroup, myId, (currentUser as any)?.role, profile, room?.admins, room?.createdById, room?.createdBy]);

  let resolvedRoomTitle = room?.title || (isGroup ? 'Group Chat' : 'Chat');
  let resolvedRoomAvatarUri = room?.avatar?.uri || (typeof room?.avatar === 'string' ? room.avatar : null);

  if (!isGroup && currentUser) {
    const participants: string[] = Array.isArray(room?.participants)
      ? room.participants.map(String)
      : typeof room?.participants === 'object' && room?.participants !== null
        ? Object.keys(room.participants)
        : [];
    const otherId = participants.find((id: string) => id !== currentUser.uid)
      || (typeof room?.id === 'string' && room.id.includes('_') ? room.id.split('_').find((id: string) => id !== currentUser.uid) : null);
    const otherDetails = otherId ? room?.participantDetails?.[otherId] : null;
    if (otherDetails?.name && otherDetails.name !== 'Member') {
      resolvedRoomTitle = cleanSenderName(otherDetails.name);
    } else if (room?.title && room.title !== 'Chat' && room.title !== 'Direct Chat' && room.title !== 'Direct Message' && room.title !== 'Member') {
      resolvedRoomTitle = cleanSenderName(room.title);
    } else if (room?.name && room.name !== 'Chat' && room.name !== 'Direct Chat' && room.name !== 'Direct Message' && room.name !== 'Member') {
      resolvedRoomTitle = cleanSenderName(room.name);
    } else if (otherDetails?.email) {
      const prefix = otherDetails.email.split('@')[0];
      resolvedRoomTitle = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    if (otherDetails?.avatar) {
      resolvedRoomAvatarUri = otherDetails.avatar;
    }
  }

  const roomTitle: string = resolvedRoomTitle;
  const roomAvatarUri: string = resolvedRoomAvatarUri || `https://ui-avatars.com/api/?name=${encodeURIComponent(roomTitle)}&background=202c33&color=e9edef&size=128`;
  if (isLoadingDeepLink) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={{ marginTop: 16, color: theme.colors.textPrimary, fontSize: 16 }}>Loading chat...</Text>
      </View>
    );
  }

  const notifyParticipants = async (text: string, type: 'new' | 'edit' | 'delete' = 'new') => {
    try {

      if (!currentUser || !room) {

        return;
      }
      let otherParticipantIds: string[] = [];

      if (room.participants && room.participants.length > 0) {
        otherParticipantIds = room.participants.filter((id: string) => id !== currentUser.uid);
      } else if (room.participantDetails) {
        otherParticipantIds = Object.keys(room.participantDetails || {}).filter((id: string) => id !== currentUser.uid);
      }

      if (otherParticipantIds.length === 0) {

        return;
      }

      const senderName = myName || 'Someone';
      let title = '';
      let body = '';

      if (isGroup) {
        const groupName = roomTitle || 'Group';
        if (type === 'new') { title = groupName; body = `${senderName}: ${text}`; }
        else if (type === 'edit') { title = groupName; body = `${senderName} edited: ${text}`; }
        else if (type === 'delete') { title = groupName; body = `${senderName} deleted a message`; }
      } else {
        if (type === 'new') { title = senderName; body = text; }
        else if (type === 'edit') { title = senderName; body = `Edited: ${text}`; }
        else if (type === 'delete') { title = senderName; body = `Deleted a message`; }
      }

      await sendPushNotification(otherParticipantIds, title, body, {
        screen: 'ChatRoom',
        params: { room }
      });

    } catch (err) {
      console.error('[notifyParticipants] Error:', err);
    }
  };
  const dispatchSendMessage = async (targetRoomId: string, payload: Record<string, any>) => {
    try {
      return await api.chats.sendMessage(targetRoomId, payload);
    } catch (err: any) {
      // Auto-recover if direct chat doesn't exist yet on backend
      if (targetRoomId && (room?.type === 'direct' || targetRoomId.includes('_'))) {
        try {
          const participants = (room?.participants && room.participants.length > 0)
            ? room.participants
            : targetRoomId.split('_');
          await api.chats.create({
            id: targetRoomId,
            name: room?.title || 'Direct Message',
            type: 'direct',
            participants,
          }).catch(() => {});
          return await api.chats.sendMessage(targetRoomId, payload);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  };

  useEffect(() => {
    const fwdText: string | undefined = route.params?.forwardText;
    const fwdType: string = route.params?.forwardType || 'text';
    if (!fwdText || !room?.id) return;
    const cu = currentUser;
    if (!cu) return;

    const sendForward = async () => {
      try {
        const msgObj: Record<string, any> = {
          chatId: room.id,
          senderId: cu.uid,
          senderName: myName || 'You',
          type: fwdType,
          text: fwdText,
          timestamp: new Date().toISOString(),
          edited: false,
          reactions: {},
          status: 'sent',
          starred: false,
          forwarded: true,
        };

        if (fwdType === 'image') {
          msgObj.imageUrl = fwdText;
        } else if (fwdType === 'video') {
          msgObj.videoUrl = fwdText;
        } else if (fwdType === 'audio') {
          msgObj.audioUrl = fwdText;
        } else if (fwdType === 'document') {
          msgObj.documentUrl = fwdText;
          if (route.params?.forwardDocumentName) {
            msgObj.documentName = route.params.forwardDocumentName;
          }
          if (route.params?.forwardDocumentSize) {
            msgObj.documentSize = route.params.forwardDocumentSize;
          }
        } else if (fwdType === 'song_share' && route.params?.forwardSongData) {
          try {
            msgObj.songData = JSON.parse(route.params.forwardSongData);
          } catch {}
        } else if (fwdType === 'playlist_share' && route.params?.forwardPlaylistData) {
          try {
            msgObj.playlistData = JSON.parse(route.params.forwardPlaylistData);
          } catch {}
        }
        let lastMsgText = fwdText;
        if (fwdType === 'image') lastMsgText = '📷 Photo';
        else if (fwdType === 'video') lastMsgText = '🎥 Video';
        else if (fwdType === 'audio') lastMsgText = '🎧 Audio';
        else if (fwdType === 'document') {
          lastMsgText = `📄 ${route.params?.forwardDocumentName || 'Document'}`;
        } else if (fwdType === 'song_share') {
          const title = msgObj.songData?.title || 'Song';
          lastMsgText = `🎵 Shared Song: ${title}`;
        } else if (fwdType === 'playlist_share') {
          const name = msgObj.playlistData?.name || 'Playlist';
          lastMsgText = `🎼 Shared Playlist: ${name}`;
        }
        await dispatchSendMessage(room?.id, msgObj || {});
      } catch (e) {
        console.error('Forward send error', e);
      }
    };

    sendForward();
    navigation.setParams({
      forwardText: undefined,
      forwardType: undefined,
      forwardDocumentName: undefined,
      forwardDocumentSize: undefined,
      forwardSongData: undefined,
      forwardPlaylistData: undefined,
    });
  }, [route.params?.forwardText]);
  useEffect(() => {
    if (route.params?.startCall) {
      startCall(route.params.startCall);
      navigation.setParams({ startCall: undefined });
    }
  }, [route.params?.startCall]);

  useEffect(() => {
    if (route.params?.openSearch) {
      setIsSearching(true);
    }
  }, [route.params?.openSearch]);


  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const memoizedMessages = useMemo(() => {
    if (!isSearching || !searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase().trim();
    return messages.filter(m => {
      const textMatch = m.text && m.text.toLowerCase().includes(q);
      const senderMatch = m.sender && m.sender.toLowerCase().includes(q);
      const docMatch = m.documentName && m.documentName.toLowerCase().includes(q);
      const songMatch = m.songData && (m.songData.title?.toLowerCase().includes(q) || m.songData.leadSinger?.toLowerCase().includes(q));
      return textMatch || senderMatch || docMatch || songMatch;
    });
  }, [messages, isSearching, searchQuery]);

  const [inputText, setInputText] = useState('');
  const [toastMsg, setToastMsg] = useState<string|null>(null);
  const [typingUsers, setTypingUsers] = useState<{userId:string; userName:string}[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string|null>(null);

  const initialClearedAt: Date | null = (() => {
    const rawCleared = room?.clearedAt?.[currentUser?.uid || ''];
    if (!rawCleared) return null;
    if (typeof rawCleared.toDate === 'function') return rawCleared.toDate();
    if (typeof rawCleared.seconds === 'number') return new Date(rawCleared.seconds * 1000);
    return new Date(rawCleared);
  })();

  const [clearedAt, setClearedAt] = useState<Date | null>(initialClearedAt);
  const [chatData, setChatData] = useState<any>(room);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(Boolean(room?.isAccepted));

  useEffect(() => {
    if (room?.isAccepted) {
      setHasAccepted(true);
      return;
    }
    if (room?.id && currentUser?.uid) {
      AsyncStorage.getItem(`chat_accepted_${currentUser.uid}_${room.id}`).then((val) => {
        if (val === 'true') setHasAccepted(true);
      }).catch(() => {});
    }
  }, [room?.id, room?.isAccepted, currentUser?.uid]);

  const isDirectRequest = !isGroup && !hasAccepted && !room?.isAccepted && Boolean(
    (room as any)?.isRequest ||
    (room?.lastMessageSenderId && room.lastMessageSenderId !== currentUser?.uid && (room?.unread ?? 0) > 0)
  );

  useWebSocket('chats', room?.id || '', (eventData: any) => {
    if (!eventData) return;
    if (eventData.type === 'message' || eventData.text || eventData.imageUrl || eventData.audioUrl) {
      setMessages(prev => {
        if (prev.some(m => m.id === eventData.id)) return prev;
        return [eventData, ...prev];
      });
    } else if (eventData.type === 'delete' && eventData.messageId) {
      setMessages(prev => prev.map(m => m.id === eventData.messageId ? { ...m, isDeleted: true, text: 'This message was deleted' } : m));
    } else if (eventData.type === 'edit' && eventData.messageId) {
      setMessages(prev => prev.map(m => m.id === eventData.messageId ? { ...m, text: eventData.text, edited: true } : m));
    }
  });

  const PENDING_QUEUE_KEY = 'PENDING_MESSAGES_' + (room?.id || '');

  useEffect(() => {
    if (!room?.id) return;
    // unsub
    flushPendingQueue();
    return () => {};
  }, [room?.id]);

  const flushPendingQueue = async () => {
    const cu = currentUser;
    if (!cu || !room?.id) return;
    try {
      const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
      if (!raw) return;
      const queue: Array<Record<string,any>> = JSON.parse(raw);
      if (!queue.length) return;
      const online = await checkOnline();
      if (!online) return;
      const remaining: Array<Record<string,any>> = [];
      for (const item of queue) {
        try {
          if (item.id) setMessages(prev => prev.map(m => m.id === item.id ? { ...m, status: 'sending' } : m));
          await api.chats.sendMessage(room?.id, item || {});
          if (item.id) setMessages(prev => prev.map(m => m.id === item.id ? { ...m, status: 'sent' } : m));
        } catch {
          remaining.push(item); // keep failed ones
          if (item.id) setMessages(prev => prev.map(m => m.id === item.id ? { ...m, status: 'failed' } : m));
        }
      }
      if (remaining.length) {
        await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        await AsyncStorage.removeItem(PENDING_QUEUE_KEY);
      }
    } catch {}
  };

  const checkOnline = async (): Promise<boolean> => {
    try {
      // Ping our own API health endpoint — works in all regions
      const res = await api.health();
      return !!res;
    } catch { return false; }
  };

  const queueMessage = async (data: Record<string,any>) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
      const queue: Array<Record<string,any>> = raw ? JSON.parse(raw) : [];
      queue.push({ ...data, _queuedAt: Date.now() });
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  };

  const retryMessage = async (messageId: string) => {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    const queue: Array<Record<string, any>> = raw ? JSON.parse(raw) : [];
    const item = queue.find(candidate => candidate.id === messageId);
    if (!item) return;
    setMessages(prev => prev.map(message => message.id === messageId ? { ...message, status: 'sending' } : message));
    try {
      await dispatchSendMessage(room?.id, item);
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.filter(candidate => candidate.id !== messageId)));
      setMessages(prev => prev.map(message => message.id === messageId ? { ...message, status: 'sent' } : message));
    } catch {
      setMessages(prev => prev.map(message => message.id === messageId ? { ...message, status: 'failed' } : message));
      showToast('Retry failed. Check your connection.');
    }
  };

  const [recording, setRecording] = useState<AudioRecorder|null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string|null>(null);
  const playingIdRef = useRef<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const bgWasPlayingRef = useRef(false);
  const [waveformData, setWaveformData] = useState<Record<string,number[]>>({});
  const [liveBars, setLiveBars] = useState<number[]>(new Array(40).fill(0));
  const recordingMeteringRef = useRef<number[]>([]);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const [msgLimit, setMsgLimit] = useState(30);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const flashRef = useRef<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const messagesCountRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const COLLAPSE_THRESHOLD = 320; // chars — roughly 6-8 lines

  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setMsgLimit(30);
    setRefreshCounter(prev => prev + 1);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch {}
    setIsRefreshing(false);
  }, []);

  const fmtDur = (s: number) => `${Math.floor(s/60)}:${(s%60)<10?'0':''}${s%60}`;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  }, [toastAnim]);
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: actionVisible ? 1 : 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [actionVisible]);
  useEffect(() => {
    if (!room?.id) return;
    const cu = currentUser;
    const cacheKey = `chat_msgs_${room.id}`;
    let cancelled = false;

    setMessagesLoadError(null);
    setIsInitialLoading(true);

    AsyncStorage.getItem(cacheKey).then(async raw => {
      if (!raw || cancelled || !isMountedRef.current) return;
      try {
        const clearedAtStr = await AsyncStorage.getItem(`cleared_at_${cu?.uid}_${room.id}`).catch(() => null);
        const clearedAt = clearedAtStr ? parseInt(clearedAtStr, 10) : 0;
        let parsed: ChatMessage[] = JSON.parse(raw).map((m: any) => {
          const rawSender = (room?.participantDetails?.[m.senderId]?.name && room.participantDetails[m.senderId].name !== 'Member' ? room.participantDetails[m.senderId].name : null)
            || (m.senderName && m.senderName !== 'Member' ? m.senderName : null)
            || (m.sender && m.sender !== 'Member' ? m.sender : null)
            || (room?.participantDetails?.[m.senderId]?.email ? room.participantDetails[m.senderId].email.split('@')[0] : null)
            || 'Member';
          return {
            ...m,
            sender: cleanSenderName(rawSender),
            isMe: cu ? m.senderId === cu.uid : false,
            senderColor: getSenderColor(m.senderId || '', themeName === 'light'),
            timestampObj: m.timestampObj ? new Date(m.timestampObj) : new Date(m.createdAt || m.created_at || m.timestamp || Date.now()),
          };
        });
        if (clearedAt > 0) {
          parsed = parsed.filter(m => (m.timestampObj?.getTime?.() || 0) > clearedAt);
        }
        parsed.sort((a, b) => (b.timestampObj?.getTime?.() || 0) - (a.timestampObj?.getTime?.() || 0));
        setMessages(parsed);
        setIsInitialLoading(false);
      } catch {}
    });

    const fetchMessages = async () => {
      try {
        const res = await api.chats.getMessages(room.id);
        if (res?.success && Array.isArray(res.data)) {
          const msgs: ChatMessage[] = res.data.map((m: any) => {
            const displayDt = new Date(m.createdAt || m.created_at || m.timestamp || Date.now());
            const rawSender = (room?.participantDetails?.[m.senderId]?.name && room.participantDetails[m.senderId].name !== 'Member' ? room.participantDetails[m.senderId].name : null)
              || (m.senderName && m.senderName !== 'Member' ? m.senderName : null)
              || (m.sender && m.sender !== 'Member' ? m.sender : null)
              || (room?.participantDetails?.[m.senderId]?.email ? room.participantDetails[m.senderId].email.split('@')[0] : null)
              || 'Member';

            // Parse JSON-encoded text payload (same as backend formatMessage)
            let parsedPayload: any = null;
            const rawText: string = m.text || m.content || '';
            if (typeof rawText === 'string' && rawText.startsWith('{') && rawText.endsWith('}')) {
              try { parsedPayload = JSON.parse(rawText); } catch {}
            }
            const pp = parsedPayload || {};
            const msgType = m.type || pp.type || 'text';
            const resolvedMediaUrl = resolveMediaUrl(m.mediaUrl || m.media_url || pp.mediaUrl || pp.media_url);

            return {
              id: m.id,
              senderId: m.senderId || m.sender_id,
              sender: cleanSenderName(rawSender),
              text: pp.text !== undefined ? pp.text : rawText,
              time: displayDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isMe: cu ? (m.senderId || m.sender_id) === cu.uid : false,
              senderColor: getSenderColor(m.senderId || '', themeName === 'light'),
              type: msgType,
              imageUrl: resolveMediaUrl(m.imageUrl || pp.imageUrl || (msgType === 'image' || msgType === 'photo' ? resolvedMediaUrl : null)) || null,
              isVoiceNote: msgType === 'voice',
              isSystem: msgType === 'system',
              duration: m.duration || pp.duration,
              audioUrl: resolveMediaUrl(m.audioUrl || pp.audioUrl || pp.voiceUrl || ((msgType === 'audio' || msgType === 'voice') ? resolvedMediaUrl : null)) || null,
              timestampObj: displayDt,
              status: m.status || 'sent',
              reactions: m.reactions || {},
              replyTo: m.replyTo || pp.replyTo || null,
              edited: m.edited || false,
              isDeleted: m.deleted || false,
              starred: m.starred || false,
              viewOnce: m.viewOnce || false,
              viewOnceViewed: m.viewOnceViewed || false,
              pinned: m.pinned || false,
              waveform: m.waveform || undefined,
              songData: m.songData || pp.songData || undefined,
              playlistData: m.playlistData || pp.playlistData || undefined,
              note: m.note || undefined,
              videoUrl: resolveMediaUrl(m.videoUrl || pp.videoUrl || (msgType === 'video' ? resolvedMediaUrl : undefined)) || undefined,
              documentUrl: resolveMediaUrl(m.documentUrl || pp.documentUrl || (msgType === 'document' ? resolvedMediaUrl : undefined)) || undefined,
              documentName: m.documentName || pp.documentName || undefined,
              documentSize: m.documentSize || pp.documentSize || undefined,
              callType: m.callType || undefined,
              callId: m.callId || undefined,
              pollOptions: m.pollOptions || pp.pollOptions || undefined,
              profileData: m.profileData || m.contactData || m.contact_data || pp.profileData || pp.contactData || undefined,
              contactData: m.contactData || m.contact_data || m.profileData || pp.contactData || pp.profileData || undefined,
            };
          });
          let finalMsgs = msgs;
          const clearedAtStr = await AsyncStorage.getItem(`cleared_at_${currentUser?.uid}_${room.id}`).catch(() => null);
          const clearedAt = clearedAtStr ? parseInt(clearedAtStr, 10) : 0;
          if (clearedAt > 0) {
            finalMsgs = msgs.filter(m => (m.timestampObj?.getTime?.() || 0) > clearedAt);
          }
          finalMsgs.sort((a, b) => b.timestampObj.getTime() - a.timestampObj.getTime());
          setMessages(prev => {
            if (prev.length === finalMsgs.length && prev.length > 0) {
              const isSame = prev[0]?.id === finalMsgs[0]?.id &&
                prev[prev.length - 1]?.id === finalMsgs[finalMsgs.length - 1]?.id &&
                prev[0]?.status === finalMsgs[0]?.status &&
                prev[0]?.text === finalMsgs[0]?.text;
              if (isSame) return prev;
            }
            return finalMsgs;
          });
          setIsInitialLoading(false);
          setIsLoadingMore(false);
        }
      } catch (err: any) {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
        setMessagesLoadError(err?.message || 'Could not load messages');
      }
    };
    fetchMessages();
    if (room?.id) {
      api.chats.markRead(room.id);
    }

    const pollInterval = setInterval(() => {
      if (!cancelled && isMountedRef.current) {
        fetchMessages();
      }
    }, 3500);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [room?.id, msgLimit, currentUser?.uid, refreshCounter, themeName, listenerRetryKey]);

  useEffect(() => {
    setMsgLimit(30);
  }, [room?.id]);

  useEffect(() => {
    const cu = currentUser;
    if (!cu || !room?.id) return;
    return () => {};
  }, [inputText, room?.id, currentUser?.uid]);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (isRecording) iv = setInterval(() => setRecDuration(p=>p+1), 1000);
    return () => clearInterval(iv);
  }, [isRecording]);

  useEffect(() => {
    if (!viewOnceVisible) return;
    setViewOnceTimer(7);
    const iv = setInterval(() => setViewOnceTimer(p => {
      if (p <= 1) { clearInterval(iv); setViewOnceVisible(false); setViewOnceUri(null); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [viewOnceVisible]);

  useEffect(() => {
    return () => {
      if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
    };
  }, []);
  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') { showToast('Microphone permission required'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      recordingMeteringRef.current = [];
      const rec = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await rec.prepareToRecordAsync();
      rec.record();
      setRecording(rec); setIsRecording(true); setRecDuration(0);
      meteringIntervalRef.current = setInterval(() => {
        try {
          const st = rec.getStatus();
          if (st.isRecording && st.metering !== undefined) {
            const normalized = Math.max(0, Math.min(1, (st.metering + 60) / 60));
            recordingMeteringRef.current.push(normalized);
            setLiveBars(prev => {
              const next = [...prev.slice(1), normalized];
              return next;
            });
          }
        } catch {}
      }, 250);
    } catch { showToast('Failed to start recording'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (meteringIntervalRef.current) { clearInterval(meteringIntervalRef.current); meteringIntervalRef.current = null; }
    setIsRecording(false);
    await recording.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {});
    const uri = recording.uri;
    const capturedWaveform = [...recordingMeteringRef.current];
    recordingMeteringRef.current = [];
    setRecording(null);
    setLiveBars(new Array(40).fill(0));
    if (uri && recDuration >= 1) await sendVoiceNote(uri, recDuration, capturedWaveform);
    else showToast('Recording too short');
  };

  const cancelRecording = async () => {
    if (!recording) return;
    if (meteringIntervalRef.current) { clearInterval(meteringIntervalRef.current); meteringIntervalRef.current = null; }
    setIsRecording(false);
    await recording.stop().catch(()=>{});
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {});
    setRecording(null); setRecDuration(0); recordingMeteringRef.current = [];
    setLiveBars(new Array(40).fill(0));
  };

  const sendVoiceNote = async (uri: string, dur: number, waveform: number[] = []) => {
    const cu = currentUser;
    if (!cu || !room?.id) return;
    try {
      setIsUploading(true); showToast('Sending voice note…');
      const audioUrl = await uploadImageToCloudinary(uri, 'video');
      const bars = downsampleWaveform(waveform, 40);
      const res = await dispatchSendMessage(room.id, {
        content: '🎤 Voice note',
        type: 'voice',
        media_url: audioUrl,
        duration: fmtDur(dur),
        waveform: bars,
      });
      notifyParticipants('🎤 Voice note');
      if (bars.length > 0 && res?.data?.id) setWaveformData(p => ({ ...p, [res.data.id]: bars }));
    } catch { showToast('Failed to send voice note'); }
    finally { setIsUploading(false); }
  };
  const downsampleWaveform = (data: number[], target: number): number[] => {
    if (data.length === 0) return [];
    if (data.length <= target) return data;
    const result: number[] = [];
    const bucketSize = data.length / target;
    for (let i = 0; i < target; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.floor((i + 1) * bucketSize);
      const slice = data.slice(start, end);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
    return result;
  };
  const playAudio = async (msgId: string, url: string) => {
    if (!url) { showToast('No audio available'); return; }
    if (!isSetupComplete) { showToast('Audio player is initializing, please try again...'); return; }
    try {
      if (playingId === msgId) {
        const state = await TrackPlayer.getState();
        if (state === State.Playing) {
          await TrackPlayer.pause();
          setIsAudioPlaying(false);
        } else {
          if (state === State.Stopped) {
            await TrackPlayer.seekTo(0);
          }
          await TrackPlayer.play();
          setIsAudioPlaying(true);
        }
        return;
      }
      try {
        const currentState = await TrackPlayer.getState();
        bgWasPlayingRef.current = currentState === State.Playing && playingId === null;
        if (currentState === State.Playing) await TrackPlayer.pause();
      } catch {}
      (global as any).isChatAudio = true;
      await TrackPlayer.reset();
      await TrackPlayer.add([{
        id: msgId,
        url,
        title: 'Audio',
        artist: 'Chat',
      }]);
      await TrackPlayer.play();
      setPlayingId(msgId);
      playingIdRef.current = msgId;
      setIsAudioPlaying(true);
    } catch (e) {
      console.error('TrackPlayer chat audio error:', e);
      showToast('Failed to play audio');
    }
  };

  const seekAudio = async (msgId: string, ratio: number) => {
    if (playingId !== msgId) return;
    try {
      const durSec = await TrackPlayer.getDuration();
      if (durSec > 0) {
        await TrackPlayer.seekTo(ratio * durSec);
      }
    } catch {}
  };

  useTrackPlayerEvents([Event.PlaybackQueueEnded, Event.PlaybackState], async (event: any) => {
    const isEnded = event.type === Event.PlaybackQueueEnded ||
      (event.type === Event.PlaybackState && (event.state === State.Stopped || event.state === State.Ended || event.state === 'ended' || event.state === 'stopped'));
    if (isEnded) {
      if (playingIdRef.current || playingId) {
        setIsAudioPlaying(false);
        setPlayingId(null);
        playingIdRef.current = null;
        await TrackPlayer.seekTo(0).catch(()=>{});
        (global as any).isChatAudio = false;
      }
    }
  });
  useEffect(() => {
    return () => {
      (async () => {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        }).catch(() => {});
        
        if (playingIdRef.current) {
          (global as any).isChatAudio = false;
          await TrackPlayer.reset().catch(() => {});
        } else if (bgWasPlayingRef.current) {
          (global as any).isChatAudio = false;
          await TrackPlayer.play().catch(() => {});
        }
      })();
    };
  }, []);
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    const cu = currentUser;
    if (!cu || !room?.id) return;

    if (editingMsg) {
      const timeDiff = Date.now() - editingMsg.timestampObj.getTime();
      if (timeDiff >= 5 * 60 * 1000) {
        showToast('Edit time limit (5 mins) has expired');
        setEditingMsg(null);
        setInputText('');
        return;
      }
      try {
        await api.chats.updateMessage(room.id, editingMsg.id, {
          content: text,
          edited: true,
        });
        setMessages(prev => prev.map(m =>
          m.id === editingMsg.id ? { ...m, text, edited: true } : m
        ));
        notifyParticipants(text, 'edit');
      } catch { showToast('Failed to edit message'); }
      setEditingMsg(null);
      return;
    }

    const msgData: Record<string,any> = {
      chatId:room.id, senderId:cu.uid, senderName:myName||'You',
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`,
      type:'text', text, timestamp: new Date().toISOString(), edited:false, reactions:{}, status:'sending', starred:false,
    };
    const replyTarget = replyingTo;
    if (replyTarget) {
      msgData.replyTo = {
        id:replyTarget.id,
        text: replyTarget.isVoiceNote ? '🎤 Voice note' : (replyTarget.imageUrl ? '📷 Photo' : replyTarget.text),
        senderName:replyTarget.sender, type:replyTarget.type, imageUrl:replyTarget.imageUrl,
      };
      setReplyingTo(null);
    }

    const optimisticMessage: ChatMessage = {
      ...msgData,
      id: msgData.id,
      senderId: cu.uid,
      sender: myName || 'You',
      text,
      type: 'text',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      senderColor: getSenderColor(cu.uid, themeName === 'light'),
      imageUrl: null,
      isVoiceNote: false,
      isSystem: false,
      audioUrl: null,
      timestampObj: new Date(msgData.timestamp),
      reactions: {},
      replyTo: msgData.replyTo || null,
      isDeleted: false,
      viewOnce: false,
      viewOnceViewed: false,
      status: 'sending',
      edited: false,
      starred: false,
      pinned: false,
    };
    setMessages(prev => [optimisticMessage, ...prev.filter(message => message.id !== optimisticMessage.id)]);

    try {
      await dispatchSendMessage(room.id, {
        content: text,
        type: 'text',
        reply_to: msgData.replyTo?.id || replyTarget?.id,
        ...msgData,
      });
      setMessages(prev => prev.map(message => message.id === msgData.id ? { ...message, status: 'sent' } : message));
      notifyParticipants(text, 'new');
    } catch {
      await queueMessage(msgData);
      setMessages(prev => prev.map(message => message.id === msgData.id ? { ...message, status: 'failed' } : message));
      showToast('No connection — message queued ⏳');
    }
  };
  const pickImage = async (useCamera: boolean) => {
    setAttachMenuVisible(false);
    setTimeout(async () => {
      try {
        const perm = useCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Permission Required',
            `Please allow access to your ${useCamera ? 'camera' : 'photos'} to send images.`
          );
          return;
        }
        const result = useCamera
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'] as any,
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'] as any,
              quality: 0.8,
              allowsMultipleSelection: true,
            });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPreviewMediaList(result.assets);
          setPreviewCaption('');
          setPreviewViewOnce(false);
        }
      } catch (err) {
        console.error('pickImage error:', err);
        showToast('Could not open image picker');
      }
    }, 350);
  };

  const pickVideo = async () => {
    setAttachMenuVisible(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Permission Required',
            'Please allow access to your videos to share video clips.'
          );
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'] as any,
          quality: 0.8,
          videoMaxDuration: 1800, // up to 30 min videos
        });
        if (!result.canceled && result.assets?.[0]) {
          const cu = currentUser;
          if (!cu || !room?.id) return;
          const asset = result.assets[0];
          if (asset.fileSize && asset.fileSize > 150 * 1024 * 1024) {
            Alert.alert(
              'Video Too Large',
              'The selected video exceeds the 150 MB upload limit. Please select a shorter or more compressed video.'
            );
            return;
          }
          const optimisticVideoId = 'pending-video-' + Date.now();
          try {
            setIsUploading(true);
            showToast('Uploading video…');
            // Optimistic insert with local URI so user sees it immediately
            const optimisticVideo: ChatMessage = {
              id: optimisticVideoId,
              senderId: cu.uid,
              sender: myName || 'You',
              text: '🎥 Video',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isMe: true,
              senderColor: getSenderColor(cu.uid, themeName === 'light'),
              type: 'video',
              videoUrl: asset.uri, // local URI for immediate preview
              imageUrl: null,
              audioUrl: null,
              isVoiceNote: false,
              isSystem: false,
              timestampObj: new Date(),
              status: 'sending',
              reactions: {},
              replyTo: null,
              edited: false,
              isDeleted: false,
              starred: false,
              viewOnce: false,
              viewOnceViewed: false,
              pinned: false,
            };
            setMessages(prev => [optimisticVideo, ...prev]);
            const videoUrl = await uploadImageToCloudinary(asset.uri, 'video');
            await dispatchSendMessage(room.id, {
              content: '🎥 Video',
              type: 'video',
              videoUrl,
              media_url: videoUrl,
            });
            // Update optimistic message to final URL + sent status
            setMessages(prev => prev.map(m => m.id === optimisticVideoId ? { ...m, videoUrl, status: 'sent' } : m));
            notifyParticipants('🎥 Video');
          } catch {
            setMessages(prev => prev.map(m => m.id === optimisticVideoId ? { ...m, status: 'failed' } : m));
            showToast('Failed to send video');
          } finally {
            setIsUploading(false);
          }
        }
      } catch (err) {
        console.error('pickVideo error:', err);
        showToast('Could not open video picker');
      }
    }, 350);
  };

  const sendPreviewMedia = async () => {
    if (!previewMediaList || previewMediaList.length === 0) return;
    const assets = [...previewMediaList];
    const caption = previewCaption;
    const viewOnce = previewViewOnce;
    setPreviewMediaList(null);

    const cu = currentUser;
    if (!cu || !room?.id) return;
    const pendingItems = assets.map((asset, index) => ({
      id: 'pending-' + Date.now() + '-' + index,
      uri: asset.uri,
      type: 'image' as const,
      caption: index === 0 ? caption : '',
    }));
    setPendingMedia(prev => [...prev, ...pendingItems]);
    for (const item of pendingItems) {
      try {
        const imageUrl = await uploadImageToCloudinary(item.uri);
        const data: Record<string,any> = {
          chatId: room.id, senderId: cu.uid, senderName: myName || 'You',
          type: 'image', imageUrl, text: item.caption,
          timestamp: new Date().toISOString(), edited: false, reactions: {}, status: 'sent',
          viewOnce, viewOnceViewed: false,
        };
        if (replyingTo && item === pendingItems[0]) {
          data.replyTo = { id: replyingTo.id, text: '📷 Photo', senderName: replyingTo.sender };
        }
        await dispatchSendMessage(room.id, {
          content: item.caption || '📷 Photo',
          type: 'image',
          media_url: imageUrl,
          reply_to: replyingTo?.id,
          viewOnce,
          ...data,
        });
        notifyParticipants(viewOnce ? '🔁 View once photo' : (item.caption ? `📷 ${item.caption}` : '📷 Photo'));
      } catch (err) {
        showToast('Failed to send image');
      } finally {
        setPendingMedia(prev => prev.filter(m => m.id !== item.id));
      }
    }
    if (replyingTo) setReplyingTo(null);
  };
  const handleReact = async (emoji: string) => {
    if (!selectedMsg || !currentUser) return;
    const uid = currentUser.uid;
    const current = selectedMsg.reactions[uid];
    setActionVisible(false);
    try {
      setMessages(prev => prev.map(m => {
        if (m.id === selectedMsg.id) {
          const reactions = { ...m.reactions };
          if (current === emoji) delete reactions[uid];
          else reactions[uid] = emoji;
          return { ...m, reactions };
        }
        return m;
      }));
    } catch { showToast('Failed to react'); }
  };

  const handleCopy = () => {
    if (!selectedMsg?.text) return;
    setActionVisible(false);
    try {
      const { Clipboard } = require('react-native');
      Clipboard.setString(selectedMsg.text);
    } catch {
    }
    showToast('Copied to clipboard');
  };

  const onMessageLongPress = (msg: ChatMessage) => {
    if (selectedMessageIds.size > 0) {
      toggleSelectMessage(msg.id);
    } else {
      setSelectedMsg(msg);
      setActionVisible(true);
    }
  };

  const handleDelete = () => {
    if (!selectedMsg || !currentUser) return;
    const isMyMsg = selectedMsg.senderId === myId || selectedMsg.senderId === currentUser.uid || selectedMsg.isMe;
    const targetMsgId = selectedMsg.id;
    const targetRoomId = room?.id || incomingRoom?.id || deepLinkRoomId;
    setActionVisible(false);

    const deleteForMe = () => {
      setMessages(prev => prev.filter(m => m.id !== targetMsgId));
      showToast('Message deleted for you');
    };

    const deleteForEveryone = async () => {
      setMessages(prev => prev.map(m => m.id === targetMsgId ? { ...m, isDeleted: true, text: 'This message was deleted' } : m));
      showToast('Message deleted');
      try {
        const res = await api.chats.deleteMessage(targetRoomId, targetMsgId);
        if (res && ((res as any).success || !(res as any).error)) {
          notifyParticipants('This message was deleted', 'delete');
        } else {
          showToast((res as any)?.error || 'Failed to delete');
        }
      } catch (err: any) {
        showToast(err?.message || 'Failed to delete');
      }
    };

    if (isMyMsg || isGroupAdmin) {
      Alert.alert(
        'Delete message?',
        'Would you like to delete this for everyone or just for yourself?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete for me', onPress: deleteForMe },
          { text: isGroupAdmin && !isMyMsg ? 'Delete for everyone (Admin)' : 'Delete for everyone', style: 'destructive', onPress: deleteForEveryone },
        ]
      );
    } else {
      Alert.alert(
        'Delete message?',
        'Delete this message from your chat?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete for me', style: 'destructive', onPress: deleteForMe },
        ]
      );
    }
  };

  const toggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedMessageIds.size === 0 || !currentUser) return;
    const count = selectedMessageIds.size;
    const selectedList = messages.filter(m => selectedMessageIds.has(m.id));
    const allMine = selectedList.every(m => m.senderId === currentUser.uid || m.isMe || isGroupAdmin);

    const executeDelete = async (forEveryone: boolean) => {
      const targetRoomId = room?.id || incomingRoom?.id || deepLinkRoomId;
      const idsToDelete = Array.from(selectedMessageIds);
      setSelectedMessageIds(new Set());

      // Optimistic update
      setMessages(prev => prev.map(m => {
        if (idsToDelete.includes(m.id)) {
          return forEveryone ? { ...m, isDeleted: true, text: 'This message was deleted' } : m;
        }
        return m;
      }).filter(m => forEveryone || !idsToDelete.includes(m.id)));

      showToast(count === 1 ? 'Message deleted' : `${count} messages deleted`);

      for (const msgId of idsToDelete) {
        try {
          if (forEveryone) {
            await api.chats.deleteMessage(targetRoomId, msgId).catch(() => {});
          }
        } catch {}
      }
    };

    if (allMine) {
      Alert.alert(
        count === 1 ? 'Delete message?' : `Delete ${count} messages?`,
        'Would you like to delete for everyone or just for yourself?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete for me', onPress: () => executeDelete(false) },
          { text: 'Delete for everyone', style: 'destructive', onPress: () => executeDelete(true) },
        ]
      );
    } else {
      Alert.alert(
        count === 1 ? 'Delete message?' : `Delete ${count} messages?`,
        'Delete these messages from your chat?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete for me', style: 'destructive', onPress: () => executeDelete(false) },
        ]
      );
    }
  };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setMsgLimit(prev => prev + 30);
  };

  const openViewOnce = async (msg: ChatMessage) => {
    if (!msg.imageUrl) return;
    setViewOnceUri(msg.imageUrl);
    setViewOnceMsgId(msg.id);
    setViewOnceVisible(true);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, viewOnceViewed: true } : m));
  };
  const saveImageToDevice = async (uri: string) => {
    try {
      showToast('Saving…');
      if (uri.startsWith('file://') || uri.startsWith('content://')) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Save or share image' });
        } else {
          showToast('Image saved to device');
        }
        return;
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      if (baseDir) {
        try {
          const dirInfo = await FileSystem.getInfoAsync(baseDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
          }
        } catch {}
      }

      const filename = `rehearsalhub_${Date.now()}.jpg`;
      const localUri = `${baseDir}${filename}`;
      const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedUri, { mimeType: 'image/jpeg', dialogTitle: 'Save or share image' });
      } else {
        showToast('Saved to app folder');
      }
    } catch (e) {
      console.error('Save error', e);
      showToast('Failed to save image');
    }
  };
  const pickDocument = async () => {
    setAttachMenuVisible(false);
    setTimeout(async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const cu = currentUser;
        if (!cu || !room?.id) return;
        
        const isAudio = asset.mimeType?.startsWith('audio/') || !!asset.name.match(/\.(mp3|wav|m4a|aac|ogg|opus|amr|flac|wma)$/i);
        const msgType = isAudio ? 'audio' : 'document';
        const optimisticDocId = 'pending-doc-' + Date.now();

        // Insert optimistic message immediately so user sees the file card
        const optimisticDoc: ChatMessage = {
          id: optimisticDocId,
          senderId: cu.uid,
          sender: myName || 'You',
          text: asset.name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: true,
          senderColor: getSenderColor(cu.uid, themeName === 'light'),
          type: msgType,
          imageUrl: null,
          audioUrl: isAudio ? asset.uri : null,
          documentUrl: !isAudio ? asset.uri : undefined,
          documentName: !isAudio ? asset.name : undefined,
          documentSize: asset.size,
          isVoiceNote: false,
          isSystem: false,
          timestampObj: new Date(),
          status: 'sending',
          reactions: {},
          replyTo: null,
          edited: false,
          isDeleted: false,
          starred: false,
          viewOnce: false,
          viewOnceViewed: false,
          pinned: false,
          duration: isAudio ? '0:00' : undefined,
        };
        setMessages(prev => [optimisticDoc, ...prev]);

        showToast(`Sending ${asset.name}…`);
        setIsUploading(true);
        const uploadedUrl = await uploadImageToCloudinary(asset.uri, isAudio ? 'video' : 'raw');

        await dispatchSendMessage(room.id, {
          content: isAudio ? '🎧 Audio' : `📄 ${asset.name}`,
          type: msgType,
          media_url: uploadedUrl,
          ...(isAudio ? { audioUrl: uploadedUrl, duration: '0:00' } : { documentUrl: uploadedUrl, documentName: asset.name, documentSize: asset.size }),
        });

        // Update optimistic message with final URL
        setMessages(prev => prev.map(m => m.id === optimisticDocId ? {
          ...m,
          status: 'sent',
          audioUrl: isAudio ? uploadedUrl : m.audioUrl,
          documentUrl: !isAudio ? uploadedUrl : m.documentUrl,
        } : m));

        notifyParticipants(isAudio ? `🎧 Audio` : `📄 ${asset.name}`);
      } catch (e) {
        console.error('Document pick error', e);
        showToast('Failed to send file');
      } finally {
        setIsUploading(false);
      }
    }, 350);
  };
  const handleDocumentTap = async (msg: ChatMessage) => {
    const docUrl = msg.documentUrl || (msg as any).mediaUrl;
    if (!docUrl) {
      showToast('No document available');
      return;
    }

    // 1. If it's a video file -> open in our own in-app video previewer!
    const isVideo =
      msg.type === 'video' ||
      /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(docUrl) ||
      /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(msg.documentName || '') ||
      /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(msg.text || '');

    if (isVideo) {
      setVideoViewerUri(docUrl);
      return;
    }

    // 2. If it's an image file -> open in our in-app image previewer!
    const isImage =
      msg.type === 'image' ||
      /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(docUrl) ||
      /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(msg.documentName || '') ||
      /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(msg.text || '');

    if (isImage) {
      setImgViewerUri(docUrl);
      setImgViewerVisible(true);
      return;
    }

    try {
      // 3. If it's already a local file (e.g., newly picked asset), share directly
      if (docUrl.startsWith('file://') || docUrl.startsWith('content://')) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(docUrl);
        } else {
          showToast('File stored on device');
        }
        return;
      }

      // 4. If it's an Office spreadsheet or document from Cloudflare R2 (e.g. .xlsx, .docx)
      // Google Docs Viewer reliably parses and renders these on mobile screens:
      const isOfficeDoc =
        /\.(xlsx|xls|docx|doc|pptx|ppt)$/i.test(docUrl) ||
        /\.(xlsx|xls|docx|doc|pptx|ppt)$/i.test(msg.documentName || '');

      if (isOfficeDoc && docUrl.startsWith('http')) {
        showToast('Opening document…');
        const googleDocsViewer = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(docUrl)}`;
        try {
          await WebBrowser.openBrowserAsync(googleDocsViewer);
          return;
        } catch {
          Linking.openURL(googleDocsViewer).catch(() => Linking.openURL(docUrl));
          return;
        }
      }

      // 5. Open remote PDF or file in native in-app browser viewer
      showToast('Opening document…');
      try {
        await WebBrowser.openBrowserAsync(docUrl);
        return;
      } catch (browserErr) {
        console.warn('WebBrowser open failed, falling back to Linking:', browserErr);
      }

      // 6. Fallback: open via system browser or external viewer
      const canOpen = await Linking.canOpenURL(docUrl);
      if (canOpen) {
        await Linking.openURL(docUrl);
      } else {
        showToast('Cannot open document on this device');
      }
    } catch (e) {
      console.error('Document tap error:', e);
      if (docUrl.startsWith('http')) {
        Linking.openURL(docUrl).catch(() => showToast('Failed to open document'));
      } else {
        showToast('Failed to open document');
      }
    }
  };

  const handleForward = () => {
    if (!selectedMsg) return;
    setActionVisible(false);

    let forwardVal = selectedMsg.text || '';
    if (selectedMsg.type === 'image' && selectedMsg.imageUrl) {
      forwardVal = selectedMsg.imageUrl;
    } else if (selectedMsg.type === 'video' && selectedMsg.videoUrl) {
      forwardVal = selectedMsg.videoUrl;
    } else if (selectedMsg.type === 'audio' && selectedMsg.audioUrl) {
      forwardVal = selectedMsg.audioUrl;
    } else if (selectedMsg.type === 'document' && selectedMsg.documentUrl) {
      forwardVal = selectedMsg.documentUrl;
    }

    navigation.navigate('NewChat', {
      forwardMessage: forwardVal,
      forwardType: selectedMsg.type,
      forwardDocumentName: selectedMsg.documentName || null,
      forwardDocumentSize: selectedMsg.documentSize || null,
      forwardSongData: selectedMsg.songData ? JSON.stringify(selectedMsg.songData) : null,
      forwardPlaylistData: selectedMsg.playlistData ? JSON.stringify(selectedMsg.playlistData) : null,
    });
  };
  const handleInputChange = (text: string) => {
    setInputText(text);
    const atIdx = text.lastIndexOf('@');
    if (atIdx !== -1 && text[atIdx - 1] !== '@') {
      const query = text.slice(atIdx + 1).toLowerCase();
      const participants = Object.entries(room?.participantDetails || {})
        .filter(([uid]) => uid !== currentUser?.uid)
        .map(([uid, details]: [string, any]) => ({ id: uid, name: details.name || 'Unknown' }))
        .filter(p => p.name.toLowerCase().includes(query));
      setMentionQuery(query);
      setMentionSuggestions(participants.slice(0, 5));
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }
  };

  const insertMention = (person: {id:string;name:string}) => {
    const atIdx = inputText.lastIndexOf('@');
    const newText = inputText.slice(0, atIdx) + `@${person.name} `;
    setInputText(newText);
    setMentionQuery(null);
    setMentionSuggestions([]);
  };
  const handleArchiveChat = async () => {
    if (!room?.id || !currentUser) return;
    try {
      const newVal = !isArchived;
      await api.chats.updateChat(room.id, { archived: newVal });
      setIsArchived(newVal);
      showToast(newVal ? 'Chat archived' : 'Chat unarchived');
    } catch { showToast('Failed to archive chat'); }
  };

  const handleMarkUnread = async () => {
    if (!room?.id || !currentUser) return;
    try {
      // unread
      showToast('Marked as unread');
      navigation.goBack();
    } catch { showToast('Failed'); }
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Clear all messages from this chat on your device? Other participants will still see the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear for me',
        style: 'destructive',
        onPress: async () => {
          try {
            setMessages([]);
            await AsyncStorage.removeItem(`chat_msgs_${room.id}`);
            await AsyncStorage.removeItem(`cached_messages_${room.id}`);
            if (currentUser?.uid) {
              await AsyncStorage.setItem(`cleared_at_${currentUser.uid}_${room.id}`, String(Date.now()));
            }
            showToast('Chat cleared on this device');
          } catch {
            Alert.alert('Error', 'Failed to clear chat');
          }
        },
      },
    ]);
  };
  const handleSetDisappearing = async (seconds: number | null) => {
    if (!room?.id) return;
    try {
      await api.chats.updateChat(room.id, { disappearingTimer: seconds });
      await api.chats.sendMessage(room.id, {
        content: seconds ? `${myName} turned on disappearing messages` : `${myName} turned off disappearing messages`,
        type: 'system',
      });
    } catch { showToast('Failed to set disappearing messages'); }
  };
  const handleSendPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      showToast('Add a question and at least 2 options');
      return;
    }
    const cu = currentUser;
    if (!cu || !room?.id) return;
    try {
      const options = pollOptions.filter(o => o.trim()).map(o => ({ text: o.trim(), votes: [] }));
      await dispatchSendMessage(room.id, {
        content: `📊 Poll: ${pollQuestion.trim()}`,
        type: 'poll',
        pollOptions: options,
      });
      notifyParticipants(`📊 Poll: ${pollQuestion.trim()}`);
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollModal(false);
    } catch { showToast('Failed to send poll'); }
  };

  const handlePollVote = async (msgId: string, optionIndex: number, currentOptions: any[]) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updatedOptions = currentOptions.map((opt: any, i: number) => ({
      ...opt,
      votes: i === optionIndex
        ? (opt.votes.includes(uid) ? opt.votes.filter((v: string) => v !== uid) : [...opt.votes, uid])
        : opt.votes.filter((v: string) => v !== uid), // remove from others (single-choice)
    }));
    try {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pollOptions: updatedOptions } : m));
    } catch { showToast('Failed to vote'); }
  };
  const handleBlockUser = async () => {
    if (!currentUser || isGroup || !room?.id) return;
    const otherUid = Object.keys(room.participantDetails || {}).find((id: string) => id !== currentUser.uid) || room.id.split('_').find((id: string) => id !== currentUser.uid);
    if (!otherUid) return;
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      isBlocked ? 'Unblock this user?' : 'Block this user? They will not be able to send you messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isBlocked) {
                await api.chats.updateChat(room.id, { unblock: currentUser.uid });
                setIsBlocked(false);
                showToast('User unblocked');
              } else {
                await api.chats.updateChat(room.id, { block: currentUser.uid });
                setIsBlocked(true);
                showToast('User blocked');
              }
              setActionVisible(false);
            } catch { showToast('Failed'); }
          }
        }
      ]
    );
  };
  const handleReport = async () => {
    if (!selectedMsg || !currentUser) return;
    Alert.alert(
      'Report Message',
      'Report this message to admins?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.reports.submit({
                reporterId: currentUser.uid,
                reporterName: myName,
                messageId: selectedMsg.id,
                messageText: selectedMsg.text,
                senderId: selectedMsg.senderId,
                chatId: room?.id,
              });
              setActionVisible(false);
              showToast('Message reported to admins ✅');
            } catch { showToast('Failed to report'); }
          }
        }
      ]
    );
  };
  const handlePickWallpaper = async () => {
    setShowWallpaperModal(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const uri = result.assets[0].uri;
      setChatWallpaperUri(uri);
      await AsyncStorage.setItem(`wallpaper_${room?.id}`, uri);
      showToast('Wallpaper set!');
    }
  };

  const handleRemoveWallpaper = async () => {
    setChatWallpaperUri(null);
    await AsyncStorage.removeItem(`wallpaper_${room?.id}`);
    setShowWallpaperModal(false);
    showToast('Wallpaper removed');
  };
  useEffect(() => {
    if (!room?.id) return;
    AsyncStorage.getItem(`wallpaper_${room.id}`).then(uri => {
      if (uri) setChatWallpaperUri(uri);
    }).catch(() => {});
    AsyncStorage.getItem(`wallpaper_opacity_${room.id}`).then(val => {
      if (val) setChatWallpaperOpacity(parseFloat(val));
    }).catch(() => {});
  }, [room?.id]);
  const TENOR_KEY = 'AIzaSyDvKGdgr3FKrwkHjsXRF_fWrHKk4S9D2mI'; // free demo key
  const searchGifs = async (q: string) => {
    setGifLoading(true);
    try {
      const endpoint = q.trim() 
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=rehearsalhub&limit=20`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=rehearsalhub&limit=20`;

      const res = await fetch(endpoint);
      const json = await res.json();
      const results = (json.results || []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || '',
        preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || r.media_formats?.gif?.url || '',
      })).filter((r: any) => r.url);
      setGifResults(results);
    } catch { showToast('Failed to load GIFs'); }
    finally { setGifLoading(false); }
  };

  const sendGif = async (gifUrl: string) => {
    const cu = currentUser;
    if (!cu || !room?.id) return;
    setShowGifPicker(false);
    try {
      await dispatchSendMessage(room.id, {
        content: '🎞️ GIF',
        type: 'image',
        media_url: gifUrl,
      });
      notifyParticipants('🎞️ GIF');
    } catch { showToast('Failed to send GIF'); }
  };
  useEffect(() => {
    if (!room?.id) return;
    api.chats.getById(room.id).then(res => {
      if (res?.success && res.data) {
        const d = res.data;
        setSlowModeSeconds(d.slowMode || 0);
        setDisappearingTimer(d.disappearingTimer || null);
      }
    }).catch(() => {});
  }, [room?.id]);
  const handleGenerateJoinLink = async () => {
    if (!room?.id) return;
    try {
      const linkCode = room.id.slice(-8).toUpperCase();
      const link = `https://www.loveworldsingersrehearsalhubportal.org/join/${room.id}?code=${linkCode}`;
      await api.chats.updateChat(room.id, { joinLink: link, joinLinkCode: linkCode });
      setJoinLink(link);
      setShowJoinLinkModal(true);
    } catch { showToast('Failed to generate link'); }
  };
  const handleShareContact = async (contactProfile: {uid:string;name:string;avatar:string}) => {
    const cu = currentUser;
    if (!cu || !room?.id) return;
    try {
      await dispatchSendMessage(room.id, {
        content: `📇 ${contactProfile.name}`,
        type: 'contact_share',
        contactData: contactProfile,
      });
      notifyParticipants(`📇 Contact: ${contactProfile.name}`);
      setShowContactShareModal(false);
    } catch { showToast('Failed to share contact'); }
  };
  const handleSwipeReply = (msg: ChatMessage) => {
    if (msg.isDeleted || msg.isSystem) return;
    setReplyingTo(msg);
  };

  const startCall = async (type: 'voice' | 'video') => {
    const cu = currentUser;
    if (!room || !cu) return;

    let targetUids: string[] = [];
    let roomTitle = room.name || '';
    let callAvatar = '';

    if (isGroup) {
      const allGroupUids = Array.from(new Set([
        ...(Array.isArray(room.participants) ? room.participants : []),
        ...Object.keys(room.participantDetails || {}),
        ...((room as any).participantIds || []),
      ])).filter((id: string) => id && id !== cu.uid && id !== 'system');

      targetUids = allGroupUids;
      callAvatar = room.avatar || '';
    } else {
      const otherUid = Object.keys(room.participantDetails || {}).find((id: string) => id !== cu.uid)
        || (Array.isArray(room.participants) ? room.participants.find((id: string) => id !== cu.uid) : null)
        || room.id.split('_').find((id: string) => id !== cu.uid) || '';
      if (otherUid) targetUids = [otherUid];
      const otherDetails = room.participantDetails?.[targetUids[0]] || {};
      roomTitle = otherDetails.name || roomTitle;
      callAvatar = otherDetails.avatar || '';
    }

    if (targetUids.length === 0) {
      Alert.alert('Cannot start call', 'No other participants found in this chat.');
      return;
    }

    const myDetails = room.participantDetails?.[cu.uid] || {};
    const displayNameToUse = myName || myDetails.name || 'Someone';
    const callerNameToUse = myName || myDetails.name || 'Me';

    try {
      // For backend calls table, receiverId must be a valid User ID
      const targetReceiverId = targetUids[0] || cu.uid;
      const callRes = await api.calls.create({
        receiverId: targetReceiverId,
        receiver_id: targetReceiverId,
        participantIds: targetUids,
        type,
        chatId: room.id,
        chat_id: room.id,
        callerName: callerNameToUse,
        caller_name: callerNameToUse,
        callerAvatar: myDetails.avatar || '',
        caller_avatar: myDetails.avatar || '',
      });
      const callData = callRes?.data || { id: 'call_' + Date.now() };

      // Alert all group participants via push notification
      sendPushNotification(
        targetUids,
        isGroup ? `${roomTitle}: Group ${type} call` : `Incoming ${type} call`,
        isGroup ? `${displayNameToUse} started a group ${type} call` : `${callerNameToUse} is calling...`,
        {
          screen: 'Call',
          callId: callData.id,
          callType: type,
          isGroupCall: isGroup,
          roomId: room.id,
          contactName: isGroup ? roomTitle : callerNameToUse,
          contactAvatar: isGroup ? callAvatar : (myDetails.avatar || ''),
          contactId: isGroup ? room.id : cu.uid,
        }
      ).catch(() => {});

      await api.chats.sendMessage(room.id, {
        content: isGroup ? `${displayNameToUse} started a group ${type} call` : `📞 ${type} call started`,
        type: isGroup ? 'group_call' : 'system',
        callType: type,
        callId: callData.id,
      });

      navigation.navigate('Call', {
        callId: callData.id,
        callType: type,
        contactId: isGroup ? room.id : targetUids[0],
        contactName: roomTitle,
        contactAvatar: callAvatar,
        roomId: room.id,
        isIncoming: false,
        isGroupCall: isGroup,
        participants: targetUids,
        participantDetails: room.participantDetails || {},
      });
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to initiate the call. Please try again.');
    }
  };

  const endCall = async () => {
    setCallVisible(false);
  };

  const fmtCallDur = (s: number) => {

    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m<10?'0':''}${m}:${sec<10?'0':''}${sec}`;
    return `${m}:${sec<10?'0':''}${sec}`;
  };
  const renderMessage = ({ item: msg, index }: { item: ChatMessage; index: number }) => {
    return (
      <ChatMessageBubble
        msg={msg}
        index={index}
        memoizedMessages={memoizedMessages}
        isGroup={isGroup}
        theme={theme}
        APP_THEME={APP_THEME}
        styles={styles}
        currentUser={currentUser}
        selectedMessageIds={selectedMessageIds}
        highlightedMsgId={highlightedMsgId}
        expandedMsgs={expandedMsgs}
        playingId={playingId}
        isAudioPlaying={isAudioPlaying}
        waveformData={waveformData}
        navigation={navigation}
        room={room}
        swipeRefs={swipeRefs}
        flashRef={flashRef}
        toggleSelectMessage={toggleSelectMessage}
        setSelectedMsg={setSelectedMsg}
        setActionVisible={setActionVisible}
        setReplyingTo={setReplyingTo}
        setHighlightedMsgId={setHighlightedMsgId}
        setExpandedMsgs={setExpandedMsgs}
        setImgViewerUri={setImgViewerUri}
        setImgViewerVisible={setImgViewerVisible}
        setVideoViewerUri={setVideoViewerUri}
        openViewOnce={openViewOnce}
        onMessageLongPress={onMessageLongPress}
        handleDocumentTap={handleDocumentTap}
        handlePollVote={handlePollVote}
        retryMessage={retryMessage}
        playAudio={playAudio}
        seekAudio={seekAudio}
      />
    );
  };
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

      <SafeAreaView style={{ flex:1 }}>
        <ChatHeaderBar
          selectedMessageIds={selectedMessageIds}
          messages={messages}
          onClearSelection={() => setSelectedMessageIds(new Set())}
          onSelectAll={() => {
            const allIds = new Set(messages.map(m => m.id));
            setSelectedMessageIds(allIds);
          }}
          onDeleteSelected={handleDeleteSelected}
          isSearching={isSearching}
          searchQuery={searchQuery}
          onStartSearch={() => setIsSearching(true)}
          onCloseSearch={() => {
            setIsSearching(false);
            setSearchQuery('');
          }}
          onChangeSearchQuery={setSearchQuery}
          room={room}
          roomTitle={roomTitle}
          roomAvatarUri={roomAvatarUri}
          isGroup={isGroup}
          currentUser={currentUser}
          typingUsers={typingUsers}
          onBack={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('ChatList');
          }}
          onOpenChatInfo={() => navigation.navigate('ChatInfo', { room })}
          onStartCall={startCall}
          onOpenMenu={() => setChatMenuVisible(true)}
          theme={theme}
          APP_THEME={APP_THEME}
          styles={styles}
        />
        <ChatOptionsMenuModal
          visible={chatMenuVisible}
          onClose={() => setChatMenuVisible(false)}
          isGroup={isGroup}
          isArchived={isArchived}
          isBlocked={isBlocked}
          theme={theme}
          APP_THEME={APP_THEME}
          onNavigateChatInfo={() => navigation.navigate('ChatInfo', { room })}
          onArchiveChat={handleArchiveChat}
          onMarkUnread={handleMarkUnread}
          onClearChat={handleClearChat}
          onBlockUser={handleBlockUser}
        />
        {toastMsg && (
          <Animated.View style={[styles.toast, { opacity: toastAnim, transform:[{ translateY: toastAnim.interpolate({ inputRange:[0,1], outputRange:[-10,0] }) }] }]}>
            <Ionicons name="information-circle" size={18} color={APP_THEME.primaryAccent} style={{ marginRight:6 }} />
            <Text style={[styles.toastText, { color:APP_THEME.primaryText }]}>{toastMsg}</Text>
          </Animated.View>
        )}
        <KeyboardAvoidingView
          style={{ flex:1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ flex:1, backgroundColor: APP_THEME.chatWallpaper }}>
            {chatWallpaperUri ? (
              <Image source={{ uri: chatWallpaperUri }} style={[StyleSheet.absoluteFillObject, { opacity: chatWallpaperOpacity }]} contentFit="cover" autoplay={false} priority="high" cachePolicy="memory-disk" />
            ) : bgSource ? (
              <Image source={bgSource} style={[StyleSheet.absoluteFillObject, { opacity: themeName === 'light' ? 0.9 : 0.25 }]} contentFit="cover" autoplay={false} priority="high" cachePolicy="memory-disk" />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { opacity: themeName === 'light' ? 0.04 : 0.02, overflow: 'hidden' }]} pointerEvents="none">
                {Array.from({ length: 15 }).map((_, row) =>
                  Array.from({ length: 8 }).map((_, col) => {
                    const iconList = ['musical-notes-outline', 'musical-note-outline', 'mic-outline', 'headset-outline', 'radio-outline', 'recording-outline', 'play-circle-outline', 'volume-medium-outline'];
                    const iconName = iconList[(row * 8 + col) % iconList.length] as any;
                    return (
                      <View key={`${row}-${col}`} style={{
                        position: 'absolute',
                        top: row * 60 + (col % 2 === 0 ? 0 : 30),
                        left: col * 60,
                        transform: [{ rotate: `${(row * col * 17) % 360}deg` }]
                      }}>
                        <Ionicons name={iconName} size={24} color={theme.colors.textPrimary} />
                      </View>
                    );
                  })
                )}
              </View>
            )}


            {messagesLoadError ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                <Ionicons name="cloud-offline-outline" size={48} color={APP_THEME.secondaryText} />
                <Text style={{ color: APP_THEME.secondaryText, marginTop: 12, textAlign: 'center' }}>
                  Could not load messages
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMessagesLoadError(null);
                    setIsInitialLoading(true);
                    setListenerRetryKey((key) => key + 1);
                  }}
                  style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: APP_THEME.primaryAccent, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Tap to Retry</Text>
                </TouchableOpacity>
              </View>
            ) : isInitialLoading ? (
              <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
                <ActivityIndicator size="large" color={APP_THEME.primaryAccent} />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <FlashList
                  ref={flashRef}
                  style={{ transform: [{ scaleY: -1 }] }}
                  data={memoizedMessages}
                  extraData={highlightedMsgId}
                  renderItem={renderMessage}
                  keyExtractor={(item, index) => (item?.id ? String(item.id) : `msg-${index}`)}
                  // @ts-ignore
                  estimatedItemSize={100}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={[APP_THEME.primaryAccent]}
                    tintColor={APP_THEME.primaryAccent}
                  />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.1}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={false}
                updateCellsBatchingPeriod={50}
                onScrollToIndexFailed={(info: any) => {
                  setTimeout(() => {
                    flashRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                  }, 100);
                }}
                ListFooterComponent={isLoadingMore ? (
                  <View style={{ paddingVertical:12, alignItems:'center', transform: [{ scaleY: -1 }] }}>
                    <ActivityIndicator size="small" color={APP_THEME.primaryAccent} />
                  </View>
                ) : null}
                ListHeaderComponent={
                  (pendingMedia.length > 0 || typingUsers.length > 0) ? (
                    <View style={{ gap: 8, paddingBottom: 8, transform: [{ scaleY: -1 }] }}>
                      <TypingBubble typingUsers={typingUsers} isGroup={isGroup} theme={theme} APP_THEME={APP_THEME} />
                      {pendingMedia.map((m) => (
                        <View key={m.id} style={[styles.msgRow, styles.msgRowMe]}>
                          <View style={[styles.bubble, { backgroundColor: APP_THEME.outgoingBubble, alignSelf: 'flex-end', padding: 4, borderRadius: 12 }]}>
                            <View>
                              <Image source={{ uri: m.uri }} style={{ width: SCREEN_WIDTH*0.65, height: SCREEN_WIDTH*0.65, borderRadius:8, opacity: 0.7 }} contentFit="cover" />
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#ffffff" />
                              </View>
                            </View>
                            {m.caption ? <Text style={[styles.msgText, { color:APP_THEME.primaryText, marginTop:6, paddingHorizontal:4, paddingBottom: 2 }]}>{m.caption}</Text> : null}
                            <View style={m.caption ? { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', marginRight: 4, marginBottom: 2 } : styles.tsOverlay}>
                              <Ionicons name="time-outline" size={11} color={m.caption ? APP_THEME.secondaryText : theme.colors.textPrimary} style={{ marginLeft: 4 }} />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null
                }
                contentContainerStyle={{ paddingHorizontal:10, paddingVertical:8 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
              </View>
            )}
          </View>
          <ChatInputDeck
            inputText={inputText}
            onChangeText={handleInputChange}
            onSend={handleSend}
            isRecording={isRecording}
            liveBars={liveBars}
            recDuration={recDuration}
            startRecording={startRecording}
            stopRecording={stopRecording}
            cancelRecording={cancelRecording}
            pickDocument={pickDocument}
            openAttachMenu={() => setAttachMenuVisible(true)}
            pickImage={pickImage}
            isUploading={isUploading}
            replyingTo={replyingTo}
            editingMsg={editingMsg}
            onCancelReplyOrEdit={() => {
              setReplyingTo(null);
              if (editingMsg) {
                setEditingMsg(null);
                setInputText('');
              }
            }}
            mentionQuery={mentionQuery}
            mentionSuggestions={mentionSuggestions}
            onInsertMention={insertMention}
            isDirectRequest={isDirectRequest}
            hasAccepted={hasAccepted}
            roomTitle={roomTitle}
            onAcceptRequest={async () => {
              try {
                setHasAccepted(true);
                if (room) {
                  room.isAccepted = true;
                  (room as any).isRequest = false;
                }
                if (currentUser?.uid && room?.id) {
                  await AsyncStorage.setItem(`chat_accepted_${currentUser.uid}_${room.id}`, 'true').catch(() => {});
                }
                await api.chats.acceptRequest(room?.id);
                showToast('Request accepted');
              } catch {
                setHasAccepted(true);
              }
            }}
            onDeclineRequest={async () => {
              try {
                await api.chats.declineRequest(room?.id);
                navigation.goBack();
              } catch {
                navigation.goBack();
              }
            }}
            onBlockUser={handleBlockUser}
            theme={theme}
            APP_THEME={APP_THEME}
            styles={styles}
          />
        </KeyboardAvoidingView>
        <ChatMessageActionSheet
          visible={actionVisible}
          onClose={() => setActionVisible(false)}
          sheetAnim={sheetAnim}
          selectedMsg={selectedMsg}
          currentUser={currentUser}
          isGroup={isGroup}
          APP_THEME={APP_THEME}
          styles={styles}
          onReact={handleReact}
          onReply={(msg) => { setReplyingTo(msg); setActionVisible(false); }}
          onForward={handleForward}
          onSelect={(msgId) => {
            setActionVisible(false);
            if (msgId) {
              setSelectedMessageIds(new Set([msgId]));
            }
          }}
          onCopy={handleCopy}
          onEdit={(msg) => {
            setEditingMsg(msg);
            setInputText(msg.text);
            setActionVisible(false);
          }}
          onInfo={() => {
            setActionVisible(false);
            setShowMessageInfo(true);
          }}
          onDelete={handleDelete}
          onReport={handleReport}
          onSaveToGallery={(uri) => {
            setActionVisible(false);
            saveImageToDevice(uri);
          }}
        />
        <ChatMessageInfoModal
          visible={showMessageInfo}
          onClose={() => setShowMessageInfo(false)}
          selectedMsg={selectedMsg}
          chatData={chatData}
          currentUser={currentUser}
          insets={insets}
          theme={theme}
          APP_THEME={APP_THEME}
        />
        <ChatVideoModal uri={videoViewerUri} onClose={() => setVideoViewerUri(null)} />
        <ChatImageViewerModal
          visible={imgViewerVisible}
          uri={imgViewerUri}
          onClose={() => setImgViewerVisible(false)}
          onSave={(uri) => saveImageToDevice(uri)}
        />
        <ChatViewOnceModal
          visible={viewOnceVisible}
          uri={viewOnceUri}
          timer={viewOnceTimer}
          onClose={() => setViewOnceVisible(false)}
        />
        <ChatAttachMenuModal
          visible={attachMenuVisible}
          onClose={() => setAttachMenuVisible(false)}
          onPickDocument={pickDocument}
          onPickCamera={() => pickImage(true)}
          onPickGallery={() => pickImage(false)}
          onPickVideo={pickVideo}
          theme={theme}
          styles={styles}
        />
        <ChatMediaPreviewModal
          visible={!!previewMediaList}
          mediaList={previewMediaList}
          caption={previewCaption}
          isViewOnce={previewViewOnce}
          isUploading={isUploading}
          onClose={() => setPreviewMediaList(null)}
          onChangeCaption={setPreviewCaption}
          onToggleViewOnce={() => setPreviewViewOnce(p => !p)}
          onSend={sendPreviewMedia}
          screenWidth={SCREEN_WIDTH}
        />


      </SafeAreaView>
    </View>
  );
}

