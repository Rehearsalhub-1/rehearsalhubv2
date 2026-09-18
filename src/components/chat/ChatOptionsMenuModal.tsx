import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface ChatOptionsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  isGroup: boolean;
  isArchived: boolean;
  isBlocked: boolean;
  theme: any;
  APP_THEME: any;
  onNavigateChatInfo: () => void;
  onArchiveChat: () => void;
  onMarkUnread: () => void;
  onClearChat: () => void;
  onBlockUser: () => void;
}

export const ChatOptionsMenuModal: React.FC<ChatOptionsMenuModalProps> = ({
  visible,
  onClose,
  isGroup,
  isArchived,
  isBlocked,
  theme,
  APP_THEME,
  onNavigateChatInfo,
  onArchiveChat,
  onMarkUnread,
  onClearChat,
  onBlockUser,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            top: 50,
            right: 10,
            backgroundColor: theme.colors.cardBackground,
            borderRadius: 8,
            padding: 8,
            elevation: 5,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 4,
            minWidth: 180,
          }}
        >
          <TouchableOpacity
            style={{ padding: 12 }}
            onPress={() => {
              onClose();
              onNavigateChatInfo();
            }}
          >
            <Text style={{ color: theme.colors.textPrimary }}>
              {isGroup ? 'Group Info' : 'Contact Info'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ padding: 12 }}
            onPress={() => {
              onClose();
              onArchiveChat();
            }}
          >
            <Text style={{ color: theme.colors.textPrimary }}>
              {isArchived ? 'Unarchive Chat' : 'Archive Chat'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ padding: 12 }}
            onPress={() => {
              onClose();
              onMarkUnread();
            }}
          >
            <Text style={{ color: theme.colors.textPrimary }}>Mark as Unread</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ padding: 12 }}
            onPress={() => {
              onClose();
              onClearChat();
            }}
          >
            <Text style={{ color: '#ef4444' }}>Clear Messages</Text>
          </TouchableOpacity>

          {!isGroup && (
            <TouchableOpacity
              style={{ padding: 12 }}
              onPress={() => {
                onClose();
                onBlockUser();
              }}
            >
              <Text style={{ color: isBlocked ? APP_THEME.primaryAccent : '#ef4444' }}>
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default ChatOptionsMenuModal;
