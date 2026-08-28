import { apiClient } from '../lib/apiClient';
import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Modal, Animated, Dimensions, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncAvatar } from './SyncAvatar';
import { useUserStore } from '../hooks/useUser';
import { cleanSenderName } from './chat';
import { uploadImageToCloudinary } from '../lib/cloudinary';

const { height: H, width: W } = Dimensions.get('window');

interface SongShare {
  id: string;
  title: string;
  leadSinger?: string;
  program?: string;
  key?: string;
  tempo?: string;
  audioUrl?: string;
  image?: any;
  imageUrl?: string;
  collectionName?: string;
  zoneId?: string;
}

interface ChatRoom {
  id: string;
  title: string;
  avatar?: string;
  isGroup: boolean;
  participantDetails?: Record<string, any>;
  participants?: string[];
  lastTimestamp?: number;
}

interface PlaylistShare {
  id: string;
  name: string;
  songs: SongShare[];
}

interface Props {
  visible: boolean;
  song?: SongShare | null;
  songs?: SongShare[] | null;
  playlist?: PlaylistShare | null;
  take?: any | null;
  profileShare?: any | null;
  onClose: () => void;
}

export function ShareToChatSheet({ visible, song, songs, playlist, take, profileShare, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const T = theme.colors;

  const [note, setNote] = useState('');
  const [commentMode, setCommentMode] = useState<'at_once' | 'each'>('at_once');
  const [eachNotes, setEachNotes] = useState<Record<string, string>>({});
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const slideAnim = useRef(new Animated.Value(H)).current;

  const songsToComment = playlist
    ? playlist.songs
    : (songs && songs.length > 1 ? songs : []);

  useEffect(() => {
    if (visible) {
      setNote('');
      setEachNotes({});
      setCommentMode('at_once');
      setSelected(new Set());
      setSent(false);
      loadChats();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 16,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadChats = async () => {
    const cu = useUserStore.getState().user;
    if (!cu) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/chats').catch(() => null);
      const snap = { docs: (res?.data || []).map((d: any) => ({ id: d.id, data: () => d })) };
      const list: ChatRoom[] = [];
      (snap.docs || []).forEach((d: any) => {
        const data = d.data();
        const isGroup = data.type === 'group';
        let title = data.name || 'Chat';
        let avatar: string | undefined;
        if (!isGroup) {
          const otherId = (data.participants || []).find((id: string) => id !== cu.uid);
          if (otherId && data.participantDetails?.[otherId]) {
            title = data.participantDetails[otherId].name || 'Direct Chat';
            avatar = data.participantDetails[otherId].avatar;
          }
        } else {
          avatar = data.avatar;
        }
        const rawTs = data.lastMessage?.timestamp;
        let lastTimestamp = 0;
        if (rawTs?.toDate) {
          lastTimestamp = rawTs.toDate().getTime();
        } else if (rawTs?.seconds) {
          lastTimestamp = rawTs.seconds * 1000;
        } else if (typeof rawTs === 'number') {
          lastTimestamp = rawTs;
        } else if (data.createdAt?.toDate) {
          lastTimestamp = data.createdAt.toDate().getTime();
        } else {
          lastTimestamp = Date.now();
        }

        list.push({ id: d.id, title, avatar, isGroup, participantDetails: data.participantDetails, participants: data.participants, lastTimestamp });
      });
      list.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      setChats(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    const songsToShare = songs && songs.length > 0 ? songs : (song ? [song] : []);
    if (selected.size === 0 || (songsToShare.length === 0 && !playlist && !take && !profileShare)) return;
    const cu = useUserStore.getState().user;
    if (!cu) return;
    setSending(true);

    const profile = useUserStore.getState().profile;
    const myName = cleanSenderName(
      profile 
        ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') 
        : ((cu as any)?.displayName || (cu as any)?.name || "Me" || '')
    );

    const cleanAudioUrl = (url: string) => {
      if (!url || !url.includes('cloudinary.com')) return url;
      return url.replace(/\/upload\/[^/]+\//, '/upload/');
    };

    try {
      const selectedChats = chats.filter(c => selected.has(c.id));

      for (const chat of selectedChats) {
        if (profileShare) {
          const profileNote = note.trim();
          const text = [
            `👤 *Contact: ${profileShare.name || profileShare.displayName || 'Singer'}*`,
            profileShare.role ? `Role: ${profileShare.role}` : '',
            profileShare.zoneName ? `Zone: ${profileShare.zoneName}` : '',
            profileNote ? `\n💬 ${profileNote}` : '',
          ].filter(Boolean).join('\n');
          await apiClient.post(`/chats/${chat.id}/messages`, {
            content: text,
            text,
            type: 'contact_share',
            profileData: profileShare,
            contactData: profileShare,
          }).catch(() => {});
        } else if (take) {
          const audioUrl = await uploadImageToCloudinary(take.uri, 'video');
          await apiClient.post(`/chats/${chat.id}/messages`, {
            content: '🎤 Voice note',
            text: '🎤 Voice note',
            type: 'voice',
            media_url: audioUrl,
            audioUrl,
            voiceUrl: audioUrl,
          }).catch(() => {});
        } else if (playlist) {
          let playlistNote = commentMode === 'at_once' ? note.trim() : '';
          let text = [
            `💽 *Playlist: ${playlist.name}*`,
            `Link: https://rehearsalhub.com/playlist/${playlist.id}`,
            `${playlist.songs.length} songs`,
            playlistNote ? `\n💬 ${playlistNote}` : '',
          ].filter(Boolean).join('\n');

          await apiClient.post(`/chats/${chat.id}/messages`, {
            content: text,
            text,
            type: 'playlist_share',
            playlistData: playlist,
          }).catch(() => {});
        } else if (songsToShare.length > 0) {
          for (let i = 0; i < songsToShare.length; i++) {
            const currentSong = songsToShare[i];
            let songNote = '';
            if (commentMode === 'each') {
              songNote = (eachNotes[currentSong.id] || '').trim();
            } else {
              songNote = note.trim();
            }

            let text = [
              `🎵 *${currentSong.title}*`,
              `Link: https://rehearsalhub.com/song/${currentSong.id}`,
              currentSong.leadSinger ? `👤 ${currentSong.leadSinger}` : '',
              currentSong.program ? `📀 ${currentSong.program}` : '',
              currentSong.key ? `🎼 Key: ${currentSong.key}` : '',
              currentSong.tempo ? `⏱ Tempo: ${currentSong.tempo}` : '',
              songNote ? `\n💬 ${songNote}` : '',
            ].filter(Boolean).join('\n');

            await apiClient.post(`/chats/${chat.id}/messages`, {
              content: text,
              text,
              type: 'song_share',
              songData: currentSong,
            }).catch(() => {});
          }
        }

// unread count updated

        let lastMsgText = '';
        if (profileShare) {
          lastMsgText = `👤 Contact: ${profileShare.name}`;
        } else if (take) {
          lastMsgText = `🎤 Voice note`;
        } else if (playlist) {
          lastMsgText = `💽 ${playlist.name}`;
        } else if (songsToShare.length === 1) {
          lastMsgText = `🎵 ${songsToShare[0].title}`;
        } else if (songsToShare.length > 1) {
          lastMsgText = `🎵 Shared ${songsToShare.length} songs`;
        }

        // chatRef updated
      }

      setSent(true);
      setTimeout(() => { onClose(); }, 1200);
    } catch (e) {
      console.error('Share to chat error', e);
    } finally {
      setSending(false);
    }
  };

  if (!visible && !song && (!songs || songs.length === 0) && !playlist && !take && !profileShare) return null;

  const showSong = song || (songs && songs.length === 1 ? songs[0] : null);
  const showMultipleSongs = songs && songs.length > 1;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share to Chat</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>

          {profileShare && (
            <View style={styles.previewCard}>
              <View style={styles.previewArt}>
                <SyncAvatar userId={profileShare.id} initialAvatar={profileShare.avatar} fallbackName={profileShare.name} size={60} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{profileShare.name}</Text>
                <Text style={styles.previewSub} numberOfLines={1}>{profileShare.role || 'Member'}</Text>
                {profileShare.zone ? <Text style={styles.previewProg} numberOfLines={1}>{profileShare.zone}</Text> : null}
              </View>
            </View>
          )}

          {take && (
            <View style={styles.previewCard}>
              <View style={styles.previewArt}>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="mic" size={28} color={T.accent} />
                </View>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{take.name}</Text>
                <Text style={styles.previewSub} numberOfLines={1}>Recorded Take</Text>
              </View>
            </View>
          )}

          {showSong && !take && (
            <View style={styles.previewCard}>
              <View style={styles.previewArt}>
                {showSong.image ? (
                  <Image source={showSong.image} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={28} color={T.accent} />
                  </View>
                )}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                <Ionicons name="musical-note" size={16} color={theme.colors.textSecondary} style={{ position: 'absolute', top: 6, right: 6 }} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{showSong.title}</Text>
                {showSong.leadSinger ? <Text style={styles.previewSub} numberOfLines={1}>{showSong.leadSinger}</Text> : null}
                {showSong.program ? <Text style={styles.previewProg} numberOfLines={1}>{showSong.program}</Text> : null}
                <View style={styles.previewTags}>
                  {showSong.key ? <View style={styles.tag}><Text style={styles.tagText}>{showSong.key}</Text></View> : null}
                  {showSong.tempo ? <View style={styles.tag}><Text style={styles.tagText}>{showSong.tempo}</Text></View> : null}
                  {showSong.audioUrl ? (
                    <View style={[styles.tag, { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' }]}>
                      <Ionicons name="headset" size={10} color={T.success} />
                      <Text style={[styles.tagText, { color: T.success }]}>Audio</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {showMultipleSongs && (
            <View style={styles.previewCard}>
              <View style={styles.previewArt}>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-notes" size={28} color={T.accent} />
                </View>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{songs!.length} Songs Selected</Text>
                <Text style={styles.previewSub} numberOfLines={2}>
                  {songs!.map(s => s.title).join(', ')}
                </Text>
              </View>
            </View>
          )}

          {playlist && (
            <View style={styles.previewCard}>
              <View style={styles.previewArt}>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="albums" size={28} color={T.accent} />
                </View>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={1}>{playlist.name}</Text>
                <Text style={styles.previewSub} numberOfLines={1}>Playlist • {playlist.songs.length} songs</Text>
              </View>
            </View>
          )}

          {songsToComment.length > 1 && (
            <View style={styles.modeToggleContainer}>
              <TouchableOpacity
                style={[styles.modeToggleBtn, commentMode === 'at_once' && styles.modeToggleBtnActive]}
                onPress={() => setCommentMode('at_once')}
              >
                <Text style={[styles.modeToggleText, commentMode === 'at_once' && styles.modeToggleTextActive]}>
                  Comment on all
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeToggleBtn, commentMode === 'each' && styles.modeToggleBtnActive]}
                onPress={() => setCommentMode('each')}
              >
                <Text style={[styles.modeToggleText, commentMode === 'each' && styles.modeToggleTextActive]}>
                  Comment on each
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {commentMode === 'at_once' ? (
            <View style={styles.noteWrap}>
              <TextInput
                style={styles.noteInput}
                placeholder={playlist ? "Add a note to this playlist… (optional)" : profileShare ? "Add a note about this contact… (optional)" : "Add a note… (optional)"}
                placeholderTextColor={T.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={200}
              />
            </View>
          ) : (
            <View style={styles.eachNotesContainer}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                {songsToComment.map((s) => (
                  <View key={s.id} style={styles.eachNoteRow}>
                    <Text style={styles.eachNoteTitle} numberOfLines={1}>{s.title}</Text>
                    <TextInput
                      style={styles.eachNoteInput}
                      placeholder="Comment…"
                      placeholderTextColor={T.textMuted}
                      value={eachNotes[s.id] || ''}
                      onChangeText={(val) => setEachNotes(prev => ({ ...prev, [s.id]: val }))}
                      maxLength={150}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.listLabel}>Send to</Text>
          {loading ? (
            <ActivityIndicator color={T.accent} style={{ paddingVertical: 20 }} />
          ) : (
            <FlatList
              data={chats}
              keyExtractor={item => item.id}
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                const otherUid = !item.isGroup
                  ? (Object.keys(item.participantDetails || {}).find(id => id !== useUserStore.getState().user?.uid))
                  : undefined;
                return (
                  <TouchableOpacity
                    style={[styles.chatRow, isSelected && styles.chatRowSelected]}
                    onPress={() => toggleSelect(item.id)}
                    activeOpacity={0.75}
                  >
                    <SyncAvatar
                      userId={otherUid}
                      initialAvatar={item.avatar}
                      fallbackName={item.title}
                      isGroup={item.isGroup}
                      size={42}
                      bgColor={item.isGroup ? '#00a884' : T.accent}
                    />
                    <Text style={styles.chatName} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleOn]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.bottomTabBorder, marginLeft: 66 }} />}
            />
          )}

          <View style={styles.footer}>
            {sent ? (
              <View style={[styles.sendBtn, { backgroundColor: T.success }]}>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.sendBtnText}>Sent!</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sendBtn, selected.size === 0 && { opacity: 0.4 }]}
                onPress={handleSend}
                disabled={selected.size === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#ffffff" />
                    <Text style={styles.sendBtnText}>
                      Send{selected.size > 0 ? ` to ${selected.size}` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const getStyles = (theme: any, insets: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.colors.bottomSheetBackground,
      overflow: 'hidden',
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingBottom: Math.max(Platform.OS === 'android' ? 36 : 24, insets.bottom + (Platform.OS === 'android' ? 28 : 12)),
      borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.bottomTabBorder,
      shadowColor: theme.colors.background, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 24,
    },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.colors.cardBackgroundLight, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: T.textPrimary },
    closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.cardBackground, justifyContent: 'center', alignItems: 'center' },
    previewCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: T.cardBackground, borderRadius: 14, padding: 10, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: T.bottomTabBorder },
    previewArt: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: T.backgroundSecondary, position: 'relative' },
    previewInfo: { flex: 1 },
    previewTitle: { fontSize: 15, fontWeight: '700', color: T.textPrimary, marginBottom: 2 },
    previewSub: { fontSize: 12, color: T.accent, fontWeight: '600', marginBottom: 1 },
    previewProg: { fontSize: 11, color: T.textSecondary, marginBottom: 6 },
    previewTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(192,132,252,0.1)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
    tagText: { fontSize: 10, color: T.accent, fontWeight: '600' },
    noteWrap: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 16, marginBottom: 12, backgroundColor: T.cardBackground, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: T.bottomTabBorder },
    noteInput: { flex: 1, color: T.textPrimary, fontSize: 14, maxHeight: 80 },
    listLabel: { fontSize: 11, fontWeight: '700', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 18, marginBottom: 6 },
    chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
    chatRowSelected: { backgroundColor: 'rgba(192,132,252,0.08)' },
    chatName: { flex: 1, fontSize: 15, fontWeight: '600', color: T.textPrimary },
    checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.textMuted, justifyContent: 'center', alignItems: 'center' },
    checkCircleOn: { backgroundColor: T.accent, borderColor: T.accent },
    footer: { paddingHorizontal: 16, paddingTop: 12 },
    sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.accent, paddingVertical: 14, borderRadius: 14, shadowColor: T.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
    sendBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    modeToggleContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.cardBackgroundLight,
      borderRadius: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 3,
    },
    modeToggleBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
    },
    modeToggleBtnActive: {
      backgroundColor: theme.colors.accent,
    },
    modeToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: T.textSecondary,
    },
    modeToggleTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },
    eachNotesContainer: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: T.cardBackground,
      borderRadius: 14,
      padding: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: T.bottomTabBorder,
    },
    eachNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: T.bottomTabBorder,
    },
    eachNoteTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: T.textPrimary,
      flex: 0.45,
    },
    eachNoteInput: {
      flex: 0.55,
      height: 36,
      backgroundColor: theme.colors.cardBackgroundLight,
      borderRadius: 8,
      paddingHorizontal: 10,
      color: T.textPrimary,
      fontSize: 12,
    },
  });
};
