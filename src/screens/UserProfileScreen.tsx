import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser, useUserStore } from '../hooks/useUser';
import { useTheme } from '../context/ThemeContext';
import ThemedHeader from '../components/ThemedHeader';
import { DoodleBackground } from '../components/DoodleBackground';
import { SyncAvatar } from '../components/SyncAvatar';

type ParamList = { UserProfile: { userId: string } };

export default function UserProfileScreen() {
  const route = useRoute<RouteProp<ParamList, 'UserProfile'>>();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const currentUser = useUserStore(s => s.user);
  const currentProfile = useUserStore(s => s.profile);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { userId } = route.params;
  const T = theme.colors;

  useEffect(() => {
    // Fast path: if viewing own profile, load immediately from store with 0 network calls!
    if (currentUser?.uid && userId === currentUser.uid && currentProfile) {
      setProfile(currentProfile);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await api.profiles.get(userId);
        if (res?.success && res.data) {
          const data = res.data;
          const fullName = `${data.first_name || data.firstName || ''} ${data.last_name || data.lastName || ''}`.trim() || data.displayName || data.name || 'Unknown User';
          setProfile({
            ...data,
            displayName: fullName
          });
        }
      } catch (e) {
        console.error('Error fetching profile', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const openDirectChat = () => {
    if (!profile || !currentUser) return;
    const chatId = [currentUser.uid, userId].sort().join('_');
    const roomObj = {
      id: chatId,
      type: 'direct',
      participantDetails: {
        [currentUser.uid]: { name: (currentUser as any).displayName || (currentUser as any).name || 'You', avatar: (currentUser as any).photoURL || (currentUser as any).avatar || '' },
        [userId]: { name: profile.displayName || 'User', avatar: profile.photoURL || profile.avatar || '' },
      },
    };
    navigation.navigate('ChatRoom', { room: roomObj });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Unknown';
      return d.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      <DoodleBackground />
      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={[StyleSheet.absoluteFill, { opacity: 0.6 }]} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <ThemedHeader style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.textPrimary }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </ThemedHeader>
        
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : !profile ? (
          <View style={styles.center}>
            <Ionicons name="person-outline" size={48} color={T.textMuted} />
            <Text style={[styles.errorText, { color: T.textSecondary }]}>Profile not found</Text>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.avatarSection}>
              <SyncAvatar userId={userId} initialAvatar={profile.photoURL || profile.avatar} fallbackName={profile.displayName} size={90} bgColor={T.accent} />
              <Text style={[styles.name, { color: T.textPrimary }]}>{profile.displayName}</Text>
              {(profile.username || profile.user_name || profile.alias) ? (
                <Text style={{ fontSize: 13, color: T.accent, fontWeight: '700', marginTop: 2, marginBottom: 2 }}>
                  @{String(profile.username || profile.user_name || profile.alias).replace(/^@/, '')}
                </Text>
              ) : null}
              <Text style={[styles.email, { color: T.textSecondary }]}>{profile.email || 'No email provided'}</Text>
            </View>

            {currentUser?.uid !== userId && (
              <TouchableOpacity 
                style={[styles.messageBtn, { backgroundColor: T.accent }]}
                onPress={openDirectChat}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.infoCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: T.border }]}>
              {profile.designation ? (
                <View style={[styles.infoRow, { borderBottomColor: T.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
                    <Ionicons name="briefcase" size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.infoTexts}>
                    <Text style={[styles.infoLabel, { color: T.textSecondary }]}>Role</Text>
                    <Text style={[styles.infoValue, { color: T.textPrimary }]}>{profile.designation}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.infoRow, { borderBottomColor: T.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
                    <Ionicons name="person" size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.infoTexts}>
                    <Text style={[styles.infoLabel, { color: T.textSecondary }]}>Role</Text>
                    <Text style={[styles.infoValue, { color: T.textPrimary }]}>{profile.role || 'Member'}</Text>
                  </View>
                </View>
              )}

              {profile.church ? (
                <View style={[styles.infoRow, { borderBottomColor: T.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
                    <Ionicons name="business" size={18} color="#FB923C" />
                  </View>
                  <View style={styles.infoTexts}>
                    <Text style={[styles.infoLabel, { color: T.textSecondary }]}>Church</Text>
                    <Text style={[styles.infoValue, { color: T.textPrimary }]}>{profile.church}</Text>
                  </View>
                </View>
              ) : null}

              {profile.region ? (
                <View style={[styles.infoRow, { borderBottomColor: T.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                    <Ionicons name="map" size={18} color={T.accent} />
                  </View>
                  <View style={styles.infoTexts}>
                    <Text style={[styles.infoLabel, { color: T.textSecondary }]}>Region</Text>
                    <Text style={[styles.infoValue, { color: T.textPrimary }]}>{profile.region}</Text>
                  </View>
                </View>
              ) : null}

              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                  <Ionicons name="calendar" size={18} color="#34D399" />
                </View>
                <View style={styles.infoTexts}>
                  <Text style={[styles.infoLabel, { color: T.textSecondary }]}>Joined</Text>
                  <Text style={[styles.infoValue, { color: T.textPrimary }]}>
                    {formatDate(profile.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 12, fontSize: 16 },
  content: { padding: 24, alignItems: 'center', width: '100%' },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 4, marginTop: 16 },
  email: { fontSize: 14 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 28, gap: 8, width: '100%', marginBottom: 32 },
  messageBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoCard: { width: '100%', borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '500' },
});
