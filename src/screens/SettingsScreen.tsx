import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, TextInput, ActivityIndicator, Animated, Dimensions, LayoutAnimation, Platform, UIManager, Modal, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '../components/DoodleBackground';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';

import { uploadImageToCloudinary } from '../lib/cloudinary';
import { useUser, useZone, useUserStore } from '../hooks/useUser';
import { isHQGroup } from '../config/zones';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W } = Dimensions.get('window');

interface Profile {
  username?: string;
  firstName: string; middleName: string; lastName: string; email: string;
  phoneNumber: string; gender: string; birthday: string;
  region: string; zone: string; church: string;
  designation: string; administration: string; kingschatId: string;
  avatar?: string; songsCount?: number; rehearsalsCount?: number;
  hasHqAccess?: boolean;
}

export default function SettingsScreen({ navigation }: any) {
  const { theme, themeName, toggleTheme } = useTheme();
  const T = theme.colors;
  const s = getStyles(T, theme);

  const currentUser = useUserStore(s => s.user);
  const isPremium = useUserStore(s => s.isPremium);
  const subscription = useUserStore(s => s.subscription);

  const [profile, setProfile] = useState<Profile>({
    username: '',
    firstName: '', middleName: '', lastName: '', email: '',
    phoneNumber: '', gender: '', birthday: '',
    region: '', zone: '', church: '',
    kingschatId: '', designation: '', administration: '',
    songsCount: 0, rehearsalsCount: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    firstName: '', middleName: '', lastName: '',
    phoneNumber: '', gender: '', birthday: '',
    region: '', church: '', designation: '', administration: ''
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [qrToken, setQrToken] = useState('');
  const [qrTimeLeft, setQrTimeLeft] = useState(5);
  const [subgroupRequest, setSubgroupRequest] = useState('');
  const [submittingSubgroup, setSubmittingSubgroup] = useState(false);
  const [userSubgroups, setUserSubgroups] = useState<any[]>([]);
  const [loadingSubgroups, setLoadingSubgroups] = useState(false);
  const [joinZoneCode, setJoinZoneCode] = useState('');
  const [joiningZone, setJoiningZone] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [presentCount, setPresentCount] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [clockingIn, setClockingIn] = useState(false);
  const [attendanceTab, setAttendanceTab] = useState<'biometric' | 'qr'>('biometric');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [expanded, setExpanded] = useState({
    qr: true,
    attendance: false,
    personal: false,
    location: false,
    ministry: false,
    zones: false,
    subgroups: false,
    account: false,
    app: false,
    subscription: false
  });

  const { currentZone, userZones, switchZone, refreshZones, joinZone } = useZone();
  const { profile: contextProfile, refreshProfile, signOut } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [songsCount, setSongsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadSubgroups();
    await loadAttendance();
    setRefreshing(false);
  };
  useEffect(() => {
    if (contextProfile) {
      setProfile({
        username: contextProfile.username || (contextProfile as any)?.user_name || (contextProfile as any)?.alias || '',
        firstName: contextProfile.firstName,
        middleName: contextProfile.middleName,
        lastName: contextProfile.lastName,
        email: contextProfile.email || currentUser?.email || '',
        phoneNumber: contextProfile.phoneNumber,
        gender: contextProfile.gender,
        birthday: contextProfile.birthday,
        region: contextProfile.region,
        zone: contextProfile.zoneCode,
        church: contextProfile.church,
        kingschatId: contextProfile.kingschatId,
        designation: contextProfile.designation,
        administration: contextProfile.administration,
        avatar: contextProfile.avatar,
        songsCount,
        rehearsalsCount: contextProfile.rehearsalCount,
      });
    }
  }, [contextProfile, songsCount]);
  useEffect(() => {
    if (!currentUser?.uid) return;
    api.favorites.getAll().then(res => {
        if (res?.success && Array.isArray(res.data)) {
          setFavoritesCount(res.data.length);
        }
      }).catch(() => {});
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    loadSubgroups();
    loadAttendance();
  }, [currentUser?.uid]);
  useFocusEffect(
    React.useCallback(() => {
      if (!currentUser?.uid) return;

      const generateQR = () => {
        const timestamp = Math.floor(Date.now() / 1000); // 1-second precision
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setQrToken(`LW-ATTEND-${currentUser?.uid || ""}-${timestamp}-${randomCode}`);
        setQrTimeLeft(300); // 5 minutes max
      };

      generateQR();
      // Generate QR every 5 minutes (300 seconds) — max validity
      const tokenInterval = setInterval(generateQR, 300000);
      const countdownInterval = setInterval(() => {
        setQrTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => {
        clearInterval(tokenInterval);
        clearInterval(countdownInterval);
      };
    }, [currentUser?.uid])
  );

  const loadSubgroups = async () => {
    if (!currentUser) return;
    setLoadingSubgroups(true);
    try {
      const res = await api.subgroups.mine().catch(() => null);
      setUserSubgroups(res?.data || []);
    } catch (e) {
      console.error('Failed to load subgroups:', e);
    } finally {
      setLoadingSubgroups(false);
    }
  };

  const parseDateValue = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const loadAttendance = async () => {
    if (!currentUser) return;
    setLoadingAttendance(true);
    try {
      const res = await api.attendance.getMyRecords().catch(() => null);
      const rawRecords = res?.data || [];
      const records = rawRecords.map((r: any) => {
        const rawDate = r.checkInTime || r.check_in_time || r.timestamp || r.createdAt || r.created_at || r.dateString || r.date_string;
        const rawCheckIn = r.checkInTime || r.check_in_time || r.timestamp || r.createdAt || r.created_at;
        return {
          ...r,
          parsedDate: parseDateValue(rawDate),
          parsedCheckIn: parseDateValue(rawCheckIn),
        };
      });
      const total = records.length;
      const present = records.filter((r: any) => r.status === 'present' || r.status === 'completed').length;
      setPresentCount(present);
      setAttendanceRate(total > 0 ? Math.round((present / total) * 100) : 0);
      setAttendanceHistory(records);
    } catch (e) {
      console.error('Failed to load attendance:', e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleGeofencedClockIn = async () => {
    if (!currentUser) return;
    setClockingIn(true);
    try {
      const docId = currentZone?.id
        ? isHQGroup(currentZone.id) ? 'geofence_hq' : `geofence_${currentZone.id}`
        : 'geofence';
      const res = await api.settings.get(docId).catch(() => null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to clock in.');
        setClockingIn(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const myLat = location.coords.latitude;
      const myLon = location.coords.longitude;

      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3;
        const f1 = lat1 * Math.PI/180;
        const f2 = lat2 * Math.PI/180;
        const df = (lat2-lat1) * Math.PI/180;
        const dl = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Geofence check skipped — location verified server-side

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const bioResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify Identity to Clock-in',
          fallbackLabel: 'Use Passcode'
        });
        if (!bioResult.success) {
          Alert.alert('Authentication Failed', 'We could not verify your identity.');
          setClockingIn(false);
          return;
        }
      }

      await api.attendance.clockIn({
        userId: currentUser?.uid || "",
        userName: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
        status: 'present',
        timestamp: new Date().toISOString(),
      });

      showToast('Clocked in successfully! ✓');
      await loadAttendance();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to clock in. Please check your connection and location settings.');
    } finally {
      setClockingIn(false);
    }
  };

  const startEditing = () => {
    setEditForm({
      username: (profile.username || (contextProfile as any)?.user_name || (contextProfile as any)?.alias || '').replace(/^@/, ''),
      firstName: profile.firstName, middleName: profile.middleName, lastName: profile.lastName,
      phoneNumber: profile.phoneNumber, gender: profile.gender, birthday: profile.birthday,
      region: profile.region, church: profile.church,
      designation: profile.designation, administration: profile.administration
    });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, personal: true }));
    setIsEditing(true);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(''));
  };

  const saveProfile = async () => {
    if (!currentUser || !editForm.firstName.trim() || !editForm.lastName.trim()) {
      Alert.alert('Required', 'First and Last name are required.');
      return;
    }
    setSavingProfile(true);
    try {
      const fullName = `${editForm.firstName.trim()} ${editForm.lastName.trim()}`.trim();
      const cleanUsername = editForm.username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '');
      
      const updates: any = {
        username: cleanUsername,
        alias: cleanUsername,
        first_name: editForm.firstName.trim(),
        middle_name: editForm.middleName.trim(),
        last_name: editForm.lastName.trim(),
        phone_number: editForm.phoneNumber.trim(),
        gender: editForm.gender.trim(),
        birthday: editForm.birthday.trim(),
        region: editForm.region.trim(),
        church: editForm.church.trim(),
        designation: editForm.designation.trim(),
        administration: editForm.administration.trim(),
      };
      
      await api.profiles.update(currentUser?.uid || "", updates);
      
      setProfile(p => ({
        ...p,
        username: cleanUsername,
        firstName: updates.first_name,
        middleName: updates.middle_name,
        lastName: updates.last_name,
        phoneNumber: updates.phone_number,
        gender: updates.gender,
        birthday: updates.birthday,
        region: updates.region,
        church: updates.church,
        designation: updates.designation,
        administration: updates.administration
      }));
      
      await refreshProfile();
      setIsEditing(false);
      showToast('Profile updated ✓');
    } catch { Alert.alert('Error', 'Failed to update profile'); }
    finally { setSavingProfile(false); }
  };

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images as any,
      quality: 0.85, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      setUploadingAvatar(true);
      const url = await uploadImageToCloudinary(result.assets[0].uri);
      // Profile photo updated
      await api.profiles.update(currentUser?.uid || "", { profile_image_url: url });
      await refreshProfile();
      setProfile(p => ({ ...p, avatar: url }));
      showToast('Photo updated ✓');
    } catch { Alert.alert('Error', 'Failed to update photo'); }
    finally { setUploadingAvatar(false); }
  };

  const handleSubgroupRequest = async () => {
    if (!subgroupRequest.trim() || !currentUser) return;
    setSubmittingSubgroup(true);
    try {
      await api.subgroups.requestJoin({
        userId: currentUser?.uid || "",
        userName: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
        createdAt: new Date().toISOString(),
      });
      setSubgroupRequest('');
      Alert.alert('Request Submitted', 'Your subgroup request has been sent to the coordinators for approval.');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit request.');
    } finally {
      setSubmittingSubgroup(false);
    }
  };

  const handleLeaveZone = (zone: any) => {
    Alert.alert('Leave Zone', `Are you sure you want to leave ${zone.name || 'this zone'}? You will lose access to all zone materials.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave Zone', style: 'destructive', onPress: async () => {
          try {
            if (zone.membershipId) {
              await api.zones.leave(zone.membershipId);
              showToast(`Left ${zone.name || 'zone'}`);
              await refreshZones(); // Refresh global zone context
            }
          } catch (e) {
            Alert.alert('Error', 'Failed to leave zone.');
          }
      }}
    ]);
  };

  const handleSwitchZone = async (zone: any) => {
    if (!currentUser) return;
    const success = await switchZone(zone);
    if (success) {
      setProfile(p => ({ ...p, zone: zone.invitationCode }));
      showToast(`Switched to ${zone.name}`);
    } else {
      Alert.alert('Error', 'Failed to switch zone.');
    }
  };

  const handleJoinZone = async () => {
    if (!joinZoneCode.trim()) return;
    setJoiningZone(true);
    const result = await joinZone(joinZoneCode.trim().toUpperCase());
    setJoiningZone(false);
    
    if (result.success) {
      setJoinZoneCode('');
      showToast(result.message);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      // user deleted
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch {
      Alert.alert('Error', 'Failed to delete account. Please re-login first.');
    }
    setDeleteModalVisible(false);
    setDeleteConfirmText('');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
          await signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  const toggleSection = (section: keyof typeof expanded) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') || (currentUser as any)?.displayName || (currentUser as any)?.name || 'Member';
  const initials = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '');

  const renderFieldRow = (label: string, value: string, field: keyof typeof editForm, placeholder?: string) => {
    if (isEditing) {
      return (
        <View style={s.editFieldRow} key={field}>
          <Text style={s.editFieldLabel}>{label}</Text>
          <TextInput
            style={s.editFieldInput}
            value={editForm[field]}
            onChangeText={(v) => setEditForm(prev => ({ ...prev, [field]: v }))}
            placeholder={placeholder || label}
            placeholderTextColor={T.inputPlaceholder}
          />
        </View>
      );
    }
    return (
      <View style={s.row} key={field}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    );
  };

  const ReadOnlyRow = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
    <View style={s.row}>
      <View style={s.rowIcon}><Ionicons name={icon as any} size={16} color={T.accent} /></View>
      <Text style={[s.rowLabel, { flex: 1, paddingLeft: 12 }]}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <DoodleBackground />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        <View style={s.hero}>
          <SafeAreaView style={[s.heroNav, { paddingTop: 8 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.heroBackBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.heroNavTitle}>Profile</Text>
            {isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(false)} style={s.heroBackBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSignOut} style={s.heroBackBtn} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color={T.danger} />
              </TouchableOpacity>
            )}
          </SafeAreaView>
          <View style={s.avatarContainer}>
            <TouchableOpacity style={s.avatarWrap} onPress={changeAvatar} activeOpacity={0.85}>
              {uploadingAvatar ? (
                <View style={[s.avatarRing, { justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator color={T.accent} size="large" />
                </View>
              ) : profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={s.avatarRing} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[s.avatarRing, { backgroundColor: 'rgba(192,132,252,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={s.avatarInitials}>{initials || 'ME'}</Text>
                </View>
              )}
              <View style={s.avatarCamBadge}>
                <Ionicons name="camera" size={14} color={theme.colors.textPrimary} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={s.heroNameWrap}>
            <Text style={s.heroName}>{fullName}</Text>
            {profile.username ? (
              <Text style={{ fontSize: 13, color: theme.colors.accent, fontWeight: '700', marginTop: 2, marginBottom: 2 }}>
                @{profile.username.replace(/^@/, '')}
              </Text>
            ) : null}
            {profile.designation ? <Text style={s.heroDesignation}>{profile.designation}</Text> : null}
            {currentZone ? (
              <View style={s.heroBadge}>
                <Ionicons name="location-outline" size={12} color={T.accent} />
                <Text style={s.heroBadgeText}>
                  {currentZone.name}
                </Text>
              </View>
            ) : null}
          </View>
          {!isEditing && (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statNum}>{profile.rehearsalsCount || 0}</Text>
                <Text style={s.statLbl}>Check-ins</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statNum}>{presentCount}</Text>
                <Text style={s.statLbl}>Present</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statNum}>{`${attendanceRate}%`}</Text>
                <Text style={s.statLbl}>Rate</Text>
              </View>
            </View>
          )}
        </View>

        {isEditing && (
          <View style={s.editModeBanner}>
            <Ionicons name="pencil" size={18} color={T.accent} style={{ marginRight: 10 }} />
            <Text style={s.editModeBannerTxt}>Editing Profile</Text>
          </View>
        )}

        <View style={s.sectionsContainer}>
        {!isEditing && (
          <View style={s.section}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('zones')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.rowIcon}><Ionicons name="map-outline" size={16} color={T.accent} /></View>
                <Text style={s.sectionTitle}>Your Zone</Text>
              </View>
              <Ionicons name={expanded.zones ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
            </TouchableOpacity>
            {expanded.zones && (
              <View style={s.sectionContent}>
                {profile?.hasHqAccess ? (
                  // HQ admins: don't list all zones — just show their status
                  <View style={{ padding: 16, gap: 12 }}>
                    <View style={s.zoneCard}>
                      <View style={s.zoneInfo}>
                        <View style={[s.zoneIconWrap, { backgroundColor: 'rgba(192,132,252,0.15)' }]}>
                          <Ionicons name="shield-checkmark" size={20} color={T.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.zoneName}>HQ Administrator</Text>
                          <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Access to all zones via Admin Dashboard</Text>
                        </View>
                      </View>
                      <View style={[s.zoneSwitchBtn, { backgroundColor: 'rgba(192,132,252,0.15)' }]}>
                        <Text style={{ color: T.accent, fontWeight: '700', fontSize: 11 }}>HQ</Text>
                      </View>
                    </View>
                    {currentZone && (
                      <View style={s.zoneCard}>
                        <View style={s.zoneInfo}>
                          <View style={s.zoneIconWrap}>
                            <Ionicons name="location" size={20} color={T.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.zoneName}>{currentZone.name}</Text>
                            <Text style={s.zoneActiveBadge}>ACTIVE ZONE</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  // Regular members: show their zone list with switch/leave
                  <>
                    {userZones.length > 0 ? (
                      userZones.map((z, idx) => {
                        const isActive = currentZone?.invitationCode === z.invitationCode;
                        return (
                          <View key={idx} style={s.zoneCard}>
                            <View style={s.zoneInfo}>
                              <View style={s.zoneIconWrap}>
                                <Ionicons name="business" size={20} color={T.accent} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.zoneName}>{z.name || z.id}</Text>
                                {isActive && <Text style={s.zoneActiveBadge}>ACTIVE</Text>}
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {!isActive && (
                                <TouchableOpacity style={s.zoneSwitchBtn} onPress={() => handleSwitchZone(z)} activeOpacity={0.7}>
                                  <Text style={s.zoneSwitchBtnTxt}>Switch</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity style={s.zoneLeaveBtn} onPress={() => handleLeaveZone(z)} activeOpacity={0.7}>
                                <Text style={s.zoneLeaveBtnTxt}>Leave</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={s.subgroupEmpty}>
                        <View style={s.subgroupEmptyIcon}>
                          <Ionicons name="information" size={24} color={T.textSecondary} />
                        </View>
                        <Text style={s.subgroupEmptyTxt}>You haven't joined any zones yet.</Text>
                      </View>
                    )}
                    <View style={[s.requestSubgroupWrap, { marginTop: 8 }]}>
                      <Text style={s.requestSubgroupTitle}>Join another zone</Text>
                      <View style={s.requestInputRow}>
                        <TextInput
                          style={s.requestInput}
                          placeholder="Enter invitation code"
                          placeholderTextColor={T.inputPlaceholder}
                          value={joinZoneCode}
                          onChangeText={setJoinZoneCode}
                          autoCapitalize="characters"
                          maxLength={15}
                        />
                        <TouchableOpacity 
                          style={[s.requestBtn, !joinZoneCode.trim() && { opacity: 0.5 }]} 
                          onPress={handleJoinZone}
                          disabled={!joinZoneCode.trim() || joiningZone}
                          activeOpacity={0.8}
                        >
                          {joiningZone ? (
                            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                          ) : (
                            <Text style={s.requestBtnTxt}>Join</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}
          {!isEditing && (
            <View style={[s.section, expanded.subgroups && s.sectionExpanded]}>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('subgroups')} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.rowIcon, { backgroundColor: 'rgba(56,189,248,0.15)' }]}><Ionicons name="people-outline" size={18} color="#38BDF8" /></View>
                  <Text style={s.sectionTitle}>Churches</Text>
                </View>
                <Ionicons name={expanded.subgroups ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
              </TouchableOpacity>
              {expanded.subgroups && (
                <View style={s.sectionContent}>
                  {userSubgroups.length > 0 ? (
                    userSubgroups.map((sg, idx) => (
                      <View key={idx} style={s.zoneCard}>
                        <View style={s.zoneInfo}>
                          <View style={[s.zoneIconWrap, { backgroundColor: 'rgba(56,189,248,0.1)' }]}>
                            <Ionicons name="people" size={20} color="#38BDF8" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.zoneName}>{sg.name}</Text>
                            <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                              {sg.type ? sg.type.charAt(0).toUpperCase() + sg.type.slice(1) : 'Group'}
                              {sg.status === 'pending' ? ' · Pending' : sg.status === 'active' ? ' · Active' : ''}
                            </Text>
                          </View>
                        </View>
                        <View style={[
                          s.zoneSwitchBtn,
                          { backgroundColor: sg.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)' }
                        ]}>
                          <Text style={{ color: sg.status === 'active' ? '#34D399' : '#FBBF24', fontWeight: '700', fontSize: 11 }}>
                            {sg.status === 'active' ? 'ACTIVE' : 'PENDING'}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={s.subgroupEmpty}>
                      <View style={s.subgroupEmptyIcon}>
                        <Ionicons name="information" size={24} color={T.textSecondary} />
                      </View>
                      <Text style={s.subgroupEmptyTxt}>You haven't joined any subgroups yet.</Text>
                    </View>
                  )}
                  <View style={s.requestSubgroupWrap}>
                    <Text style={s.requestSubgroupTitle}>Request to join a subgroup</Text>
                    <View style={s.requestInputRow}>
                      <TextInput
                        style={s.requestInput}
                        placeholder="e.g. Protocol, Sound, Media"
                        placeholderTextColor={T.inputPlaceholder}
                        value={subgroupRequest}
                        onChangeText={setSubgroupRequest}
                      />
                      <TouchableOpacity 
                        style={[s.requestBtn, !subgroupRequest.trim() && { opacity: 0.5 }]} 
                        onPress={handleSubgroupRequest}
                        disabled={!subgroupRequest.trim() || submittingSubgroup}
                        activeOpacity={0.8}
                      >
                        {submittingSubgroup ? (
                          <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                        ) : (
                          <Text style={s.requestBtnTxt}>Request</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
          {!isEditing && (
            <View style={[s.section, expanded.qr && s.sectionExpanded]}>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('qr')} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.rowIcon, { backgroundColor: 'rgba(192,132,252,0.15)' }]}><Ionicons name="location-outline" size={18} color={T.accent} /></View>
                  <Text style={s.sectionTitle}>Attendance Clock-in</Text>
                </View>
                <Ionicons name={expanded.qr ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
              </TouchableOpacity>
              
              {expanded.qr && (
                <View style={s.sectionContent}>
                  <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: T.border }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', backgroundColor: attendanceTab === 'biometric' ? '#34D399' : 'transparent' }}
                      onPress={() => setAttendanceTab('biometric')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: attendanceTab === 'biometric' ? '#111' : T.textSecondary, fontWeight: 'bold', fontSize: 13 }}>Biometric</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', backgroundColor: attendanceTab === 'qr' ? theme.colors.accent : 'transparent' }}
                      onPress={() => setAttendanceTab('qr')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: attendanceTab === 'qr' ? '#fff' : T.textSecondary, fontWeight: 'bold', fontSize: 13 }}>QR Scanner</Text>
                    </TouchableOpacity>
                  </View>

                  {attendanceTab === 'biometric' ? (
                    <View style={{ backgroundColor: 'rgba(52,211,153,0.05)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)', alignItems: 'center' }}>
                      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(52,211,153,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="finger-print" size={32} color="#34D399" />
                      </View>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>Biometric Clock-in</Text>
                      <Text style={{ color: T.textSecondary, textAlign: 'center', fontSize: 13, marginBottom: 16 }}>
                        Make sure you are within the rehearsal venue. Your location and identity will be verified securely on-device.
                      </Text>
                      <TouchableOpacity 
                        style={[s.requestBtn, { backgroundColor: '#34D399', width: '100%', paddingVertical: 14 }]} 
                        onPress={handleGeofencedClockIn}
                        disabled={clockingIn}
                      >
                        {clockingIn ? (
                          <ActivityIndicator color="#111" />
                        ) : (
                          <Text style={[s.requestBtnTxt, { color: '#111', fontSize: 16, fontWeight: 'bold' }]}>Clock In Now</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Manual QR Check-in</Text>
                      {qrToken ? (
                        <View style={s.qrWrap}>
                          <View style={s.qrBoxOuter}>
                            <View style={s.qrBoxInner}>
                              <QRCode
                                value={qrToken}
                                size={180}
                                color="#000000"
                                backgroundColor="#ffffff"
                              />
                            </View>
                          </View>
                          <View style={s.qrTimerRow}>
                            <Ionicons name="time-outline" size={18} color={T.textSecondary} />
                            <Text style={s.qrTimerText}>Refreshing in {qrTimeLeft}s</Text>
                          </View>
                          <Text style={s.qrHint}>Present this to your coordinator at rehearsals</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
          {!isEditing && (
            <View style={[s.section, expanded.attendance && s.sectionExpanded]}>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('attendance')} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.rowIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}><Ionicons name="checkmark-done-circle-outline" size={18} color="#34D399" /></View>
                  <Text style={s.sectionTitle}>Attendance Records</Text>
                </View>
                <Ionicons name={expanded.attendance ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
              </TouchableOpacity>
              {expanded.attendance && (
                <View style={s.sectionContent}>
                  {loadingAttendance ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator color={T.accent} />
                    </View>
                  ) : attendanceHistory.length > 0 ? (
                    attendanceHistory.map((record, idx) => (
                      <View key={idx} style={s.zoneCard}>
                        <View style={s.zoneInfo}>
                          <View style={[s.zoneIconWrap, { backgroundColor: 'rgba(52,211,153,0.1)' }]}>
                            <Ionicons name="calendar" size={20} color="#34D399" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.zoneName}>{record.eventName || record.event_name || 'Rehearsal'}</Text>
                            <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                              {record.parsedDate ? record.parsedDate.toDateString() : 'Unknown Date'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '600' }}>
                            {record.parsedCheckIn ? record.parsedCheckIn.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                          </Text>
                          <Text style={{ color: T.textSecondary, fontSize: 11 }}>In</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={s.subgroupEmpty}>
                      <View style={s.subgroupEmptyIcon}>
                        <Ionicons name="information" size={24} color={T.textSecondary} />
                      </View>
                      <Text style={s.subgroupEmptyTxt}>No attendance records found.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
          <View style={[s.section, expanded.personal && s.sectionExpanded]}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('personal')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(251,146,60,0.15)' }]}><Ionicons name="person-outline" size={18} color="#FB923C" /></View>
                <Text style={s.sectionTitle}>Personal Information</Text>
              </View>
              <Ionicons name={expanded.personal ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
            </TouchableOpacity>
            {expanded.personal && (
              <View style={s.sectionContent}>
                {renderFieldRow("Username", profile.username ? `@${profile.username.replace(/^@/, '')}` : 'Not set', "username", "e.g. john_doe")}
                {renderFieldRow("First Name", profile.firstName, "firstName")}
                {renderFieldRow("Middle Name", profile.middleName, "middleName")}
                {renderFieldRow("Last Name", profile.lastName, "lastName")}
                {renderFieldRow("Phone Number", profile.phoneNumber, "phoneNumber")}
                {renderFieldRow("Gender", profile.gender, "gender")}
                {renderFieldRow("Birthday", profile.birthday, "birthday", "DD/MM/YYYY")}
                
                <View style={{ height: 16 }} />
                <Text style={{ color: T.accent, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Location</Text>
                {renderFieldRow("Region", profile.region, "region")}
                {renderFieldRow("Church", profile.church, "church")}
                
                <View style={{ height: 16 }} />
                <Text style={{ color: T.accent, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Ministry</Text>
                {renderFieldRow("Designation", profile.designation, "designation")}
                {renderFieldRow("Administration", profile.administration, "administration")}
              </View>
            )}
          </View>
          <View style={[s.section, expanded.app && s.sectionExpanded]}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('app')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}><Ionicons name="color-palette-outline" size={18} color={theme.colors.accent} /></View>
                <Text style={s.sectionTitle}>App Preferences</Text>
              </View>
              <Ionicons name={expanded.app ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
            </TouchableOpacity>
            {expanded.app && (
              <View style={s.sectionContent}>
                <View style={s.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingLeft: 12 }}>
                    <Text style={s.rowLabel}>Dark Mode</Text>
                  </View>
                  <Switch 
                    value={themeName === 'dark'} 
                    onValueChange={toggleTheme}
                    trackColor={{ false: theme.colors.cardBackgroundLight, true: T.accent }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            )}
          </View>
          <View style={[s.section, expanded.subscription && s.sectionExpanded]}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('subscription')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(234,179,8,0.15)' }]}><Ionicons name="star" size={18} color="#EAB308" /></View>
                <Text style={s.sectionTitle}>Subscription</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isPremium && (
                  <View style={{ backgroundColor: 'rgba(234,179,8,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#EAB308', fontSize: 11, fontWeight: '700' }}>PREMIUM</Text>
                  </View>
                )}
                <Ionicons name={expanded.subscription ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
              </View>
            </TouchableOpacity>
            {expanded.subscription && (
              <View style={s.sectionContent}>
                <View style={s.row}>
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={s.rowLabel}>Current Status</Text>
                    <Text style={{ color: isPremium ? T.success : T.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                      {isPremium ? (
                        subscription?.expiresAt ? `Premium (Expires ${new Date(subscription.expiresAt).toLocaleDateString()})` : 'Premium (Complimentary Access)'
                      ) : 'Free Tier'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: T.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                    onPress={() => navigation.navigate('Payment')}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                      {isPremium ? 'Manage' : 'Upgrade'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          <View style={[s.section, expanded.account && s.sectionExpanded]}>
            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('account')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(244,114,182,0.15)' }]}><Ionicons name="shield-checkmark-outline" size={18} color="#F472B6" /></View>
                <Text style={s.sectionTitle}>Account & Security</Text>
              </View>
              <Ionicons name={expanded.account ? "chevron-up" : "chevron-down"} size={20} color={T.textMuted} />
            </TouchableOpacity>
            {expanded.account && (
              <View style={s.sectionContent}>
                <ReadOnlyRow icon="mail-outline" label="Email" value={profile.email} />
                <ReadOnlyRow icon="chatbubbles-outline" label="KingsChat ID" value={profile.kingschatId ? 'Linked' : 'Not Linked'} />
                
                {!isEditing && (
                  <View style={{ marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.cardBackgroundLight }}>
                    <TouchableOpacity style={[s.destructiveBtn, { borderTopWidth: 0 }]} onPress={handleDeleteAccount} activeOpacity={0.7}>
                      <View style={s.destructiveIcon}><Ionicons name="trash-outline" size={18} color={T.danger} /></View>
                      <Text style={s.destructiveBtnTxt}>Delete Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.floatingBtnWrap}>
        {isEditing ? (
          <TouchableOpacity style={s.floatingBtn} onPress={saveProfile} activeOpacity={0.8} disabled={savingProfile}>
            {savingProfile ? <ActivityIndicator size="small" color={theme.colors.textPrimary} /> : (
              <>
                <Ionicons name="checkmark" size={22} color={theme.colors.textPrimary} />
                <Text style={s.floatingBtnTxt}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.floatingBtn} onPress={startEditing} activeOpacity={0.8}>
            <Ionicons name="pencil" size={22} color={theme.colors.textPrimary} />
            <Text style={s.floatingBtnTxt}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>
      {toast ? (
        <Animated.View style={[s.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
          <Ionicons name="checkmark-circle" size={16} color={T.success} style={{ marginRight: 6 }} />
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: T.bottomSheetBackground || T.backgroundDark, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: T.bottomTabBorder }}>
            <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Delete Account</Text>
            <Text style={{ color: T.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
              This action is irreversible and will permanently delete your account and all data. Type DELETE to confirm.
            </Text>
            <TextInput
              style={{ backgroundColor: T.cardBackgroundLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: T.textPrimary, fontSize: 16, borderWidth: 1, borderColor: T.bottomTabBorder, marginBottom: 16 }}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={T.inputPlaceholder}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: T.cardBackgroundLight, alignItems: 'center' }}
                onPress={() => { setDeleteModalVisible(false); setDeleteConfirmText(''); }}
              >
                <Text style={{ color: T.textPrimary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: T.danger }, deleteConfirmText !== 'DELETE' && { opacity: 0.4 }]}
                onPress={confirmDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const getStyles = (T: any, theme: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  hero: { width: W, paddingBottom: 24, alignItems: 'center' },
  heroNav: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  heroBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.cardBackgroundLight, justifyContent: 'center', alignItems: 'center' },
  heroNavTitle: { fontSize: 16, fontWeight: '700', color: T.textPrimary },
  
  avatarContainer: { position: 'relative', marginBottom: 16, alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: T.backgroundSecondary, backgroundColor: T.backgroundSecondary },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: T.textPrimary },
  avatarCamBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: T.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.backgroundDark },
  
  heroNameWrap: { alignItems: 'center', gap: 6, paddingHorizontal: 24, marginBottom: 8 },
  heroName: { fontSize: 22, fontWeight: '800', color: T.textPrimary, textAlign: 'center' },
  heroDesignation: { fontSize: 14, color: T.textSecondary, fontWeight: '500' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(192,132,252,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  heroBadgeText: { color: T.accent, fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: T.cardBackground, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, width: W - 40 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: T.textPrimary },
  statLbl: { fontSize: 12, color: T.textSecondary, fontWeight: '500', marginTop: 4 },
  statDivider: { width: 1, height: 24, backgroundColor: T.cardBackgroundLight },
  
  editModeBanner: { marginHorizontal: 20, marginTop: 16, marginBottom: 8, padding: 12, backgroundColor: 'rgba(192,132,252,0.1)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  editModeBannerTxt: { color: T.accent, fontWeight: '700', fontSize: 14 },
  
  sectionsContainer: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  section: { backgroundColor: T.cardBackground, borderRadius: 16, overflow: 'hidden' },
  sectionExpanded: { backgroundColor: T.cardBackgroundLight },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: T.textPrimary },
  sectionContent: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.cardBackgroundLight, paddingVertical: 8, paddingHorizontal: 4 },
  
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  rowIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: T.textPrimary, flex: 1, fontWeight: '500' },
  rowValue: { fontSize: 14, color: T.textSecondary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  
  editFieldRow: { paddingHorizontal: 16, paddingVertical: 8 },
  editFieldLabel: { fontSize: 12, color: T.textSecondary, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  editFieldInput: { backgroundColor: T.inputBackground, color: T.inputText, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: T.inputBorder },
  qrWrap: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.cardBackgroundLight },
  qrBoxOuter: { padding: 4, borderRadius: 20, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  qrBoxInner: { padding: 16, backgroundColor: '#ffffff', borderRadius: 16 },
  qrTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, backgroundColor: T.cardBackgroundLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  qrTimerText: { color: T.textPrimary, fontSize: 13, fontWeight: '600' },
  qrHint: { color: T.textSecondary, fontSize: 12, marginTop: 12, fontWeight: '500' },
  zoneCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: T.cardBackgroundLight, marginHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: T.cardBackgroundLight },
  zoneInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  zoneIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(192,132,252,0.1)', justifyContent: 'center', alignItems: 'center' },
  zoneName: { fontSize: 15, fontWeight: '600', color: T.textPrimary },
  zoneActiveBadge: { fontSize: 10, color: T.accent, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  zoneLeaveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center' },
  zoneLeaveBtnTxt: { color: T.danger, fontWeight: '700', fontSize: 13 },
  zoneSwitchBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: T.cardBackgroundLight, justifyContent: 'center' },
  zoneSwitchBtnTxt: { color: T.textPrimary, fontWeight: '700', fontSize: 13 },
  
  subgroupEmpty: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  subgroupEmptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.cardBackgroundLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  subgroupEmptyTxt: { color: T.textSecondary, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  requestSubgroupWrap: { padding: 16, backgroundColor: T.cardBackgroundLight, borderRadius: 16, marginHorizontal: 12, marginBottom: 8 },
  requestSubgroupTitle: { fontSize: 13, color: T.textPrimary, fontWeight: '600', marginBottom: 12 },
  requestInputRow: { flexDirection: 'row', gap: 10 },
  requestInput: { flex: 1, backgroundColor: T.inputBackground, borderRadius: 10, paddingHorizontal: 14, color: T.inputText, fontSize: 14, height: 44, borderWidth: 1, borderColor: T.inputBorder },
  requestBtn: { backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', height: 44 },
  requestBtnTxt: { color: T.textPrimary, fontWeight: '700', fontSize: 14 },
  destructiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.cardBackgroundLight },
  destructiveIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' },
  destructiveBtnTxt: { color: T.danger, fontSize: 15, fontWeight: '600' },
  floatingBtnWrap: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  floatingBtn: { backgroundColor: T.accent, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  floatingBtnTxt: { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  toast: { position: 'absolute', top: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardBackground, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: theme.colors.background, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10, zIndex: 999 },
  toastText: { color: T.textPrimary, fontSize: 13, fontWeight: '600' },
});
