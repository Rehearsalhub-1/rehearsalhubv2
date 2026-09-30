import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { ConductorGuideIcon } from '../icons/PlayerCustomIcons';

export interface PlayerMoreAssetsModalProps {
  visible: boolean;
  onClose: () => void;
  canViewHistory?: boolean;
  onOpenConductor?: () => void;
  onOpenHistory?: () => void;
  onOpenSolfa?: () => void;
  isDownloadedOffline?: boolean;
  isDownloadingOffline?: boolean;
  onToggleOfflineDownload?: () => void;
  sleepTimerRemaining?: number | null;
  onOpenSleepTimer?: () => void;
  theme: any;
  styles: any;
}

export const PlayerMoreAssetsModal: React.FC<PlayerMoreAssetsModalProps> = ({
  visible,
  onClose,
  canViewHistory = true,
  onOpenConductor,
  onOpenHistory,
  onOpenSolfa,
  isDownloadedOffline = false,
  isDownloadingOffline = false,
  onToggleOfflineDownload,
  sleepTimerRemaining = null,
  onOpenSleepTimer,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>More Options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Download for Offline Playback */}
          {onToggleOfflineDownload && (
            <TouchableOpacity
              style={styles.optionItem}
              disabled={isDownloadingOffline}
              onPress={() => {
                onToggleOfflineDownload();
              }}
            >
              <View style={styles.optionIconBox}>
                {isDownloadingOffline ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : isDownloadedOffline ? (
                  <Ionicons name="cloud-done" size={22} color={theme.colors.accent} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={22} color={theme.colors.textPrimary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionItemText,
                    isDownloadedOffline && { color: theme.colors.accent, fontWeight: '700' },
                  ]}
                >
                  {isDownloadingOffline
                    ? 'Downloading Song...'
                    : isDownloadedOffline
                    ? 'Downloaded for Offline'
                    : 'Download Offline'}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {isDownloadingOffline
                    ? 'Saving audio to device...'
                    : isDownloadedOffline
                    ? 'Available offline • Tap to remove'
                    : 'Listen without internet connection'}
                </Text>
              </View>
              {isDownloadedOffline ? (
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          )}

          {/* Sleep Timer Option */}
          {onOpenSleepTimer && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  onOpenSleepTimer();
                }, 250);
              }}
            >
              <View style={styles.optionIconBox}>
                <Ionicons
                  name={sleepTimerRemaining !== null ? 'moon' : 'moon-outline'}
                  size={22}
                  color={sleepTimerRemaining !== null ? theme.colors.accent : theme.colors.textPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionItemText,
                    sleepTimerRemaining !== null && { color: theme.colors.accent, fontWeight: '700' },
                  ]}
                >
                  Sleep Timer
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {sleepTimerRemaining !== null
                    ? `Active: ${Math.ceil(sleepTimerRemaining / 60)}m remaining`
                    : 'Set auto-stop timer'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Conductor's Guide */}
          {onOpenConductor && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                onOpenConductor();
              }}
            >
              <View style={styles.optionIconBox}>
                <ConductorGuideIcon size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionItemText}>Conductor's Guide</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Solfa Notation */}
          {onOpenSolfa && (
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
          )}

          <View style={{ height: 24 }} />
        </View>
      </BlurView>
    </Modal>
  );
};
