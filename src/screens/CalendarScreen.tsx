import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useUserStore } from '../hooks/useUser';
import { useZone } from '../hooks/useZone';
import * as Location from 'expo-location';

LocaleConfig.locales['en'] = {
  monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['S','M','T','W','T','F','S'],
};
LocaleConfig.defaultLocale = 'en';

const mapWeatherCode = (code: number, accentColor: string) => {
  if (code === 0)                    return { condition: 'Sunny',         icon: 'sunny',              color: '#fbbf24' };
  if (code >= 1 && code <= 3)        return { condition: 'Partly Cloudy', icon: 'partly-sunny',       color: '#94a3b8' };
  if (code === 45 || code === 48)    return { condition: 'Foggy',         icon: 'cloudy',             color: '#64748b' };
  if (code >= 51 && code <= 55)      return { condition: 'Drizzle',       icon: 'rainy-outline',      color: '#60a5fa' };
  if (code >= 61 && code <= 65)      return { condition: 'Rainy',         icon: 'rainy',              color: '#3b82f6' };
  if (code >= 71 && code <= 77)      return { condition: 'Snowy',         icon: 'snow',               color: '#93c5fd' };
  if (code >= 80 && code <= 82)      return { condition: 'Showers',       icon: 'thunderstorm-outline', color: '#2563eb' };
  if (code >= 95 && code <= 99)      return { condition: 'Thunderstorm',  icon: 'thunderstorm',       color: accentColor };
  return                               { condition: 'Clear',          icon: 'sunny',              color: '#fbbf24' };
};

const getLiveTraffic = (condition: string, location: string = 'ASESE BASE') => {

  const h   = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;
  const isRainy   = /rain|storm|drizzle/i.test(condition);

  const status = (clear: string, mod: string, heavy: string, peak1: boolean, peak2: boolean) => {

    if (peak2 || (isRainy && peak1)) return { text: heavy, color: '#ef4444', icon: 'alert-circle' };
    if (peak1 || (isRainy))          return { text: mod,   color: '#f59e0b', icon: 'trending-up' };
    return                             { text: clear, color: '#4ade80', icon: 'checkmark-circle' };
  };

  const r1 = status('ROAD CLEAR', 'MODERATE DELAYS', 'HEAVY TRAFFIC',
    !isWeekend && h >= 6 && h <= 10, !isWeekend && h >= 16 && h <= 20);
  const r2 = status('FREE FLOW',  'SLOW MOVING',     'HEAVY TRAFFIC',
    !isWeekend && h >= 7 && h <= 9,  false);
  const r3 = status('FREE FLOW',  'MODERATE DELAYS', 'HEAVY TRAFFIC',
    !isWeekend && h >= 15 && h <= 19, !isWeekend && h >= 6 && h <= 9);

  const hasHeavy = [r1,r2,r3].some(r => r.text.includes('HEAVY'));
  const hasMod   = [r1,r2,r3].some(r => r.text.includes('MOD') || r.text.includes('SLOW'));

  const isBase = location.toUpperCase() === 'ASESE BASE' || location.toUpperCase() === 'LAGOS';

  return {
    overallStatus: hasHeavy ? 'Congested' : hasMod ? 'Slow Moving' : 'Flowing',
    overallColor:  hasHeavy ? '#ef4444'   : hasMod ? '#f59e0b'     : '#4ade80',
    routes: isBase
      ? [
          { label: 'Asese → Berger', ...r1 },
          { label: 'Longbridge / Expressway', ...r2 },
          { label: 'Lagos-Inbound (General)', ...r3 },
        ]
      : [
          { label: `${location} Central Bypass`, ...r1 },
          { label: `${location} Downtown Route`, ...r2 },
          { label: `${location} Suburban Route`, ...r3 },
        ],
  };
};

