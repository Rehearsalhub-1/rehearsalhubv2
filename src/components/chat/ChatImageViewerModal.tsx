import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface ChatImageViewerModalProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  onSave?: (uri: string) => void;
}

export const ChatImageViewerModal: React.FC<ChatImageViewerModalProps> = ({
  visible,
  uri,
  onClose,
  onSave,
}) => {
  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, zIndex: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.15)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Photo</Text>
            {onSave && uri ? (
              <TouchableOpacity
                onPress={() => onSave(uri)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
          <View style={{ flex: 1, width: '100%', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            {uri && (
              <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default ChatImageViewerModal;
