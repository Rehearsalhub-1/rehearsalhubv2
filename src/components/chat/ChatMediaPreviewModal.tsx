import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface ChatMediaPreviewModalProps {
  visible: boolean;
  mediaList: any[] | null;
  caption: string;
  isViewOnce: boolean;
  isUploading: boolean;
  onClose: () => void;
  onChangeCaption: (text: string) => void;
  onToggleViewOnce: () => void;
  onSend: () => void;
  screenWidth: number;
}

export const ChatMediaPreviewModal: React.FC<ChatMediaPreviewModalProps> = ({
  visible,
  mediaList,
  caption,
  isViewOnce,
  isUploading,
  onClose,
  onChangeCaption,
  onToggleViewOnce,
  onSend,
  screenWidth,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1, backgroundColor: '#0B141A' }}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* WhatsApp Top Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#0B141A',
              zIndex: 10,
            }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={{
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}>
                <Text style={{ color: '#E9EDEF', fontSize: 14, fontWeight: '600' }}>
                  {mediaList?.length === 1 ? 'Preview' : `${mediaList?.length || 0} items`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={onToggleViewOnce}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isViewOnce ? 'rgba(0, 168, 132, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isViewOnce ? 'eye' : 'eye-outline'}
                  size={18}
                  color={isViewOnce ? '#00A884' : '#E9EDEF'}
                />
                <Text style={{
                  color: isViewOnce ? '#00A884' : '#E9EDEF',
                  fontSize: 12,
                  fontWeight: '600',
                }}>
                  {isViewOnce ? 'View once' : 'Standard'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Centered Media Canvas - Fits 100% within screen, never overflowing */}
            <View style={{ flex: 1, width: '100%', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
              {mediaList && mediaList.length > 0 && (
                <FlatList
                  data={mediaList}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, index) => index.toString()}
                  style={{ flex: 1, width: '100%' }}
                  contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
                  renderItem={({ item }) => (
                    <View style={{ width: screenWidth, flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
                      <Image
                        source={{ uri: item.uri }}
                        style={{ width: screenWidth - 16, height: '100%' }}
                        contentFit="contain"
                      />
                    </View>
                  )}
                />
              )}
            </View>

            {/* WhatsApp Caption Input and Send Button Deck */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 10,
              backgroundColor: '#0B141A',
              gap: 10,
            }}>
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(32, 44, 51, 0.95)',
                borderRadius: 24,
                paddingHorizontal: 16,
                paddingVertical: Platform.OS === 'ios' ? 8 : 4,
                minHeight: 46,
              }}>
                <TextInput
                  style={{
                    flex: 1,
                    color: '#FFFFFF',
                    fontSize: 15,
                    maxHeight: 90,
                    paddingVertical: 4,
                  }}
                  placeholder={mediaList?.length && mediaList.length > 1 ? 'Add a caption to first item…' : 'Add a caption…'}
                  placeholderTextColor="#8696A0"
                  value={caption}
                  onChangeText={onChangeCaption}
                  multiline
                />
                <TouchableOpacity
                  onPress={onToggleViewOnce}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: isViewOnce ? '#00A884' : '#8696A0',
                    backgroundColor: isViewOnce ? 'rgba(0, 168, 132, 0.25)' : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginLeft: 8,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: isViewOnce ? '#00A884' : '#8696A0',
                    fontSize: 13,
                    fontWeight: '700',
                  }}>
                    1
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#00A884',
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.35,
                  shadowRadius: 3,
                  elevation: 5,
                }}
                onPress={onSend}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default ChatMediaPreviewModal;
