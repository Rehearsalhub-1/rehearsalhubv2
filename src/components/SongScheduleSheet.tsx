import { apiClient } from '../lib/apiClient';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  ActivityIndicator,
  TextInput,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useZone } from '../hooks/useZone';
import { isHQGroup } from '../config/zones';

const { height: H } = Dimensions.get('window');
const StatusPill = ({ status, theme }: { status: string, theme: any }) => {
  const map: Record<string, { bg: string, color: string, label: string }> = {
    rehearsed: { bg: 'rgba(16, 185, 129, 0.15)', color: "#10b981", label: "Rehearsed" },
    "not-rehearsed": { bg: 'rgba(239, 68, 68, 0.15)', color: "#ef4444", label: "Pending" },
    break: { bg: theme.colors.cardBackgroundLight, color: theme.colors.textMuted, label: "Break" }
  };
  const s = map[status] || map["not-rehearsed"];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
      <Text style={{ color: s.color, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{s.label}</Text>
    </View>
  );
};

const SectionHeader = ({ label, count, icon, theme }: { label: string, count?: number, icon: any, theme: any }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
    <Ionicons name={icon} size={22} color={theme.colors.accent} style={{ marginRight: 8 }} />
    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, flex: 1 }}>{label}</Text>
    {count !== undefined && count > 0 && (
      <View style={{ backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 12 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{count}</Text>
      </View>
    )}
  </View>
);

const Card = ({ children, redBorder, theme }: { children: React.ReactNode, redBorder?: boolean, theme: any }) => (
  <View style={[
    {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.bottomTabBorder,
    },
    redBorder && { borderColor: '#ef4444' }
  ]}>
    {redBorder ? (
      <View style={{ width: 4, backgroundColor: '#ef4444', borderRadius: 2, marginRight: 12 }} />
    ) : (
      <View style={{ width: 4, backgroundColor: theme.colors.accent, borderRadius: 2, marginRight: 12 }} />
    )}
    <View style={{ flex: 1 }}>{children}</View>
  </View>
);

const Lbl = ({ c, theme }: { c: string, theme: any }) => (
  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: theme.colors.textMuted, textTransform: "uppercase" }}>{c}</Text>
);

const Val = ({ c, bold, theme }: { c: string | number, bold?: boolean, theme: any }) => (
  <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: bold ? '700' : '500' }}>{c}</Text>
);

const KV = ({ label, value, bold, theme }: { label: string, value: string | number, bold?: boolean, theme: any }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 }}>
    <Lbl c={label} theme={theme} />
    <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginHorizontal: 6 }}>•</Text>
    <Val c={value || '—'} bold={bold} theme={theme} />
  </View>
);

const Reason = ({ c, theme }: { c: string, theme: any }) => {
  if (!c) return null;
  return (
    <View style={{ marginTop: 10, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 8, padding: 10, borderLeftWidth: 2, borderLeftColor: theme.colors.textMuted }}>
      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: "italic", lineHeight: 18 }}>{c}</Text>
    </View>
  );
};

const NewSongs = ({ data, theme }: { data: any[], theme: any }) => (
  <View>
    <SectionHeader label={`New Songs Submitted`} count={data.length} icon="musical-notes" theme={theme} />
    {data.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No new submissions.</Text>}
    {data.map((s: any) => (
      <Card key={s.id} theme={theme}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, flex: 1 }}>{s.title}</Text>
          <View style={{ backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '600' }}>Key: {s.key || '?'} · {s.duration || '--'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          <KV label="By" value={s.submittedBy} bold theme={theme} />
          <KV label="Date" value={s.submittedOn} theme={theme} />
        </View>
      </Card>
    ))}
  </View>
);

