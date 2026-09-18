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

export const SPEED_OPTIONS = [
  { label: '0.75x', value: 0.75, description: 'Very Slow (Practice tempo)' },
  { label: '0.85x', value: 0.85, description: 'Slow' },
  { label: '1.0x', value: 1.0, description: 'Normal Speed' },
  { label: '1.15x', value: 1.15, description: 'Slightly Faster' },
  { label: '1.25x', value: 1.25, description: 'Fast' },
  { label: '1.5x', value: 1.5, description: 'Very Fast' },
];

export interface PlayerSpeedModalProps {
  visible: boolean;
  onClose: () => void;
  playbackRate: number;
  onSelectSpeed: (speed: number) => void;
  theme: any;
  styles: any;
}

export const PlayerSpeedModal: React.FC<PlayerSpeedModalProps> = ({
  visible,
  onClose,
  playbackRate,
  onSelectSpeed,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Playback Speed</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {SPEED_OPTIONS.map((opt) => {
              const isSelected = Math.abs(playbackRate - opt.value) < 0.01;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.playlistItem,
                    isSelected && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 },
                  ]}
                  onPress={() => onSelectSpeed(opt.value)}
                >
                  <View
                    style={[
                      styles.playlistIconBox,
                      isSelected && { backgroundColor: theme.colors.accent + '33' },
                    ]}
                  >
                    <Ionicons
                      name="speedometer"
                      size={22}
                      color={isSelected ? theme.colors.accent : theme.colors.textPrimary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.playlistItemName,
                        isSelected && { color: theme.colors.accent, fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.playlistItemCount}>{opt.description}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
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
