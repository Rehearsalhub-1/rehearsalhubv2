import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerAddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  newPlaylistName: string;
  onChangeNewPlaylistName: (text: string) => void;
  isCreatingPlaylist: boolean;
  onCreatePlaylist: () => void;
  playlists: any[];
  activeTrack: any;
  onAddToPlaylist: (playlistId: string) => void;
  theme: any;
  styles: any;
}

export const PlayerAddToPlaylistModal: React.FC<PlayerAddToPlaylistModalProps> = ({
  visible,
  onClose,
  newPlaylistName,
  onChangeNewPlaylistName,
  isCreatingPlaylist,
  onCreatePlaylist,
  playlists,
  activeTrack,
  onAddToPlaylist,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Save to Playlist</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.newPlaylistRow}>
            <TextInput
              style={styles.playlistInput}
              placeholder="New Playlist Name"
              placeholderTextColor={theme.colors.textMuted}
              value={newPlaylistName}
              onChangeText={onChangeNewPlaylistName}
            />
            <TouchableOpacity
              style={[styles.createPlaylistBtn, !newPlaylistName.trim() && { opacity: 0.5 }]}
              disabled={!newPlaylistName.trim() || isCreatingPlaylist}
              onPress={onCreatePlaylist}
            >
              {isCreatingPlaylist ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Text style={styles.createPlaylistBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
            {playlists.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 }}>
                No playlists yet.
              </Text>
            ) : (
              playlists.map((pl) => {
                const songList = (pl.songs || pl.songIds || []).map((s: any) => String(s?.id || s));
                const inPlaylist = activeTrack?.id ? songList.includes(String(activeTrack.id)) : false;
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.playlistItem}
                    onPress={() => onAddToPlaylist(pl.id)}
                  >
                    <View style={styles.playlistIconBox}>
                      <Ionicons name="musical-notes-outline" size={24} color={theme.colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playlistItemName}>{pl.name || pl.title || 'Untitled'}</Text>
                      <Text style={styles.playlistItemCount}>
                        {songList.length} {songList.length === 1 ? 'song' : 'songs'}
                      </Text>
                    </View>
                    {inPlaylist && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
