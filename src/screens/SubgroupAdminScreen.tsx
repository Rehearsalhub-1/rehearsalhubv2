import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/apiClient';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
  KeyboardAvoidingView, Platform, AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUserStore } from '../hooks/useUser';
import * as DocumentPicker from 'expo-document-picker';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { sendPushNotification } from '../lib/notifications';

type Tab = 'dashboard' | 'songs' | 'members' | 'notifications' | 'setlists';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function cleanHtmlLyrics(html: string): string {
  if (!html) return '';
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export default function SubgroupAdminScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;
  const user = useUserStore(s => s.user);

  const [loading, setLoading]               = useState(true);
  const [subgroups, setSubgroups]           = useState<any[]>([]);
  const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab]           = useState<Tab>('dashboard');
  const [members, setMembers]               = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching,   setIsSearching]   = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  
  const [zoneMembers, setZoneMembers]       = useState<any[]>([]);
  const [rehearsals, setRehearsals] = useState<any[]>([]);
  const [rehearsalsLoading, setRehearsalsLoading] = useState(true);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string | null>(null);
  const [showRehearsalModal, setShowRehearsalModal] = useState(false);
  const [rehearsalName, setRehearsalName] = useState('');
  const [rehearsalDate, setRehearsalDate] = useState('');
  const [rehearsalLocation, setRehearsalLocation] = useState('');
  const [rehearsalCategory, setRehearsalCategory] = useState<'ongoing' | 'pre-rehearsal' | 'archive'>('ongoing');
  const [editingRehearsalId, setEditingRehearsalId] = useState<string | null>(null);
  const [isSavingRehearsal, setIsSavingRehearsal] = useState(false);
  const [importSongModalVisible, setImportSongModalVisible] = useState(false);
  const [isImportingSong, setIsImportingSong] = useState(false);

  const [songs, setSongs]                   = useState<any[]>([]);
  const [songsLoading, setSongsLoading]     = useState(true);
  const [stats, setStats] = useState({
    songCount: 0,
    rehearsalCount: 0,
    recentMembers: [] as any[]
  });
  const [addSongModalVisible, setAddSongModalVisible] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songKey, setSongKey] = useState('');
  const [songWriter, setSongWriter] = useState('');
  const [songCategory, setSongCategory] = useState('');
  const [songTempo, setSongTempo] = useState('');
  const [songLeadSinger, setSongLeadSinger] = useState('');
  const [songLyrics, setSongLyrics] = useState('');
  const [songAudioFile, setSongAudioFile] = useState('');
  const [songAudioFileAsset, setSongAudioFileAsset] = useState<any>(null);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [editSongModalVisible, setEditSongModalVisible] = useState(false);
  const [editSong, setEditSong] = useState<any>(null);
  const [editSongTitle, setEditSongTitle] = useState('');
  const [editSongKey, setEditSongKey] = useState('');
  const [editSongWriter, setEditSongWriter] = useState('');
  const [editSongCategory, setEditSongCategory] = useState('');
  const [editSongTempo, setEditSongTempo] = useState('');
  const [editSongLeadSinger, setEditSongLeadSinger] = useState('');
  const [editSongLyrics, setEditSongLyrics] = useState('');
  const [editSongAudioFile, setEditSongAudioFile] = useState('');
  const [editSongAudioFileAsset, setEditSongAudioFileAsset] = useState<any>(null);
  const [isEditingSong, setIsEditingSong] = useState(false);
  const [editSubgroupModal, setEditSubgroupModal] = useState(false);
  const [editSubgroupName, setEditSubgroupName] = useState('');
  const [editSubgroupDesc, setEditSubgroupDesc] = useState('');
  const [isSavingSubgroup, setIsSavingSubgroup] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => { 
    fetchCoordinatedSubgroups(); 
  }, [user]);

  const fetchCoordinatedSubgroups = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/subgroups');
      const list = res?.data || [];
      setSubgroups(list);
      if (list.length > 0) {
        setActiveSubgroupId(list[0].id);
      }
    } catch (e) { 
      console.error("Error fetching coordinated subgroups:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const activeSubgroup = subgroups.find(sg => sg.id === activeSubgroupId);
  const selectedRehearsal = rehearsals.find(r => r.id === selectedRehearsalId) || null;

  useEffect(() => {
    let active = true;
    const fetchMembers = async () => {
      if (!activeSubgroupId) {
        setMembers([]);
        setStats(prev => ({ ...prev, recentMembers: [] }));
        return;
      }
      setMembersLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: any[] }>(
          `/subgroups/${activeSubgroupId}/members`
        );
        if (!active) return;
        const fetchedMembers = Array.isArray(res?.data) ? res.data : [];
        setMembers(fetchedMembers);
        setStats(prev => ({
          ...prev,
          recentMembers: fetchedMembers.slice(0, 5)
        }));
      } catch (e) {
        if (!active) return;
        console.error(e);
        setMembers([]);
      } finally {
        if (active) setMembersLoading(false);
      }
    };
    fetchMembers();
    return () => { active = false; };
  }, [activeSubgroupId]);

  useEffect(() => {
     if (!activeSubgroupId) return;
     let unsubscribeSongs: (() => void) | null = null;
     let unsubscribeRehearsals: (() => void) | null = null;

     if (AppState.currentState === 'active') {
       // songs query
       apiClient.get<{ success: boolean; data: any[] }>(`/subgroups/${activeSubgroup?.id}/songs`).then(res => {
        if (res?.data) setSongs(res.data);
      }).catch(() => {});
     }
     const appStateSub = AppState.addEventListener('change', (nextState: any) => {
       if (nextState === 'active' && !unsubscribeSongs) {
         // songs query
         apiClient.get<{ success: boolean; data: any[] }>(`/subgroups/${activeSubgroup?.id}/songs`).then(res => {
        if (res?.data) setSongs(res.data);
      }).catch(() => {});
       } else if ((nextState === 'background' || nextState === 'inactive') && unsubscribeSongs) {
         if (unsubscribeSongs) { unsubscribeSongs(); unsubscribeSongs = null; }
         if (unsubscribeRehearsals) { unsubscribeRehearsals(); unsubscribeRehearsals = null; }
       }
     });

     return () => {
       if (unsubscribeSongs) unsubscribeSongs();
       if (unsubscribeRehearsals) unsubscribeRehearsals();
       appStateSub.remove();
     };
  }, [activeSubgroupId]);
  useEffect(() => {
    if (searchModalVisible && (activeSubgroup?.organizationId || activeSubgroup?.zoneId)) {
      const fetchZoneMembers = async () => {
        const zoneId = activeSubgroup?.organizationId || activeSubgroup?.zoneId;
        if (!zoneId) return;
        setIsSearching(true);
        try {
          const res = await apiClient.get<{ success: boolean; data: any[] }>(
            `/members/zone/${encodeURIComponent(zoneId)}`
          );
          setZoneMembers(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
          console.error('Error fetching zone members:', e);
        } finally {
          setIsSearching(false);
        }
      };

      fetchZoneMembers();
    } else {
      setZoneMembers([]);
      setSearchResults([]);
      setSearchQuery('');
    }
  }, [searchModalVisible, activeSubgroup?.zoneId]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const term = text.trim().toLowerCase();

    if (!term) {
      setSearchResults([]);
      return;
    }

    try {
      const results = zoneMembers.filter(p => 
        (p.first_name + ' ' + (p.last_name || '')).toLowerCase().includes(term) || 
        (p.email || '').toLowerCase().includes(term)
      );

      setSearchResults(results.slice(0, 30));
    } catch (e) { 
      console.error(e);
      Alert.alert('Error', 'Search failed.'); 
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!activeSubgroup) return;
    setIsAddingMember(true);
    try {
      const res = await apiClient.post<{ success: boolean }>('/subgroups/members', { subGroupId: activeSubgroup.id, userId, role: 'member', addedBy: user?.uid });
      if (res?.success) {
        const refreshRes = await apiClient.get<{ success: boolean; data: any[] }>(
          `/subgroups/${activeSubgroup.id}/members`
        );
        setMembers(Array.isArray(refreshRes?.data) ? refreshRes.data : []);
        setSearchModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);
        Alert.alert('Done', 'Member added successfully.');
      } else {
        Alert.alert('Error', 'Failed to add member.');
      }
    } catch { Alert.alert('Error', 'Something went wrong.'); }
    finally { setIsAddingMember(false); }
  };

  const handleRemoveMember = (userId: string) => {
    Alert.alert('Remove member?', 'They will be removed from this subgroup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const res = await apiClient.delete<{ success: boolean }>(`/subgroups/members?subGroupId=${activeSubgroup?.id}&userId=${userId}`);
          if (res?.success) {
            const refreshRes = await apiClient.get<{ success: boolean; data: any[] }>(
              `/subgroups/${activeSubgroup!.id}/members`
            );
            setMembers(Array.isArray(refreshRes?.data) ? refreshRes.data : []);
          } else { Alert.alert('Error', 'Failed to remove member.'); }
        } catch { Alert.alert('Error', 'Something went wrong.'); }
      }},
    ]);
  };

  const closeModal = () => {
 setSearchModalVisible(false); setSearchQuery(''); setSearchResults([]); };

  const handleAddManualSong = async () => {
    if (!songTitle.trim()) return;
    setIsAddingSong(true);
    try {
      let finalAudioUrl = songAudioFile.trim();
      if (songAudioFileAsset && !songAudioFileAsset.isExisting) {
        finalAudioUrl = await uploadImageToCloudinary(songAudioFileAsset.uri, 'video');
      }

      const res: any = await apiClient.post('/subgroups/songs', {
        title: songTitle.trim(),
        key: songKey.trim(),
        writer: songWriter.trim(),
        category: songCategory.trim(),
        tempo: songTempo.trim(),
        leadSinger: songLeadSinger.trim(),
        lyrics: songLyrics.trim(),
        audioFile: finalAudioUrl,
        subGroupId: activeSubgroup?.id,
        zoneId: activeSubgroup?.zoneId,
      });
      if (selectedRehearsalId && selectedRehearsal) {
        const currentSongIds = selectedRehearsal.songIds || [];
        const updatedSongIds = [...currentSongIds, res.data?.id];
        await apiClient.patch(`/subgroups/praise-nights/${selectedRehearsalId}`, {
        songIds: updatedSongIds,
      });
      }
      setSongTitle('');
      setSongKey('');
      setSongWriter('');
      setSongCategory('');
      setSongTempo('');
      setSongLeadSinger('');
      setSongLyrics('');
      setSongAudioFile('');
      setSongAudioFileAsset(null);
      setAddSongModalVisible(false);
      Alert.alert('Success', 'Song added successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add custom song.');
    } finally {
      setIsAddingSong(false);
    }
  };

  const handleSaveRehearsal = async () => {
    if (!activeSubgroupId || !rehearsalName.trim() || !rehearsalDate.trim()) return;
    setIsSavingRehearsal(true);
    try {
      if (editingRehearsalId) {
        await apiClient.patch(`/subgroups/praise-nights/${editingRehearsalId}`, {
          name: rehearsalName.trim(),
          date: rehearsalDate.trim(),
          location: rehearsalLocation.trim(),
          category: rehearsalCategory,
        });
        Alert.alert('Success', 'Setlist updated.');
      } else {
        await apiClient.post('/subgroups/praise-nights', {
        name: rehearsalName, date: rehearsalDate, location: rehearsalLocation, category: rehearsalCategory,
        subGroupId: activeSubgroup?.id,
      });
        Alert.alert('Success', 'Setlist created.');
      }
      setShowRehearsalModal(false);
      setRehearsalName('');
      setRehearsalDate('');
      setRehearsalLocation('');
      setRehearsalCategory('ongoing');
      setEditingRehearsalId(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save setlist.');
    } finally {
      setIsSavingRehearsal(false);
    }
  };

  const handleDeleteRehearsal = (rehearsalId: string) => {
    Alert.alert('Delete Setlist?', 'Are you sure you want to delete this setlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/subgroups/praise-nights/${rehearsalId}`);
          if (selectedRehearsalId === rehearsalId) {
            setSelectedRehearsalId(null);
          }
          Alert.alert('Deleted', 'Setlist deleted successfully.');
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to delete setlist.');
        }
      }}
    ]);
  };

  const handleImportSong = async (songId: string) => {
    if (!selectedRehearsalId || !selectedRehearsal) return;
    setIsImportingSong(true);
    try {
      const currentSongIds = selectedRehearsal.songIds || [];
      if (currentSongIds.includes(songId)) {
        Alert.alert('Info', 'Song is already in this setlist.');
        return;
      }
      const updatedSongIds = [...currentSongIds, songId];
      await apiClient.patch(`/subgroups/praise-nights/${selectedRehearsalId}`, {
        songIds: updatedSongIds,
      });
      Alert.alert('Success', 'Song imported successfully.');
      setImportSongModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to import song.');
    } finally {
      setIsImportingSong(false);
    }
  };

  const handleRemoveSongFromRehearsal = async (songId: string) => {
    if (!selectedRehearsalId || !selectedRehearsal) return;
    Alert.alert('Remove Song?', 'Remove this song from the setlist? (It will remain in your subgroup songs library)', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const updatedSongIds = (selectedRehearsal.songIds || []).filter((id: string) => id !== songId);
          await apiClient.patch(`/subgroups/praise-nights/${selectedRehearsalId}`, {
        songIds: updatedSongIds,
      });
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to remove song.');
        }
      }}
    ]);
  };

  const handleToggleSongStatus = async (song: any) => {
    try {
      const nextStatus = song.status === 'heard' ? 'unheard' : 'heard';
      await apiClient.patch(`/subgroups/songs/${song.id}`, { status: nextStatus });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update song status.');
    }
  };

  const handleToggleSongActive = async (song: any) => {
    try {
      const nextActive = !song.isActive;
      await apiClient.patch(`/subgroups/songs/${song.id}`, { isActive: nextActive });

      if (nextActive) {
        const memberIds = activeSubgroup?.memberIds || [];





      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update song active status.');
    }
  };

  const handleDeleteSong = (songId: string) => {
    Alert.alert('Delete Song?', 'Are you sure you want to delete this custom song?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/subgroups/songs/${songId}`);
          Alert.alert('Deleted', 'Song deleted successfully.');
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to delete song.');
        }
      }}
    ]);
  };

  const openEditSong = (song: any) => {
    setEditSong(song);
    setEditSongTitle(song.title || '');
    setEditSongKey(song.key || '');
    setEditSongWriter(song.writer || '');
    setEditSongCategory(song.category || '');
    setEditSongTempo(song.tempo || '');
    setEditSongLeadSinger(song.leadSinger || '');
    setEditSongLyrics(cleanHtmlLyrics(song.lyrics || ''));
    setEditSongAudioFile(song.audioFile || '');
    setEditSongAudioFileAsset(song.audioFile ? { name: 'Existing Audio File', uri: song.audioFile, isExisting: true } : null);
    setEditSongModalVisible(true);
  };

  const handleEditSong = async () => {
    if (!editSong || !editSongTitle.trim()) return;
    setIsEditingSong(true);
    try {
      let finalAudioUrl = editSongAudioFile.trim();
      if (editSongAudioFileAsset && !editSongAudioFileAsset.isExisting) {
        finalAudioUrl = await uploadImageToCloudinary(editSongAudioFileAsset.uri, 'video');
      }

      await apiClient.patch(`/subgroups/songs/${editSong.id}`, {
        title: editSongTitle.trim(),
        key: editSongKey.trim(),
        writer: editSongWriter.trim(),
        category: editSongCategory.trim(),
        tempo: editSongTempo.trim(),
        leadSinger: editSongLeadSinger.trim(),
        lyrics: editSongLyrics.trim(),
        audioFile: finalAudioUrl,
      });
      setEditSongModalVisible(false);
      setEditSong(null);
      setEditSongAudioFileAsset(null);
      Alert.alert('Success', 'Song updated successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update song.');
    } finally {
      setIsEditingSong(false);
    }
  };

  const openEditSubgroup = () => {
    if (!activeSubgroup) return;
    setEditSubgroupName(activeSubgroup.name || '');
    setEditSubgroupDesc(activeSubgroup.description || '');
    setEditSubgroupModal(true);
  };

  const handleSaveSubgroup = async () => {
    if (!activeSubgroup || !editSubgroupName.trim()) return;
    setIsSavingSubgroup(true);
    try {
      await apiClient.patch(`/subgroups/${activeSubgroup.id}`, {
        name: editSubgroupName.trim(),
        description: editSubgroupDesc.trim(),
      });
      setSubgroups(prev => prev.map(sg =>
        sg.id === activeSubgroup.id
          ? { ...sg, name: editSubgroupName.trim(), description: editSubgroupDesc.trim() }
          : sg
      ));
      setEditSubgroupModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update subgroup.');
    } finally {
      setIsSavingSubgroup(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() || !activeSubgroup) return;
    setIsBroadcasting(true);
    try {
      const memberIds: string[] = activeSubgroup.memberIds || [];
      await Promise.all(memberIds.map((uid: string) =>
        apiClient.post('/notifications', {
          userId: uid,
          title: `Announcement: ${activeSubgroup.name}`,
          body: broadcastMsg.trim(),
          type: 'subgroup_announcement',
          subgroupId: activeSubgroup.id,
        }).catch(() => {})
      ));
      Alert.alert('Success', 'Broadcast notification sent!');
      setBroadcastMsg('');
      setBroadcastModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to send broadcast.');
    } finally {
      setIsBroadcasting(false);
    }
  };
  return (
    <View style={styles.container}>
      <Modal visible={editSubgroupModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditSubgroupModal(false)}>
        <View style={styles.modal}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Subgroup</Text>
                <TouchableOpacity onPress={() => setEditSubgroupModal(false)} style={styles.backBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Subgroup Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter subgroup name..."
                  placeholderTextColor={T.textMuted}
                  value={editSubgroupName}
                  onChangeText={setEditSubgroupName}
                />
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 120, textAlignVertical: 'top' }]}
                  placeholder="Brief description..."
                  placeholderTextColor={T.textMuted}
                  value={editSubgroupDesc}
                  onChangeText={setEditSubgroupDesc}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, !editSubgroupName.trim() && { opacity: 0.5 }]}
                  onPress={handleSaveSubgroup}
                  disabled={!editSubgroupName.trim() || isSavingSubgroup}
                >
                  {isSavingSubgroup ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={broadcastModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBroadcastModal(false)}>
        <View style={styles.modal}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send Broadcast</Text>
                <TouchableOpacity onPress={() => setBroadcastModal(false)} style={styles.backBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={[styles.textInput, { height: 150, textAlignVertical: 'top' }]}
                  placeholder="Write your announcement..."
                  placeholderTextColor={T.textMuted}
                  value={broadcastMsg}
                  onChangeText={setBroadcastMsg}
                  multiline
                />
                <Text style={{ color: T.textMuted, fontSize: 12, marginTop: -4 }}>
                  Will be sent to {activeSubgroup?.memberIds?.length || 0} members
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, !broadcastMsg.trim() && { opacity: 0.5 }]}
                  onPress={handleBroadcast}
                  disabled={!broadcastMsg.trim() || isBroadcasting}
                >
                  {isBroadcasting ? <ActivityIndicator color={theme.colors.textPrimary} /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="send" size={16} color={theme.colors.textPrimary} />
                      <Text style={styles.primaryBtnText}>Send to All Members</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={addSongModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddSongModalVisible(false)}>
        <View style={styles.modal}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Custom Song</Text>
                <TouchableOpacity onPress={() => setAddSongModalVisible(false)} style={styles.backBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Song Title</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter song title..."
                  placeholderTextColor={T.textMuted}
                  value={songTitle}
                  onChangeText={setSongTitle}
                />

                <Text style={styles.inputLabel}>Key (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. C Major"
                  placeholderTextColor={T.textMuted}
                  value={songKey}
                  onChangeText={setSongKey}
                />

                <Text style={styles.inputLabel}>Writer / Composer</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter writer's name..."
                  placeholderTextColor={T.textMuted}
                  value={songWriter}
                  onChangeText={setSongWriter}
                />

                <Text style={styles.inputLabel}>Category (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Worship"
                  placeholderTextColor={T.textMuted}
                  value={songCategory}
                  onChangeText={setSongCategory}
                />

                <Text style={styles.inputLabel}>Tempo (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 80"
                  placeholderTextColor={T.textMuted}
                  value={songTempo}
                  onChangeText={setSongTempo}
                />

                <Text style={styles.inputLabel}>Lead Singer</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter lead singer..."
                  placeholderTextColor={T.textMuted}
                  value={songLeadSinger}
                  onChangeText={setSongLeadSinger}
                />

                <Text style={styles.inputLabel}>Lyrics</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 150, textAlignVertical: 'top' }]}
                  placeholder="Paste or enter lyrics here..."
                  placeholderTextColor={T.textMuted}
                  multiline
                  numberOfLines={10}
                  value={songLyrics}
                  onChangeText={setSongLyrics}
                />

                <Text style={styles.inputLabel}>Audio File (Optional)</Text>
                <TouchableOpacity 
                  style={{
                    backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 12,
                    borderWidth: 1, borderColor: theme.colors.bottomTabBorder, borderStyle: 'dashed',
                    overflow: 'hidden', minHeight: 60, justifyContent: 'center', marginBottom: 8
                  }} 
                  onPress={async () => {
                    try {
                      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
                      if (!result.canceled && result.assets[0]) {
                        if (result.assets[0].size && result.assets[0].size > 50 * 1024 * 1024) {
                          Alert.alert('File too large', 'Audio file must be less than 50MB'); return;
                        }
                        setSongAudioFileAsset(result.assets[0]);
                        setSongAudioFile('');
                      }
                    } catch (e) { Alert.alert('Error', 'Failed to pick audio file'); }
                  }}
                >
                  {songAudioFileAsset ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
                      <Ionicons name="musical-notes" size={24} color={T.accent} />
                      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{songAudioFileAsset.name}</Text>
                      <TouchableOpacity onPress={() => setSongAudioFileAsset(null)}>
                        <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                      <Ionicons name="cloud-upload-outline" size={24} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontWeight: '600' }}>Upload Audio (Max 50MB)</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Or Paste Audio URL</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Paste direct audio link (MP3, etc)..."
                  placeholderTextColor={T.textMuted}
                  value={songAudioFile}
                  onChangeText={(val) => { setSongAudioFile(val); if(val) setSongAudioFileAsset(null); }}
                />

                <TouchableOpacity 
                  style={[styles.primaryBtn, !songTitle.trim() && { opacity: 0.5 }]} 
                  onPress={handleAddManualSong}
                  disabled={!songTitle.trim() || isAddingSong}
                >
                  {isAddingSong ? (
                    <ActivityIndicator color={theme.colors.textPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Add Song</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={showRehearsalModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRehearsalModal(false)}>
        <View style={styles.modal}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingRehearsalId ? 'Edit Setlist' : 'New Setlist'}</Text>
                <TouchableOpacity onPress={() => setShowRehearsalModal(false)} style={styles.backBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Setlist Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Sunday Service Prep"
                  placeholderTextColor={T.textMuted}
                  value={rehearsalName}
                  onChangeText={setRehearsalName}
                />

                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2026-06-25"
                  placeholderTextColor={T.textMuted}
                  value={rehearsalDate}
                  onChangeText={setRehearsalDate}
                />

                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Choir Hall"
                  placeholderTextColor={T.textMuted}
                  value={rehearsalLocation}
                  onChangeText={setRehearsalLocation}
                />

                <Text style={styles.inputLabel}>Status</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { key: 'ongoing', label: 'Live' },
                    { key: 'pre-rehearsal', label: 'Draft' },
                    { key: 'archive', label: 'Archive' }
                  ].map(cat => (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setRehearsalCategory(cat.key as any)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: rehearsalCategory === cat.key ? T.accent : 'rgba(255,255,255,0.03)',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: rehearsalCategory === cat.key ? T.accent : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: rehearsalCategory === cat.key ? '#ffffff' : T.textSecondary }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity 
                  style={[styles.primaryBtn, (!rehearsalName.trim() || !rehearsalDate.trim()) && { opacity: 0.5 }]} 
                  onPress={handleSaveRehearsal}
                  disabled={!rehearsalName.trim() || !rehearsalDate.trim() || isSavingRehearsal}
                >
                  {isSavingRehearsal ? (
                    <ActivityIndicator color={theme.colors.textPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Setlist</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={importSongModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setImportSongModalVisible(false)}>
        <View style={styles.modal}>
          <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Song to Setlist</Text>
              <TouchableOpacity onPress={() => setImportSongModalVisible(false)} style={styles.backBtn}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedRehearsal && (
              <FlatList
                data={songs.filter(s => !(selectedRehearsal.songIds || []).includes(s.id))}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                renderItem={({ item }) => (
                  <View style={styles.searchResultRow}>
                    <View style={[styles.recentAvatar, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                      <Ionicons name="musical-notes" size={20} color={theme.colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rosterName}>{item.title}</Text>
                      <Text style={styles.rosterEmail}>{item.category || 'Custom'} • {item.key || 'No Key'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleImportSong(item.id)}
                      disabled={isImportingSong}
                      style={styles.addSmallBtn}
                    >
                      <Text style={styles.addSmallBtnText}>Import</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyContentText, { marginTop: 40 }]}>
                    All library songs have already been imported to this setlist.
                  </Text>
                }
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container:   { flex: 1, backgroundColor: T.background },
  fullCenter:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.background },
  loadingText: { color: T.textSecondary, fontSize: 14, marginTop: 12 },
  goBackBtn:   { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 20 },
  goBackText:  { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 14 },
  headerCompact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: T.accent, fontSize: 12, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  
  avatarMini: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarMiniText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '800' },

  body: { paddingBottom: 40 },
  switcherRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16, gap: 12, alignItems: 'center' },
  switcherChip: {
    height: 44, paddingHorizontal: 24, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0, minWidth: 90,
    alignItems: 'center', justifyContent: 'center'
  },
  switcherChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  switcherText: { color: T.textSecondary, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  dashboardSection: { flex: 1 },
  sectionHeaderWrap: { paddingHorizontal: 20, marginBottom: 14, marginTop: 16 },
  sectionOverline: { color: T.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  seeAllText: { color: T.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  statsScroll: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  statCard: {
    width: 140, borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(20,20,30,0.4)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderTopWidth: 2,
  },
  statCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: T.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statValue: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '900', marginTop: 4 },
  quickActionsGrid: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  actionTile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionContent: { flex: 1, marginLeft: 16 },
  actionTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  actionDesc: { color: T.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '500' },
  recentMembersCard: {
    marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  recentMemberRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  recentMemberBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  recentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(139, 92, 246, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
  recentAvatarText: { color: T.accent, fontSize: 15, fontWeight: '800' },
  recentName: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
  recentEmail: { color: T.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  emptyRecent: { padding: 40, alignItems: 'center' },
  emptyRecentText: { color: T.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  tabContentSection: { paddingHorizontal: 20, paddingTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: T.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  actionBtnText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  
  emptyContentCard: { alignItems: 'center', padding: 40, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyContentText: { color: T.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22, fontWeight: '500' },
  rosterCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  rosterBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rosterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
  rosterAvatarText: { color: '#3b82f6', fontSize: 16, fontWeight: '800' },
  rosterName: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  rosterEmail: { color: T.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  rosterBadge: { backgroundColor: 'rgba(139, 92, 246, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.5)' },
  rosterBadgeText: { color: theme.colors.textPrimary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  removeIconBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  cardItem: { 
    backgroundColor: 'rgba(255,255,255,0.02)', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)', 
    padding: 16, 
    marginBottom: 12, 
    gap: 12 
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  cardIconWrap: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  cardContent: { 
    flex: 1 
  },
  cardTitle: { 
    color: theme.colors.textPrimary, 
    fontSize: 15, 
    fontWeight: '700' 
  },
  cardSubtext: { 
    color: T.textMuted, 
    fontSize: 12, 
    marginTop: 4, 
    fontWeight: '500' 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.04)', 
    paddingTop: 12 
  },
  badgeRow: { 
    flexDirection: 'row', 
    gap: 8, 
    alignItems: 'center', 
    flexWrap: 'wrap', 
    flex: 1 
  },
  actionRow: { 
    flexDirection: 'row', 
    gap: 8, 
    alignItems: 'center' 
  },
  pillBadge: { 
    paddingVertical: 5, 
    paddingHorizontal: 10, 
    borderRadius: 8, 
    borderWidth: 1 
  },
  pillBadgeText: { 
    fontSize: 9, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  actionIconButton: { 
    width: 34, 
    height: 34, 
    borderRadius: 10, 
    backgroundColor: 'rgba(255,255,255,0.04)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  modal: { flex: 1, backgroundColor: T.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, paddingHorizontal: 16, height: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: theme.colors.inputText, fontSize: 15 },
  searchBtn:     { backgroundColor: T.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  searchBtnText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  addSmallBtn:     { backgroundColor: T.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addSmallBtnDone: { backgroundColor: 'rgba(255,255,255,0.1)' },
  addSmallBtnText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '800' },
  listHeaderTitle: { color: T.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentSmall: { backgroundColor: T.backgroundDark, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50 },
  modalHeaderSmall: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtnSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  modalBodySmall: { gap: 20 },
  inputLabel: { color: T.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: -10, letterSpacing: 0.5 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 18, color: T.inputText, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  primaryBtn: { backgroundColor: T.accent, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 12, shadowColor: T.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  primaryBtnText: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  bottomTabBar: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: T.backgroundDark || '#090514',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 14 : 4,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textMuted,
    marginTop: 4,
    letterSpacing: 0.2
  },
  tabBarLabelActive: {
    color: T.accent,
    fontWeight: '700'
  },
  tabActiveIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    backgroundColor: T.accent,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5
  },
});
};
