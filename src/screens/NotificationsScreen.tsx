import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useUserStore } from '../hooks/useUser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'rehearsal' | 'announcement' | 'reminder' | 'system' | 'admin' | 'song' | 'praise_night';
  priority: 'low' | 'medium' | 'high';
  sender_id?: string;
  sender_name?: string;
  action_url?: string;
  created_at: any;
  is_read: boolean;
  target_audience: 'all' | 'group' | 'individual';
  target_user_id?: string;
  target_group?: string;
  zoneId?: string;
}

const formatNotifTime = (ts: any): string => {
  if (!ts) return '';
  let date: Date;
  if (ts.toDate) {
    date = ts.toDate();
  } else if (typeof ts === 'string') {
    date = new Date(ts);
  } else {
    date = new Date(ts);
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'rehearsal':
      return 'mic-outline';
    case 'announcement':
      return 'megaphone-outline';
    case 'reminder':
      return 'alarm-outline';
    case 'song':
      return 'musical-notes-outline';
    case 'praise_night':
      return 'trophy-outline';
    case 'admin':
      return 'shield-checkmark-outline';
    case 'chat':
      return 'chatbubbles-outline';
    case 'call':
      return 'call-outline';
    case 'system':
    default:
      return 'notifications-outline';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return '#EF4444'; // Red
    case 'medium':
      return '#F59E0B'; // Orange
    case 'low':
    default:
      return '#10B981'; // Green
  }
};
const getNavigationRoute = (actionUrl?: string) => {
  if (!actionUrl) return null;
  const url = actionUrl.toLowerCase();
  if (url.includes('rehearsal') || url.includes('ongoing')) return { screen: 'Rehearsal' };
  if (url.includes('submit')) return { screen: 'SubmitSong' };
  if (url.includes('song') || url.includes('media') || url.includes('player') || url.includes('play')) {
    const match = actionUrl.match(/\/songs?\/([^\/?#]+)/i);
    const songId = match ? match[1] : null;
    if (songId) {
      return { screen: 'Rehearsal', params: { songId } };
    }
    return { screen: 'Player' };
  }
  if (url.includes('subgroup-admin')) return { screen: 'Subgroups' };
  if (url.includes('subgroup')) return { screen: 'Subgroups' };
  if (url.includes('chat') || url.includes('conversation')) {
    const match = actionUrl.match(/(?:chat|conversation|groups\/)([^\/?#&]+)/i) || actionUrl.match(/(?:[?&]chat|[?&]conversation)=([^&]+)/i);
    const chatId = match ? match[1] : null;
    if (chatId) {
      return { screen: 'ChatRooms', params: { chatId } };
    }
    return { screen: 'ChatRooms' };
  }
  if (url.includes('call')) return { screen: 'Calls' };
  if (url.includes('calendar') || url.includes('program')) return { screen: 'Calendar' };

  if (url.includes('lexicon')) return { screen: 'Lexicon' };
  return null;
};

export default function NotificationsScreen({ route, navigation }: any) {
  const { theme, themeName } = useTheme();
  const isLight = themeName === 'light';
  const styles = getStyles(theme);

  const params = route.params || {};
  const card = params.card || {
    title: 'Notifications', 
    subtitle: 'Events, Rehearsals, and Announcements'
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'chat' | 'rehearsals' | 'calls' | 'announcements'>('all');
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const user = useUserStore(s => s.user);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.notifications.getAll();
      if (res?.success && Array.isArray(res.data)) {
        const list: NotificationItem[] = res.data.map((d: any) => ({
          id: d.id,
          title: d.title || 'Notification',
          message: d.message || d.body || '',
          type: d.type || 'info',
          category: d.category || 'announcement',
          priority: d.priority || 'normal',
          sender_name: d.senderName || d.sender_name || 'Admin',
          action_url: d.actionUrl || d.action_url,
          created_at: d.createdAt || d.created_at || new Date().toISOString(),
          is_read: d.is_read !== undefined ? Boolean(d.is_read) : Boolean(d.isRead),
          target_audience: d.targetAudience || d.target_audience || 'all',
          target_user_id: d.targetUserId || d.target_user_id,
          zoneId: d.zoneId || d.zone_id,
        }));
        setNotifications(list);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    fetchNotifications();
  }, [user?.uid, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      await api.notifications.markRead(id, true).catch(() => {});
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const handleToggleRead = async (id: string, currentIsRead: boolean) => {
    const nextState = !currentIsRead;
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: nextState } : n));
      if (selectedNotif && selectedNotif.id === id) {
        setSelectedNotif(prev => prev ? { ...prev, is_read: nextState } : null);
      }
      await api.notifications.markRead(id, nextState).catch(() => {});
    } catch (e) {
      console.error('Error toggling read:', e);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await api.notifications.delete(id).catch(() => {});
    } catch (e) {
      console.error('Error dismissing notification:', e);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedNotif(null);
      await api.notifications.delete(id).catch(() => {});
    } catch (e) {
      console.error('Error dismissing notification:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await api.notifications.markAllRead().catch(() => {});
      Alert.alert('Done', 'All notifications marked as read.');
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const handleNotifPress = async (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }

    const nav = getNavigationRoute(item.action_url);
    if (nav) {
      navigation.navigate(nav.screen, nav.params || {});
    } else {
      setSelectedNotif(item);
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  const chatCount = useMemo(() => {
    return notifications.filter(notif => {
      const cat = (notif.category || '').toLowerCase();
      const type = (notif.type || '').toLowerCase();
      const title = (notif.title || '').toLowerCase();
      const url = (notif.action_url || '').toLowerCase();
      return (
        cat === 'chat' ||
        type === 'chat' ||
        cat === 'message' ||
        url.includes('chat') ||
        title.includes('message') ||
        title.includes('chat')
      );
    }).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (selectedFilter === 'unread') return !notif.is_read;
      if (selectedFilter === 'chat') {
        const cat = (notif.category || '').toLowerCase();
        const type = (notif.type || '').toLowerCase();
        const title = (notif.title || '').toLowerCase();
        const msg = (notif.message || '').toLowerCase();
        const url = (notif.action_url || '').toLowerCase();
        return (
          cat === 'chat' ||
          type === 'chat' ||
          cat === 'message' ||
          url.includes('chat') ||
          title.includes('message') ||
          title.includes('chat') ||
          msg.includes('sent a message')
        );
      }
      if (selectedFilter === 'rehearsals') {
        const cat = (notif.category || '').toLowerCase();
        const title = (notif.title || '').toLowerCase();
        return cat === 'rehearsal' || title.includes('rehearsal');
      }
      if (selectedFilter === 'calls') {
        const cat = (notif.category || '').toLowerCase();
        const type = (notif.type || '').toLowerCase();
        const title = (notif.title || '').toLowerCase();
        return cat === 'call' || type === 'call' || title.includes('call');
      }
      if (selectedFilter === 'announcements') {
        const cat = (notif.category || '').toLowerCase();
        return cat === 'announcement' || cat === 'system' || cat === 'admin' || cat === 'general';
      }
      return true;
    });
  }, [notifications, selectedFilter]);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const s = styles;
    return (
      <TouchableOpacity
        onPress={() => handleNotifPress(item)}
        style={[s.notifRow, !item.is_read && s.notifRowUnread]}
        activeOpacity={0.75}
      >
        <View style={[s.priorityBar, { backgroundColor: getPriorityColor(item.priority) }]} />

        <View style={s.notifIconWrap}>
          <Ionicons
            name={getCategoryIcon(item.category) as any}
            size={20}
            color={theme.colors.accent}
          />
        </View>

        <View style={s.notifContent}>
          <View style={s.notifMetaRow}>
            <Text style={s.categoryBadge}>{item.category.replace('_', ' ')}</Text>
            <Text style={s.notifTime}>{formatNotifTime(item.created_at)}</Text>
          </View>
          
          <Text style={s.notifTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={s.notifBody} numberOfLines={2}>
            {item.message}
          </Text>
        </View>

        {!item.is_read && <View style={s.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isLight ? "dark" : "light"} />
      {card.source ? (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={card.source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </View>
      ) : (
        <LinearGradient
          colors={isLight 
            ? [theme.colors.background, theme.colors.background, theme.colors.backgroundDark]
            : [theme.colors.background, theme.colors.background, '#000814']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <BlurView intensity={25} tint={isLight ? "light" : "dark"} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={isLight 
            ? ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.9)']
            : ['rgba(0, 8, 20, 0.4)', 'rgba(0, 0, 0, 0.85)']}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <BlurView intensity={35} tint="light" style={styles.backButtonBlur}>
                <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
              </BlurView>
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>{card.title}</Text>
            
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn}>
              <BlurView intensity={35} tint="light" style={styles.backButtonBlur}>
                <Ionicons name="checkmark-done" size={20} color={theme.colors.accent} />
              </BlurView>
            </TouchableOpacity>
          </View>
          <View style={styles.filterPillsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 5, gap: 8 }}
            >
              {([
                { key: 'all', label: 'ALL' },
                { key: 'unread', label: unreadCount > 0 ? `UNREAD (${unreadCount})` : 'UNREAD' },
                { key: 'chat', label: chatCount > 0 ? `CHAT (${chatCount})` : 'CHAT' },
                { key: 'rehearsals', label: 'REHEARSALS' },
                { key: 'calls', label: 'CALLS' },
                { key: 'announcements', label: 'ANNOUNCEMENTS' },
              ] as const).map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setSelectedFilter(filter.key as any)}
                  style={[
                    styles.filterPill,
                    selectedFilter === filter.key && styles.filterPillActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedFilter === filter.key && styles.filterPillTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {loading && !refreshing ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={theme.colors.accent} size="large" />
            </View>
          ) : filteredNotifications.length === 0 ? (
            <ScrollView
              contentContainerStyle={{ flex: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchNotifications(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            >
              <View style={styles.emptyState}>
                <BlurView intensity={20} tint="light" style={styles.emptyIconWrap}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={48}
                    color={theme.colors.textMuted}
                  />
                </BlurView>
                <Text style={styles.emptyStateText}>No notifications found</Text>
                <Text style={styles.emptyStateSubText}>
                  {selectedFilter === 'unread'
                    ? "You've read all your notifications!"
                    : "You're all caught up! Check back later."}
                </Text>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={true}
              updateCellsBatchingPeriod={50}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchNotifications(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
            />
          )}
        </SafeAreaView>
      </BlurView>
      <Modal
        visible={!!selectedNotif}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedNotif(null)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
          
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name={selectedNotif ? (getCategoryIcon(selectedNotif.category) as any) : 'notifications'}
                  size={32}
                  color={theme.colors.accent}
                />
              </View>
              <Text style={styles.modalCategory}>
                {selectedNotif?.category?.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.modalTime}>
                {selectedNotif ? formatNotifTime(selectedNotif.created_at) : ''}
              </Text>
            </View>
            <Text style={styles.modalTitle}>{selectedNotif?.title}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.modalBody}>{selectedNotif?.message}</Text>
            </ScrollView>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              {selectedNotif && (
                <TouchableOpacity
                  onPress={() => handleToggleRead(selectedNotif.id, selectedNotif.is_read)}
                  style={[styles.modalCloseBtn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)' }]}
                >
                  <Text style={[styles.modalCloseText, { color: theme.colors.textPrimary }]}>
                    {selectedNotif.is_read ? 'MARK UNREAD' : 'MARK READ'}
                  </Text>
                </TouchableOpacity>
              )}
              {selectedNotif && (
                <TouchableOpacity
                  onPress={() => handleDeleteNotif(selectedNotif.id)}
                  style={[styles.modalCloseBtn, { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
                >
                  <Text style={[styles.modalCloseText, { color: '#EF4444' }]}>DISMISS</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedNotif(null)}
              style={[styles.modalCloseBtn, { marginTop: 8 }]}
            >
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: T.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: T.bottomTabBorder,
    },
    backButtonBlur: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markAllBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: T.bottomTabBorder,
    },
    headerTitle: {
      color: T.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    filterPillsContainer: {
      marginBottom: 10,
    },
    filterScroll: {
      paddingHorizontal: 16,
      paddingVertical: 5,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: T.cardBackgroundLight,
      borderWidth: 1,
      borderColor: T.bottomTabBorder,
    },
    filterPillActive: {
      backgroundColor: T.accent,
      borderColor: T.accentBright,
    },
    filterPillText: {
      color: T.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    filterPillTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      paddingTop: 8,
    },
    centerWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      backgroundColor: T.cardBackgroundLight,
      borderWidth: 1,
      borderColor: T.bottomTabBorder,
      position: 'relative',
      overflow: 'hidden',
    },
    notifRowUnread: {
      backgroundColor: T.cardBackground,
      borderColor: 'rgba(124, 58, 237, 0.4)',
    },
    priorityBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    notifIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(124,58,237,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    notifContent: {
      flex: 1,
    },
    notifMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    categoryBadge: {
      color: T.accent,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notifTime: {
      color: T.textMuted,
      fontSize: 10,
    },
    notifTitle: {
      color: T.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 3,
    },
    notifBody: {
      color: T.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: T.accent,
      marginLeft: 8,
      alignSelf: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 80,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      overflow: 'hidden',
    },
    emptyStateText: {
      color: T.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 10,
    },
    emptyStateSubText: {
      color: T.textMuted,
      fontSize: 12,
      marginTop: 6,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      width: '100%',
      backgroundColor: T.backgroundDark,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: T.bottomTabBorder,
      maxHeight: '70%',
      elevation: 5,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    modalIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(124,58,237,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalCategory: {
      color: T.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    modalTime: {
      color: T.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    modalTitle: {
      color: T.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 12,
    },
    modalScroll: {
      marginBottom: 20,
    },
    modalBody: {
      color: T.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
    },
    modalCloseBtn: {
      backgroundColor: T.accent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalCloseText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
  });
};
