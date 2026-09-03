import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage, cleanSenderName } from './ChatTypes';
import { LocalAudioSlider, VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import { SyncAvatar } from '../SyncAvatar';
import { useUserStore } from '../../hooks/useUser';
import { api } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CardBaseProps {
  msg: ChatMessage;
  theme: any;
  APP_THEME: any;
  styles: any;
}

export const TickIcon = ({ status, APP_THEME }: { status: ChatMessage['status']; APP_THEME: any }) => {
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

interface AudioFileCardProps extends CardBaseProps {
  playingId: string | null;
  isAudioPlaying: boolean;
  playAudio: (msgId: string, audioUrl: string) => void;
  seekAudio: (msgId: string, value: number) => void;
}

export const AudioFileCard = React.memo(({
  msg, playingId, isAudioPlaying, playAudio, seekAudio, theme, APP_THEME, styles
}: AudioFileCardProps) => {
  return (
    <View style={styles.songShareCard}>
      <View style={styles.songShareHeader}>
        <Ionicons name="headset" size={13} color={APP_THEME.primaryAccent} />
        <Text style={styles.songShareLabel}>Audio File</Text>
      </View>
      <View style={styles.songShareBody}>
        <View style={[styles.songShareIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
          <Ionicons name="headset" size={22} color={theme.colors.success} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.songShareTitle} numberOfLines={2}>{msg.documentName || msg.text || 'Audio File'}</Text>
          {msg.documentSize ? <Text style={[styles.tsText, { color: APP_THEME.secondaryText, marginTop: 2 }]}>{(msg.documentSize / 1024).toFixed(0)} KB</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        style={styles.songSharePlayRow}
        onPress={() => playAudio(msg.id, msg.audioUrl || msg.documentUrl || '')}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: APP_THEME.primaryAccent, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name={playingId === msg.id && isAudioPlaying ? 'pause' : 'play'} size={14} color={theme.colors.textPrimary} style={playingId !== msg.id || !isAudioPlaying ? { marginLeft: 2 } : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.songSharePlayText}>
            {playingId === msg.id && isAudioPlaying ? 'Playing…' : 'Play audio'}
          </Text>
          <LocalAudioSlider
            msgId={msg.id}
            playingId={playingId}
            isAudioPlaying={isAudioPlaying}
            onSeek={(val: number) => seekAudio(msg.id, val)}
            theme={theme}
          />
        </View>
        <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
        {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
      </TouchableOpacity>
    </View>
  );
});

interface SongShareCardProps extends CardBaseProps {
  playingId: string | null;
  isAudioPlaying: boolean;
  playAudio: (msgId: string, audioUrl: string) => void;
  seekAudio: (msgId: string, value: number) => void;
  navigation: any;
}

export const SongShareCard = React.memo(({
  msg, playingId, isAudioPlaying, playAudio, seekAudio, navigation, theme, APP_THEME, styles
}: SongShareCardProps) => {
  if (!msg.songData) return null;
  return (
    <View style={styles.songShareCard}>
      <View style={styles.songShareHeader}>
        <Ionicons name="musical-notes" size={13} color={APP_THEME.primaryAccent} />
        <Text style={styles.songShareLabel}>Song shared</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          navigation.navigate('Player', {
            activeTrack: msg.songData,
            fromAllSongs: true,
          });
        }}
        style={styles.songShareBody}
      >
        <View style={styles.songShareIconWrap}>
          <Ionicons name="musical-note" size={22} color={APP_THEME.primaryAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.songShareTitle} numberOfLines={1}>{msg.songData.title}</Text>
          {msg.songData.leadSinger ? <Text style={styles.songShareSub} numberOfLines={1}>{msg.songData.leadSinger}</Text> : null}
          {msg.songData.program ? <Text style={styles.songShareProg} numberOfLines={1}>{msg.songData.program}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
             {msg.songData.key ? <View style={styles.songShareTag}><Text style={styles.songShareTagText}>{msg.songData.key}</Text></View> : null}
             {msg.songData.tempo ? <View style={styles.songShareTag}><Text style={styles.songShareTagText}>{msg.songData.tempo}</Text></View> : null}
             {(msg.songData.audioUrl || (msg.songData as any).hasAudioIndicator) ? <View style={[styles.songShareTag, { borderColor: 'rgba(16,185,129,0.4)' }]}><Ionicons name="headset" size={9} color={theme.colors.success} /><Text style={[styles.songShareTagText, { color: theme.colors.success }]}>Audio</Text></View> : null}
          </View>
        </View>
      </TouchableOpacity>
      {msg.note ? (
        <View style={styles.songShareNote}>
          <Text style={styles.songShareNoteText}>"{msg.note}"</Text>
        </View>
      ) : null}
      {msg.songData.audioUrl ? (
        <TouchableOpacity
          style={styles.songSharePlayRow}
          onPress={() => {
            playAudio(msg.id, msg.songData!.audioUrl);
          }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: APP_THEME.primaryAccent, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={playingId === msg.id && isAudioPlaying ? 'pause' : 'play'} size={14} color={theme.colors.textPrimary} style={playingId !== msg.id || !isAudioPlaying ? { marginLeft: 2 } : undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.songSharePlayText}>
              {playingId === msg.id && isAudioPlaying ? 'Playing…' : 'Play audio'}
            </Text>
            <LocalAudioSlider
              msgId={msg.id}
              playingId={playingId}
              isAudioPlaying={isAudioPlaying}
              onSeek={(val: number) => seekAudio(msg.id, val)}
              theme={theme}
            />
          </View>
          <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
          {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
        </TouchableOpacity>
      ) : (
        <View style={[styles.tsBubbleRow, { paddingHorizontal: 10, paddingBottom: 8 }]}>
          <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
          {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
        </View>
      )}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: APP_THEME.border }}
        onPress={() => {
          navigation.navigate('Player', {
            activeTrack: msg.songData,
            fromAllSongs: true,
          });
        }}
      >
        <Ionicons name="library-outline" size={14} color={APP_THEME.primaryAccent} />
        <Text style={{ fontSize: 12, color: APP_THEME.primaryAccent, fontWeight: '600' }}>View in Library ›</Text>
      </TouchableOpacity>
    </View>
  );
});

interface PlaylistShareCardProps extends CardBaseProps {
  navigation: any;
}

export const PlaylistShareCard = React.memo(({
  msg, navigation, theme, APP_THEME, styles
}: PlaylistShareCardProps) => {
  if (!msg.playlistData) return null;
  const count = msg.playlistData.songCount !== undefined && msg.playlistData.songCount !== null
    ? msg.playlistData.songCount
    : (Array.isArray(msg.playlistData.songs) ? msg.playlistData.songs.length : 0);

  const handleOpenPlaylist = () => {
    const notesMap: Record<string, string> = {};
    const rawSongs = Array.isArray(msg.playlistData?.songs) ? msg.playlistData.songs : [];
    rawSongs.forEach((s: any) => {
      if (s && typeof s === 'object' && s.id && s.note) notesMap[s.id] = s.note;
    });
    navigation.navigate('Playlists', {
      openPlaylistId: msg.playlistData?.id,
      openPlaylistName: msg.playlistData?.name,
      openPlaylistSongs: rawSongs.map((s: any) => typeof s === 'string' ? s : s.id).filter(Boolean),
      sharedSongs: rawSongs.filter((s: any) => typeof s === 'object' && s.id),
      openPlaylistSongNotes: notesMap,
    });
  };

  return (
    <View style={styles.songShareCard}>
      <View style={styles.songShareHeader}>
        <Ionicons name="albums" size={13} color={APP_THEME.primaryAccent} />
        <Text style={styles.songShareLabel}>Playlist shared</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenPlaylist}
        style={styles.songShareBody}
      >
        <View style={[styles.songShareIconWrap, { backgroundColor: 'rgba(192,132,252,0.15)' }]}>
          <Ionicons name="musical-notes" size={22} color={APP_THEME.primaryAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.songShareTitle} numberOfLines={1}>{msg.playlistData.name || 'Shared Playlist'}</Text>
          <Text style={styles.songShareSub}>{count} {count === 1 ? 'song' : 'songs'}</Text>
          {Array.isArray(msg.playlistData.songs) && msg.playlistData.songs.slice(0, 3).map((s: any, i: number) => (
            <Text key={i} style={[styles.songShareProg, { marginBottom: 1 }]} numberOfLines={1}>
              • {s?.title || (typeof s === 'string' ? s : 'Track')}{s?.note ? ` (💬 ${s.note})` : ''}
            </Text>
          ))}
          {count > 3 && (
            <Text style={[styles.songShareProg, { fontStyle: 'italic' }]}>+{count - 3} more</Text>
          )}
        </View>
      </TouchableOpacity>
      {msg.note ? (
        <View style={styles.songShareNote}>
          <Text style={styles.songShareNoteText}>"{msg.note}"</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: APP_THEME.border }}
        onPress={handleOpenPlaylist}
      >
        <Ionicons name="list-outline" size={14} color={APP_THEME.primaryAccent} />
        <Text style={{ fontSize: 12, color: APP_THEME.primaryAccent, fontWeight: '600' }}>View Playlist ›</Text>
      </TouchableOpacity>
      <View style={[styles.tsBubbleRow, { paddingHorizontal: 10, paddingBottom: 8 }]}>
        <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
        {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
      </View>
    </View>
  );
});

interface GroupCallCardProps extends CardBaseProps {
  navigation: any;
  room: any;
}

export const GroupCallCard = React.memo(({
  msg, navigation, room, theme, APP_THEME, styles
}: GroupCallCardProps) => {
  const isVideo = msg.callType === 'video';

  const handleJoin = () => {
    navigation.navigate('Call', {
      callId: msg.callId || room?.id,
      callType: isVideo ? 'video' : 'voice',
      isIncoming: false,
      contactName: room?.title || room?.name || 'Group Call',
      contactAvatar: room?.avatar || '',
      roomId: room?.id,
      isGroupCall: true,
    });
  };

  return (
    <View style={[
      waCardStyles.cardContainer,
      {
        backgroundColor: msg.isMe 
          ? (APP_THEME.outgoingBubble || '#1e3a8a')
          : (APP_THEME.incomingBubble || '#1f2937'),
        borderColor: msg.isMe ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)',
      }
    ]}>
      {/* Upper Call Header */}
      <View style={waCardStyles.cardBody}>
        <View style={[waCardStyles.avatarWrapper, { backgroundColor: 'rgba(37, 211, 102, 0.15)', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={24} color="#25D366" />
        </View>
        <View style={waCardStyles.infoWrapper}>
          <Text style={[waCardStyles.contactName, { color: APP_THEME.primaryText }]} numberOfLines={1}>
            {isVideo ? 'Group video call' : 'Group voice call'}
          </Text>
          <Text style={[waCardStyles.contactSubtitle, { color: APP_THEME.secondaryText }]} numberOfLines={1}>
            {msg.text || (msg.isMe ? 'You started a call' : 'Tap to join call')}
          </Text>
        </View>
      </View>

      {/* Hairline Separator */}
      <View style={[
        waCardStyles.divider,
        { backgroundColor: msg.isMe ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)' }
      ]} />

      {/* WhatsApp-Style Join Button */}
      <TouchableOpacity
        style={[waCardStyles.actionBtn, { height: 44 }]}
        onPress={handleJoin}
        activeOpacity={0.65}
      >
        <Ionicons name="enter-outline" size={18} color="#25D366" style={{ marginRight: 6 }} />
        <Text style={[waCardStyles.actionTextGreen, { fontSize: 15 }]}>Join call</Text>
      </TouchableOpacity>

      {/* Bottom Timestamp & Tick */}
      <View style={waCardStyles.tsRow}>
        <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
        {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
      </View>
    </View>
  );
});

interface VoiceNoteCardProps extends CardBaseProps {
  playingId: string | null;
  isAudioPlaying: boolean;
  playAudio: (msgId: string, audioUrl: string) => void;
  seekAudio: (msgId: string, ratio: number) => void;
  waveformData: Record<string, number[]>;
}

export const VoiceNoteCard = React.memo(({
  msg, playingId, isAudioPlaying, playAudio, seekAudio, waveformData, theme, APP_THEME, styles
}: VoiceNoteCardProps) => {
  return (
    <View style={styles.voiceContainer}>
      <SyncAvatar userId={msg.senderId} fallbackName={msg.sender} size={36} isGroup={false}
        bgColor={msg.isMe ? APP_THEME.primaryAccent : '#555'} />
      <TouchableOpacity
        onPress={() => { playAudio(msg.id, msg.audioUrl||''); }}
        style={styles.voicePlayBtn}
      >
        <Ionicons name={playingId === msg.id && isAudioPlaying ? 'pause' : 'play'} size={20} color={msg.isMe ? theme.colors.textPrimary : APP_THEME.primaryText} />
      </TouchableOpacity>
      
      <VoiceWaveformVisualizer
        msgId={msg.id}
        playingId={playingId}
        isAudioPlaying={isAudioPlaying}
        rawBars={msg.waveform || waveformData[msg.id] || []}
        duration={msg.duration}
        onSeek={(ratio: number) => seekAudio(msg.id, ratio)}
        styles={styles}
        theme={theme}
        isMe={msg.isMe}
        time={msg.time}
        status={msg.status}
      />
    </View>
  );
});

interface ProfileShareCardProps extends CardBaseProps {
  navigation: any;
}

export const ProfileShareCard = React.memo(({
  msg, navigation, theme, APP_THEME, styles
}: ProfileShareCardProps) => {
  const profileData = msg.profileData || (msg as any).contactData || (msg as any).data?.profileData;
  const contactData = (msg as any).contactData || msg.profileData;

  const extractedName = msg.text?.match(/👤\s*\*Contact:\s*([^*]+)\*/i)?.[1]?.trim()
    || msg.text?.match(/📇\s*([^\n\r]+)/)?.[1]?.trim()
    || '';
  const extractedRole = msg.text?.match(/Role:\s*([^\n\r]+)/i)?.[1]?.trim() || '';
  const extractedZone = msg.text?.match(/Zone:\s*([^\n\r]+)/i)?.[1]?.trim() || '';
  const extractedId = msg.text?.match(/https?:\/\/[^\s]+\/profile\/([a-zA-Z0-9_-]+)/i)?.[1] || '';

  const resolvedId = profileData?.id || profileData?.uid || contactData?.id || contactData?.uid || extractedId || '';
  const rawName = profileData?.name || profileData?.displayName || contactData?.name || contactData?.displayName || extractedName || 'Contact';
  const resolvedName = cleanSenderName(rawName);
  const resolvedAvatar = profileData?.avatar || contactData?.avatar || '';
  const resolvedRole = profileData?.role || contactData?.role || extractedRole || '';
  const resolvedZone = profileData?.zone || profileData?.zoneName || contactData?.zone || contactData?.zoneName || extractedZone || '';
  const resolvedNote = msg.note || (msg.text?.match(/💬\s*([^\n\r]+)/i)?.[1]?.trim()) || '';

  const subtitle = resolvedRole
    ? (resolvedZone ? `${resolvedRole} • ${resolvedZone}` : resolvedRole)
    : (resolvedZone ? resolvedZone : 'Contact');

  const openUserProfile = () => {
    if (resolvedId && resolvedId !== 'user') {
      navigation.navigate('UserProfile', { userId: resolvedId });
    }
  };

  const openDirectChat = async () => {
    if (!resolvedId || resolvedId === 'user') {
      openUserProfile();
      return;
    }
    const currentUser = useUserStore.getState().user;
    if (!currentUser) return;
    if (resolvedId === currentUser.uid) {
      openUserProfile();
      return;
    }

    const chatId = [currentUser.uid, resolvedId].sort().join('_');
    const myProfile = useUserStore.getState().profile;
    const myName = myProfile 
      ? [myProfile.firstName, myProfile.lastName].filter(Boolean).join(' ').trim() || (currentUser as any)?.displayName || 'Me' 
      : ((currentUser as any)?.displayName || 'Me');
    const myAvatar = myProfile?.avatar || '';

    try {
      api.chats.create({
        id: chatId,
        name: resolvedName,
        type: 'direct',
        participants: [currentUser.uid, resolvedId],
      }).catch(() => {});
    } catch {}

    const directRoom = {
      id: chatId,
      title: resolvedName,
      avatar: resolvedAvatar ? { uri: resolvedAvatar } : null,
      isGroup: false,
      type: 'direct',
      participants: [currentUser.uid, resolvedId],
      participantDetails: {
        [currentUser.uid]: { name: myName, avatar: myAvatar },
        [resolvedId]: { name: resolvedName, avatar: resolvedAvatar || '' },
      },
    };
    navigation.navigate('ChatRoom', { room: directRoom });
  };

  return (
    <View style={[
      waCardStyles.cardContainer,
      {
        backgroundColor: msg.isMe 
          ? (APP_THEME.outgoingBubble || '#1e3a8a')
          : (APP_THEME.incomingBubble || '#1f2937'),
        borderColor: msg.isMe ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)',
      }
    ]}>
      {/* Upper Contact Body (Tappable to view contact info) */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={openUserProfile}
        style={waCardStyles.cardBody}
      >
        <View style={waCardStyles.avatarWrapper}>
          <SyncAvatar
            userId={resolvedId}
            initialAvatar={resolvedAvatar}
            fallbackName={resolvedName}
            size={48}
          />
        </View>
        <View style={waCardStyles.infoWrapper}>
          <Text style={[waCardStyles.contactName, { color: APP_THEME.primaryText }]} numberOfLines={1}>
            {resolvedName}
          </Text>
          <Text style={[waCardStyles.contactSubtitle, { color: APP_THEME.secondaryText }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={APP_THEME.secondaryText} style={{ opacity: 0.6 }} />
      </TouchableOpacity>

      {/* Optional Attached Note */}
      {resolvedNote ? (
        <View style={waCardStyles.noteContainer}>
          <Text style={[waCardStyles.noteText, { color: APP_THEME.primaryText }]}>
            "{resolvedNote}"
          </Text>
        </View>
      ) : null}

      {/* Hairline Separator */}
      <View style={[
        waCardStyles.divider,
        { backgroundColor: msg.isMe ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)' }
      ]} />

      {/* WhatsApp-Style Action Buttons */}
      <View style={waCardStyles.actionsRow}>
        <TouchableOpacity
          style={waCardStyles.actionBtn}
          onPress={openDirectChat}
          activeOpacity={0.65}
        >
          <Ionicons name="chatbubble-ellipses" size={17} color="#25D366" style={{ marginRight: 6 }} />
          <Text style={waCardStyles.actionTextGreen}>Message</Text>
        </TouchableOpacity>

        <View style={[
          waCardStyles.actionDivider,
          { backgroundColor: msg.isMe ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)' }
        ]} />

        <TouchableOpacity
          style={waCardStyles.actionBtn}
          onPress={openUserProfile}
          activeOpacity={0.65}
        >
          <Ionicons name="person-outline" size={16} color={APP_THEME.primaryText} style={{ marginRight: 6, opacity: 0.85 }} />
          <Text style={[waCardStyles.actionTextNeutral, { color: APP_THEME.primaryText }]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Timestamp and Tick */}
      <View style={waCardStyles.tsRow}>
        <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
        {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
      </View>
    </View>
  );
});

export const ContactShareCard = ProfileShareCard;

const waCardStyles = StyleSheet.create({
  cardContainer: {
    width: Math.min(SCREEN_WIDTH * 0.76, 290),
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  infoWrapper: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  contactSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '400',
  },
  noteContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    marginTop: -2,
  },
  noteText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    opacity: 0.85,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  actionTextGreen: {
    fontSize: 14,
    fontWeight: '600',
    color: '#25D366',
  },
  actionTextNeutral: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: '55%',
  },
  tsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 6,
    paddingTop: 1,
  },
});
