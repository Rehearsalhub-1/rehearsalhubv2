import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from './ChatTypes';
import { LocalAudioSlider, VoiceWaveformVisualizer } from './VoiceWaveformVisualizer';
import { SyncAvatar } from '../SyncAvatar';

interface CardBaseProps {
  msg: ChatMessage;
  theme: any;
  APP_THEME: any;
  styles: any;
}

export const TickIcon = ({ status, APP_THEME }: { status: ChatMessage['status']; APP_THEME: any }) => {
  if (status === 'sending')
    return <Ionicons name="time-outline" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
  if (status === 'sent')
    return <Ionicons name="checkmark" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
  if (status === 'delivered')
    return <Ionicons name="checkmark-done" size={13} color={APP_THEME.tickColor} style={{ marginLeft: 3 }} />;
  return <Ionicons name="checkmark-done" size={13} color={APP_THEME.tickColorRead} style={{ marginLeft: 3 }} />;
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
  return (
    <View style={styles.songShareCard}>
      <View style={styles.songShareHeader}>
        <Ionicons name={msg.callType === 'video' ? 'videocam' : 'call'} size={13} color={APP_THEME.primaryAccent} />
        <Text style={styles.songShareLabel}>Group {msg.callType} call</Text>
      </View>
      <View style={styles.songShareBody}>
        <View style={[styles.songShareIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
          <Ionicons name={msg.callType === 'video' ? 'videocam' : 'call'} size={22} color={theme.colors.success} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.songShareTitle} numberOfLines={1}>{msg.text}</Text>
          <Text style={styles.songShareSub}>{msg.time}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.songSharePlayRow, { justifyContent: 'center' }]}
        onPress={() => {
          navigation.navigate('Call', {
            callId: msg.callId || room.id,
            callType: msg.callType || 'voice',
            isIncoming: false,
            contactName: room?.title || room?.name || 'Group',
            roomId: room.id,
            isGroupCall: true,
          });
        }}
      >
        <Text style={[styles.songSharePlayText, { color: theme.colors.success, textAlign: 'center', fontWeight: '700' }]}>Join Call</Text>
      </TouchableOpacity>
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
  if (!msg.profileData) return null;
  return (
    <View style={styles.songShareCard}>
      <View style={styles.songShareHeader}>
        <Ionicons name="person" size={13} color={APP_THEME.primaryAccent} />
        <Text style={styles.songShareLabel}>Contact shared</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          navigation.navigate('UserProfile', {
            userId: msg.profileData!.id
          });
        }}
        style={styles.songShareBody}
      >
        <SyncAvatar userId={msg.profileData.id} initialAvatar={msg.profileData.avatar} fallbackName={msg.profileData.name} size={44} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.songShareTitle} numberOfLines={1}>{msg.profileData.name}</Text>
          <Text style={styles.songShareSub}>{msg.profileData.role || 'Member'}</Text>
          {msg.profileData.zone ? <Text style={styles.songShareProg} numberOfLines={1}>{msg.profileData.zone}</Text> : null}
        </View>
      </TouchableOpacity>
      {msg.note ? (
        <View style={styles.songShareNote}>
          <Text style={styles.songShareNoteText}>"{msg.note}"</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: APP_THEME.border }}
        onPress={() => {
          navigation.navigate('UserProfile', {
            userId: msg.profileData!.id
          });
        }}
      >
        <Ionicons name="person-outline" size={14} color={APP_THEME.primaryAccent} />
        <Text style={{ fontSize: 12, color: APP_THEME.primaryAccent, fontWeight: '600' }}>View Profile ›</Text>
      </TouchableOpacity>
      <View style={[styles.tsBubbleRow, { paddingHorizontal: 10, paddingBottom: 8 }]}>
        <Text style={[styles.tsText, { color: APP_THEME.secondaryText }]}>{msg.time}</Text>
        {msg.isMe && <TickIcon status={msg.status} APP_THEME={APP_THEME} />}
      </View>
    </View>
  );
});
