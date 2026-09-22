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
import { isLiveSong } from '../../../stores/liveSongStore';

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
              const isLive = isLiveSong(song);
              const purpleAccent = theme.colors.accentBright || theme.colors.accent || '#c084fc';
              return (
                <TouchableOpacity
                  key={song.id || index}
                  style={[
                    styles.playlistItem,
                    (isCurrent || isLive) && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 },
                    isLive && { borderColor: 'rgba(192, 132, 252, 0.4)', borderWidth: 1 },
                  ]}
                  onPress={() => onSelectTrack(song)}
                >
                  <View
                    style={[
                      styles.playlistIconBox,
                      (isCurrent || isLive) && { backgroundColor: theme.colors.accent + '33' },
                    ]}
                  >
                    {isLive ? (
                      <Ionicons name="radio" size={16} color={purpleAccent} />
                    ) : (
                      <Text
                        style={{
                          color: isCurrent ? purpleAccent : theme.colors.textMuted,
                          fontWeight: '700',
                          fontSize: 14,
                        }}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.playlistItemName,
                          { flexShrink: 1 },
                          (isCurrent || isLive) && { color: purpleAccent, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {song.title}
                      </Text>
                      {isLive && (
                        <View style={{
                          backgroundColor: 'rgba(168, 85, 247, 0.22)',
                          borderColor: 'rgba(192, 132, 252, 0.5)',
                          borderWidth: 1,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 5,
                          marginLeft: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                        }}>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: purpleAccent }} />
                          <Text style={{ color: purpleAccent, fontSize: 9, fontWeight: '800' }}>
                            LIVE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.playlistItemCount, (isCurrent || isLive) && { color: purpleAccent }]} numberOfLines={1}>
                      {song.leadSinger || song.writer || 'Loveworld Singers'}
                    </Text>
                  </View>
                  {(isCurrent || isLive) && (
                    <Ionicons name={isLive ? 'radio' : 'volume-high'} size={20} color={purpleAccent} />
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
