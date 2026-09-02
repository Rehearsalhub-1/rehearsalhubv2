import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { uploadMedia } from '../lib/cloudinary';
import { useUserStore } from '../hooks/useUser';
import { useWebSocket } from '../hooks/useWebSocket';
import { cleanSenderName } from '../components/chat';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type StatusItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  mediaUrl: string;
  type: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewers: string[];
  likes?: string[];
  isViewed?: boolean;
};

export default function StatusScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const user = useUserStore((state) => state.user);
  const profile = useUserStore((state) => state.profile);

  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  // Caption modal before publishing
  const [pendingAsset, setPendingAsset] = useState<any | null>(null);
  const [captionInput, setCaptionInput] = useState('');
  const [showCaptionModal, setShowCaptionModal] = useState(false);

  // Viewers sheet modal
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [activeViewers, setActiveViewers] = useState<string[]>([]);

  // Reply modal
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Tab filter: 'all' | 'mine'
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');

  // Double tap heart animation
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);

  const currentUserId = user?.uid || '';

  const myStatuses = useMemo(
    () => statuses.filter((status) => status.userId === currentUserId),
    [statuses, currentUserId]
  );

  const displayedStatuses = useMemo(() => {
    if (activeTab === 'mine') {
      return myStatuses;
    }
    return statuses;
  }, [statuses, myStatuses, activeTab]);

  const loadStatuses = useCallback(async () => {
    try {
      const response = await api.statuses.getAll();
      if (response?.success && Array.isArray(response.data)) {
        setStatuses(response.data);
      }
    } catch (error) {
      console.error('[StatusScreen] load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useWebSocket('statuses', 'all', () => {
    loadStatuses();
  }, !!currentUserId);

  const currentStatus = displayedStatuses[activeIndex] || null;

  // Mark status as viewed when active
  useEffect(() => {
    if (!currentStatus) return;
    if (currentStatus.isViewed || currentStatus.userId === currentUserId) return;

    setStatuses((prev) =>
      prev.map((item) => (item.id === currentStatus.id ? { ...item, isViewed: true } : item))
    );
    api.statuses.view(currentStatus.id);
  }, [activeIndex, currentStatus?.id]);

  // 1-Tap Pick Media
  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow media library access to share status updates.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.9,
    });

    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;

    setPendingAsset(asset);
    setCaptionInput('');
    setShowCaptionModal(true);
  };

  // Publish Media
  const handlePublish = async () => {
    if (!pendingAsset) return;
    setShowCaptionModal(false);
    setPublishing(true);
    setUploadProgressMsg('Uploading status moment...');

    try {
      const type = pendingAsset.type === 'video' ? 'video' : 'image';
      const mediaUrl = await uploadMedia(pendingAsset.uri, type);
      if (!mediaUrl) throw new Error('Could not upload media');

      setUploadProgressMsg('Publishing status...');
      const response = await api.statuses.create({
        mediaUrl,
        type,
        caption: captionInput.trim(),
      });

      if (response?.success && response.data) {
        setStatuses((prev) => [response.data!, ...prev]);
        setActiveIndex(0);
        Alert.alert('✨ Status Live', 'Your choir status is now live for 24 hours!');
      } else {
        throw new Error((response as any)?.error || 'Could not publish status');
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Your status could not be posted. Please try again.');
    } finally {
      setPublishing(false);
      setPendingAsset(null);
      setCaptionInput('');
    }
  };

  // Like status
  const handleLikeStatus = async (statusId: string) => {
    if (!statusId) return;
    const isLiked = currentStatus?.likes?.includes(currentUserId);
    const updatedLikes = isLiked
      ? (currentStatus?.likes || []).filter((id) => id !== currentUserId)
      : [...(currentStatus?.likes || []), currentUserId];

    setStatuses((prev) =>
      prev.map((item) => (item.id === statusId ? { ...item, likes: updatedLikes } : item))
    );

    api.statuses.like(statusId);
  };

  // Double tap to like
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      if (currentStatus) {
        if (!currentStatus.likes?.includes(currentUserId)) {
          handleLikeStatus(currentStatus.id);
        }
        // Trigger popup heart animation
        heartScale.setValue(0);
        heartOpacity.setValue(1);
        Animated.parallel([
          Animated.spring(heartScale, { toValue: 1.4, bounciness: 12, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(450),
            Animated.timing(heartOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]),
        ]).start();
      }
    } else {
      lastTapRef.current = now;
    }
  };

  // Delete status
  const handleDeleteStatus = (statusId: string) => {
    Alert.alert('Delete Status', 'Are you sure you want to remove this status update?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.statuses.delete(statusId);
          setStatuses((prev) => prev.filter((item) => item.id !== statusId));
          if (activeIndex > 0) setActiveIndex(activeIndex - 1);
        },
      },
    ]);
  };

  // Share status
  const handleShareStatus = async () => {
    if (!currentStatus) return;
    await Share.share({
      message: `${currentStatus.userName}'s Choir Status: ${currentStatus.caption ? `"${currentStatus.caption}" ` : ''}${currentStatus.mediaUrl}`,
    }).catch(() => {});
  };

  // Send direct message reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !currentStatus) return;
    setReplySending(true);
    try {
      // Find or create direct chat with author
      const chatRes = await api.chats.create({
        type: 'direct',
        participants: [currentStatus.userId],
      });

      if (chatRes?.success && chatRes.data?.id) {
        await api.chats.sendMessage(chatRes.data.id, {
          content: `Replying to status: "${currentStatus.caption || 'Photo/Video'}"\n\n${replyText.trim()}`,
        });
        setShowReplyModal(false);
        setReplyText('');
        Alert.alert('Reply Sent', `Your message was sent to ${currentStatus.userName}.`);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not send reply message.');
    } finally {
      setReplySending(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const index = viewableItems[0].index;
      if (typeof index === 'number') {
        setActiveIndex(index);
      }
    }
  }).current;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Main Full-Screen Vertical Reel */}
      {displayedStatuses.length > 0 ? (
        <FlatList
          data={displayedStatuses}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          renderItem={({ item, index }) => {
            const isActive = index === activeIndex;
            const isLiked = item.likes?.includes(currentUserId);
            const isMe = item.userId === currentUserId;

            return (
              <Pressable style={styles.reelCard} onPress={handleDoubleTap}>
                {/* Media Layer */}
                {item.type === 'video' ? (
                  <Video
                    source={{ uri: item.mediaUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={isActive}
                    isLooping
                    isMuted={isMuted}
                  />
                ) : (
                  <Image source={{ uri: item.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                )}

                {/* Top Gradient */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.2)', 'transparent']}
                  style={styles.topGradient}
                  pointerEvents="none"
                />

                {/* Bottom Gradient */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                  style={styles.bottomGradient}
                  pointerEvents="none"
                />

                {/* Double Tap Popup Heart */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.floatingHeart,
                    {
                      opacity: heartOpacity,
                      transform: [{ scale: heartScale }],
                    },
                  ]}
                >
                  <Ionicons name="heart" size={100} color="#ff2d55" />
                </Animated.View>

                {/* Right Action Stack */}
                <View style={[styles.rightActionStack, { bottom: insets.bottom + 90 }]}>
                  {/* Author Avatar with Plus Badge for Quick Post */}
                  <TouchableOpacity
                    style={styles.actionAvatarContainer}
                    activeOpacity={0.85}
                    onPress={() => (isMe ? handlePickMedia() : null)}
                  >
                    <Image
                      source={{
                        uri: item.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userName)}&background=7c3aed&color=fff`,
                      }}
                      style={styles.actionAvatar}
                    />
                    {isMe && (
                      <View style={styles.avatarPlusBadge}>
                        <Ionicons name="add" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Like Button */}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    activeOpacity={0.7}
                    onPress={() => handleLikeStatus(item.id)}
                  >
                    <Ionicons
                      name={isLiked ? 'heart' : 'heart-outline'}
                      size={32}
                      color={isLiked ? '#ff2d55' : '#fff'}
                    />
                    <Text style={styles.actionCount}>{(item.likes || []).length}</Text>
                  </TouchableOpacity>

                  {/* Reply Button */}
                  {!isMe && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      activeOpacity={0.7}
                      onPress={() => setShowReplyModal(true)}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
                      <Text style={styles.actionCount}>Reply</Text>
                    </TouchableOpacity>
                  )}

                  {/* Share Button */}
                  <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleShareStatus}>
                    <Ionicons name="paper-plane-outline" size={28} color="#fff" />
                    <Text style={styles.actionCount}>Share</Text>
                  </TouchableOpacity>

                  {/* Viewers Eye Button */}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isMe) {
                        setActiveViewers(item.viewers || []);
                        setShowViewersModal(true);
                      }
                    }}
                  >
                    <Ionicons name="eye-outline" size={26} color="#fff" />
                    <Text style={styles.actionCount}>{(item.viewers || []).length}</Text>
                  </TouchableOpacity>

                  {/* Delete Button (If Owner) */}
                  {isMe && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteStatus(item.id)}
                    >
                      <Ionicons name="trash-outline" size={26} color="#f87171" />
                    </TouchableOpacity>
                  )}

                  {/* Mute/Unmute if video */}
                  {item.type === 'video' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      activeOpacity={0.7}
                      onPress={() => setIsMuted(!isMuted)}
                    >
                      <Ionicons name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Bottom Left Info */}
                <View style={[styles.bottomInfoContainer, { bottom: insets.bottom + 85 }]}>
                  <View style={styles.authorRow}>
                    <Text style={styles.authorName}>{cleanSenderName(item.userName)}</Text>
                    <View style={styles.choirBadge}>
                      <Text style={styles.choirBadgeText}>Choir</Text>
                    </View>
                  </View>

                  {!!item.caption && (
                    <Text style={styles.captionText} numberOfLines={3}>
                      {item.caption}
                    </Text>
                  )}

                  <View style={styles.audioTickerRow}>
                    <Ionicons name="musical-notes" size={14} color="#a78bfa" style={{ marginRight: 6 }} />
                    <Text style={styles.audioTickerText}>LoveWorld Singers Rehearsal Repertoire</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        /* Empty State */
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 60 }]}>
          <LinearGradient
            colors={['rgba(124, 58, 237, 0.25)', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="videocam-outline" size={72} color="#a78bfa" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyHeading}>No Status Updates Yet</Text>
          <Text style={styles.emptySubtext}>
            Be the first in your choir to share a rehearsal video or moment with your team!
          </Text>
          <TouchableOpacity style={styles.emptyPostButton} activeOpacity={0.85} onPress={handlePickMedia}>
            <LinearGradient
              colors={['#8b5cf6', '#6d28d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.emptyPostButtonText}>Post Status Moment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top Header Floating Overlay */}
      <SafeAreaView style={styles.topHeaderContainer} pointerEvents="box-none">
        <View style={styles.topHeaderRow}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Segment Filter */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'all' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.segmentText, activeTab === 'all' && styles.segmentTextActive]}>
                Choir Feed
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'mine' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('mine')}
            >
              <Text style={[styles.segmentText, activeTab === 'mine' && styles.segmentTextActive]}>
                My Updates {myStatuses.length > 0 ? `(${myStatuses.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1-Tap Quick Post Button */}
          <TouchableOpacity
            style={styles.headerAddButton}
            activeOpacity={0.8}
            onPress={handlePickMedia}
            disabled={publishing}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Publishing Progress Banner */}
      {publishing && (
        <View style={[styles.publishingBanner, { top: insets.top + 70 }]}>
          <LinearGradient
            colors={['rgba(124, 58, 237, 0.92)', 'rgba(79, 70, 229, 0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.publishingText}>{uploadProgressMsg}</Text>
        </View>
      )}

      {/* Caption & Post Modal */}
      <Modal visible={showCaptionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Status Caption</Text>
                <TouchableOpacity onPress={() => setShowCaptionModal(false)}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <TextInput
                value={captionInput}
                onChangeText={setCaptionInput}
                placeholder="Write a rehearsal thought or note..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.captionInput}
                multiline
                maxLength={300}
                autoFocus
              />

              <TouchableOpacity style={styles.publishBtn} activeOpacity={0.85} onPress={handlePublish}>
                <LinearGradient
                  colors={['#8b5cf6', '#6d28d9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.publishBtnText}>Share Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reply Modal */}
      <Modal visible={showReplyModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reply to {currentStatus?.userName}</Text>
                <TouchableOpacity onPress={() => setShowReplyModal(false)}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Send a message..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.captionInput}
                multiline
                autoFocus
              />

              <TouchableOpacity
                style={styles.publishBtn}
                activeOpacity={0.85}
                onPress={handleSendReply}
                disabled={replySending}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#6d28d9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.publishBtnText}>{replySending ? 'Sending...' : 'Send Message'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Viewers Sheet Modal */}
      <Modal visible={showViewersModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '60%', paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="eye-outline" size={20} color="#a78bfa" />
                <Text style={styles.modalTitle}>Status Viewers ({activeViewers.length})</Text>
              </View>
              <TouchableOpacity onPress={() => setShowViewersModal(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {activeViewers.length > 0 ? (
              <FlatList
                data={activeViewers}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <Ionicons name="person-circle-outline" size={32} color="#a78bfa" style={{ marginRight: 10 }} />
                    <Text style={styles.viewerNameText}>Choir Member ({item.slice(0, 8)})</Text>
                  </View>
                )}
              />
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginVertical: 24 }}>
                No views yet. Your updates are visible to choir members.
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelCard: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#09090b',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  floatingHeart: {
    position: 'absolute',
    top: '40%',
    left: SCREEN_WIDTH / 2 - 50,
    zIndex: 10,
  },
  topHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentBtnActive: {
    backgroundColor: '#7c3aed',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#fff',
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  rightActionStack: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 16,
    zIndex: 15,
  },
  actionAvatarContainer: {
    marginBottom: 6,
    alignItems: 'center',
  },
  actionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  avatarPlusBadge: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfoContainer: {
    position: 'absolute',
    left: 16,
    right: 80,
    zIndex: 15,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  choirBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a78bfa',
  },
  choirBadgeText: {
    color: '#e9d5ff',
    fontSize: 10,
    fontWeight: '700',
  },
  captionText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  audioTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioTickerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyHeading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyPostButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  publishingBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    overflow: 'hidden',
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  publishingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  publishBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  viewerNameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
