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

export interface PlayerOptionsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  abLoop: { active: boolean; start: number | null; end: number | null };
  onOpenABLooper: () => void;
  onClearABLoop: () => void;
  activeTrack: any;
  isDownloadedOffline: boolean;
  isDownloadingOffline: boolean;
  onToggleOfflineDownload: () => void;
  sleepTimerRemaining: number | null;
  onOpenSleepTimer: () => void;
  onOpenPlaylist: () => void;
  formatTime: (secondsOrMs: number) => string;
  theme: any;
  styles: any;
}

export const PlayerOptionsMenuModal: React.FC<PlayerOptionsMenuModalProps> = ({
  visible,
  onClose,
  abLoop,
  onOpenABLooper,
  onClearABLoop,
  activeTrack,
  isDownloadedOffline,
  isDownloadingOffline,
  onToggleOfflineDownload,
  sleepTimerRemaining,
  onOpenSleepTimer,
  onOpenPlaylist,
  formatTime,
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

          {/* Section Looper Option */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              onOpenABLooper();
            }}
          >
            <View style={styles.optionIconBox}>
              <Ionicons
                name="infinite"
                size={22}
                color={abLoop.active ? theme.colors.accent : theme.colors.textPrimary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionItemText}>Section Looper (A-B)</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {abLoop.active
                  ? `Active: ${formatTime(abLoop.start!)} – ${formatTime(abLoop.end!)}`
                  : 'Set A-B repeat region'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Clear Section Loop if active */}
          {(abLoop.active || abLoop.start !== null) && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                onClearABLoop();
              }}
            >
              <View style={styles.optionIconBox}>
                <Ionicons name="trash-outline" size={22} color="#ff453a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionItemText, { color: '#ff453a' }]}>Reset Section Loop</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {abLoop.active
                    ? `${formatTime(abLoop.start!)} – ${formatTime(abLoop.end!)}`
                    : 'Point A is set'}
                </Text>
              </View>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Download for Offline Playback */}
          {activeTrack?.audioUrl && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={onToggleOfflineDownload}
              disabled={isDownloadingOffline}
            >
              <View
                style={[
                  styles.optionIconBox,
                  isDownloadedOffline && { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
                ]}
              >
                {isDownloadingOffline ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Ionicons
                    name={isDownloadedOffline ? 'checkmark-circle' : 'cloud-download-outline'}
                    size={22}
                    color={isDownloadedOffline ? '#22c55e' : theme.colors.accent}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionItemText,
                    isDownloadedOffline && { color: '#22c55e', fontWeight: '700' },
                  ]}
                >
                  {isDownloadedOffline ? 'Downloaded (Offline Ready)' : 'Download for Offline Playback'}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {isDownloadedOffline ? 'Tap to remove from device' : 'Save track to play without internet'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Sleep Timer Option */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              setTimeout(onOpenSleepTimer, 300);
            }}
          >
            <View style={styles.optionIconBox}>
              <Ionicons name="moon-outline" size={22} color={theme.colors.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionItemText}>Sleep Timer</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {sleepTimerRemaining !== null
                  ? `${Math.ceil(sleepTimerRemaining / 60)} mins remaining`
                  : 'Off'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Add to Playlist */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              setTimeout(onOpenPlaylist, 300);
            }}
          >
            <View style={styles.optionIconBox}>
              <Ionicons name="list-outline" size={22} color={theme.colors.textPrimary} />
            </View>
            <Text style={styles.optionItemText}>Add to Playlist</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </BlurView>
    </Modal>
  );
};
