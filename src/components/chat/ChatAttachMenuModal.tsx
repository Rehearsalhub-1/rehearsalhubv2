import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ChatAttachMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onPickDocument: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickVideo: () => void;
  theme: any;
  styles: any;
}

export const ChatAttachMenuModal: React.FC<ChatAttachMenuModalProps> = ({
  visible,
  onClose,
  onPickDocument,
  onPickCamera,
  onPickGallery,
  onPickVideo,
  theme,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Full-screen dismiss area - sits behind the menu card */}
      <View style={[styles.overlay, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        {/* Menu card stops event propagation so button taps don't dismiss the modal */}
        <View
          style={[styles.attachMenu, { backgroundColor: theme.colors.backgroundDark, marginBottom: 90, marginHorizontal: 16, alignSelf: 'stretch' }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={e => e.stopPropagation()}
        >
          <View style={styles.attachRow}>
            {[
              { icon: 'document', color: '#7f66ff', label: 'Document', onPress: onPickDocument },
              { icon: 'camera', color: '#ff2e74', label: 'Camera', onPress: onPickCamera },
              { icon: 'image', color: '#00a884', label: 'Gallery', onPress: onPickGallery },
              { icon: 'videocam', color: '#f59e0b', label: 'Video', onPress: onPickVideo },
            ].map(item => (
              <TouchableOpacity key={item.label} style={styles.attachBtn} onPress={item.onPress} activeOpacity={0.75}>
                <View style={[styles.attachIcon, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={24} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.attachLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ChatAttachMenuModal;
