import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from './ChatTypes';

interface ChatMessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  sheetAnim: Animated.Value;
  selectedMsg: ChatMessage | null;
  currentUser: any;
  isGroup: boolean;
  APP_THEME: any;
  styles: any;
  onReact: (emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onForward: () => void;
  onSelect: (msgId: string) => void;
  onCopy: () => void;
  onEdit: (msg: ChatMessage) => void;
  onInfo: () => void;
  onDelete: () => void;
  onReport: () => void;
  onSaveToGallery: (uri: string) => void;
}

export const ChatMessageActionSheet: React.FC<ChatMessageActionSheetProps> = ({
  visible,
  onClose,
  sheetAnim,
  selectedMsg,
  currentUser,
  isGroup,
  APP_THEME,
  styles,
  onReact,
  onReply,
  onForward,
  onSelect,
  onCopy,
  onEdit,
  onInfo,
  onDelete,
  onReport,
  onSaveToGallery,
}) => {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.sheetOverlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View style={[
        styles.actionSheet,
        {
          transform: [{
            translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }),
          }],
          opacity: sheetAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        }
      ]}>
        <View style={styles.sheetHandle} />
        <View style={styles.reactionRow}>
          {['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏'].map(e => {
            const isSelected = selectedMsg?.reactions?.[currentUser?.uid || ''] === e;
            return (
              <TouchableOpacity
                key={e}
                onPress={() => onReact(e)}
                style={[styles.reactionBtn, isSelected && styles.reactionBtnActive]}
              >
                <Text style={styles.reactionEmoji}>{e}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.sheetDivider} />
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
          {selectedMsg && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onReply(selectedMsg)}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="arrow-undo-outline" size={20} color={APP_THEME.primaryText} />
              </View>
              <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Reply</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={onForward}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="arrow-redo-outline" size={20} color={APP_THEME.primaryText} />
            </View>
            <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Forward</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => {
              if (selectedMsg?.id) onSelect(selectedMsg.id);
            }}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="checkbox-outline" size={20} color={APP_THEME.primaryText} />
            </View>
            <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Select</Text>
          </TouchableOpacity>

          {selectedMsg?.type === 'text' && !selectedMsg.isDeleted && (
            <TouchableOpacity style={styles.actionItem} onPress={onCopy}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="copy-outline" size={20} color={APP_THEME.primaryText} />
              </View>
              <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Copy</Text>
            </TouchableOpacity>
          )}

          {selectedMsg?.isMe && !selectedMsg.isVoiceNote && !selectedMsg.isDeleted && (
            (() => {
              const canEdit = selectedMsg?.timestampObj ? Date.now() - selectedMsg.timestampObj.getTime() < 5 * 60 * 1000 : false;
              if (!canEdit) return null;
              return (
                <TouchableOpacity style={styles.actionItem} onPress={() => onEdit(selectedMsg)}>
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="pencil-outline" size={20} color={APP_THEME.primaryText} />
                  </View>
                  <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Edit</Text>
                </TouchableOpacity>
              );
            })()
          )}

          {selectedMsg?.isMe && isGroup && !selectedMsg.isDeleted && (
            <TouchableOpacity style={styles.actionItem} onPress={onInfo}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="information-circle-outline" size={20} color={APP_THEME.primaryText} />
              </View>
              <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Info</Text>
            </TouchableOpacity>
          )}

          {!selectedMsg?.isDeleted && (
            <TouchableOpacity style={styles.actionItem} onPress={onDelete}>
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </View>
              <Text style={[styles.actionText, { color: '#ef4444' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}

          {!selectedMsg?.isMe && !selectedMsg?.isDeleted && !selectedMsg?.isSystem && (
            <TouchableOpacity style={styles.actionItem} onPress={onReport}>
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Ionicons name="warning-outline" size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.actionText, { color: '#f59e0b' }]}>Report</Text>
            </TouchableOpacity>
          )}

          {selectedMsg?.type === 'image' && selectedMsg?.imageUrl && !selectedMsg?.viewOnce && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onSaveToGallery(selectedMsg.imageUrl!)}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="download-outline" size={20} color={APP_THEME.primaryText} />
              </View>
              <Text style={[styles.actionText, { color: APP_THEME.primaryText }]}>Save to Gallery</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

export default ChatMessageActionSheet;