const CarriedOver = ({ data, theme }: { data: any[], theme: any }) => (
  <View>
    <SectionHeader label={`Carried Over Songs`} count={data.length} icon="return-down-back" theme={theme} />
    {data.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No carried over songs.</Text>}
    {data.map((s: any) => (
      <Card key={s.id} theme={theme}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, flex: 1 }}>{s.title}</Text>
          <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '700' }}>{s.rehearsalCount || 1} prior rehearsals</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          <KV label="From" value={s.originalProgram} theme={theme} />
          <KV label="Key" value={s.key} theme={theme} />
        </View>
        <Reason c={s.reason} theme={theme} />
      </Card>
    ))}
  </View>
);

const SwappedSongs = ({ data, theme }: { data: any[], theme: any }) => (
  <View>
    <SectionHeader label={`Swapped Songs`} count={data.length} icon="swap-horizontal" theme={theme} />
    {data.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No swapped songs.</Text>}
    {data.map((s: any) => (
      <Card key={s.id} theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <Text style={{ fontSize: 15, color: '#ef4444', textDecorationLine: "line-through" }}>{s.original}</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} style={{ marginHorizontal: 8 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#10b981' }}>{s.replacement}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <KV label="Swapped by" value={s.swappedBy} bold theme={theme} />
          <KV label="Date" value={s.swappedOn} theme={theme} />
        </View>
        <Reason c={s.reason} theme={theme} />
      </Card>
    ))}
  </View>
);

const InvalidSongs = ({ data, theme }: { data: any[], theme: any }) => (
  <View>
    <SectionHeader label={`Invalid Songs`} count={data.length} icon="ban" theme={theme} />
    {data.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No invalid songs.</Text>}
    {data.map((s: any) => (
      <Card key={s.id} redBorder theme={theme}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444', textDecorationLine: "line-through", flex: 1 }}>{s.title}</Text>
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700', textTransform: 'uppercase' }}>{s.invalidatedBy || 'Unknown'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          {s.replacedBy && <KV label="Replaced by" value={s.replacedBy} bold theme={theme} />}
          <KV label="Date" value={s.date} theme={theme} />
        </View>
      </Card>
    ))}
  </View>
);

const NameChanges = ({ data, theme }: { data: any[], theme: any }) => (
  <View>
    <SectionHeader label={`Song Name Changes`} count={data.length} icon="pencil" theme={theme} />
    {data.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No name changes.</Text>}
    {data.map((s: any) => (
      <Card key={s.id} theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <Text style={{ fontSize: 15, color: theme.colors.textMuted, fontStyle: "italic" }}>{s.from}</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.accent} style={{ marginHorizontal: 8 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary }}>{s.to}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <KV label="Changed by" value={s.changedBy} bold theme={theme} />
          <KV label="Date" value={s.changedOn} theme={theme} />
        </View>
        <Reason c={s.reason} theme={theme} />
      </Card>
    ))}
  </View>
);

