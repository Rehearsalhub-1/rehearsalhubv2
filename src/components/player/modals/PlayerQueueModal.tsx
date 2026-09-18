import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerQueueModalProps {
  visible: boolean;
  onClose: () => void;
  displayQueue: any[];
  activeTrack: any;
  onSelectTrack: (song: any) => Promise<void> | void;
  theme: any;
  styles: any;
}

export const PlayerQueueModal: React.FC<PlayerQueueModalProps> = ({
  visible,
  onClose,
  displayQueue,
  activeTrack,
  onSelectTrack,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={[styles.bottomSheet, { maxHeight: '80%' }]}>
          <View style={styles.bottomSheetHeader}>
            <View>
              <Text style={styles.bottomSheetTitle}>Up Next Queue</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 2 }}>
                {displayQueue.length} {displayQueue.length === 1 ? 'song' : 'songs'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {displayQueue.map((song: any, index: number) => {
              const isCurrent = String(song.id) === String(activeTrack?.id);
              return (
                <TouchableOpacity
                  key={song.id || index}
                  style={[
                    styles.playlistItem,
                    isCurrent && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 },
                  ]}
                  onPress={() => onSelectTrack(song)}
                >
                  <View
                    style={[
                      styles.playlistIconBox,
                      isCurrent && { backgroundColor: theme.colors.accent + '33' },
                    ]}
                  >
                    <Text
                      style={{
                        color: isCurrent ? theme.colors.accent : theme.colors.textMuted,
                        fontWeight: '700',
                        fontSize: 14,
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.playlistItemName,
                        isCurrent && { color: theme.colors.accent, fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {song.title}
                    </Text>
                    <Text style={styles.playlistItemCount} numberOfLines={1}>
                      {song.leadSinger || song.writer || 'Loveworld Singers'}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Ionicons name="volume-high" size={22} color={theme.colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
};
