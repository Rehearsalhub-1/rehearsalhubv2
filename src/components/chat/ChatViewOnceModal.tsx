import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface ChatViewOnceModalProps {
  visible: boolean;
  uri: string | null;
  timer: number;
  onClose: () => void;
}

export const ChatViewOnceModal: React.FC<ChatViewOnceModalProps> = ({
  visible,
  uri,
  timer,
  onClose,
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
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(192,132,252,0.25)' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>{timer}s</Text>
            </View>
            <View style={{ width: 40 }} />
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
          <View style={{ paddingBottom: 24, alignItems: 'center' }}>
            <Ionicons name="eye-outline" size={22} color="rgba(255,255,255,0.6)" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4, fontSize: 13 }}>
              View once — disappears in {timer}s
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default ChatViewOnceModal;
