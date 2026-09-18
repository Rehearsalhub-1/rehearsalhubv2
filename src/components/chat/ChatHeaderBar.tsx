import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedHeader from '../ThemedHeader';
import { SyncAvatar } from '../SyncAvatar';

interface ChatHeaderBarProps {
  selectedMessageIds: Set<string>;
  messages: any[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  isSearching: boolean;
  searchQuery: string;
  onStartSearch: () => void;
  onCloseSearch: () => void;
  onChangeSearchQuery: (q: string) => void;
  room: any;
  roomTitle: string;
  roomAvatarUri?: string | null;
  isGroup: boolean;
  currentUser: any;
  typingUsers: any[];
  onBack: () => void;
  onOpenChatInfo: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
  onOpenMenu: () => void;
  theme: any;
  APP_THEME: any;
  styles: any;
}

export const ChatHeaderBar: React.FC<ChatHeaderBarProps> = ({
  selectedMessageIds,
  messages,
  onClearSelection,
  onSelectAll,
  onDeleteSelected,
  isSearching,
  searchQuery,
  onStartSearch,
  onCloseSearch,
  onChangeSearchQuery,
  room,
  roomTitle,
  roomAvatarUri,
  isGroup,
  currentUser,
  typingUsers,
  onBack,
  onOpenChatInfo,
  onStartCall,
  onOpenMenu,
  theme,
  APP_THEME,
  styles,
}) => {
  return (
    <ThemedHeader style={styles.header}>
      {selectedMessageIds.size > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={onClearSelection} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.gradients.headerTextColor,
              }}
            >
              {selectedMessageIds.size}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={onSelectAll} style={{ padding: 6 }}>
              <Ionicons name="checkmark-done" size={22} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDeleteSelected} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ) : isSearching ? (
        <View style={styles.searchBar}>
          <TouchableOpacity onPress={onCloseSearch} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.searchInput, { color: theme.colors.inputText }]}
            placeholder="Search messages…"
            placeholderTextColor={theme.colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onChangeSearchQuery('')} style={{ padding: 6 }}>
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <View style={[styles.avatarBorder, { borderColor: APP_THEME.primaryAccent }]}>
              <SyncAvatar
                userId={
                  !isGroup
                    ? room?.id?.split('_')?.find((id: string) => id !== currentUser?.uid)
                    : undefined
                }
                initialAvatar={roomAvatarUri}
                fallbackName={roomTitle}
                isGroup={isGroup}
                size={36}
                bgColor={isGroup ? '#00a884' : APP_THEME.primaryAccent}
              />
            </View>
            <TouchableOpacity style={{ flex: 1, marginLeft: 8 }} onPress={onOpenChatInfo}>
              <Text
                style={[styles.headerTitle, { color: theme.gradients.headerTextColor }]}
                numberOfLines={1}
              >
                {roomTitle}
              </Text>
              <Text
                style={[
                  styles.headerSub,
                  {
                    color:
                      typingUsers.length > 0 ? '#c4b5fd' : 'rgba(255,255,255,0.75)',
                  },
                ]}
                numberOfLines={1}
              >
                {typingUsers.length > 0
                  ? `${typingUsers.map((u) => u.userName).join(', ')} typing…`
                  : isGroup
                  ? `${room?.memberCount || ''} members`
                  : 'tap for info'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={onStartSearch}>
              <Ionicons
                name="search-outline"
                size={22}
                color={theme.gradients.headerTextColor}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => onStartCall('video')}>
              <Ionicons
                name="videocam-outline"
                size={23}
                color={theme.gradients.headerTextColor}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => onStartCall('voice')}>
              <Ionicons name="call-outline" size={22} color={theme.gradients.headerTextColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={onOpenMenu}>
              <Ionicons
                name="ellipsis-vertical"
                size={22}
                color={theme.gradients.headerTextColor}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </ThemedHeader>
  );
};

export default ChatHeaderBar;
