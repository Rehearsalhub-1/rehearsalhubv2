import { theme } from '../constants/Colors';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUserStore } from '../hooks/useUser';
import { SyncAvatar } from '../components/SyncAvatar';

const T = theme.colors;

export default function ChatSettingsScreen({ navigation }: any) {

  const currentUser = useUserStore(s => s.user);
  const signOut = useUserStore(s => s.signOut);
  const [notifications, setNotifications] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [mediaAutoDownload, setMediaAutoDownload] = useState(true);

  const Row = ({
    icon, label, value, onPress, toggle, toggleValue, onToggle, danger, chevron = true,
  }: {
    icon: string; label: string; value?: string; onPress?: () => void;
    toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void;
    danger?: boolean; chevron?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => { onPress?.(); }}
      activeOpacity={toggle ? 1 : 0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(239,68,68,0.12)' : T.cardBackground }]}>
        <Ionicons name={icon as any} size={18} color={danger ? T.danger : T.accent} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: T.danger }]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={v => { onToggle?.(v); }}
          trackColor={{ false: theme.colors.cardBackgroundLight, true: T.accent }}
          thumbColor={theme.colors.textPrimary}
        />
      ) : (
        <>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          {chevron && <Ionicons name="chevron-forward" size={16} color={T.textMuted} />}
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <TouchableOpacity style={styles.profileCard} activeOpacity={0.8}>
            <SyncAvatar
              userId={currentUser?.uid}
              fallbackName={(currentUser as any)?.displayName || (currentUser as any)?.name || "User" || 'Me'}
              size={64}
              bgColor={T.accent}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{(currentUser as any)?.displayName || (currentUser as any)?.name || "User" || 'My Account'}</Text>
              <Text style={styles.profileEmail}>{currentUser?.email || ''}</Text>
              <Text style={styles.profileEdit}>Tap to edit profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Row icon="notifications-outline" label="Message notifications"
              toggle toggleValue={notifications} onToggle={setNotifications} />
            <Row icon="volume-high-outline" label="Notification sounds"
              toggle toggleValue={notifications} onToggle={setNotifications} />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <Row icon="checkmark-done-outline" label="Read receipts"
              toggle toggleValue={readReceipts} onToggle={setReadReceipts} />
            <Row icon="pencil-outline" label="Typing indicator"
              toggle toggleValue={typingIndicator} onToggle={setTypingIndicator} />
            <Row icon="eye-outline" label="Last seen" value="Everyone"
              onPress={() => Alert.alert('Last Seen', 'Coming soon')} />
            <Row icon="person-circle-outline" label="Profile photo" value="Everyone"
              onPress={() => Alert.alert('Profile Photo', 'Coming soon')} />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chats</Text>
            <Row icon="cloud-download-outline" label="Media auto-download"
              toggle toggleValue={mediaAutoDownload} onToggle={setMediaAutoDownload} />
            <Row icon="color-palette-outline" label="Chat wallpaper"
              onPress={() => Alert.alert('Wallpaper', 'Coming soon')} />
            <Row icon="archive-outline" label="Archived chats"
              onPress={() => Alert.alert('Archived', 'Coming soon')} />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help</Text>
            <Row icon="help-circle-outline" label="Help Center"
              onPress={() => Alert.alert('Help', 'Contact your administrator')} />
            <Row icon="information-circle-outline" label="App version" value="1.0.0" chevron={false} />
          </View>
          <View style={[styles.section, { marginBottom: 0 }]}>
            <Row
              icon="log-out-outline"
              label="Sign out"
              danger
              chevron={false}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out', style: 'destructive', onPress: async () => {
                      await signOut();
                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    }
                  }
                ]);
              }}
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.backgroundDark },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bottomTabBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, padding: 16,
    backgroundColor: T.cardBackground, borderRadius: 16, gap: 14,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  profileEmail: { fontSize: 13, color: T.textSecondary, marginTop: 2 },
  profileEdit: { fontSize: 12, color: T.accent, marginTop: 4 },
  section: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: T.cardBackground, borderRadius: 14, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: T.textSecondary,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bottomTabBorder,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: T.textPrimary },
  rowValue: { fontSize: 14, color: T.textSecondary, marginRight: 6 },
});
