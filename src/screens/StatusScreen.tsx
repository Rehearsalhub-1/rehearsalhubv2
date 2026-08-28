import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/apiClient';
import { uploadMedia } from '../lib/cloudinary';
import { useUserStore } from '../hooks/useUser';
import { useWebSocket } from '../hooks/useWebSocket';

type StatusItem = {
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
  isViewed?: boolean;
};

export default function StatusScreen() {
  const { theme } = useTheme();
  const user = useUserStore((state) => state.user);
  const profile = useUserStore((state) => state.profile);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const currentUserId = user?.uid || '';
  const myStatuses = useMemo(() => statuses.filter((status) => status.userId === currentUserId), [statuses, currentUserId]);
  const authors = useMemo(() => {
    const grouped = new Map<string, StatusItem[]>();
    statuses.forEach((status) => grouped.set(status.userId, [...(grouped.get(status.userId) || []), status]));
    return Array.from(grouped.entries()).map(([userId, items]) => ({ userId, items }));
  }, [statuses]);

  const loadStatuses = useCallback(async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data?: StatusItem[] }>('/statuses');
      if (response.success) setStatuses(response.data || []);
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

  const pickAndPublish = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo and video access to post a status.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.9,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;

    setPublishing(true);
    try {
      const type = asset.type === 'video' ? 'video' : 'image';
      const mediaUrl = await uploadMedia(asset.uri, type);
      const response = await apiClient.post<{ success: boolean; data?: StatusItem }>('/statuses', { mediaUrl, type });
      if (!response.success || !response.data) throw new Error('Status could not be published');
      setStatuses((current) => [response.data!, ...current]);
    } catch (error) {
      Alert.alert('Upload failed', 'Your status could not be posted. Please try again.');
      console.error('[StatusScreen] publish error:', error);
    } finally {
      setPublishing(false);
    }
  };

  const openAuthor = (items: StatusItem[]) => {
    const firstUnread = items.findIndex((item) => !item.isViewed);
    setViewerIndex(statuses.findIndex((item) => item.id === items[firstUnread >= 0 ? firstUnread : 0].id));
  };

  const markViewed = async (status: StatusItem) => {
    if (status.isViewed || status.userId === currentUserId) return;
    setStatuses((current) => current.map((item) => item.id === status.id ? { ...item, isViewed: true } : item));
    await apiClient.post(`/statuses/${encodeURIComponent(status.id)}/view`).catch(() => {});
  };

  const closeViewer = () => setViewerIndex(null);
  const currentStatus = viewerIndex === null ? null : statuses[viewerIndex];

  useEffect(() => {
    if (currentStatus) markViewed(currentStatus);
  }, [viewerIndex]);

  const nextStatus = () => {
    if (viewerIndex === null) return;
    if (viewerIndex >= statuses.length - 1) closeViewer();
    else setViewerIndex(viewerIndex + 1);
  };

  const previousStatus = () => {
    if (viewerIndex === null) return;
    setViewerIndex(Math.max(0, viewerIndex - 1));
  };

  const deleteCurrentStatus = async () => {
    if (!currentStatus || currentStatus.userId !== currentUserId) return;
    await apiClient.delete(`/statuses/${encodeURIComponent(currentStatus.id)}`).catch(() => {});
    setStatuses((current) => current.filter((item) => item.id !== currentStatus.id));
    closeViewer();
  };

  const shareCurrentStatus = async () => {
    if (!currentStatus) return;
    await Share.share({ message: currentStatus.mediaUrl });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Status</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Updates from your choir</Text>
          </View>
          <TouchableOpacity onPress={pickAndPublish} disabled={publishing} style={[styles.addButton, { backgroundColor: theme.colors.accent }]}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addText}>{publishing ? 'Posting' : 'Add status'}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={authors}
          keyExtractor={(item) => item.userId}
          refreshing={loading}
          onRefresh={loadStatuses}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <TouchableOpacity style={styles.myStatusRow} onPress={() => myStatuses.length ? openAuthor(myStatuses) : pickAndPublish()}>
              <View style={styles.avatarRing}>
                {profile?.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : <Ionicons name="person" size={26} color="#fff" />}
                <View style={[styles.plusBadge, { backgroundColor: theme.colors.accent }]}><Ionicons name="add" size={13} color="#fff" /></View>
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>My status</Text>
                <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{myStatuses.length ? 'Tap to view your updates' : 'Share a photo or video'}</Text>
              </View>
            </TouchableOpacity>
          )}
          renderItem={({ item }) => {
            const first = item.items[0];
            return (
              <TouchableOpacity style={styles.statusRow} onPress={() => openAuthor(item.items)}>
                <View style={[styles.avatarRing, item.items.every((status) => status.isViewed) && styles.seenRing]}>
                  {first.userAvatar ? <Image source={{ uri: first.userAvatar }} style={styles.avatar} /> : <Ionicons name="person" size={26} color="#fff" />}
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>{first.userName}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{item.items.length} update{item.items.length === 1 ? '' : 's'} · disappears after 24 hours</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="radio-outline" size={48} color={theme.colors.textMuted} /><Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No status updates yet</Text><Text style={[styles.emptyCopy, { color: theme.colors.textSecondary }]}>Share a rehearsal moment with your choir.</Text></View> : null}
        />
      </SafeAreaView>

      <Modal visible={!!currentStatus} animationType="fade" onRequestClose={closeViewer}>
        {currentStatus && <View style={styles.viewer}>
          {currentStatus.type === 'video' ? <Video source={{ uri: currentStatus.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping /> : <Image source={{ uri: currentStatus.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
          <View style={styles.viewerTop}><Text style={styles.viewerName}>{currentStatus.userName}</Text><Text style={styles.viewerExpiry}>Expires in 24 hours</Text><TouchableOpacity onPress={closeViewer}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity></View>
          <Pressable style={styles.leftTap} onPress={previousStatus} /><Pressable style={styles.rightTap} onPress={nextStatus} />
          <View style={styles.viewerBottom}><Text style={styles.caption}>{currentStatus.caption}</Text><TouchableOpacity onPress={shareCurrentStatus}><Ionicons name="share-outline" size={24} color="#fff" /></TouchableOpacity>{currentStatus.userId === currentUserId && <TouchableOpacity onPress={deleteCurrentStatus}><Ionicons name="trash-outline" size={24} color="#fff" /></TouchableOpacity>}</View>
        </View>}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  myStatusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  avatarRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: '#25D366', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333' },
  seenRing: { borderColor: '#666' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  plusBadge: { position: 'absolute', right: -2, bottom: -1, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111' },
  rowCopy: { flex: 1, marginLeft: 14 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyCopy: { fontSize: 13, textAlign: 'center', marginTop: 8 },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTop: { position: 'absolute', top: 52, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 2 },
  viewerName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewerExpiry: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  leftTap: { position: 'absolute', left: 0, top: 100, bottom: 100, width: '35%' },
  rightTap: { position: 'absolute', right: 0, top: 100, bottom: 100, width: '65%' },
  viewerBottom: { position: 'absolute', left: 18, right: 18, bottom: 40, flexDirection: 'row', alignItems: 'center', gap: 22 },
  caption: { flex: 1, color: '#fff', fontSize: 15 },
});
