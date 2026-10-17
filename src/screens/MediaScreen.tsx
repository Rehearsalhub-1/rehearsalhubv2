/**
 * MediaScreen — Netflix-style layout (mock data for UI preview)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '@/hooks/useUser';
import { SyncAvatar } from '@/components/SyncAvatar';
import { useTheme } from '../context/ThemeContext';

const ACCENT = '#a855f7';
const BG     = '#0B0B10';
const BG2    = '#12111A';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  thumbnail: { uri: string };
  duration?: string;
  isNew?: boolean;
  progressPercent?: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const HERO: MediaItem = {
  id: 'hero',
  title: 'Praise Night 2024',
  subtitle: 'Live Worship · Grand Finale · Loveworld Singers',
  category: 'Praise Night',
  thumbnail: { uri: '' },
};

const CONTINUE_WATCHING: MediaItem[] = [
  {
    id: 'c1',
    title: 'Soprano Rehearsal Wk 12',
    category: 'Rehearsal',
    thumbnail: { uri: '' },
    progressPercent: 31,
    isNew: true,
  },
  {
    id: 'c2',
    title: 'Christmas Medley Full Choir',
    category: 'Rehearsal',
    thumbnail: { uri: '' },
    progressPercent: 58,
  },
  {
    id: 'c3',
    title: 'Deep Worship — Anointed',
    category: 'Specials',
    thumbnail: { uri: '' },
    progressPercent: 72,
    isNew: true,
  },
  {
    id: 'c4',
    title: 'Praise Night Grand Finale',
    category: 'Praise Night',
    thumbnail: { uri: '' },
    progressPercent: 20,
  },
];

const PRAISE_NIGHT: MediaItem[] = [
  { id: 'p1', title: 'Praise Night 2024 — Night 1', category: 'Praise Night', thumbnail: { uri: '' }, duration: '1h 42m' },
  { id: 'p2', title: 'Praise Night 2023 — Opening', category: 'Praise Night', thumbnail: { uri: '' }, duration: '2h 05m' },
  { id: 'p3', title: 'Praise Night 2024 — Night 2', category: 'Praise Night', thumbnail: { uri: '' }, duration: '1h 28m', isNew: true },
  { id: 'p4', title: 'Praise Night Highlights', category: 'Praise Night', thumbnail: { uri: '' }, duration: '45m' },
];

const REHEARSALS: MediaItem[] = [
  { id: 'r1', title: 'Soprano Section — Week 12', category: 'Rehearsal', thumbnail: { uri: '' }, duration: '45m', isNew: true },
  { id: 'r2', title: 'Alto Harmony Workshop', category: 'Rehearsal', thumbnail: { uri: '' }, duration: '38m' },
  { id: 'r3', title: 'Full Choir — Christmas Medley', category: 'Rehearsal', thumbnail: { uri: '' }, duration: '1h 10m' },
  { id: 'r4', title: 'Tenor Vocal Exercises', category: 'Rehearsal', thumbnail: { uri: '' }, duration: '30m' },
];

const SPECIALS: MediaItem[] = [
  { id: 's1', title: 'Deep Worship Session', category: 'Specials', thumbnail: { uri: '' }, duration: '58m' },
  { id: 's2', title: 'Vocal Dynamics Masterclass', category: 'Specials', thumbnail: { uri: '' }, duration: '32m', isNew: true },
  { id: 's3', title: 'Ministerial Performance Night', category: 'Specials', thumbnail: { uri: '' }, duration: '1h 05m' },
];

const CATEGORIES = ['All', 'Praise Night', 'Rehearsal', 'Specials'];

// ─── Continue Watching card (portrait 2:3) ────────────────────────────────────

const ContinueCard = ({ item, cardWidth = 120, cardHeight = 178 }: { item: MediaItem; cardWidth?: number; cardHeight?: number }) => (
  <TouchableOpacity activeOpacity={0.85} style={{ width: cardWidth, marginRight: 8 }}>
    <View style={{ width: cardWidth, height: cardHeight, borderRadius: 6, overflow: 'hidden', backgroundColor: BG2 }}>
      <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* Play circle */}
      <View style={StyleSheet.absoluteFill as any} >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>
      {/* NEW badge */}
      {item.isNew && (
        <View style={{
          position: 'absolute', top: 0, right: 0,
          backgroundColor: ACCENT,
          paddingHorizontal: 6, paddingVertical: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>NEW{'\n'}EPISODES</Text>
        </View>
      )}
      {/* Progress bar */}
      {item.progressPercent !== undefined && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <View style={{ height: 3, width: `${item.progressPercent}%` as any, backgroundColor: ACCENT }} />
        </View>
      )}
    </View>
    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 5 }} numberOfLines={1}>
      {item.title}
    </Text>
    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 }}>S0:E00</Text>
  </TouchableOpacity>
);

// ─── Section row card (16:9 widescreen) ──────────────────────────────────────

