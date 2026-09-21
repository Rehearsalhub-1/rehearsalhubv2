import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { SyncAvatar } from '../SyncAvatar';
import { resolveMediaUrl } from '../../lib/mediaUtils';
import CustomLinkPreview from './CustomLinkPreview';
import {
  VoiceNoteCard,
  AudioFileCard,
  SongShareCard,
  PlaylistShareCard,
  ProfileShareCard,
  GroupCallCard,
  isOnlyEmojis,
} from './index';
import type { ChatMessage } from './ChatTypes';
import { navigateToPlayer } from '../../navigation/navigationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLLAPSE_THRESHOLD = 320;

export interface ChatMessageBubbleProps {
  msg: ChatMessage;
  index: number;
  memoizedMessages: ChatMessage[];
  isGroup: boolean;
  theme: any;
  APP_THEME: any;
  styles: any;
  currentUser: any;
  selectedMessageIds: Set<string>;
  highlightedMsgId: string | null;
  expandedMsgs: Set<string>;
  playingId: string | null;
  isAudioPlaying: boolean;
  waveformData: Record<string, number[]>;
  navigation: any;
  room: any;
  swipeRefs: React.MutableRefObject<Record<string, Swipeable | null>>;
  flashRef: React.MutableRefObject<any>;
  toggleSelectMessage: (id: string) => void;
  setSelectedMsg: (msg: ChatMessage) => void;
  setActionVisible: (visible: boolean) => void;
  setReplyingTo: (msg: ChatMessage) => void;
  setHighlightedMsgId: (id: string | null) => void;
  setExpandedMsgs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setImgViewerUri: (uri: string) => void;
  setImgViewerVisible: (visible: boolean) => void;
  setVideoViewerUri: (uri: string) => void;
  openViewOnce: (msg: ChatMessage) => void;
  onMessageLongPress: (msg: ChatMessage) => void;
  handleDocumentTap: (msg: ChatMessage) => void;
  handlePollVote: (msgId: string, optIndex: number, pollOptions: any[]) => void;
  retryMessage: (msgId: string) => void;
  playAudio: (url: string, id: string) => void;
  seekAudio: (msgId: string, ratio: number) => void | Promise<void>;
}

const ReplyPreview = ({
  replyTo,
  onPress,
  styles,
  APP_THEME,
}: {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  onPress?: () => void;
  styles: any;
  APP_THEME: any;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.quoteBox}>
    <Text style={[styles.quoteName, { color: APP_THEME.primaryAccent }]}>{replyTo.senderName}</Text>
    {replyTo.imageUrl ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Image source={{ uri: replyTo.imageUrl }} style={{ width: 36, height: 36, borderRadius: 4 }} contentFit="cover" />
        <Text style={[styles.quoteText, { color: APP_THEME.secondaryText }]}>📷 Photo</Text>
      </View>
    ) : (
      <Text style={[styles.quoteText, { color: APP_THEME.secondaryText }]} numberOfLines={2}>
        {replyTo.text || '🎤 Voice note'}
      </Text>
    )}
  </TouchableOpacity>
);

