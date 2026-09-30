import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { useUserStore } from '../hooks/useUser';

function parseDateValue(val: any): Date | null {
  if (!val) return null;
  if (val && typeof val === 'object' && val.toDate) return val.toDate();
  if (val && typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isValidDate(d: Date | null | undefined): d is Date {
  return !!d && !isNaN(d.getTime());
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Returns "YYYY-MM-DD" in LOCAL timezone so midnight-edge records group correctly
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function groupRecords(records: any[]): { key: string; label: string; date: Date | null; items: any[] }[] {
  const map = new Map<string, { label: string; date: Date | null; items: any[] }>();
  for (const r of records) {
    const rawTs = r.checkInTime || r.scannedAt || r.check_in_time || r.timestamp || r.createdAt || r.created_at || r.dateString || r.date_string;
    const parsedDate = parseDateValue(rawTs);
    // Use LOCAL date for grouping key to avoid UTC midnight edge issues
    const dateKey = isValidDate(parsedDate) ? localDateStr(parsedDate) : 'unknown';
    const eventLabel = r.eventName || r.event_name || 'Rehearsal';
    const key = `${eventLabel}__${dateKey}`;
    if (!map.has(key)) {
      map.set(key, { label: eventLabel, date: parsedDate, items: [] });
    }
    map.get(key)!.items.push({ ...r, parsedDate, parsedCheckIn: parsedDate });
  }
  return Array.from(map.entries())
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => {
      if (!isValidDate(a.date) && !isValidDate(b.date)) return 0;
      if (!isValidDate(a.date)) return 1;
      if (!isValidDate(b.date)) return -1;
      return b.date.getTime() - a.date.getTime();
    });
}


export default function AttendanceArchiveScreen({ navigation }: any) {
  const { theme } = useTheme();
  const T = theme.colors;
  const s = getStyles(T, theme);

  const currentUser = useUserStore((st: any) => st.user);

  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const loadRecords = async (showRefresh = false) => {
    if (!currentUser) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.attendance.getMyRecords().catch(() => null);
      const raw: any[] = res?.data || [];
      setAllRecords(raw);
    } catch (e) {
      console.error('[AttendanceArchiveScreen] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadRecords(); }, [currentUser?.uid]);

  const stats = useMemo(() => {
    const total = allRecords.length;
    const present = allRecords.filter((r: any) => r.status === 'present' || r.status === 'completed').length;
    return { total, present, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [allRecords]);

  const groups = useMemo(() => groupRecords(allRecords), [allRecords]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(
          (r: any) => (r.eventName || r.event_name || '').toLowerCase().includes(q) || (r.status || '').toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.label.toLowerCase().includes(q) || g.items.length > 0);
  }, [groups, search]);

  const toggleGroup = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Attendance Archive</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={T.accent} />
            <Text style={s.loadingTxt}>Loading records...</Text>
          </View>
        ) : (
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecords(true)} tintColor={T.accent} colors={[T.accent]} />}
          >
            <View style={s.statsRow}>
              <StatCard label="Sessions" value={stats.total} icon="calendar-outline" color="#60A5FA" theme={T} />
              <StatCard label="Present" value={stats.present} icon="checkmark-circle-outline" color="#34D399" theme={T} />
              <StatCard label="Rate" value={`${stats.rate}%`} icon="trending-up-outline" color="#F59E0B" theme={T} />
            </View>

            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={T.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search events..."
                placeholderTextColor={T.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={T.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {filteredGroups.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="calendar-outline" size={56} color={T.textMuted} style={{ marginBottom: 16 }} />
                <Text style={s.emptyTitle}>No Records Found</Text>
                <Text style={s.emptySubtitle}>
                  {search ? 'Try a different search term.' : 'Your attendance history will appear here once you clock in.'}
                </Text>
              </View>
            ) : (
              filteredGroups.map(group => {
                const isOpen = expandedKeys.has(group.key);
                return (
                  <View key={group.key} style={s.groupCard}>
                    <TouchableOpacity style={s.groupHeader} onPress={() => toggleGroup(group.key)} activeOpacity={0.75}>
                      <View style={s.groupIconWrap}>
                        <Ionicons name="calendar" size={20} color="#60A5FA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.groupLabel} numberOfLines={1}>{group.label}</Text>
                        {isValidDate(group.date) && (
                          <Text style={s.groupDate}>{formatDate(group.date)}</Text>
                        )}
                      </View>
                      <View style={s.groupBadge}>
                        <Text style={s.groupBadgeTxt}>{group.items.length}</Text>
                      </View>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={T.textMuted} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={s.groupBody}>
                        {group.items
                          .slice()
                          .sort((a: any, b: any) => {
                            const ta = isValidDate(a.parsedCheckIn) ? a.parsedCheckIn.getTime() : 0;
                            const tb = isValidDate(b.parsedCheckIn) ? b.parsedCheckIn.getTime() : 0;
                            return ta - tb;
                          })
                          .map((item: any, idx: number) => {
                          const isPresent = item.status === 'present' || item.status === 'completed';
                          const statusColor = isPresent ? '#34D399' : '#F87171';
                          return (
                            <View key={idx} style={[s.recordRow, idx < group.items.length - 1 && s.recordRowDivider]}>
                              <View style={[s.dot, { backgroundColor: statusColor }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={s.recordStatus}>{isPresent ? 'Present' : (item.status || 'Unknown')}</Text>
                                {isValidDate(item.parsedCheckIn) ? (
                                  <Text style={s.recordTime}>
                                    {formatDate(item.parsedCheckIn)} · {formatTime(item.parsedCheckIn)}
                                  </Text>
                                ) : (
                                  <Text style={s.recordTime}>Date unknown</Text>
                                )}
                              </View>
                              {isValidDate(item.parsedCheckIn) && (
                                <Text style={[s.recordTimeBadge, { color: statusColor }]}>{formatTime(item.parsedCheckIn)}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function StatCard({ label, value, icon, color, theme: T }: any) {
  return (
    <View style={[statStyles.card, { borderColor: `${color}30`, backgroundColor: `${color}12` }]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 6 }} />
      <Text style={[statStyles.value, { color: T.textPrimary }]}>{value}</Text>
      <Text style={[statStyles.label, { color: T.textMuted }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1, marginHorizontal: 4 },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
});

const getStyles = (T: any, theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    backBtn: { padding: 6 },
    headerTitle: { color: T.textPrimary, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingTxt: { color: T.textSecondary, fontSize: 14 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
    statsRow: { flexDirection: 'row', marginBottom: 16 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardBackgroundLight, borderRadius: 14, borderWidth: 1, borderColor: T.bottomTabBorder, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
    searchInput: { flex: 1, color: T.textPrimary, fontSize: 14, paddingVertical: 0 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyTitle: { color: T.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptySubtitle: { color: T.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
    groupCard: { backgroundColor: T.cardBackgroundLight, borderRadius: 18, borderWidth: 1, borderColor: T.bottomTabBorder, marginBottom: 12, overflow: 'hidden' },
    groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    groupIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.12)', alignItems: 'center', justifyContent: 'center' },
    groupLabel: { color: T.textPrimary, fontSize: 15, fontWeight: '700' },
    groupDate: { color: T.textMuted, fontSize: 12, marginTop: 2 },
    groupBadge: { backgroundColor: 'rgba(96,165,250,0.18)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, minWidth: 28, alignItems: 'center' },
    groupBadgeTxt: { color: '#60A5FA', fontSize: 12, fontWeight: '800' },
    groupBody: { borderTopWidth: 1, borderTopColor: T.bottomTabBorder, paddingHorizontal: 16 },
    recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    recordRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder },
    dot: { width: 8, height: 8, borderRadius: 4 },
    recordStatus: { color: T.textPrimary, fontSize: 14, fontWeight: '600' },
    recordTime: { color: T.textMuted, fontSize: 12, marginTop: 2 },
    recordTimeBadge: { fontSize: 13, fontWeight: '700' },
  });
