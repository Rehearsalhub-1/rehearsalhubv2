import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { apiClient } from '../lib/apiClient';

export default function LinksScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLinks() {
      try {
        const res = await apiClient.get<{ success: boolean; data: any[] }>('/links');
        const loadedLinks = res?.success ? res.data : [];
        loadedLinks.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
        setLinks(loadedLinks);
      } catch (err) {
        console.error('Failed to load links:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLinks();
  }, []);

  const openLink = async (url: string) => {
    if (!url) return;
    try { const ok = await Linking.canOpenURL(url); if (ok) await Linking.openURL(url); } catch {}
  };

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />

      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Community Links</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 40 }} />
        ) : links.length === 0 ? (
          <View style={s.placeholderContainer}>
            <Ionicons name="link-outline" size={80} color={theme.colors.textDisabled} />
            <Text style={s.placeholderTitle}>No Links Yet</Text>
            <Text style={s.placeholderSub}>Check back soon for updates to our community links.</Text>
          </View>
        ) : (
          <FlatList
            data={links}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.linkRow} onPress={() => openLink(item.url)} activeOpacity={0.7}>
                <View style={s.iconWrap}><Ionicons name={item.icon || 'link-outline'} size={22} color={theme.colors.accent} /></View>
                <View style={s.linkInfo}>
                  <Text style={s.linkLabel}>{item.label || item.title}</Text>
                  <Text style={s.linkDesc} numberOfLines={1}>{item.description}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    backBtn: { padding: 4, width: 40 },
    headerTitle: { color: T.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: T.cardBackgroundLight, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: T.bottomTabBorder },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' },
    linkInfo: { flex: 1 },
    linkLabel: { color: T.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
    linkDesc: { color: T.textMuted, fontSize: 12 },
    
    placeholderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      marginTop: -80,
    },
    placeholderTitle: {
      color: T.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      marginTop: 24,
      marginBottom: 12,
    },
    placeholderSub: {
      color: T.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
    }
  });
};