const getRealTraffic = async (lat: number, lon: number) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key is not defined');
  }
  const offsets = [
    { dLat: 0.02, dLon: 0.02 },
    { dLat: -0.02, dLon: -0.02 },
    { dLat: 0.02, dLon: -0.02 }
  ];

  const fetchRouteTraffic = async (dLat: number, dLon: number) => {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lon}&destination=${lat + dLat},${lon + dLon}&departure_time=now&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Google Directions API error status: ${data.status}`);
    }

    const leg = data.routes[0]?.legs[0];
    if (!leg) throw new Error('No legs found in Google Directions response');

    const durationVal = leg.duration.value;
    const trafficVal = leg.duration_in_traffic?.value || durationVal;
    const ratio = trafficVal / durationVal;

    let text = 'ROAD CLEAR';
    let color = '#4ade80';
    let icon = 'checkmark-circle';

    if (ratio > 1.35) {
      text = 'HEAVY TRAFFIC';
      color = '#ef4444';
      icon = 'alert-circle';
    } else if (ratio > 1.1) {
      text = 'MODERATE DELAYS';
      color = '#f59e0b';
      icon = 'trending-up';
    }
    let label = leg.end_address.split(',')[0] || 'Local Highway';
    if (label.match(/^\d+$/) || label.length < 3) {
      label = leg.steps[leg.steps.length - 1]?.html_instructions?.replace(/<[^>]*>/g, '') || 'Local Bypass';
    }

    return { label, text, color, icon };
  };

  const routes = await Promise.all(
    offsets.map(o => fetchRouteTraffic(o.dLat, o.dLon))
  );

  const hasHeavy = routes.some(r => r.text.includes('HEAVY'));
  const hasMod   = routes.some(r => r.text.includes('MOD') || r.text.includes('SLOW'));

  return {
    overallStatus: hasHeavy ? 'Congested' : hasMod ? 'Slow Moving' : 'Flowing',
    overallColor:  hasHeavy ? '#ef4444'   : hasMod ? '#f59e0b'     : '#4ade80',
    routes
  };
};

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  location?: string;
  type: string;
  zoneId: string;
  isGlobal?: boolean;
  createdBy: string;
}

interface BirthdayUser {
  id: string;
  first_name: string;
  last_name: string;
  birthday: string;
  profile_image_url?: string;
  age: number;
  isToday: boolean;
}

const HQ_IDS = [
  'zone-001','zone-002','zone-003','zone-004','zone-005',
  'zone-orchestra','zone-president','zone-president-2','zone-director',
  'zone-oftp','zone-oftd','zone-national','zone-international','zone-sa-1','zone-boss'
];

const getEventColors = (theme: any): Record<string, string> => ({
  rehearsal: theme.colors.accent,
  performance: '#f43f5e',
  meeting: '#0ea5e9',
  other: '#f59e0b',
});

const formatEventTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function CalendarScreen({ route, navigation }: any) {
  const { theme, themeName } = useTheme();
  const s = getStyles(theme);
  const isLight = themeName === 'light';

  const { card } = route.params || {};
  const bgSource = card?.source;
  const today     = new Date().toISOString().split('T')[0];
  const [selected, setSelected] = useState(today);
  const [month,    setMonth]    = useState(new Date());

  const [locationName, setLocationName] = useState('LAGOS');
  const [trafficLocation, setTrafficLocation] = useState('ASESE BASE');

  const [weather, setWeather] = useState({
    temp: 28, condition: 'Sunny', icon: 'sunny', color: '#fbbf24',
    forecast: [
      { day: 'MON', icon: 'cloud',        temp: 26 },
      { day: 'TUE', icon: 'sunny',        temp: 29 },
      { day: 'WED', icon: 'partly-sunny', temp: 27 },
    ],
  });
  const [traffic,        setTraffic]        = useState(getLiveTraffic('Sunny', 'ASESE BASE'));
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [lastUpdated,    setLastUpdated]    = useState('Just now');

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(true);
  const [userZoneId, setUserZoneId] = useState('');
  const { currentZone, isLoading: isZoneLoading } = useZone();
  const user = useUserStore(s => s.user);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  useEffect(() => {
    if (isZoneLoading || isProfileLoading || !user) return;
    if (currentZone?.id) {
      setUserZoneId(currentZone.id);
    }
  }, [currentZone?.id, isZoneLoading, isProfileLoading, user?.uid]);
  useEffect(() => {
    if (!userZoneId) return;
    setEventsLoading(true);
    let isMounted = true;
    const uid = user?.uid || '';

    const fetchEvents = async () => {
      try {
        const res = await api.events.getUpcoming(userZoneId).catch(() => null);
        if (!isMounted) return;

        let rawEvents: any[] = [];
        if (Array.isArray(res)) {
          rawEvents = res;
        } else if (res && typeof res === 'object') {
          if (Array.isArray(res.data)) rawEvents = res.data;
          else if (Array.isArray(res.items)) rawEvents = res.items;
        }

        const all = rawEvents.map((data: any) => {
          let startDate = new Date();
          if (data.date) {
            startDate = new Date(data.date);
          } else if (data.event_start_date) {
            startDate = new Date(data.event_start_date);
          } else if (data.createdAt || data.created_at) {
            startDate = new Date(data.createdAt || data.created_at);
          }
          if (isNaN(startDate.getTime())) startDate = new Date();

          let endDate = startDate;
          if (data.endDate || data.event_end_date) {
            const parsedEnd = new Date(data.endDate || data.event_end_date);
            if (!isNaN(parsedEnd.getTime())) endDate = parsedEnd;
          }

          const cat = data.type || data.category || 'rehearsal';
          const eventTitle = data.title || data.name || data.eventName || data.event_name || data.summary || data.programName || data.program || data.subject || (data.description ? data.description.slice(0, 35) : '') || 'Ministry Event';
          return {
            id: data.id || `ev_${Math.random().toString(36).slice(2, 7)}`,
            title: eventTitle,
            description: data.description || data.message || '',
            start: startDate,
            end: endDate,
            allDay: true,
            color: getEventColors(theme)[cat] || theme.colors.accent,
            location: data.location || '',
            type: cat,
            zoneId: data.zoneId || '',
            isGlobal: data.isGlobal === true || !data.zoneId,
            createdBy: data.createdBy || data.sender_id || '',
            target_audience: data.target_audience,
            target_user_id: data.target_user_id,
            target_group: data.target_group,
          } as CalendarEvent;
        });

        all.sort((a, b) => a.start.getTime() - b.start.getTime());
        setEvents(all);
      } catch (err) {
        console.error('Calendar fetch error:', err);
      } finally {
        if (isMounted) setEventsLoading(false);
      }
    };

    fetchEvents();
    return () => { isMounted = false; };
  }, [userZoneId]);
  useEffect(() => {
    if (!userZoneId) return;
    
    let isMounted = true;
    const cacheKey = `CALENDAR_BIRTHDAYS_${userZoneId}`;
    const syncTimeKey = `CALENDAR_BIRTHDAYS_SYNC_TIME_${userZoneId}`;

    const loadBirthdaysData = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        const lastSyncStr = await AsyncStorage.getItem(syncTimeKey);
        const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
        
        if (cached && isMounted) {
          setBirthdays(JSON.parse(cached));
          setBirthdaysLoading(false);
          if (Date.now() - lastSync < 6 * 60 * 60 * 1000) {

            return;
          }
        }

const isBirthdayThisWeek = (rawBday: string): { isThisWeek: boolean; isToday: boolean } => {
  if (!rawBday || typeof rawBday !== 'string') return { isThisWeek: false, isToday: false };
  const d = new Date(rawBday);
  if (isNaN(d.getTime())) return { isThisWeek: false, isToday: false };

  const now = new Date();
  const currentYear = now.getFullYear();

  const thisYearBday = new Date(currentYear, d.getMonth(), d.getDate());

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const isThisWeek = thisYearBday >= startOfWeek && thisYearBday <= endOfWeek;
  const isToday = thisYearBday.getMonth() === now.getMonth() && thisYearBday.getDate() === now.getDate();

  return { isThisWeek, isToday };
};

        const profRes = await api.profiles.getBirthdays(userZoneId).catch(() => null);
        const rawBirthdays = profRes?.data || [];
        const now = new Date();
        const results: BirthdayUser[] = [];
        for (const b of rawBirthdays) {
          if (!b.birthday) continue;
          const { isThisWeek, isToday } = isBirthdayThisWeek(b.birthday);
          if (!isThisWeek && !b.isToday) continue;

          let bdayDate = new Date(b.birthday);
          let age: number | undefined = undefined;
          if (!isNaN(bdayDate.getTime())) {
            age = now.getFullYear() - bdayDate.getFullYear();
          }
          results.push({
            id: b.id,
            first_name: b.first_name || 'Member',
            last_name: b.last_name || '',
            birthday: b.birthday,
            profile_image_url: b.profile_image_url,
            age: age || 0,
            isToday: isToday || !!b.isToday,
          });
        }
        results.sort((a, b) => (b.isToday ? 1 : 0) - (a.isToday ? 1 : 0));
        
        if (isMounted) {
          setBirthdays(results);
          setBirthdaysLoading(false);
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(results));
        await AsyncStorage.setItem(syncTimeKey, Date.now().toString());
      } catch (e) {
        console.error('Error loading birthdays:', e);
        if (isMounted) setBirthdaysLoading(false);
      }
    };
    
    loadBirthdaysData();

    return () => {
      isMounted = false;
    };
  }, [userZoneId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let lat = 6.74;
        let lon = 3.42;
        let city = 'LAGOS';
        let base = 'ASESE BASE';

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
            const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            if (geo && geo.length > 0) {
              city = geo[0].city || geo[0].subregion || geo[0].region || 'Your Location';
              base = geo[0].street || geo[0].name || city;
            }
          }
        } catch (err) {

        }

        if (active) {
          setLocationName(city.toUpperCase());
          setTrafficLocation(base.toUpperCase());
        }

        const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max&timezone=auto`);
        const data = await res.json();
        if (!active || !data?.current_weather) return;
        const cw   = mapWeatherCode(data.current_weather.weathercode, theme.colors.accent);
        const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
        const fc   = (data.daily?.time || []).slice(1, 4).map((t: string, i: number) => ({
          day:  days[new Date(t).getDay()],
          icon: mapWeatherCode(data.daily.weathercode[i + 1] ?? 0, theme.colors.accent).icon,
          temp: Math.round(data.daily.temperature_2m_max[i + 1] ?? 28),
        }));
        setWeather({ temp: Math.round(data.current_weather.temperature), ...cw, forecast: fc.length ? fc : weather.forecast });

        let trafficData;
        try {
          trafficData = await getRealTraffic(lat, lon);

        } catch (err) {
          console.warn('[CalendarScreen] Failed to load live Google traffic, using simulation fallback:', err);
          trafficData = getLiveTraffic(cw.condition, base);
        }
        setTraffic(trafficData);
      } catch (err) {

      } finally {
        if (active) setWeatherLoading(false);
      }
    })();
    const t = setInterval(() => setLastUpdated('1 min ago'), 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const monthLabel = month.toLocaleString('default', { month: 'long' });
  const yearLabel  = month.getFullYear();

  const shiftMonth = (d: number) => {

    const n = new Date(month);
    n.setMonth(n.getMonth() + d);
    setMonth(n);
  };

  const markedDates = React.useMemo(() => {
    const marks: any = {};
    events.forEach(event => {
      let current = new Date(event.start);
      current.setHours(0, 0, 0, 0);
      
      const end = new Date(event.end);
      end.setHours(23, 59, 59, 999);

      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (!marks[dateStr]) {
          marks[dateStr] = { marked: true, dotColor: event.color || theme.colors.accent };
        }
        current.setDate(current.getDate() + 1);
      }
    });
    if (!marks[today]) {
      marks[today] = { today: true };
    } else {
      marks[today] = { ...marks[today], today: true };
    }
    marks[selected] = {
      ...marks[selected],
      selected: true,
      disableTouchEvent: true,
      selectedColor: theme.colors.accent,
    };

    return marks;
  }, [events, selected, today, theme.colors.accent]);

  const selectedDateEvents = React.useMemo(() => {
    return events.filter(ev => {
      const selDate = new Date(selected);
      selDate.setHours(12, 0, 0, 0); // Use noon to avoid timezone shift edge cases
      
      const start = new Date(ev.start);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(ev.end);
      end.setHours(23, 59, 59, 999);

      return selDate >= start && selDate <= end;
    });
  }, [events, selected]);

  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter(ev => {
        const end = new Date(ev.end);
        return end.getTime() >= now.getTime();
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {bgSource ? (
        <Image source={bgSource} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      )}
      {isLight ? (
        <LinearGradient
          colors={['rgba(233,230,247,0.75)', 'rgba(217,212,238,0.85)', 'rgba(233,230,247,0.95)']}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)', 'rgba(0,0,0,0.92)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home');
            }}
            style={s.iconBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={s.monthArrow}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', minWidth: 140 }}>
              <Text style={s.monthText}>{monthLabel}</Text>
              <Text style={s.yearText}>{yearLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={s.monthArrow}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => { setSelected(today); setMonth(new Date()); }} style={s.iconBtn}>
            <Ionicons name="today-outline" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={s.calCard}>
            <Calendar
              key={month.getMonth() + '-' + month.getFullYear()}
              current={month.toISOString().split('T')[0]}
              onDayPress={(day: any) => setSelected(day.dateString)}
              markedDates={markedDates}
              hideArrows
              enableSwipeMonths={false}
              style={{ backgroundColor: 'transparent' }}
              theme={{
                backgroundColor:            'transparent',
                calendarBackground:         'transparent',
                textSectionTitleColor:      isLight ? 'rgba(10,10,15,0.45)' : 'rgba(255,255,255,0.35)',
                selectedDayBackgroundColor: theme.colors.accent,
                selectedDayTextColor:       theme.colors.textPrimary,
                todayTextColor:             theme.colors.accent,
                todayBackgroundColor:       theme.colors.accent + '22',
                dayTextColor:               theme.colors.textPrimary,
                textDisabledColor:          isLight ? 'rgba(10,10,15,0.18)' : 'rgba(255,255,255,0.12)',
                dotColor:                   theme.colors.accent,
                selectedDotColor:           theme.colors.textPrimary,
                monthTextColor:             'transparent',
                textDayFontWeight:          '600',
                textDayHeaderFontWeight:    '700',
                textDayFontSize:            15,
                textDayHeaderFontSize:      11,
                'stylesheet.calendar.header': {
                  header:    { height: 0, opacity: 0 },
                  dayHeader: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
                },
              } as any}
            />
          </View>
          {birthdays.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>🎂 BIRTHDAYS THIS WEEK</Text>
              </View>
              {birthdaysLoading ? (
                <ActivityIndicator color={theme.colors.accent} size="small" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                  {birthdays.map(bday => (
                    <View key={bday.id} style={[s.birthdayCard, bday.isToday && s.birthdayCardToday]}>
                      {bday.profile_image_url ? (
                        <Image source={{ uri: bday.profile_image_url }} style={s.birthdayAvatar} />
                      ) : (
                        <View style={s.birthdayAvatarPlaceholder}>
                          <Text style={s.avatarLetter}>{bday.first_name[0]}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.birthdayName} numberOfLines={1}>
                          {bday.first_name} {bday.last_name}
                        </Text>
                        <Text style={s.birthdayAge}>
                          {bday.isToday ? `Today! 🎂` : `Upcoming Birthday`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>EVENTS</Text>
              <Text style={s.selectedDate}>
                {(() => {
                  try {
                    const d = selected ? new Date(selected + (selected.includes('T') ? '' : 'T00:00:00')) : new Date();
                    return !isNaN(d.getTime()) ? d.toDateString() : new Date().toDateString();
                  } catch {
                    return new Date().toDateString();
                  }
                })()}
              </Text>
            </View>
            {eventsLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 20 }} />
            ) : selectedDateEvents.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>No events on this date</Text>
                
                {upcomingEvents.length > 0 && (
                  <View style={{ width: '100%', marginTop: 20 }}>
                    <Text style={[s.sectionLabel, { marginBottom: 12 }]}>UPCOMING SCHEDULE</Text>
                    {upcomingEvents.map(ev => (
                      <TouchableOpacity
                        key={ev.id}
                        style={s.eventCard}
                        onPress={() => {
                          setSelected(ev.start.toISOString().split('T')[0]);
                        }}
                      >
                        <View style={[s.eventStripe, { backgroundColor: ev.color }]} />
                        <View style={s.eventBody}>
                          <Text style={s.eventTime}>
                            {ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} · {formatEventTime(ev.start)}
                          </Text>
                          <Text style={s.eventTitle}>{ev.title}</Text>
                          {ev.description ? <Text style={s.eventDesc} numberOfLines={2}>{ev.description}</Text> : null}
                          <View style={[s.typeBadge, { backgroundColor: ev.color + '22' }]}>
                            <Text style={[s.typeText, { color: ev.color }]}>{ev.type}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              selectedDateEvents.map(ev => (
                <View key={ev.id} style={s.eventCard}>
                  <View style={[s.eventStripe, { backgroundColor: ev.color }]} />
                  <View style={s.eventBody}>
                    <Text style={s.eventTime}>{formatEventTime(ev.start)} - {formatEventTime(ev.end)}</Text>
                    <Text style={s.eventTitle}>{ev.title}</Text>
                    {ev.description ? <Text style={s.eventDesc} numberOfLines={2}>{ev.description}</Text> : null}
                    {ev.location ? (
                      <View style={s.locationRow}>
                        <Ionicons name="location-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={s.locationText}>{ev.location}</Text>
                      </View>
                    ) : null}
                    <View style={[s.typeBadge, { backgroundColor: ev.color + '22' }]}>
                      <Text style={[s.typeText, { color: ev.color }]}>{ev.type}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={s.section}>
            <Text style={s.sectionLabel}>WEATHER · {locationName}</Text>
            <View style={s.infoCard}>
              {weatherLoading ? (
                <Text style={s.mutedText}>Fetching weather...</Text>
              ) : (
                <>
                  <View style={s.weatherMain}>
                    <View style={s.weatherLeft}>
                      <Ionicons name={weather.icon as any} size={44} color={weather.color} />
                      <View style={{ marginLeft: 14 }}>
                        <Text style={s.tempText}>{weather.temp}°C</Text>
                        <Text style={s.condText}>{weather.condition}</Text>
                      </View>
                    </View>
                    <Text style={s.updatedText}>{lastUpdated}</Text>
                  </View>
                  <View style={s.divider} />
                  <View style={s.forecastRow}>
                    {weather.forecast.map((f, i) => (
                      <View key={i} style={s.forecastItem}>
                        <Text style={s.fcDay}>{f.day}</Text>
                        <Ionicons name={f.icon as any} size={18} color={theme.colors.textSecondary} />
                        <Text style={s.fcTemp}>{f.temp}°</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>TRAFFIC · {trafficLocation}</Text>
              <View style={[s.statusBadge, { backgroundColor: traffic.overallColor + '22' }]}>
                <View style={[s.statusDot, { backgroundColor: traffic.overallColor }]} />
                <Text style={[s.statusText, { color: traffic.overallColor }]}>{traffic.overallStatus}</Text>
              </View>
            </View>
            <View style={s.infoCard}>
              {traffic.routes.map((r, i) => (
                <View key={i} style={[s.trafficRow, i < traffic.routes.length - 1 && s.trafficRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.routeLabel}>{r.label}</Text>
                    <Text style={[s.routeStatus, { color: r.color }]}>{r.text}</Text>
                  </View>
                  <Ionicons name={r.icon as any} size={20} color={r.color} />
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getStyles(theme: any) {
  const T = theme.colors;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: T.cardBackgroundLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.bottomTabBorder,
  },
  monthNav:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthArrow: { padding: 8 },
  monthText: { color: T.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  yearText:  { color: T.textMuted, fontSize: 12, marginTop: 1 },
  calCard: {
    marginHorizontal: 16, marginTop: 4,
    backgroundColor: T.cardBackground,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: T.bottomTabBorder,
    paddingHorizontal: 8, paddingBottom: 10,
  },
  section:       { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel:  { color: T.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  selectedDate:  { color: T.accent, fontSize: 12, fontWeight: '600' },
  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.cardBackground,
    borderRadius: 14, marginBottom: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: T.bottomTabBorder,
  },
  eventStripe: { width: 4, alignSelf: 'stretch' },
  eventBody:   { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  eventTime:   { color: T.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  eventTitle:  { color: T.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  eventDesc:   { color: T.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  locationText:{ color: T.textMuted, fontSize: 11 },
  typeBadge:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeText:    { fontSize: 10, fontWeight: '700' },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.cardBackgroundLight,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: T.bottomTabBorder,
    width: 200,
  },
  birthdayCardToday: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: T.accentBright,
  },
  birthdayAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.cardBackground,
  },
  birthdayAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  birthdayName: {
    color: T.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  birthdayAge: {
    color: T.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: T.cardBackground,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: T.bottomTabBorder,
  },
  mutedText: { color: T.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  weatherMain:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weatherLeft:  { flexDirection: 'row', alignItems: 'center' },
  tempText:     { color: T.textPrimary, fontSize: 32, fontWeight: '800' },
  condText:     { color: T.textMuted, fontSize: 14, marginTop: 2 },
  updatedText:  { color: T.textMuted, fontSize: 11 },
  divider:      { height: 1, backgroundColor: T.bottomTabBorder, marginBottom: 14 },
  forecastRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  forecastItem: { alignItems: 'center', gap: 6 },
  fcDay:        { color: T.textMuted, fontSize: 11, fontWeight: '700' },
  fcTemp:       { color: T.textPrimary, fontSize: 14, fontWeight: '700' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  trafficRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  trafficRowBorder: { borderBottomWidth: 1, borderBottomColor: T.bottomTabBorder },
  routeLabel:   { color: T.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  routeStatus:  { fontSize: 14, fontWeight: '800' },
});
}
