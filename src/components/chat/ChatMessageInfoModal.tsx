import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '../DoodleBackground';
import { SyncAvatar } from '../SyncAvatar';
import { ChatMessage } from './ChatTypes';

interface ChatMessageInfoModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMsg: ChatMessage | null;
  chatData: any;
  currentUser: any;
  insets: any;
  theme: any;
  APP_THEME: any;
}

export const ChatMessageInfoModal: React.FC<ChatMessageInfoModalProps> = ({
  visible,
  onClose,
  selectedMsg,
  chatData,
  currentUser,
  insets,
  theme,
  APP_THEME,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LinearGradient
          colors={theme.gradients.bgBase}
          locations={theme.gradients.bgBaseLocations}
          style={StyleSheet.absoluteFill}
        />
        <DoodleBackground />
        <LinearGradient
          colors={theme.gradients.bgGlow}
          locations={theme.gradients.bgGlowLocations}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            flex: 1,
            paddingTop: Math.max(
              insets?.top || 0,
              Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 44
            ),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: APP_THEME.border,
            }}
          >
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={26} color={APP_THEME.primaryText} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: APP_THEME.primaryText }}>
              Message Info
            </Text>
            <View style={{ width: 38 }} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={true}
          >
            <View
              style={{
                padding: 16,
                backgroundColor: 'rgba(255,255,255,0.05)',
                marginBottom: 16,
                marginHorizontal: 16,
                borderRadius: 12,
              }}
            >
              {selectedMsg?.imageUrl && (
                <Image
                  source={{ uri: selectedMsg.imageUrl }}
                  style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: 8 }}
                  contentFit="cover"
                />
              )}
              {selectedMsg?.isVoiceNote && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="mic" size={18} color={APP_THEME.primaryAccent} />
                  <Text style={{ color: APP_THEME.primaryAccent, fontWeight: '600', fontSize: 13 }}>
                    Voice Note
                  </Text>
                </View>
              )}
              {selectedMsg?.documentName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="document-text-outline" size={18} color={APP_THEME.primaryAccent} />
                  <Text style={{ color: APP_THEME.primaryText, fontWeight: '600', fontSize: 14 }}>
                    {selectedMsg.documentName}
                  </Text>
                </View>
              )}
              {selectedMsg?.text ? (
                <Text style={{ color: APP_THEME.primaryText, fontSize: 15, lineHeight: 21 }}>
                  {selectedMsg.text}
                </Text>
              ) : null}
              <Text style={{ color: APP_THEME.secondaryText, fontSize: 12, marginTop: 6 }}>
                {selectedMsg?.time}
              </Text>
            </View>

            {(() => {
              const readers: any[] = [];
              const delivered: any[] = [];
              const isRead = selectedMsg?.status === 'read';
              const readByList: string[] = Array.isArray(selectedMsg?.readBy) ? selectedMsg.readBy : [];

              if (chatData?.participantDetails) {
                Object.keys(chatData.participantDetails || {}).forEach((uid) => {
                  if (uid === currentUser?.uid) return;
                  const details = chatData.participantDetails[uid];
                  const hasRead = readByList.includes(uid) || (isRead && readByList.length === 0);
                  if (hasRead) {
                    readers.push({ uid, ...details });
                  } else {
                    delivered.push({ uid, ...details });
                  }
                });
              }

              return (
                <>
                  <Text
                    style={{
                      color: APP_THEME.primaryAccent,
                      paddingHorizontal: 16,
                      paddingBottom: 8,
                      fontWeight: 'bold',
                    }}
                  >
                    Read by ({readers.length})
                  </Text>
                  {readers.map((r) => (
                    <View
                      key={r.uid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      }}
                    >
                      <SyncAvatar userId={r.uid} fallbackName={r.name} size={40} isGroup={false} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: APP_THEME.primaryText, fontSize: 16 }} numberOfLines={1}>
                          {r.name}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-done" size={18} color="#38bdf8" />
                    </View>
                  ))}
                  {readers.length === 0 && (
                    <Text
                      style={{
                        color: APP_THEME.secondaryText,
                        paddingHorizontal: 16,
                        paddingBottom: 16,
                      }}
                    >
                      No one has read this yet.
                    </Text>
                  )}

                  <Text
                    style={{
                      color: APP_THEME.primaryAccent,
                      paddingHorizontal: 16,
                      paddingTop: 16,
                      paddingBottom: 8,
                      fontWeight: 'bold',
                    }}
                  >
                    Delivered to ({delivered.length})
                  </Text>
                  {delivered.map((r) => (
                    <View
                      key={r.uid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      }}
                    >
                      <SyncAvatar userId={r.uid} fallbackName={r.name} size={40} isGroup={false} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: APP_THEME.primaryText, fontSize: 16 }} numberOfLines={1}>
                          {r.name}
                        </Text>
                      </View>
                      <Ionicons name="checkmark" size={18} color={APP_THEME.secondaryText} />
                    </View>
                  ))}
                  {delivered.length === 0 && (
                    <Text
                      style={{
                        color: APP_THEME.secondaryText,
                        paddingHorizontal: 16,
                        paddingBottom: 16,
                      }}
                    >
                      No one else in group.
                    </Text>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default ChatMessageInfoModal;