const DailySchedule = ({ data, theme }: { data: any[], theme: any }) => {
  const rehearsed = data.filter((d: any) => d.status === "rehearsed").length;
  const notRehearsed = data.filter((d: any) => d.status === "not-rehearsed").length;
  const totalMins = data.filter((d: any) => d.status !== "break").reduce((a: number, s: any) => a + (parseInt(s.allotment) || 0), 0);

  return (
    <View>
      <SectionHeader label={`Daily Schedule`} icon="calendar" theme={theme} />
      {data.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 }}>
          {[
            { label: "Rehearsed", val: rehearsed, bg: 'rgba(16, 185, 129, 0.1)', color: "#10b981" },
            { label: "Pending", val: notRehearsed, bg: 'rgba(239, 68, 68, 0.1)', color: "#ef4444" },
            { label: "Total Time", val: `${totalMins}m`, bg: theme.colors.cardBackgroundLight, color: theme.colors.textPrimary }
          ].map(m => (
            <View key={m.label} style={{ backgroundColor: m.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: m.color }}>{m.val}</Text>
              <Text style={{ fontSize: 10, color: m.color, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, textTransform: 'uppercase' }}>{m.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 20 }}>No daily schedule set.</Text>
      )}
      <View>
        {data.map((s: any, i: number) => (
          <View key={s.id} style={{ flexDirection: 'row', marginBottom: 4, opacity: s.status === "not-rehearsed" ? 0.6 : 1 }}>
            <View style={{ width: 50, alignItems: 'flex-end', paddingRight: 10, paddingTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary }}>{s.time}</Text>
            </View>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.status === "break" ? theme.colors.bottomTabBorder : s.status === "rehearsed" ? '#10b981' : '#ef4444', marginTop: 14, borderWidth: 2, borderColor: theme.colors.background }} />
              {i < data.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: theme.colors.bottomTabBorder, marginTop: 4, borderRadius: 1 }} />}
            </View>
            <View style={{ flex: 1, backgroundColor: s.status === "break" ? 'transparent' : theme.colors.cardBackground, borderWidth: s.status === "break" ? 0 : 1, borderColor: theme.colors.bottomTabBorder, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: s.status === "break" ? '500' : '700', color: s.status === "break" ? theme.colors.textMuted : theme.colors.textPrimary, fontStyle: s.status === "break" ? "italic" : "normal", flex: 1 }}>
                  {s.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {s.key && s.key !== "—" && <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>Key {s.key}</Text>}
                  <View style={{ backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textPrimary, fontWeight: '600' }}>{s.allotment}m</Text>
                  </View>
                  <StatusPill status={s.status} theme={theme} />
                </View>
              </View>
              {s.note ? (
                <View style={{ marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.bottomTabBorder, paddingTop: 10 }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: "italic", lineHeight: 18 }}>{s.note}</Text>
                </View>
              ) : null}
            </View>

          </View>
        ))}
      </View>
    </View>
  );
};