function ChatMessageBubble({
  msg,
  index,
  memoizedMessages,
  isGroup,
  theme,
  APP_THEME,
  styles,
  currentUser,
  selectedMessageIds,
  highlightedMsgId,
  expandedMsgs,
  playingId,
  isAudioPlaying,
  waveformData,
  navigation,
  room,
  swipeRefs,
  flashRef,
  toggleSelectMessage,
  setSelectedMsg,
  setActionVisible,
  setReplyingTo,
  setHighlightedMsgId,
  setExpandedMsgs,
  setImgViewerUri,
  setImgViewerVisible,
  setVideoViewerUri,
  openViewOnce,
  onMessageLongPress,
  handleDocumentTap,
  handlePollVote,
  retryMessage,
  playAudio,
  seekAudio,
}: ChatMessageBubbleProps) {
  if (!msg || msg.isSystem) return null;

  const TickIcon = ({ status }: { status: ChatMessage['status'] }) => {
    if (status === 'sending')
      return <Ionicons name="time-outline" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
    if (status === 'failed')
      return <Ionicons name="alert-circle-outline" size={13} color="#ef4444" style={{ marginLeft: 3 }} />;
    if (status === 'read')
      return <Ionicons name="checkmark-done" size={13} color={APP_THEME.tickColorRead} style={{ marginLeft: 3 }} />;
    if (status === 'delivered')
      return <Ionicons name="checkmark-done" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
    return <Ionicons name="checkmark" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
  };

  const ts = (msg.timestampObj && typeof msg.timestampObj.getTime === 'function' && !isNaN(msg.timestampObj.getTime()))
    ? msg.timestampObj
    : ((msg as any).createdAt ? new Date((msg as any).createdAt) : new Date());
  const curDate = ts.toDateString();

  const nextMsg = index < memoizedMessages.length - 1 ? memoizedMessages[index + 1] : null;
  const nextTs = (nextMsg?.timestampObj && typeof nextMsg.timestampObj.getTime === 'function' && !isNaN(nextMsg.timestampObj.getTime()))
    ? nextMsg.timestampObj
    : ((nextMsg as any)?.createdAt ? new Date((nextMsg as any).createdAt) : null);
  const prevDate = nextTs ? nextTs.toDateString() : '';

  const showDate = curDate !== prevDate && msg.status !== 'sending';
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const dateLbl = curDate === now.toDateString()
    ? 'TODAY'
    : curDate === yest.toDateString()
      ? 'YESTERDAY'
      : ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  const reactionEntries = Object.entries(msg?.reactions || {});
  const reactionSummary = [...new Set(Object.values(msg?.reactions || {}))].join('');

  const renderBoldText = (text: string) => {
    const boldRegex = /\*([^*]+)\*/g;
    const parts = text.split(boldRegex);
    if (parts.length === 1) {
      return text;
    }
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return (
          <Text key={`bold-${idx}`} style={{ fontWeight: 'bold' }}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const renderParsedText = (text: string, defaultColor: string, isMe: boolean) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+|rehearsalhub:\/\/[^\s]+|exp:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    if (parts.length === 1) {
      return renderBoldText(text);
    }
    return parts.map((part, pIdx) => {
      if (part.match(urlRegex)) {
        const isSongLink = part.toLowerCase().includes('/song/') || part.toLowerCase().includes('/songs/') || part.toLowerCase().includes('rehearsalhub://song/');
        const isPlaylistLink = part.toLowerCase().includes('/playlist/') || part.toLowerCase().includes('/playlists/') || part.toLowerCase().includes('rehearsalhub://playlist/');
        const isProfileLink = part.toLowerCase().includes('/profile/') || part.toLowerCase().includes('/profiles/') || part.toLowerCase().includes('/user/') || part.toLowerCase().includes('rehearsalhub://user/');

        let label = part;
        let onPress = () => {
          Linking.openURL(part).catch(() => {});
        };

        if (isSongLink) {
          const songId = part.split('/').filter(Boolean).pop()?.split('?')[0] || '';
          label = `🎵 Listen to Song`;
          onPress = () => {
            navigation.navigate('Player', {
              activeTrack: { id: songId },
              fromAllSongs: true,
            });
          };
        } else if (isPlaylistLink) {
          const playlistId = part.split('/').filter(Boolean).pop()?.split('?')[0] || '';
          label = `💽 Open Playlist`;
          onPress = () => {
            navigation.navigate('Playlists', {
              openPlaylistId: playlistId,
            });
          };
        } else if (isProfileLink) {
          const userId = part.split('/').filter(Boolean).pop()?.split('?')[0] || '';
          label = `👤 View Profile`;
          onPress = () => {
            navigation.navigate('UserProfile', {
              userId,
            });
          };
        }

        return (
          <Text
            key={`link-${pIdx}`}
            style={{
              color: isMe ? '#ffffff' : APP_THEME.primaryAccent,
              textDecorationLine: 'underline',
              fontWeight: 'bold',
            }}
            onPress={onPress}
          >
            {label}
          </Text>
        );
      }
      return renderBoldText(part);
    });
  };

  const renderTextBubble = (message: ChatMessage) => {
    const fullText = message.text;
    const isLong = fullText.length > COLLAPSE_THRESHOLD;
    const isExpanded = expandedMsgs.has(message.id);
    const displayText = isLong && !isExpanded
      ? fullText.slice(0, COLLAPSE_THRESHOLD).trimEnd() + '…'
      : fullText;
    const textColor = message.isMe ? APP_THEME.outgoingText : APP_THEME.incomingText;
    const subTextColor = message.isMe ? `${APP_THEME.outgoingText}aa` : APP_THEME.secondaryText;

    return (
      <View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Text style={[styles.msgText, { color: textColor, flexShrink: 1 }]}>
            {renderParsedText(displayText, textColor, message.isMe)}
          </Text>
          {(!isLong || isExpanded) && (
            <View style={styles.tsBubbleRow}>
              {message.edited && (
                <Text style={[styles.tsText, { color: subTextColor, fontStyle: 'italic', marginRight: 3 }]}>
                  edited
                </Text>
              )}
              <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{message.time}</Text>
              {message.isMe && <TickIcon status={message.status} />}
            </View>
          )}
        </View>
        {message.status === 'failed' && (
          <TouchableOpacity onPress={() => retryMessage(message.id)} style={{ marginTop: 4 }}>
            <Text style={{ color: '#fecaca', fontSize: 11, fontWeight: '700' }}>Tap to retry</Text>
          </TouchableOpacity>
        )}
        {(() => {
          const urlMatch = fullText.match(/(https?:\/\/[^\s]+)/)
            || fullText.match(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})(\/[^\s]*)?)\b/);
          if (!urlMatch) return null;
          const rawUrl = urlMatch[1];
          const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
          return (
            <CustomLinkPreview
              url={url}
              isMe={message.isMe}
              accentColor={APP_THEME.primaryAccent}
              bubbleColor={message.isMe ? APP_THEME.outgoingBubble : APP_THEME.incomingBubble}
            />
          );
        })()}

        {isLong && (
          <TouchableOpacity
            onPress={() => {
              setExpandedMsgs((prev) => {
                const next = new Set(prev);
                if (next.has(message.id)) next.delete(message.id);
                else next.add(message.id);
                return next;
              });
            }}
            style={styles.readMoreRow}
            activeOpacity={0.7}
          >
            <Text style={[styles.readMoreText, { color: APP_THEME.primaryAccent }]}>
              {isExpanded ? 'Read less' : 'Read more'}
            </Text>
            {!isExpanded && (
              <View style={[styles.tsBubbleRow, { marginLeft: 'auto' as any }]}>
                {message.edited && (
                  <Text style={[styles.tsText, { color: APP_THEME.secondaryText, fontStyle: 'italic', marginRight: 3 }]}>
                    edited
                  </Text>
                )}
                <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{message.time}</Text>
                {message.isMe && <TickIcon status={message.status} />}
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ transform: [{ scaleY: -1 }] }}>
      {showDate && (
        <View style={styles.datePillWrap}>
          <View style={[styles.datePill, { backgroundColor: APP_THEME.datePill }]}>
            <Text style={[styles.datePillText, { color: APP_THEME.secondaryText }]}>{dateLbl}</Text>
          </View>
        </View>
      )}
      <Swipeable
        ref={(ref) => {
          swipeRefs.current[msg.id] = ref;
        }}
        onSwipeableWillOpen={() => {
          setReplyingTo(msg);
          swipeRefs.current[msg.id]?.close();
        }}
        renderLeftActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [0, 50, 100, 101],
            outputRange: [-20, 0, 0, 1],
          });
          return (
            <View style={{ justifyContent: 'center', alignItems: 'center', width: 60 }}>
              <Animated.View style={{ transform: [{ translateX: trans }] }}>
                <View
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="arrow-undo" size={20} color={theme.colors.textPrimary} />
                </View>
              </Animated.View>
            </View>
          );
        }}
        friction={2}
        leftThreshold={40}
      >
        <React.Fragment>
          {reactionEntries.length > 0 && (
            <View
              style={[
                styles.reactionPillRow,
                msg.isMe
                  ? { justifyContent: 'flex-end', paddingRight: 8 }
                  : { justifyContent: 'flex-start', paddingLeft: isGroup ? 42 : 8 },
              ]}
            >
              <TouchableOpacity
                style={styles.reactionPill}
                onPress={() => {
                  setSelectedMsg(msg);
                  setActionVisible(true);
                }}
              >
                <Text style={styles.reactionPillText}>
                  {reactionSummary}
                  {reactionEntries.length > 1 && <Text style={styles.reactionCount}> {reactionEntries.length}</Text>}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              styles.msgRow,
              msg.isMe ? styles.msgRowMe : styles.msgRowThem,
              selectedMessageIds.has(msg.id) && {
                backgroundColor: 'rgba(99, 102, 241, 0.18)',
                borderRadius: 8,
                paddingVertical: 2,
              },
            ]}
          >
            {selectedMessageIds.size > 0 && (
              <TouchableOpacity
                onPress={() => toggleSelectMessage(msg.id)}
                style={{ paddingHorizontal: 6, alignSelf: 'center' }}
              >
                <Ionicons
                  name={selectedMessageIds.has(msg.id) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selectedMessageIds.has(msg.id) ? '#25D366' : 'rgba(255,255,255,0.4)'}
                />
              </TouchableOpacity>
            )}
            {!msg.isMe && isGroup && (
              <View style={{ marginRight: 6, alignSelf: 'flex-end', marginBottom: 4 }}>
                <SyncAvatar userId={msg.senderId} fallbackName={msg.sender} size={28} isGroup={false} />
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => {
                if (selectedMessageIds.size > 0) {
                  toggleSelectMessage(msg.id);
                }
              }}
              onLongPress={() => {
                if (selectedMessageIds.size > 0) {
                  toggleSelectMessage(msg.id);
                } else {
                  setSelectedMsg(msg);
                  setActionVisible(true);
                }
              }}
              style={[
                styles.bubble,
                msg.isMe
                  ? {
                      backgroundColor: isOnlyEmojis(msg.text) ? 'transparent' : APP_THEME.outgoingBubble,
                      alignSelf: 'flex-end',
                    }
                  : {
                      backgroundColor: isOnlyEmojis(msg.text) ? 'transparent' : APP_THEME.incomingBubble,
                      alignSelf: 'flex-start',
                    },
                msg.type === 'image' && (!msg.text && !msg.viewOnce ? { backgroundColor: 'transparent', padding: 0 } : { padding: 3, borderRadius: 12 }),
                (msg.type === 'song_share' ||
                  msg.type === 'playlist_share' ||
                  msg.type === 'profile_share' ||
                  msg.type === 'contact_share' ||
                  msg.type === 'group_call' ||
                  msg.type === 'audio' ||
                  (msg.type === 'document' && !!(msg.documentName || msg.text)?.match(/\.(mp3|wav|m4a|aac|ogg|opus|amr|flac|wma)$/i))) && {
                  backgroundColor: 'transparent',
                  padding: 0,
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                },
                isOnlyEmojis(msg.text) && { paddingHorizontal: 2, paddingVertical: 2 },
                highlightedMsgId === msg.id && {
                  backgroundColor: theme.colors.accent + '55',
                  shadowColor: theme.colors.accent,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
            >
              {!msg.isMe && isGroup && <Text style={[styles.senderName, { color: msg.senderColor }]}>{msg.sender}</Text>}
              {msg.replyTo && (
                <ReplyPreview
                  replyTo={msg.replyTo}
                  styles={styles}
                  APP_THEME={APP_THEME}
                  onPress={() => {
                    const replyTargetId = msg.replyTo?.id;
                    if (!replyTargetId) return;
                    const idx = memoizedMessages.findIndex((m) => m.id === replyTargetId);
                    if (idx !== -1) {
                      setHighlightedMsgId(replyTargetId);
                      flashRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                      setTimeout(() => {
                        setHighlightedMsgId(null);
                      }, 1800);
                    } else {
                      Alert.alert('Message not found', 'This message is too old or was deleted.');
                    }
                  }}
                />
              )}
              {(msg as any).forwarded && (
                <View style={styles.forwardedLabel}>
                  <Ionicons name="arrow-redo-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={styles.forwardedText}>Forwarded</Text>
                </View>
              )}
              {msg.isDeleted ? (
                <View style={styles.deletedRow}>
                  <Ionicons name="ban-outline" size={14} color={APP_THEME.secondaryText} style={{ marginRight: 5 }} />
                  <Text style={[styles.msgText, { color: APP_THEME.secondaryText, fontStyle: 'italic', opacity: 0.7 }]}>
                    This message was deleted
                  </Text>
                  <Text style={[styles.tsText, { color: APP_THEME.secondaryText, marginLeft: 6 }]}>{msg.time}</Text>
                </View>
              ) : msg.type === 'image' && msg.imageUrl ? (
                msg.viewOnce ? (
                  msg.viewOnceViewed ? (
                    <View style={styles.viewOnceViewed}>
                      <Ionicons name="eye-off-outline" size={20} color={APP_THEME.secondaryText} />
                      <Text style={[styles.msgText, { color: APP_THEME.secondaryText, marginLeft: 6 }]}>Opened</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.viewOnceBadge} onPress={() => openViewOnce(msg)}>
                      <Ionicons name="eye-outline" size={22} color={theme.colors.textPrimary} />
                      <Text style={styles.viewOnceLabel}>View once</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedMessageIds.size > 0) {
                        toggleSelectMessage(msg.id);
                      } else {
                        setImgViewerUri(msg.imageUrl!);
                        setImgViewerVisible(true);
                      }
                    }}
                    onLongPress={() => onMessageLongPress(msg)}
                    delayLongPress={250}
                  >
                    <Image
                      source={{ uri: msg.imageUrl }}
                      style={{ width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.65, borderRadius: 8 }}
                      contentFit="cover"
                    />
                    {msg.text ? (
                      <Text style={[styles.msgText, { color: APP_THEME.primaryText, marginTop: 6, paddingHorizontal: 4, paddingBottom: 2 }]}>
                        {msg.text}
                      </Text>
                    ) : null}
                    <View style={msg.text ? { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', marginRight: 4, marginBottom: 2 } : styles.tsOverlay}>
                      <Text style={[styles.tsText, { color: msg.text ? APP_THEME.secondaryText : theme.colors.textPrimary }]}>{msg.time}</Text>
                      {msg.isMe && <TickIcon status={msg.status} />}
                    </View>
                  </TouchableOpacity>
                )
              ) : msg.isVoiceNote ? (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => {
                    if (selectedMessageIds.size > 0) toggleSelectMessage(msg.id);
                  }}
                  onLongPress={() => onMessageLongPress(msg)}
                  delayLongPress={250}
                >
                  <VoiceNoteCard
                    msg={{ ...msg, audioUrl: msg.audioUrl || msg.documentUrl || null }}
                    playingId={playingId}
                    isAudioPlaying={isAudioPlaying}
                    playAudio={playAudio}
                    seekAudio={seekAudio}
                    waveformData={waveformData}
                    theme={theme}
                    APP_THEME={APP_THEME}
                    styles={styles}
                  />
                </TouchableOpacity>
              ) : (msg.type === 'audio' || (msg.type === 'document' && !!(msg.documentName || msg.text)?.match(/\.(mp3|wav|m4a|aac|ogg|opus|amr|flac|wma)$/i))) ? (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => {
                    if (selectedMessageIds.size > 0) toggleSelectMessage(msg.id);
                  }}
                  onLongPress={() => onMessageLongPress(msg)}
                  delayLongPress={250}
                >
                  <AudioFileCard
                    msg={msg}
                    playingId={playingId}
                    isAudioPlaying={isAudioPlaying}
                    playAudio={playAudio}
                    seekAudio={seekAudio}
                    theme={theme}
                    APP_THEME={APP_THEME}
                    styles={styles}
                  />
                </TouchableOpacity>
              ) : msg.type === 'song_share' ? (
                <SongShareCard
                  msg={{
                    ...msg,
                    songData: msg.songData || (msg as any).data?.songData || (msg as any).metadata?.songData || {
                      id: (msg.text?.match(/song\/([a-zA-Z0-9_-]+)/i)?.[1]) || 'song_1',
                      title: (msg.text?.match(/🎵\s*\*([^*]+)\*/i)?.[1]?.trim()) || 'Shared Song',
                      leadSinger: (msg.text?.match(/👤\s*([^\n\r]+)/i)?.[1]?.trim()) || 'Singer',
                    },
                  }}
                  playingId={playingId}
                  isAudioPlaying={isAudioPlaying}
                  playAudio={playAudio}
                  seekAudio={seekAudio}
                  navigation={navigation}
                  theme={theme}
                  APP_THEME={APP_THEME}
                  styles={styles}
                />
              ) : msg.type === 'playlist_share' ? (
                <PlaylistShareCard
                  msg={{
                    ...msg,
                    playlistData: msg.playlistData || (msg as any).data?.playlistData || (msg as any).metadata?.playlistData || {
                      id: (msg.text?.match(/playlist\/([a-zA-Z0-9_-]+)/i)?.[1]) || 'favs',
                      name: (msg.text?.match(/💽\s*\*Playlist:\s*([^*]+)\*/i)?.[1]?.trim()) || 'Shared Playlist',
                      songCount: parseInt(msg.text?.match(/(\d+)\s+songs/i)?.[1] || '0'),
                      songs: [],
                    },
                  }}
                  navigation={navigation}
                  theme={theme}
                  APP_THEME={APP_THEME}
                  styles={styles}
                />
              ) : (msg.type === 'profile_share' || msg.type === 'contact_share') ? (
                <ProfileShareCard
                  msg={msg}
                  navigation={navigation}
                  theme={theme}
                  APP_THEME={APP_THEME}
                  styles={styles}
                />
              ) : msg.type === 'group_call' ? (
                <GroupCallCard
                  msg={msg}
                  navigation={navigation}
                  room={room}
                  theme={theme}
                  APP_THEME={APP_THEME}
                  styles={styles}
                />
              ) : msg.type === 'poll' ? (
                <View style={{ padding: 4, minWidth: 240, maxWidth: SCREEN_WIDTH * 0.75 }}>
                  <Text style={{ color: APP_THEME.primaryText, fontSize: 16, fontWeight: '700', marginBottom: 12, lineHeight: 22 }}>
                    📊 {msg.text}
                  </Text>
                  <View style={{ backgroundColor: 'transparent', borderRadius: 8 }}>
                    {(msg as any).pollOptions?.map((opt: any, idx: number) => {
                      const totalVotes = (msg as any).pollOptions.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);
                      const myVotes = opt.votes?.length || 0;
                      const percent = totalVotes > 0 ? (myVotes / totalVotes) * 100 : 0;
                      const hasVoted = opt.votes?.includes(currentUser?.uid || '');
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={{
                            marginBottom: 6,
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: 6,
                            backgroundColor: theme.colors.background === '#000000' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          }}
                          activeOpacity={0.7}
                          onPress={() => handlePollVote(msg.id, idx, (msg as any).pollOptions)}
                        >
                          {totalVotes > 0 && (
                            <View
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${percent}%`,
                                backgroundColor: hasVoted
                                  ? APP_THEME.primaryAccent + '40'
                                  : (theme.colors.background === '#000000' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'),
                              }}
                            />
                          )}

                          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingVertical: 12 }}>
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                borderWidth: 2,
                                borderColor: hasVoted ? APP_THEME.primaryAccent : APP_THEME.secondaryText,
                                marginRight: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: hasVoted ? APP_THEME.primaryAccent : 'transparent',
                              }}
                            >
                              {hasVoted && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={{ color: APP_THEME.primaryText, fontSize: 15, flex: 1, fontWeight: hasVoted ? '600' : '400' }}>
                              {opt.text}
                            </Text>
                            {totalVotes > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                                {myVotes > 0 && (
                                  <View style={{ flexDirection: 'row-reverse', marginRight: 4 }}>
                                    {opt.votes.slice(0, 3).map((vid: string) => (
                                      <View
                                        key={vid}
                                        style={{
                                          width: 16,
                                          height: 16,
                                          borderRadius: 8,
                                          backgroundColor: APP_THEME.secondaryText,
                                          marginLeft: -6,
                                          borderWidth: 1,
                                          borderColor: msg.isMe ? APP_THEME.outgoingBubble : APP_THEME.incomingBubble,
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <SyncAvatar userId={vid} fallbackName="?" size={16} isGroup={false} />
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.tsBubbleRow, { marginTop: 4 }]}>
                    <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>
                      {((msg as any).pollOptions || []).reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0)} votes
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
                    {msg.isMe && <TickIcon status={msg.status} />}
                  </View>
                </View>
              ) : msg.type === 'video' && (msg.videoUrl || (msg as any).mediaUrl) ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (selectedMessageIds.size > 0) {
                      toggleSelectMessage(msg.id);
                    } else {
                      const vUrl = resolveMediaUrl(msg.videoUrl || (msg as any).mediaUrl);
                      if (vUrl) setVideoViewerUri(vUrl);
                    }
                  }}
                  onLongPress={() => onMessageLongPress(msg)}
                  delayLongPress={250}
                  style={{ position: 'relative' }}
                >
                  <View
                    style={{
                      width: SCREEN_WIDTH * 0.65,
                      height: SCREEN_WIDTH * 0.4,
                      borderRadius: 10,
                      backgroundColor: '#000',
                      overflow: 'hidden',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Image
                      source={{ uri: resolveMediaUrl(msg.videoUrl) }}
                      style={{ ...StyleSheet.absoluteFillObject, borderRadius: 10 }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        borderRadius: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {msg.status === 'sending' ? (
                        <ActivityIndicator size="large" color="#fff" />
                      ) : (
                        <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.92)" />
                      )}
                    </View>
                  </View>
                  <View style={styles.tsOverlay}>
                    <Text style={[styles.tsText, { color: '#fff' }]}>{msg.time}</Text>
                    {msg.isMe && <TickIcon status={msg.status} />}
                  </View>
                </TouchableOpacity>
              ) : msg.type === 'document' ? (
                <TouchableOpacity
                  style={styles.docCard}
                  onPress={() => {
                    if (selectedMessageIds.size > 0) {
                      toggleSelectMessage(msg.id);
                    } else {
                      handleDocumentTap(msg);
                    }
                  }}
                  onLongPress={() => onMessageLongPress(msg)}
                  delayLongPress={250}
                  activeOpacity={0.75}
                  disabled={msg.status === 'sending'}
                >
                  <View style={styles.docIconWrap}>
                    {msg.status === 'sending' ? (
                      <ActivityIndicator size="small" color={APP_THEME.primaryAccent} />
                    ) : (
                      <Ionicons name="document-text" size={24} color={APP_THEME.primaryAccent} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.msgText, { color: APP_THEME.primaryText }]} numberOfLines={1}>
                      {msg.documentName || msg.text || 'Document'}
                    </Text>
                    <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>
                      {msg.status === 'sending' ? 'Uploading…' : msg.documentSize ? `${(msg.documentSize / 1024).toFixed(0)} KB` : 'Tap to download'}
                    </Text>
                  </View>
                  <View style={styles.tsBubbleRow}>
                    <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
                    {msg.isMe && <TickIcon status={msg.status} />}
                  </View>
                </TouchableOpacity>
              ) : isOnlyEmojis(msg.text) ? (
                <View>
                  <Text style={{ fontSize: 40, lineHeight: 48 }}>{msg.text}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 }}>
                    <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
                    {msg.isMe && <TickIcon status={msg.status} />}
                  </View>
                </View>
              ) : (
                renderTextBubble(msg)
              )}
            </TouchableOpacity>
          </View>
        </React.Fragment>
      </Swipeable>
    </View>
  );
}

export default memo(ChatMessageBubble, (prev, next) => {
  if (prev.msg !== next.msg) return false;
  if (prev.index !== next.index) return false;
  if (prev.memoizedMessages.length !== next.memoizedMessages.length) return false;

  const prevSelected = prev.selectedMessageIds.has(prev.msg.id);
  const nextSelected = next.selectedMessageIds.has(next.msg.id);
  if (prevSelected !== nextSelected) return false;

  const prevSelectionActive = prev.selectedMessageIds.size > 0;
  const nextSelectionActive = next.selectedMessageIds.size > 0;
  if (prevSelectionActive !== nextSelectionActive) return false;

  const prevHighlighted = prev.highlightedMsgId === prev.msg.id;
  const nextHighlighted = next.highlightedMsgId === next.msg.id;
  if (prevHighlighted !== nextHighlighted) return false;

  const prevExpanded = prev.expandedMsgs.has(prev.msg.id);
  const nextExpanded = next.expandedMsgs.has(next.msg.id);
  if (prevExpanded !== nextExpanded) return false;

  const isAudioMsg =
    prev.msg.isVoiceNote ||
    prev.msg.type === 'audio' ||
    prev.msg.type === 'song_share' ||
    prev.msg.type === 'playlist_share';
  if (isAudioMsg) {
    const prevPlayingThis = prev.playingId === prev.msg.id;
    const nextPlayingThis = next.playingId === next.msg.id;
    if (prevPlayingThis !== nextPlayingThis) return false;
    if (prevPlayingThis && prev.isAudioPlaying !== next.isAudioPlaying) return false;
  }

  if (prev.theme !== next.theme) return false;

  return true;
});
