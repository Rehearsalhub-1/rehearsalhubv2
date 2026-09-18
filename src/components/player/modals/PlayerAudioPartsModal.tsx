import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveSongAudioUrls } from '../../../lib/mediaUtils';

export interface PlayerAudioPartsModalProps {
  visible: boolean;
  onClose: () => void;
  activeTrack: any;
  currentTrack: any;
  onSelectTrack: (trackToPlay: any) => void;
  theme: any;
  styles: any;
}

export const PlayerAudioPartsModal: React.FC<PlayerAudioPartsModalProps> = ({
  visible,
  onClose,
  activeTrack,
  currentTrack,
  onSelectTrack,
  theme,
  styles,
}) => {
  const parts = resolveSongAudioUrls(activeTrack);
  const entries = Object.entries(parts).filter(
    ([partName, url]) => url && typeof url === 'string' && partName.toLowerCase() !== 'full'
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={[styles.bottomSheet, { maxHeight: '70%' }]}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Select Audio Part</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            <TouchableOpacity
              style={styles.playlistItem}
              onPress={() => {
                onSelectTrack(activeTrack);
                onClose();
              }}
            >
              <View style={styles.playlistIconBox}>
                <Ionicons name="musical-notes" size={24} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playlistItemName}>Main Track</Text>
                <Text style={styles.playlistItemCount}>Full recording</Text>
              </View>
              {(currentTrack?.audioUrl === activeTrack?.audioUrl ||
                currentTrack?.url === activeTrack?.audioUrl) && (
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
              )}
            </TouchableOpacity>

            {entries.length === 0 ? (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  textAlign: 'center',
                  marginTop: 24,
                  fontSize: 13,
                  fontWeight: '500',
                }}
              >
                No isolated parts available for this song.
              </Text>
            ) : (
              entries.map(([partName, url]) => {
                const isSelected =
                  currentTrack?.audioUrl === url || currentTrack?.url === url;
                return (
                  <TouchableOpacity
                    key={partName}
                    style={styles.playlistItem}
                    onPress={() => {
                      onSelectTrack({ ...activeTrack, audioUrl: url as string });
                      onClose();
                    }}
                  >
                    <View style={styles.playlistIconBox}>
                      <Ionicons name="mic-outline" size={24} color={theme.colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playlistItemName}>
                        {partName.charAt(0).toUpperCase() + partName.slice(1)}
                      </Text>
                      <Text style={styles.playlistItemCount}>Isolated part</Text>
                    </View>
                    {isSelected && (
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