const SubmittersPanel = ({ data, theme }: { data: any[], theme: any }) => {
  const [activeFilter, setActiveFilter] = useState<'eligible' | 'ineligible'>('eligible');

  const eligible = data.filter((d: any) => !d.isBlocked);
  const ineligible = data.filter((d: any) => d.isBlocked);

  return (
    <View>
      <SectionHeader label="Song Submission Eligibility" icon="people" theme={theme} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => setActiveFilter('eligible')}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: activeFilter === 'eligible' ? theme.colors.accentSubtle : theme.colors.cardBackgroundLight,
            borderWidth: 1,
            borderColor: activeFilter === 'eligible' ? theme.colors.accent : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: activeFilter === 'eligible' ? theme.colors.accent : theme.colors.textSecondary,
          }}>
            Eligible ({eligible.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('ineligible')}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: activeFilter === 'ineligible' ? 'rgba(239, 68, 68, 0.1)' : theme.colors.cardBackgroundLight,
            borderWidth: 1,
            borderColor: activeFilter === 'ineligible' ? '#ef4444' : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: activeFilter === 'ineligible' ? '#ef4444' : theme.colors.textSecondary,
          }}>
            Ineligible ({ineligible.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View>
        {activeFilter === 'eligible' ? (
          <>
            {eligible.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No eligible submitters listed.</Text>}
            {eligible.map((p: any) => (
              <Card key={p.id} theme={theme}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: theme.colors.textPrimary }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{p.role}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.cardBackgroundLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>Usage: </Text>
                    <Text style={{ fontWeight: '800', fontSize: 14, color: theme.colors.accent }}>{p.submissions || 0}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}> / {p.quota || 0}</Text>
                  </View>
                </View>
                <View style={{ height: 6, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${((p.submissions || 0) / (p.quota || 1)) * 100}%`, backgroundColor: (p.submissions || 0) >= (p.quota || 1) ? '#ef4444' : '#10b981', borderRadius: 3 }} />
                </View>
              </Card>
            ))}
          </>
        ) : (
          <>
            {ineligible.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>No ineligible submitters.</Text>}
            {ineligible.map((p: any) => (
              <Card key={p.id} redBorder theme={theme}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: theme.colors.textPrimary }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{p.role}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                    <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700' }}>Blocked since {p.since || 'Unknown'}</Text>
                  </View>
                </View>
                <Reason c={p.reason} theme={theme} />
              </Card>
            ))}
          </>
        )}
      </View>
    </View>
  );
};

const TABS = [
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "new", label: "New", icon: "musical-notes" },
  { key: "carried", label: "Carried", icon: "return-down-back" },
  { key: "swapped", label: "Swapped", icon: "swap-horizontal" },
  { key: "renamed", label: "Renamed", icon: "pencil" },
  { key: "invalid", label: "Invalid", icon: "ban" },
  { key: "submitters", label: "Eligibility", icon: "people" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SongScheduleSheet({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { currentZone } = useZone();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState("schedule");
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  const [selectedWeekId, setSelectedWeekId] = useState<string>('default_week_1');
  const [selectedDayId, setSelectedDayId] = useState<string>('default_day_1');
  
  const slideAnim = useRef(new Animated.Value(H)).current;
  
  const minimizedTranslateY = H * 0.42; // When minimized, push it down so only 50% of screen is covered

  useEffect(() => {
    if (visible) {
      setIsMaximized(true);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, bounciness: 0, speed: 16,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H, duration: 260, useNativeDriver: true,
      }).start();
      setTimeout(() => {
        setActiveTab("schedule");
        setViewHistory(false);
        setIsMaximized(false);
      }, 300);
    }
  }, [visible]);

  const toggleMaximize = () => {
    const nextMax = !isMaximized;
    setIsMaximized(nextMax);
    Animated.spring(slideAnim, {
      toValue: nextMax ? 0 : minimizedTranslateY,
      useNativeDriver: true, bounciness: 0, speed: 16,
    }).start();
  };
  useEffect(() => {
    if (!currentZone?.id) return;
    
    const resolvedZoneId = isHQGroup(currentZone.id) ? 'zone-001' : currentZone.id;
    const cacheKey = `SCHEDULE_CACHE_${resolvedZoneId}_${viewHistory}`;
    let isMounted = true;
    const loadCache = async () => {
      try {
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr && isMounted) {
          const fetched = JSON.parse(cachedStr);
          setPrograms(fetched);
          setActiveProgramId((prev) => {
            if (!prev || !fetched.find((f: any) => f.id === prev)) {
              const currentProg = fetched.find((f: any) => f.isCurrent);
              if (currentProg) return currentProg.id;
              return fetched.length > 0 ? fetched[fetched.length - 1].id : null;
            }
            return prev;
          });
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch (e) {
        console.error("Error reading schedule cache:", e);
        setLoading(true);
      }
    };

    loadCache();
    apiClient.get<{ success: boolean; data: any[] }>('/schedules').then(res => {
      if (res?.success && Array.isArray(res.data) && isMounted) {
        const fetched = res.data;
        setPrograms(fetched);
        setActiveProgramId((prev) => {
          if (!prev || !fetched.find((f: any) => f.id === prev)) {
            const currentProg = fetched.find((f: any) => f.isCurrent);
            if (currentProg) return currentProg.id;
            return fetched.length > 0 ? fetched[fetched.length - 1].id : null;
          }
          return prev;
        });
        setLoading(false);
      }
    }).catch(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [currentZone?.id, viewHistory]);

  const activeProgram = programs.find(p => p.id === activeProgramId) || null;

  const rawWeeks = activeProgram?.weeks || [
    { id: 'default_week_1', name: 'Week 1' }
  ];

  const rawDays = activeProgram?.days || [
    { id: 'default_day_1', weekId: 'default_week_1', name: 'Day 1' }
  ];
  const weeks = [...rawWeeks].sort((a, b) => {
    if (activeProgram?.currentWeekId === a.id) return -1;
    if (activeProgram?.currentWeekId === b.id) return 1;
    return 0;
  });
  const days = [...rawDays].sort((a, b) => {
    if (activeProgram?.currentDayId === a.id) return -1;
    if (activeProgram?.currentDayId === b.id) return 1;
    return 0;
  });

  useEffect(() => {
    if (weeks.length > 0) {
      const exists = weeks.some((w: any) => w.id === selectedWeekId);
      if (!exists) {
        setSelectedWeekId(weeks[0].id);
      }
    }
  }, [weeks, selectedWeekId]);

  useEffect(() => {
    const weekDays = days.filter((d: any) => d.weekId === selectedWeekId);
    if (weekDays.length > 0) {
      const exists = weekDays.some((d: any) => d.id === selectedDayId);
      if (!exists) {
        setSelectedDayId(weekDays[0].id);
      }
    } else {
      setSelectedDayId('');
    }
  }, [days, selectedWeekId, selectedDayId]);

  useEffect(() => {
    if (activeProgram) {
      const defaultWeek = activeProgram.currentWeekId || activeProgram.weeks?.[0]?.id || 'default_week_1';
      setSelectedWeekId(defaultWeek);
      
      const weekDays = (activeProgram.days || []).filter((d: any) => d.weekId === defaultWeek);
      const defaultDay = activeProgram.currentDayId && weekDays.some((d: any) => d.id === activeProgram.currentDayId)
        ? activeProgram.currentDayId
        : (weekDays[0]?.id || 'default_day_1');
      setSelectedDayId(defaultDay);
    }
  }, [activeProgramId]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} />
      </TouchableOpacity>

      <Animated.View style={[
        { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.92, backgroundColor: theme.colors.accent, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 2 },
        { transform: [{ translateY: slideAnim }] }
      ]}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, overflow: 'hidden' }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.colors.cardBackgroundLight, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
          <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.bottomTabBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.textPrimary }}>Schedule</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 }}>
                  {viewHistory ? 'ARCHIVED PROGRAMS' : 'ACTIVE PROGRAMS'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => setViewHistory(!viewHistory)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: viewHistory ? 'rgba(245, 158, 11, 0.15)' : theme.colors.cardBackgroundLight, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={viewHistory ? "arrow-back" : "archive"} size={14} color={viewHistory ? "#f59e0b" : theme.colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: viewHistory ? "#f59e0b" : theme.colors.textPrimary }}>
                    {viewHistory ? "Active" : "Archive"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleMaximize} style={{ padding: 8, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 20 }}>
                  <Ionicons name={isMaximized ? "chevron-down" : "chevron-up"} size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 20 }}>
                  <Ionicons name="close" size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              {programs.length === 0 && (
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 }}>
                  No {viewHistory ? 'archived' : 'active'} programs available.
                </Text>
              )}
              {programs.map(p => (
                <TouchableOpacity 
                  key={p.id} 
                  onPress={() => setActiveProgramId(p.id)} 
                  style={{ 
                    paddingVertical: 8, 
                    paddingHorizontal: 16, 
                    borderRadius: 20,
                    backgroundColor: activeProgramId === p.id ? theme.colors.accent : theme.colors.cardBackgroundLight,
                    marginRight: 10,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ 
                    fontSize: 13, 
                    fontWeight: '700', 
                    color: activeProgramId === p.id ? '#FFFFFF' : theme.colors.textSecondary 
                  }}>
                    {p.name}
                  </Text>
                  {p.isCurrent && (
                    <View style={{ backgroundColor: activeProgramId === p.id ? 'rgba(255,255,255,0.2)' : 'rgba(245, 158, 11, 0.15)', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4, marginLeft: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: activeProgramId === p.id ? '#FFFFFF' : '#d97706' }}>
                        CURRENT
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {programs.length > 0 && (
            <View style={{ backgroundColor: theme.colors.cardBackground, borderBottomWidth: 1, borderBottomColor: theme.colors.bottomTabBorder }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
                {TABS.map(t => (
                  <TouchableOpacity 
                    key={t.key} 
                    onPress={() => setActiveTab(t.key)} 
                    style={{ 
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14, 
                      paddingHorizontal: 14, 
                      borderBottomWidth: 3, 
                      borderBottomColor: activeTab === t.key ? theme.colors.accent : "transparent",
                    }}
                  >
                    <Ionicons name={t.icon as any} size={18} color={activeTab === t.key ? theme.colors.accent : theme.colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ 
                      fontSize: 13, 
                      fontWeight: activeTab === t.key ? '700' : '600', 
                      color: activeTab === t.key ? theme.colors.textPrimary : theme.colors.textMuted 
                    }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 40 }} />
            ) : activeProgram ? (
              <>
                {activeTab === "new" && <NewSongs data={activeProgram.newSongs || []} theme={theme} />}
                {activeTab === "carried" && <CarriedOver data={activeProgram.carriedOver || []} theme={theme} />}
                {activeTab === "swapped" && <SwappedSongs data={activeProgram.swapped || []} theme={theme} />}
                {activeTab === "invalid" && <InvalidSongs data={activeProgram.invalidSongs || []} theme={theme} />}
                {activeTab === "renamed" && <NameChanges data={activeProgram.nameChanges || []} theme={theme} />}
                {activeTab === "schedule" && (
                  <View>
                    <View style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.bottomTabBorder }}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: 6 }}>
                        {weeks.map((w: any) => {
                          const isSelected = selectedWeekId === w.id;
                          const isCurrent = activeProgram.currentWeekId === w.id;
                          return (
                            <TouchableOpacity
                              key={w.id}
                              onPress={() => setSelectedWeekId(w.id)}
                              style={{
                                paddingVertical: 6,
                                borderBottomWidth: 2,
                                borderBottomColor: isSelected ? theme.colors.accent : 'transparent',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Text style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: isSelected ? theme.colors.accent : theme.colors.textSecondary,
                                opacity: isSelected ? 1 : 0.6
                              }}>
                                {w.name}
                              </Text>
                              {isCurrent && (
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '800',
                                  color: theme.colors.accent,
                                  opacity: isSelected ? 0.95 : 0.65,
                                }}>
                                  (Current)
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <View style={{ marginBottom: 20 }}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                        {days.filter((d: any) => d.weekId === selectedWeekId).map((d: any) => {
                          const isSelected = selectedDayId === d.id;
                          const isCurrent = activeProgram.currentDayId === d.id;
                          return (
                            <TouchableOpacity
                              key={d.id}
                              onPress={() => setSelectedDayId(d.id)}
                              style={{
                                paddingVertical: 6,
                                paddingHorizontal: 16,
                                borderRadius: 20,
                                backgroundColor: isSelected ? theme.colors.accentSubtle : theme.colors.cardBackgroundLight,
                                borderWidth: 1,
                                borderColor: isSelected ? theme.colors.accent : 'transparent',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Text style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: isSelected ? theme.colors.accent : theme.colors.textSecondary,
                              }}>
                                {d.name}
                              </Text>
                              {isCurrent && (
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '800',
                                  color: theme.colors.accent,
                                }}>
                                  (Current)
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                        {days.filter((d: any) => d.weekId === selectedWeekId).length === 0 && (
                          <Text style={{ fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic', paddingVertical: 8 }}>
                            No days added under this week yet.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                    <DailySchedule 
                      data={(activeProgram.dailySchedules || []).filter((s: any) => {
                        const itemWeekId = s.weekId || 'default_week_1';
                        const itemDayId = s.dayId || 'default_day_1';
                        return itemWeekId === selectedWeekId && itemDayId === selectedDayId;
                      })} 
                      theme={theme} 
                    />
                  </View>
                )}
                {activeTab === "submitters" && <SubmittersPanel data={activeProgram.submitters || []} theme={theme} />}
              </>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                <Ionicons name="folder-open-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>No programs to display</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}
