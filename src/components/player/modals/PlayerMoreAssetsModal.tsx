import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerMoreAssetsModalProps {
  visible: boolean;
  onClose: () => void;
  canViewHistory: boolean;
  onOpenHistory: () => void;
  onOpenSolfa: () => void;
  theme: any;
  styles: any;
}

export const PlayerMoreAssetsModal: React.FC<PlayerMoreAssetsModalProps> = ({
  visible,
  onClose,
  canViewHistory,
  onOpenHistory,
  onOpenSolfa,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Song Resources</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {canViewHistory && (
            <>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  onOpenHistory();
                }}
              >
                <View style={styles.optionIconBox}>
                  <Ionicons name="time-outline" size={22} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.optionItemText}>Song History</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  onOpenSolfa();
                }}
              >
                <View style={styles.optionIconBox}>
                  <Ionicons name="musical-note-outline" size={22} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.optionItemText}>Solfa Notation</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 24 }} />
        </View>
      </BlurView>
    </Modal>
  );
};
