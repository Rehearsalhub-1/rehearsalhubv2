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
import { StyleSheet } from 'react-native';

export interface PlayerAudioPartsModalProps {
  visible: boolean;
  onClose: () => void;
  activeTrack: any;
  currentTrack: any;
  onSelectTrack: (trackToPlay: any) => void;
  theme: any;
  styles?: any;
}

const PART_LABELS: Record<string, string> = {
  full: 'Full Mix',
  soprano: 'Soprano',
  alto: 'Alto',
  tenor: 'Tenor',
  bass: 'Bass',
  lead: 'Lead Vocal',
  band: 'Band',
  instrumental: 'Instrumental',
  backing: 'Backup Vocals',
  bvs: 'Backup Vocals',
  'backup vocals': 'Backup Vocals',
  'lead vocals': 'Lead Vocals',
};

export const PlayerAudioPartsModal: React.FC<PlayerAudioPartsModalProps> = ({
  visible,
  onClose,
  activeTrack,
  currentTrack,
  onSelectTrack,
  theme,
  styles: customStyles,
}) => {
  const fallbackStyles = StyleSheet.create({
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalDismissArea: { flex: 1 },
    bottomSheet: {
      backgroundColor: theme.colors.bottomSheetBackground || theme.colors.cardBackground || '#181824',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder || 'rgba(255,255,255,0.1)',
    },
    bottomSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    bottomSheetTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
    closeModalBtn: { padding: 6, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 16 },
    playlistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.bottomTabBorder || theme.colors.divider || 'rgba(255,255,255,0.08)',
    },
    playlistIconBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.cardBackgroundLight || '#242436',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    playlistItemName: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
    playlistItemCount: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  });

  const styles = { ...fallbackStyles, ...(customStyles || {}) };
  const parts = resolveSongAudioUrls(activeTrack);
  const entries = Object.entries(parts).filter(
    ([partName, url]) =>
      !partName.startsWith('_') &&
      typeof url === 'string' &&
      url.trim().length > 0 &&
      (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('/')) &&
      partName.toLowerCase() !== 'full'
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
                const fullUrl = parts.full || activeTrack?.audioUrl;
                onSelectTrack({ ...activeTrack, audioUrl: fullUrl });
                onClose();
              }}
            >
              <View style={styles.playlistIconBox}>
                <Ionicons name="musical-notes" size={24} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playlistItemName}>Full Mix</Text>
                <Text style={styles.playlistItemCount}>Master recording</Text>
              </View>
              {(currentTrack?.audioUrl === (parts.full || activeTrack?.audioUrl) ||
                currentTrack?.url === (parts.full || activeTrack?.audioUrl)) && (
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
                const isBand = partName.toLowerCase().includes('band') || partName.toLowerCase().includes('instrumental');
                const displayName = PART_LABELS[partName.toLowerCase()] || (partName.charAt(0).toUpperCase() + partName.slice(1));
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
                      <Ionicons
                        name={isBand ? 'radio-outline' : 'mic-outline'}
                        size={24}
                        color={isSelected ? theme.colors.accent : theme.colors.textPrimary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.playlistItemName, isSelected && { color: theme.colors.accent, fontWeight: '700' }]}>
                        {displayName}
                      </Text>
                      <Text style={styles.playlistItemCount}>
                        {isBand ? 'Instrumental track' : 'Vocal track'}
                      </Text>
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
