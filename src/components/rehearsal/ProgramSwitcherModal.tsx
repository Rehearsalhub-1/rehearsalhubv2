import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface Props {
  visible: boolean;
  onClose: () => void;
  availablePrograms: any[];
  programTitle: string;
  currentActiveTrack: any;
  categoryFilter: string;
  onSelectProgram: (prog: any) => void;
  insets: { bottom: number };
  theme: any;
  styles: any;
}

export const ProgramSwitcherModal: React.FC<Props> = ({
  visible,
  onClose,
  availablePrograms,
  programTitle,
  currentActiveTrack,
  categoryFilter,
  onSelectProgram,
  insets,
  theme,
  styles,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <BlurView intensity={60} tint="dark" style={styles.modalBackdrop}>
      <Pressable style={styles.modalDismissArea} onPress={onClose} />
      <View style={[styles.modalContainer, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitleText}>Switch Program</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {availablePrograms
            .filter((prog: any) => {
              const targetCat = (categoryFilter || 'ongoing').toLowerCase().trim();
              return (prog.category || '').toLowerCase().trim() === targetCat;
            })
            .map((prog) => {
              const isActive = prog.id === currentActiveTrack?.program || prog.name === programTitle;
              return (
                <TouchableOpacity
                  key={prog.id}
                  style={[styles.categoryListItem, isActive && { backgroundColor: 'transparent', borderColor: theme.colors.bottomTabBorder, borderWidth: 1 }]}
                  onPress={() => onSelectProgram(prog)}
                >
                  <View style={styles.categoryItemLeft}>
                    <View style={[styles.categoryIconWrapper, isActive && { backgroundColor: 'transparent' }]}>
                      <Ionicons name="radio" size={20} color={theme.colors.textPrimary} />
                    </View>
                    <View style={styles.categoryTextInfo}>
                      <Text style={[styles.categoryListTitle, isActive && { color: theme.colors.textPrimary }]} numberOfLines={1}>{prog.name || prog.title}</Text>
                      <Text style={styles.categoryListSubtitle} numberOfLines={1}>{prog.date || new Date(prog.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={24} color={theme.colors.textPrimary} />}
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>
    </BlurView>
  </Modal>
);
