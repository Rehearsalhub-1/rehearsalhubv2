import { apiClient } from '../lib/apiClient';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '../components/DoodleBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncAvatar } from '../components/SyncAvatar';
import { useUserStore } from '../hooks/useUser';

interface CallLog {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  type: 'voice' | 'video';
  status: 'missed' | 'incoming' | 'outgoing' | 'canceled';
  duration?: number;
  timestamp: Date;
  chatId?: string;
}

const fmtDuration = (s?: number): string => {
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const fmtTime = (d?: Date | string | null) => {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!dateObj || typeof dateObj.getTime !== 'function' || isNaN(dateObj.getTime())) return '';
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (dateObj.toDateString() === now.toDateString())
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dateObj.toDateString() === yest.toDateString()) return 'Yesterday';
  return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function CallsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;

  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const currentUser = useUserStore(s => s.user);

  const loadCalls = useCallback(async (isRefresh = false) => {
    if (!currentUser) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/calls');
      if (res?.success && Array.isArray(res.data)) {
        const logs: CallLog[] = res.data.map((d: any) => {
          const isCaller = currentUser?.uid ? (d.callerId || d.caller_id) === currentUser.uid : false;
          let computedStatus: CallLog['status'] = 'incoming';
          if (d.status === 'declined' || d.status === 'missed') {
            computedStatus = 'missed';
          } else if (d.status === 'canceled') {
            computedStatus = 'canceled';
          } else if (isCaller) {
            computedStatus = 'outgoing';
          } else {
            computedStatus = 'incoming';
          }

          return {
            id: d.id,
            callerId: d.callerId || d.caller_id,
            callerName: d.callerName || d.caller_name || 'Caller',
            callerAvatar: d.callerAvatar || d.caller_avatar,
            receiverId: d.receiverId || d.receiver_id,
            receiverName: d.receiverName || d.receiver_name || 'Receiver',
            receiverAvatar: d.receiverAvatar || d.receiver_avatar,
            type: d.type || 'voice',
            status: computedStatus,
            duration: d.duration,
            timestamp: new Date(d.createdAt || d.created_at || Date.now()),
            chatId: d.chatId || d.chat_id,
          };
        });
        setCalls(logs);
      }
    } catch (e) {
      console.error('[CallsScreen] Failed to load calls:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadCalls();
    }, [loadCalls])
  );

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedCalls(new Set());
    } else {
      setSelectionMode(true);
    }
  };

  const toggleSelectCall = (id: string) => {
    const newSelected = new Set(selectedCalls);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      if (newSelected.size === 0) setSelectionMode(false);
    } else {
      newSelected.add(id);
    }
    setSelectedCalls(newSelected);
  };

  const selectAll = () => {
    if (selectedCalls.size === calls.length) {
      setSelectedCalls(new Set());
      setSelectionMode(false);
    } else {
      setSelectedCalls(new Set(calls.map(c => c.id)));
    }
  };

  const deleteSelected = async () => {
    if (selectedCalls.size === 0) return;
    const idsToDelete = Array.from(selectedCalls);
    try {
      setCalls(prev => prev.filter(c => !selectedCalls.has(c.id)));
      setSelectionMode(false);
      setSelectedCalls(new Set());
      await apiClient.delete('/calls', { ids: idsToDelete });
    } catch (e) {
      console.error('Failed to delete calls:', e);
      loadCalls();
    }
  };

  const handleCallBack = async (item: CallLog) => {
    const cu = currentUser;
    if (!cu) return;
    const isOutgoing = item.callerId === cu.uid;
    const contactId = isOutgoing ? item.receiverId : item.callerId;
    const contactName = isOutgoing ? item.receiverName : item.callerName;
    const contactAvatar = isOutgoing ? item.receiverAvatar : item.callerAvatar;
    try {
      const callRes = await apiClient.post<{ success: boolean; data: any }>('/calls', {
        receiver_id: contactId,
        type: item.type,
      });
      navigation.navigate('Call', {
        callId: (callRes as any)?.data?.id || "",
        callType: item.type,
        contactId,
        contactName,
        contactAvatar,
        isIncoming: false,
        roomId: item.chatId || '',
      });
    } catch (e) {
      console.error('Failed to initiate call:', e);
    }
  };

  const statusIcon = (status: CallLog['status'], type: CallLog['type']) => {
    if (status === 'missed' || status === 'canceled') return { name: 'call-outline' as any, color: T.danger };
    if (status === 'outgoing') return { name: (type === 'video' ? 'videocam-outline' : 'call-outline') as any, color: T.textSecondary };
    return { name: (type === 'video' ? 'videocam-outline' : 'call-outline') as any, color: T.accent };
  };

  const renderItem = ({ item }: { item: CallLog }) => {
    const isOutgoing = item.callerId === currentUser?.uid;
    const contactId = isOutgoing ? item.receiverId : item.callerId;
    const contactName = isOutgoing ? (item.receiverName && item.receiverName !== 'Receiver' ? item.receiverName : 'Member') : (item.callerName || 'Member');
    const contactAvatar = isOutgoing ? item.receiverAvatar : item.callerAvatar;
    const icon = statusIcon(item.status, item.type);
    const isSelected = selectedCalls.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.callRow, isSelected && { backgroundColor: T.cardBackgroundLight }]}
        onLongPress={() => {
          if (!selectionMode) setSelectionMode(true);
          toggleSelectCall(item.id);
        }}
        onPress={() => {
          if (selectionMode) {
            toggleSelectCall(item.id);
          } else {
            handleCallBack(item);
          }
        }}
        delayLongPress={300}
        activeOpacity={0.7}
      >
        {selectionMode && (
          <View style={{ marginRight: 12 }}>
            <Ionicons 
              name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={isSelected ? T.accent : T.textMuted} 
            />
          </View>
        )}
        <SyncAvatar userId={contactId} initialAvatar={contactAvatar} fallbackName={contactName} size={50} />
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{contactName}</Text>
          <View style={styles.callMeta}>
            <Ionicons name={icon.name} size={14} color={icon.color} style={{ marginRight: 4 }} />
            <Text style={[styles.callStatus, { color: (item.status === 'missed' || item.status === 'canceled') ? T.danger : T.textSecondary }]}>
              {item.status === 'missed' ? 'Missed' : item.status === 'canceled' ? 'Canceled' : item.status === 'outgoing' ? 'Outgoing' : 'Incoming'}
              {item.type === 'video' ? ' video' : ' call'}
              {item.duration ? ` · ${fmtDuration(item.duration)}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.callRight}>
          <Text style={styles.callTime}>{fmtTime(item.timestamp)}</Text>
          {!selectionMode && (
            <TouchableOpacity style={styles.callBackBtn} onPress={() => handleCallBack(item)}>
              <Ionicons
                name={item.type === 'video' ? 'videocam-outline' : 'call-outline'}
                size={20}
                color={T.accent}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
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

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (selectionMode) {
              setSelectionMode(false);
              setSelectedCalls(new Set());
            } else {
              navigation.goBack();
            }
          }} style={styles.backBtn}>
            <Ionicons name={selectionMode ? "close" : "chevron-back"} size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectionMode ? `${selectedCalls.size} Selected` : 'Calls'}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 40, justifyContent: 'flex-end' }}>
            {selectionMode ? (
              <>
                <TouchableOpacity onPress={selectAll} style={{ marginRight: 15 }}>
                  <Ionicons name="checkmark-done-outline" size={24} color={T.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={deleteSelected}>
                  <Ionicons name="trash-outline" size={24} color={T.danger} />
                </TouchableOpacity>
              </>
            ) : (
              calls.length > 0 && (
                <TouchableOpacity onPress={() => setSelectionMode(true)}>
                  <Ionicons name="trash-outline" size={22} color={T.textPrimary} />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : calls.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="call-outline" size={56} color={T.textMuted} />
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.emptySub}>Your call history will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={calls}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadCalls(true)}
                tintColor={T.accent}
                colors={[T.accent]}
              />
            }
          />
        )}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="call" size={24} color={T.accent} />
            <Text style={[styles.tabLabel, { color: T.accent }]}>Calls</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => {
            navigation.navigate('ChatRooms');
          }}>
            <Ionicons name="chatbubbles-outline" size={24} color={T.accent} style={{ opacity: 0.6 }} />
            <Text style={[styles.tabLabel, { color: T.accent, opacity: 0.6 }]}>Chats</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
    callRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
      backgroundColor: 'transparent',
    },
    callInfo: { flex: 1 },
    callName: { fontSize: 16, fontWeight: '600', color: T.textPrimary, marginBottom: 3 },
    callMeta: { flexDirection: 'row', alignItems: 'center' },
    callStatus: { fontSize: 13 },
    callRight: { alignItems: 'flex-end', gap: 6 },
    callTime: { fontSize: 12, color: T.textMuted },
    callBackBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: T.cardBackgroundLight,
      justifyContent: 'center', alignItems: 'center',
    },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: T.bottomTabBorder, marginLeft: 78 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: T.textPrimary },
    emptySub: { fontSize: 14, color: T.textSecondary },
    tabBar: {
      height: 50,
      backgroundColor: T.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: T.bottomTabBorder,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingBottom: 2
    },
    tabItem: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1
    },
    tabLabel: {
      fontSize: 10,
      marginTop: 3,
      fontWeight: '500'
    },
  });
};
