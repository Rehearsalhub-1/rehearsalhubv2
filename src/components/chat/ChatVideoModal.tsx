import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeTrackPlayer as TrackPlayer } from '../../lib/safeNativeModules';

function ChatVideoPlayerInner({ uri, onClose }: { uri: string; onClose: () => void }) {
  useEffect(() => {
    TrackPlayer.pause().catch(() => {});
  }, []);

  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.play();
  });
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={Boolean(uri)} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" />
        {/* Top Header */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 20,
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.18)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
            Video
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.18)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Video Canvas strictly inset from top and bottom bars */}
        <View style={{
          flex: 1,
          width: '100%',
          paddingTop: Math.max(insets.top, 16) + 50,
          paddingBottom: Math.max(insets.bottom, 16) + 10,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <VideoView
            style={{ width: '100%', height: '100%' }}
            player={player}
            nativeControls={true}
            contentFit="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

export function ChatVideoModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  if (!uri) return null;
  return <ChatVideoPlayerInner uri={uri} onClose={onClose} />;
}

export default ChatVideoModal;
