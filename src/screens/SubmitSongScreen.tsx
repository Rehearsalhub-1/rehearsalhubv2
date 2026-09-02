import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/apiClient';
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { getZoneByInvitationCode } from '../config/zones';
import { useUserStore } from '../hooks/useUser';
import { getHiddenFeatures } from '../config/roles';

const T = theme.colors;

export default function SubmitSongScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState<'submit' | 'submitted'>('submit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [writer, setWriter] = useState('');
  const [leadSinger, setLeadSinger] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [songKey, setSongKey] = useState('');
  const [notes, setNotes] = useState('');
  const [audioFile, setAudioFile] = useState<any>(null);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  const hf = getHiddenFeatures(profile);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeZone, setActiveZone] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      setUserProfile(profile.raw);
      const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
      if (!writer) setWriter(fullName);
      if (profile.zoneCode) {
        const zone = getZoneByInvitationCode(profile.zoneCode);
        if (zone) setActiveZone(zone);
      }
    }
  }, [profile]);

  const fetchMySubmissions = useCallback(async () => {
    if (!user) return;
    setLoadingSubmissions(true);
    try {
      const res = await apiClient.get<any>('/submissions/mine');
      const items = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : [];
      setMySubmissions(items);
    } catch (e) {
      console.error('Failed to load my submissions:', e);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchMySubmissions();
  }, [fetchMySubmissions, activeTab]);

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        if (result.assets[0].size && result.assets[0].size > 50 * 1024 * 1024) {
          Alert.alert('File too large', 'Audio file must be less than 50MB');
          return;
        }
        setAudioFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking audio:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const handleCancelEdit = () => {
    setEditingSubmission(null);
    setTitle('');
    setLyrics('');
    setSongKey('');
    setLeadSinger('');
    setNotes('');
    setAudioFile(null);
    if (userProfile) {
      setWriter([userProfile.first_name, userProfile.middle_name, userProfile.last_name].filter(Boolean).join(' '));
    }
  };

  const handleEditSubmission = (submission: any) => {
    setEditingSubmission(submission);
    setTitle(submission.title);
    setWriter(submission.writer || '');
    setLeadSinger(submission.leadSinger || '');
    setLyrics(submission.lyrics);
    setSongKey(submission.key || '');
    setNotes(submission.notes || '');
    setAudioFile(submission.audioUrl ? { name: 'Existing Audio File', uri: submission.audioUrl, isExisting: true } : null);
    setActiveTab('submit');
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    if (!title.trim() || !lyrics.trim()) {
      Alert.alert('Error', 'Title and Lyrics are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      let audioUrl = editingSubmission?.audioUrl || '';
      if (audioFile && !audioFile.isExisting) {
        audioUrl = await uploadImageToCloudinary(audioFile.uri, 'video');
      }

      const submissionData = {
        title: title.trim(),
        lyrics: lyrics.trim(),
        writer: writer.trim() || 'Unknown',
        leadSinger: leadSinger.trim(),
        key: songKey.trim(),
        notes: notes.trim(),
        audioUrl: audioUrl,
        updatedAt: new Date().toISOString(),
      };

      if (editingSubmission) {
        await apiClient.patch(`/submissions/${editingSubmission.id}`, submissionData);
        Alert.alert('Success', 'Submission updated successfully!');
      } else {
        await apiClient.post('/submissions', submissionData);
        Alert.alert('Success', 'Song submitted successfully!');
      }

      handleCancelEdit();
      await fetchMySubmissions();
      setActiveTab('submitted');
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit song. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Submission', 'Are you sure you want to delete this submission?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/submissions/${id}`);
            setMySubmissions(prev => prev.filter(s => s.id !== id));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete submission');
          }
        }
      }
    ]);
  };

  const handleSendReply = async () => {
    if (!replyingTo || !replyMessage.trim()) return;
    
    setIsSendingReply(true);
    try {
      const fullName = [userProfile?.first_name, userProfile?.middle_name, userProfile?.last_name].filter(Boolean).join(' ') || user?.email || 'User';
      
      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        senderName: fullName,
        message: replyMessage.trim(),
        timestamp: new Date().toISOString()
      };

      const existingConversation = replyingTo.conversation || [];
      await apiClient.patch(`/submissions/${replyingTo.id}`, {
        conversation: [...existingConversation, newMessage]
      });

      setMySubmissions(prev => prev.map(s => {
        if (s.id === replyingTo.id) {
          return { ...s, conversation: [...existingConversation, newMessage] };
        }
        return s;
      }));

      setReplyMessage('');
      setReplyingTo(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  if (!isProfileLoading && hf.hideSubmissions) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }]}>
          <Ionicons name="lock-closed" size={80} color={theme.colors.accent} style={{ marginBottom: 24 }} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>Access Restricted</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Song submissions are currently not enabled for your account.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: theme.colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={theme.gradients.bgBase} locations={theme.gradients.bgBaseLocations} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.gradients.bgGlow} locations={theme.gradients.bgGlowLocations} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home');
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Submit Song</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.tabsContainer}>
          <View style={styles.tabsWrapper}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
              onPress={() => setActiveTab('submit')}
            >
              <Text style={[styles.tabText, activeTab === 'submit' && styles.tabTextActive]}>Submit Song</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'submitted' && styles.tabButtonActive]}
              onPress={() => setActiveTab('submitted')}
            >
              <Text style={[styles.tabText, activeTab === 'submitted' && styles.tabTextActive]}>Submitted Songs</Text>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {activeTab === 'submit' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContainer}>
              {editingSubmission && (
                <View style={styles.editBanner}>
                  <Ionicons name="pencil" size={16} color="#d97706" />
                  <Text style={styles.editBannerText}>Editing: {editingSubmission.title}</Text>
                  <TouchableOpacity onPress={handleCancelEdit}>
                    <Text style={styles.editBannerCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>Song Title <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Enter the title of the song"
                placeholderTextColor={theme.colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Writer/Composer</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter writer's name"
                placeholderTextColor={theme.colors.textMuted}
                value={writer}
                onChangeText={setWriter}
              />

              <Text style={styles.label}>Lead Singer</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter lead singer's name"
                placeholderTextColor={theme.colors.textMuted}
                value={leadSinger}
                onChangeText={setLeadSinger}
              />

              <Text style={styles.label}>Lyrics <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter the song lyrics..."
                placeholderTextColor={theme.colors.textMuted}
                value={lyrics}
                onChangeText={setLyrics}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Key</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. C Major"
                    placeholderTextColor={theme.colors.textMuted}
                    value={songKey}
                    onChangeText={setSongKey}
                  />
                </View>
              </View>

              <Text style={styles.label}>Additional Notes</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Any special instructions or notes..."
                placeholderTextColor={theme.colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Audio File (Optional)</Text>
              <TouchableOpacity style={styles.audioUploadBtn} onPress={pickAudio}>
                {audioFile ? (
                  <View style={styles.audioFileSelected}>
                    <Ionicons name="musical-notes" size={24} color={T.accent} />
                    <Text style={styles.audioFileName} numberOfLines={1}>{audioFile.name}</Text>
                    <TouchableOpacity onPress={() => setAudioFile(null)}>
                      <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.audioFilePlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={24} color={theme.colors.textMuted} />
                    <Text style={styles.audioFilePlaceholderText}>Upload Audio (Max 50MB)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.submitButton, (!title.trim() || !lyrics.trim() || isSubmitting) && styles.submitButtonDisabled]} 
                onPress={handleSubmit}
                disabled={!title.trim() || !lyrics.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={theme.colors.textPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>{editingSubmission ? 'Save Changes' : 'Submit Song'}</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </ScrollView>
          ) : (
            <View style={styles.submissionsContainer}>
              {loadingSubmissions ? (
                <ActivityIndicator size="large" color={T.accent} style={{ marginTop: 40 }} />
              ) : mySubmissions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>You haven't submitted any songs yet.</Text>
                </View>
              ) : (
                <FlatList
                  data={mySubmissions}
                  keyExtractor={(item, index) => (item?.id ? String(item.id) : `sub-${index}`)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                  refreshing={loadingSubmissions}
                  onRefresh={fetchMySubmissions}
                  renderItem={({ item }) => {
                    const isExpanded = expandedSubmissionId === item.id;
                    const dateObj = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                    
                    let statusColor = '#eab308'; // yellow for pending
                    let statusBg = 'rgba(234, 179, 8, 0.15)';
                    if (item.status === 'approved') {
                      statusColor = '#22c55e'; // green
                      statusBg = 'rgba(34, 197, 94, 0.15)';
                    } else if (item.status === 'rejected') {
                      statusColor = '#ef4444'; // red
                      statusBg = 'rgba(239, 68, 68, 0.15)';
                    }

                    return (
                      <View style={styles.submissionCard}>
                        <TouchableOpacity 
                          style={styles.submissionHeader}
                          activeOpacity={0.7}
                          onPress={() => setExpandedSubmissionId(isExpanded ? null : item.id)}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.subTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.subDate}>{dateObj.toLocaleDateString()}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                              <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
                            </View>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
                          </View>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.submissionDetails}>
                            {item.status === 'rejected' && item.reviewNotes && (
                              <View style={styles.reviewNotesBox}>
                                <Text style={styles.reviewNotesLabel}>Rejection Reason:</Text>
                                <Text style={styles.reviewNotesText}>{item.reviewNotes}</Text>
                              </View>
                            )}
                            
                            {item.status === 'approved' && (
                              <View style={[styles.reviewNotesBox, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)' }]}>
                                <Text style={[styles.reviewNotesText, { color: '#4ade80' }]}>Added to the collection!</Text>
                              </View>
                            )}
                            {(item.conversation?.length > 0 || item.replyMessage || item.userReply) && (
                              <View style={styles.chatSection}>
                                <Text style={styles.chatHeader}>Conversation</Text>
                                
                                {item.conversation?.length > 0 ? (
                                  item.conversation.map((msg: any) => (
                                    <View key={msg.id} style={[styles.chatBubble, msg.sender === 'admin' ? styles.chatAdmin : styles.chatUser]}>
                                      <Text style={styles.chatSender}>{msg.sender === 'admin' ? `Admin (${msg.senderName})` : 'You'}</Text>
                                      <Text style={styles.chatText}>{msg.message}</Text>
                                    </View>
                                  ))
                                ) : (
                                  <>
                                    {item.replyMessage && (
                                      <View style={[styles.chatBubble, styles.chatAdmin]}>
                                        <Text style={styles.chatSender}>Admin</Text>
                                        <Text style={styles.chatText}>{item.replyMessage}</Text>
                                      </View>
                                    )}
                                    {item.userReply && (
                                      <View style={[styles.chatBubble, styles.chatUser]}>
                                        <Text style={styles.chatSender}>You</Text>
                                        <Text style={styles.chatText}>{item.userReply}</Text>
                                      </View>
                                    )}
                                  </>
                                )}
                              </View>
                            )}
                            <View style={styles.actionButtons}>
                              {(item.status === 'pending' || item.status === 'approved') && (
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditSubmission(item)}>
                                  <Ionicons name="pencil" size={16} color={theme.colors.textPrimary} />
                                  <Text style={styles.actionBtnText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                              
                              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]} onPress={() => setReplyingTo(item)}>
                                <Ionicons name="chatbubble" size={16} color={T.accent} />
                                <Text style={[styles.actionBtnText, { color: T.accent }]}>Reply</Text>
                              </TouchableOpacity>

                              {item.status === 'pending' && (
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]} onPress={() => handleDelete(item.id)}>
                                  <Ionicons name="trash" size={16} color="#ef4444" />
                                  <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Delete</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            {replyingTo?.id === item.id && (
                              <View style={styles.replyInputArea}>
                                <TextInput
                                  style={styles.replyInput}
                                  placeholder="Type your reply..."
                                  placeholderTextColor={theme.colors.textMuted}
                                  value={replyMessage}
                                  onChangeText={setReplyMessage}
                                  multiline
                                />
                                <View style={styles.replyActions}>
                                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <Text style={{ color: theme.colors.textMuted, fontWeight: '600' }}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.sendReplyBtn, !replyMessage.trim() && { opacity: 0.5 }]} 
                                    onPress={handleSendReply}
                                    disabled={!replyMessage.trim() || isSendingReply}
                                  >
                                    {isSendingReply ? <ActivityIndicator size="small" color={theme.colors.textPrimary} /> : <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Send</Text>}
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  
  tabsContainer: { paddingHorizontal: 16, marginBottom: 12 },
  tabsWrapper: {
    flexDirection: 'row', backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16, padding: 4,
  },
  tabButton: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12,
  },
  tabButtonActive: { backgroundColor: theme.colors.cardBackgroundLight },
  tabText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: theme.colors.textPrimary, fontWeight: '700' },

  formContainer: { padding: 16 },
  label: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  required: { color: '#ef4444' },
  input: {
    backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.bottomTabBorder,
    color: theme.colors.textPrimary, fontSize: 15, paddingHorizontal: 16, height: 50,
  },
  textArea: { height: 160, paddingTop: 16 },
  rowInputs: { flexDirection: 'row', gap: 12 },

  audioUploadBtn: {
    backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.bottomTabBorder, borderStyle: 'dashed',
    overflow: 'hidden', minHeight: 60, justifyContent: 'center'
  },
  audioFilePlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  audioFilePlaceholderText: { color: theme.colors.textMuted, fontWeight: '600' },
  audioFileSelected: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: 'rgba(139, 92, 246, 0.1)' },
  audioFileName: { flex: 1, color: theme.colors.textPrimary, fontWeight: '600', fontSize: 14 },

  submitButton: {
    backgroundColor: T.accent, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 32,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },

  editBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(217, 119, 6, 0.15)',
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217, 119, 6, 0.3)',
    marginBottom: 8, gap: 8
  },
  editBannerText: { flex: 1, color: '#fcd34d', fontWeight: '700', fontSize: 13 },
  editBannerCancel: { color: '#fcd34d', fontWeight: '600', textDecorationLine: 'underline' },

  submissionsContainer: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyText: { color: theme.colors.textMuted, marginTop: 16, fontWeight: '600' },

  submissionCard: {
    backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.bottomTabBorder,
    marginBottom: 12, overflow: 'hidden'
  },
  submissionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  subTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
  subDate: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  submissionDetails: {
    padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: theme.colors.bottomTabBorder,
  },
  reviewNotesBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', marginTop: 12,
  },
  reviewNotesLabel: { color: '#ef4444', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  reviewNotesText: { color: '#fca5a5', fontSize: 13, lineHeight: 20 },

  chatSection: { marginTop: 16 },
  chatHeader: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  chatBubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  chatAdmin: { backgroundColor: 'rgba(139, 92, 246, 0.15)', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatUser: { backgroundColor: 'rgba(56, 189, 248, 0.15)', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatSender: { fontSize: 11, fontWeight: '800', marginBottom: 4, color: theme.colors.textSecondary },
  chatText: { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 18 },

  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.cardBackgroundLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  actionBtnText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },

  replyInputArea: { marginTop: 16, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 },
  replyInput: {
    backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 10, padding: 12,
    color: theme.colors.textPrimary, fontSize: 14, minHeight: 80, textAlignVertical: 'top'
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 12 },
  sendReplyBtn: { backgroundColor: T.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
});
};