const SectionCard = ({ item, cardWidth = 160, cardHeight = 90 }: { item: MediaItem; cardWidth?: number; cardHeight?: number }) => (
  <TouchableOpacity activeOpacity={0.85} style={{ width: cardWidth, marginRight: 8 }}>
    <View style={{ width: cardWidth, height: cardHeight, borderRadius: 6, overflow: 'hidden', backgroundColor: BG2 }}>
      <Image source={item.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
      {item.isNew && (
        <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: ACCENT, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 }}>NEW</Text>
        </View>
      )}
      {item.duration && (
        <View style={{ position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{item.duration}</Text>
        </View>
      )}
      {/* Play overlay */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="play-circle-outline" size={32} color="rgba(255,255,255,0.75)" />
      </View>
    </View>
    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 5 }} numberOfLines={2}>
      {item.title}
    </Text>
  </TouchableOpacity>
);

const SectionRow = ({ title, data, cardWidth, cardHeight }: { title: string; data: MediaItem[]; cardWidth?: number; cardHeight?: number }) => {
  if (!data.length) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 }}>
        {title}
      </Text>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <SectionCard item={item} cardWidth={cardWidth} cardHeight={cardHeight} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MediaScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cwW = Math.max(110, Math.min(windowWidth * 0.30, 160));
  const cwH = Math.round(cwW * 1.48);
  const scW = Math.max(150, Math.min(windowWidth * 0.40, 240));
  const scH = Math.round(scW * (9 / 16));
  const heroH = Math.min(Math.max(windowHeight * 0.52, 340), 520);
  const user = useUserStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);
  const userName = profile?.firstName?.trim() || 'You';

  const [selectedCat, setSelectedCat] = useState('All');
  const [inMyList, setInMyList] = useState(false);

  const showAll = selectedCat === 'All';
  const praiseData  = showAll || selectedCat === 'Praise Night' ? PRAISE_NIGHT : [];
  const rehearsalData = showAll || selectedCat === 'Rehearsal'  ? REHEARSALS    : [];
  const specialsData  = showAll || selectedCat === 'Specials'   ? SPECIALS      : [];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      {/* ── Floating top bar ─────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {/* Left: back + logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation?.goBack?.()}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Image
            source={require('../../assets/logo/logo.png')}
            style={{ width: 36, height: 28 }}
            contentFit="contain"
          />
        </View>
        {/* Right: cast + profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity activeOpacity={0.7}>
            <Ionicons name="tv-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <SyncAvatar
            userId={user?.uid}
            fallbackName={userName}
            size={30}
            bgColor="#3B82F6"
          />
        </View>
      </View>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <View style={{ width: '100%', height: heroH }}>
          <Image
            source={HERO.thumbnail}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          {/* Gradient: transparent top → app background bottom */}
          <LinearGradient
            colors={['transparent', 'transparent', `${BG}CC`, BG]}
            locations={[0, 0.35, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Category tabs — plain text, no border, no background */}
          <View style={[styles.catBar, { top: insets.top + 52 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 24 }}
            >
              {CATEGORIES.map((c) => {
                const active = selectedCat === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedCat(c)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Text style={{
                      color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                      fontSize: 14,
                      fontWeight: active ? '700' : '500',
                    }}>
                      {c}
                    </Text>
                    {c === 'Specials' && (
                      <Ionicons name="chevron-down" size={13} color={active ? '#fff' : 'rgba(255,255,255,0.65)'} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Hero bottom content */}
          <View style={styles.heroBottom}>
            {/* Subtitle / tags */}
            <Text style={styles.heroTags} numberOfLines={1}>
              {HERO.subtitle}
            </Text>

            {/* Action row: exactly like Netflix — no borders, no backgrounds on sides */}
            <View style={styles.heroActions}>
              {/* My List */}
              <TouchableOpacity
                style={styles.heroSideBtn}
                activeOpacity={0.8}
                onPress={() => setInMyList((v) => !v)}
              >
                <Ionicons name={inMyList ? 'checkmark' : 'add'} size={26} color="#FFFFFF" />
                <Text style={styles.heroSideBtnLabel}>My List</Text>
              </TouchableOpacity>

              {/* Play — solid white, wide */}
              <TouchableOpacity style={styles.heroPlayBtn} activeOpacity={0.9}>
                <Ionicons name="play" size={18} color="#000000" />
                <Text style={styles.heroPlayLabel}>Play</Text>
              </TouchableOpacity>

              {/* Info */}
              <TouchableOpacity style={styles.heroSideBtn} activeOpacity={0.8}>
                <Ionicons name="information-circle-outline" size={26} color="#FFFFFF" />
                <Text style={styles.heroSideBtnLabel}>Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Continue Watching ──────────────────────────────────────────── */}
        {showAll && (
          <View style={{ marginTop: 16, marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>
              Continue Watching for {userName}
            </Text>
            <FlatList
              data={CONTINUE_WATCHING}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <ContinueCard item={item} cardWidth={cwW} cardHeight={cwH} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {/* ── Section rows ─────────────────────────────────────────────── */}
        <SectionRow title="Praise Night Highlights" data={praiseData} cardWidth={scW} cardHeight={scH} />
        <SectionRow title="Choir Rehearsals & Training" data={rehearsalData} cardWidth={scW} cardHeight={scH} />
        <SectionRow title="Specials & Deep Worship" data={specialsData} cardWidth={scW} cardHeight={scH} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Top bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Category bar over hero
  catBar: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },

  // Hero bottom
  heroBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    zIndex: 10,
  },
  heroTags: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  heroSideBtn: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  heroSideBtnLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 36,
    borderRadius: 4,
    minWidth: 120,
  },
  heroPlayLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },

  // Section rows
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
});
