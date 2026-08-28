import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../lib/apiClient';
import { useUserStore } from '../hooks/useUser';

interface TrackOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  track?: any;
  tracks?: any[];
  onForwardToChat?: () => void;
  currentPlaylistId?: string;
  isFavoritesView?: boolean;
}

export default function TrackOptionsModal({ visible, onClose, track, tracks, onForwardToChat, currentPlaylistId, isFavoritesView }: TrackOptionsModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);

  const navigation = useNavigation<any>();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [commentMode, setCommentMode] = useState<'at_once' | 'each'>('at_once');
  const [note, setNote] = useState('');
  const [eachNotes, setEachNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      setNote('');
      setEachNotes({});
      setCommentMode('at_once');
      setNewPlaylistName('');
    }
  }, [visible]);

  useEffect(() => {
    const user = useUserStore.getState().user;
    if (!user || !visible) return;
    
    async function loadPlaylists() {
      try {
        const res = await apiClient.get<{ success: boolean; data: any[] }>('/playlists/me');
        if (res?.success && Array.isArray(res.data)) {
          setPlaylists(res.data);
        }
      } catch (err) {
        console.warn('Error loading playlists:', err);
      }
    }

    loadPlaylists();
  }, [visible]);

  const tracksToAdd = tracks && tracks.length > 0 ? tracks : (track ? [track] : []);

  const handleAddToPlaylist = async (playlistId: string, currentSongs: string[]) => {
    if (tracksToAdd.length === 0) return;
    try {
      handleFullClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePlaylist = async () => {
    const user = useUserStore.getState().user;
    if (!newPlaylistName.trim() || !user || tracksToAdd.length === 0) return;
    setIsCreatingPlaylist(true);
    try {
      setNewPlaylistName('');
      setNote('');
      setEachNotes({});
      setCommentMode('at_once');
      handleFullClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };
  const handleFullClose = () => {
    setShowPlaylistModal(false);
    onClose();
  };

  const handleRemoveFromPlaylist = async () => {
    if (!currentPlaylistId || !track) return;
    setIsRemoving(true);
    try {
      handleFullClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRemoveFromFavorites = async () => {
    const user = useUserStore.getState().user;
    if (!user || !track) return;
    setIsRemoving(true);
    try {
      // favRef
      // fav update
      handleFullClose();
    } catch (err) {
      console.error('Error removing from favorites:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleImportToRepertoire = async () => {
    if (tracksToAdd.length === 0) return;
    setIsImporting(true);
    try {
      const songIds = tracksToAdd.map((t: any) => t.id);
      const res = await apiClient.post<{ success: boolean; message?: string }>('/songs/import-from-ministered', { songIds });
      if (res?.success) {
        Alert.alert('Imported', res.message || `${songIds.length} song(s) imported to repertoire.`);
        handleFullClose();
      } else {
        Alert.alert('Notice', 'Could not import songs.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to import songs.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Modal visible={visible && !showPlaylistModal} transparent animationType="fade" onRequestClose={onClose}>
        <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={onClose} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.bottomSheetTitle}>More Options</Text>
                {tracks && tracks.length > 1 ? (
                  <Text style={styles.bottomSheetSubtitle} numberOfLines={1} ellipsizeMode="tail">{tracks.length} tracks selected</Text>
                ) : track ? (
                  <Text style={styles.bottomSheetSubtitle} numberOfLines={1} ellipsizeMode="tail">{track.title}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.optionItem} onPress={handleImportToRepertoire} disabled={isImporting}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(192,132,252,0.15)' }]}>
                {isImporting ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Ionicons name="download-outline" size={22} color={theme.colors.accent} />
                )}
              </View>
              <Text style={[styles.optionItemText, { color: theme.colors.accent, fontWeight: '600' }]}>
                {isImporting ? 'Importing…' : 'Import to Repertoire'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => {
              onClose();
              if (onForwardToChat) {
                setTimeout(() => onForwardToChat(), 300);
              } else {
                navigation.navigate('ChatRooms');
              }
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Forward to Chat</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => {
              setShowPlaylistModal(true);
            }}>
              <View style={styles.optionIconBox}>
                <Ionicons name="list-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Add to Playlist</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
            {currentPlaylistId && (
              <TouchableOpacity style={styles.optionItem} onPress={handleRemoveFromPlaylist} disabled={isRemoving}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
                </View>
                <Text style={[styles.optionItemText, { color: '#ef4444' }]}>
                  {isRemoving ? 'Removing…' : 'Remove from Playlist'}
                </Text>
              </TouchableOpacity>
            )}
            {isFavoritesView && (
              <TouchableOpacity style={styles.optionItem} onPress={handleRemoveFromFavorites} disabled={isRemoving}>
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <Ionicons name="heart-dislike-outline" size={22} color="#ef4444" />
                </View>
                <Text style={[styles.optionItemText, { color: '#ef4444' }]}>
                  {isRemoving ? 'Removing…' : 'Remove from Liked Songs'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 24 }} />
          </View>
        </BlurView>
      </Modal>
      <Modal visible={showPlaylistModal} transparent animationType="slide" onRequestClose={handleFullClose}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalDismissArea} onPress={handleFullClose} />
          <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Save to Playlist</Text>
              <TouchableOpacity onPress={handleFullClose} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {tracksToAdd.length > 0 && (
              <View style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: theme.colors.cardBackgroundLight || 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.bottomTabBorder || 'rgba(255,255,255,0.1)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: (theme.colors.accent || '#c084fc') + '20',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name="musical-note" size={20} color={theme.colors.accent || '#c084fc'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textMuted || '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {tracksToAdd.length === 1 ? 'Adding Song' : `Adding ${tracksToAdd.length} Songs`}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary || '#ffffff', marginTop: 1 }} numberOfLines={1}>
                    {tracksToAdd.length === 1 ? tracksToAdd[0].title : `${tracksToAdd.length} selected tracks`}
                  </Text>
                  {tracksToAdd.length === 1 && tracksToAdd[0].program ? (
                    <Text style={{ fontSize: 12, color: theme.colors.accent || '#c084fc', fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                      Program: {tracksToAdd[0].program}
                    </Text>
                  ) : tracksToAdd.length > 1 && tracksToAdd.every((t: any) => t.program && t.program === tracksToAdd[0].program) ? (
                    <Text style={{ fontSize: 12, color: theme.colors.accent || '#c084fc', fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                      Program: {tracksToAdd[0].program}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
            {tracksToAdd.length > 1 && (
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
                  placeholder={tracksToAdd.length > 1 ? "Add a note to all songs… (optional)" : "Add a note… (optional)"}
                  placeholderTextColor={theme.colors.textMuted}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={150}
                />
              </View>
            ) : (
              <View style={styles.eachNotesContainer}>
                <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                  {tracksToAdd.map((t) => (
                    <View key={t.id} style={styles.eachNoteRow}>
                      <Text style={styles.eachNoteTitle} numberOfLines={1}>{t.title}</Text>
                      <TextInput
                        style={styles.eachNoteInput}
                        placeholder="Comment…"
                        placeholderTextColor={theme.colors.textMuted}
                        value={eachNotes[t.id] || ''}
                        onChangeText={(val) => setEachNotes(prev => ({ ...prev, [t.id]: val }))}
                        maxLength={100}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.newPlaylistRow}>
              <TextInput
                style={styles.playlistInput}
                placeholder="New Playlist Name"
                placeholderTextColor={theme.colors.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity
                style={[styles.createPlaylistBtn, !newPlaylistName.trim() && { opacity: 0.5 }]}
                disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                onPress={handleCreatePlaylist}
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
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 }}>No playlists yet.</Text>
              ) : (
                playlists.map(pl => {
                  const inPlaylist = tracksToAdd.length === 1 ? pl.songs?.includes(String(tracksToAdd[0]?.id)) : false;
                  return (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.playlistItem}
                      onPress={() => handleAddToPlaylist(pl.id, pl.songs || [])}
                    >
                      <View style={styles.playlistIconBox}>
                        <Ionicons name="musical-notes-outline" size={24} color={theme.colors.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playlistItemName}>{pl.name}</Text>
                        <Text style={styles.playlistItemCount}>{(pl.songs || []).length} songs</Text>
                      </View>
                      {inPlaylist && <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const getStyles = (theme: any, insets: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  bottomSheet: {
    backgroundColor: theme.colors.bottomSheetBackground,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Math.max(Platform.OS === 'android' ? 36 : 24, insets.bottom + (Platform.OS === 'android' ? 32 : 16)),
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  bottomSheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  },
  bottomSheetSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2
  },
  closeModalBtn: {
    padding: 6,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  optionItemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  playlistInput: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  createPlaylistBtn: {
    height: 50,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createPlaylistBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  playlistIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  playlistItemName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  playlistItemCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.bottomTabBorder,
    marginBottom: 12,
  },
  noteInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    maxHeight: 60,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 10,
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
    color: theme.colors.textSecondary,
  },
  modeToggleTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  eachNotesContainer: {
    marginBottom: 12,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 14,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.bottomTabBorder,
  },
  eachNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.bottomTabBorder,
  },
  eachNoteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 0.45,
  },
  eachNoteInput: {
    flex: 0.55,
    height: 36,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
});
};
