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

export const SLEEP_TIMER_OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '60 minutes', minutes: 60 },
  { label: 'End of current song', minutes: -1 },
];

export interface PlayerSleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
  sleepTimerMinutes: number | null;
  onSelectSleepTimer: (minutes: number) => void;
  theme: any;
  styles: any;
}

export const PlayerSleepTimerModal: React.FC<PlayerSleepTimerModalProps> = ({
  visible,
  onClose,
  sleepTimerMinutes,
  onSelectSleepTimer,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Sleep Timer</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {SLEEP_TIMER_OPTIONS.map((opt) => {
              const isSelected = sleepTimerMinutes === opt.minutes;
              return (
                <TouchableOpacity
                  key={String(opt.minutes)}
                  style={[
                    styles.playlistItem,
                    isSelected && { backgroundColor: theme.colors.accent + '15', borderRadius: 14 },
                  ]}
                  onPress={() => onSelectSleepTimer(opt.minutes)}
                >
                  <View
                    style={[
                      styles.playlistIconBox,
                      isSelected && { backgroundColor: theme.colors.accent + '33' },
                    ]}
                  >
                    <Ionicons
                      name="moon"
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
