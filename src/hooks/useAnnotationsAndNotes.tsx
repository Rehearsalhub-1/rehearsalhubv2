import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, PanResponder, Modal, TextInput, ActivityIndicator, Alert, Dimensions, ScrollView, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/apiClient';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useUserStore } from './useUser';
import { useAnnotationStore } from '../stores/useAnnotationStore';
import { DoodleLayer } from '../components/DoodleLayer';
import { MiniDoodleCanvas } from '../components/MiniDoodleCanvas';
import { canUseAnnotations } from '../config/roles';
export function useAnnotationsAndNotes(trackId: string | undefined, trackTitle: string | undefined, options?: { isPlayer?: boolean }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const profile = useUserStore(s => s.profile);
  const isPrivileged = canUseAnnotations(profile);
  const [annotationTool, setAnnotationTool] = useState<'pen' | 'eraser' | 'line' | 'rectangle' | 'circle'>('pen');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [showColorPalette, setShowColorPalette] = useState(true);
  const { strokes, subscribeToTrack } = useAnnotationStore();
  const setStrokes = useAnnotationStore(s => s.setStrokes);

  useEffect(() => {
    if (trackId) subscribeToTrack(trackId);
  }, [trackId, subscribeToTrack]);


  const [showNotesModal, setShowNotesModal] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  const [personalStrokes, setPersonalStrokes] = useState<any[]>([]);
  const [noteMode, setNoteMode] = useState<'text' | 'draw'>('text');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    if (!trackId) {
      setPersonalNote('');
      setPersonalStrokes([]);
      return;
    }
    setPersonalNote('');
    setPersonalStrokes([]);
    let isMounted = true;
    const localNoteKey = `SONG_PERSONAL_NOTE_${trackId}`;
    const localStrokesKey = `SONG_PERSONAL_STROKES_${trackId}`;

    // 1. Immediately read from AsyncStorage so user never waits and notes show instantly
    AsyncStorage.getItem(localNoteKey).then(savedNote => {
      if (savedNote !== null && isMounted) {
        setPersonalNote(savedNote);
      }
    }).catch(() => {});

    AsyncStorage.getItem(localStrokesKey).then(savedStrokes => {
      if (savedStrokes && isMounted) {
        try {
          const parsed = JSON.parse(savedStrokes);
          if (Array.isArray(parsed)) setPersonalStrokes(parsed);
        } catch {}
      }
    }).catch(() => {});

    // 2. Sync from backend
    apiClient.get<{ success: boolean; data: any }>(`/songs/notes/${trackId}`).then(res => {
      if (res?.success && isMounted) {
        const remoteNote = typeof res.data === 'string'
          ? res.data
          : (res.data?.notes ?? res.data?.note ?? '');
        if (remoteNote) {
          setPersonalNote(remoteNote);
          AsyncStorage.setItem(localNoteKey, remoteNote).catch(() => {});
        }
      }
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [trackId]);

  const getMyColor = () => {
    if (selectedColor) return selectedColor;
    const user = useUserStore.getState().user;
    const uid = user?.uid || '123';
    const colors = ['#ff3b30', '#34c759', '#007aff', '#ffcc00', '#af52de', '#ff9500'];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash += uid.charCodeAt(i);
    return colors[hash % colors.length];
  };

  const handleClearMyAnnotations = async () => {
    const user = useUserStore.getState().user;
    const otherStrokes = strokes.filter((s: any) => s.userId !== user?.uid);
    setStrokes(otherStrokes);
  };

  const handleSaveNote = async () => {
    if (!trackId) return;
    setIsSavingNote(true);
    const localNoteKey = `SONG_PERSONAL_NOTE_${trackId}`;
    const localStrokesKey = `SONG_PERSONAL_STROKES_${trackId}`;

    try {
      // 1. Always save to local storage immediately
      await AsyncStorage.setItem(localNoteKey, personalNote || '');
      if (personalStrokes.length > 0) {
        await AsyncStorage.setItem(localStrokesKey, JSON.stringify(personalStrokes));
      } else {
        await AsyncStorage.removeItem(localStrokesKey);
      }

      // 2. Sync to backend with fallback
      await apiClient.patch(`/songs/notes/${trackId}`, {
        notes: personalNote,
        note: personalNote,
      });

      setShowNotesModal(false);
      Alert.alert('Saved', 'Your notes have been saved.');
    } catch (err: any) {
      console.warn('[handleSaveNote saved locally]:', err?.message);
      setShowNotesModal(false);
      Alert.alert('Saved Offline', 'Notes saved to your device.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const isAnnotationModeRef = useRef(isAnnotationMode);
  useEffect(() => {
    isAnnotationModeRef.current = isAnnotationMode;
  }, [isAnnotationMode]);

  const annotationLayerElement = ( 
      <DoodleLayer 
        isAnnotationMode={isAnnotationMode} 
        activeTrackId={trackId} 
        user={useUserStore.getState().user} 
        getMyColor={getMyColor} 
        insets={insets} 
        annotationTool={annotationTool} 
        strokes={strokes} 
        setStrokes={setStrokes} 
        isPlayer={options?.isPlayer}
      /> 
  );

  const notesModalElement = (
    <Modal visible={showNotesModal} transparent={false} animationType="slide" onRequestClose={() => setShowNotesModal(false)}>
      <KeyboardAvoidingView
        behavior='padding'
        style={{ flex: 1 }}
      >
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundDark }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 16,
          borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        }}>
          <TouchableOpacity onPress={() => setShowNotesModal(false)} style={{ padding: 4 }}>
            <Ionicons name="chevron-down" size={26} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: '800' }}>My Personal Notes</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>Private • {trackTitle}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSaveNote}
            disabled={isSavingNote}
            style={{ padding: 4 }}>
            {isSavingNote
              ? <ActivityIndicator size="small" color={theme.colors.accent} />
              : <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '800' }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', margin: 16, borderRadius: 10, padding: 4 }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7, backgroundColor: noteMode === 'text' ? theme.colors.accent : 'transparent' }}
            onPress={() => setNoteMode('text')}
          >
            <Text style={{ color: noteMode === 'text' ? '#fff' : theme.colors.textMuted, fontWeight: '700', fontSize: 13 }}>Type</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7, backgroundColor: noteMode === 'draw' ? theme.colors.accent : 'transparent' }}
            onPress={() => { Keyboard.dismiss(); setNoteMode('draw'); }}
          >
            <Text style={{ color: noteMode === 'draw' ? '#fff' : theme.colors.textMuted, fontWeight: '700', fontSize: 13 }}>Pen</Text>
          </TouchableOpacity>
        </View>
        {noteMode === 'text' ? (
          <ScrollView
            style={{ flex: 1, marginHorizontal: 16 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}>
            <TextInput
              style={{
                flex: 1, color: theme.colors.textPrimary, fontSize: 16,
                lineHeight: 26, textAlignVertical: 'top', minHeight: 300,
                backgroundColor: theme.colors.cardBackground,
                borderRadius: 14, padding: 16,
              }}
              placeholder="Write your private rehearsal notes here..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              autoFocus={false}
              value={personalNote}
              onChangeText={setPersonalNote}
            />
          </ScrollView>
        ) : (
          <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: theme.colors.cardBackground }}>
            <MiniDoodleCanvas strokes={personalStrokes} setStrokes={setPersonalStrokes} color={theme.colors.accent} />
            <TouchableOpacity
              style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}
              onPress={() => setPersonalStrokes([])}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: insets.bottom + 16 }} />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return {
    isPrivileged,
    isAnnotationMode,
    setIsAnnotationMode,
    setShowNotesModal,
    AnnotationLayer: annotationLayerElement,
    NotesModal: notesModalElement,
    strokes,
    handleClearMyAnnotations,
    annotationTool,
    setAnnotationTool,
    selectedColor,
    setSelectedColor,
    getMyColor,
    personalNote,
    setPersonalNote,
    personalStrokes,
    setPersonalStrokes,
    showColorPalette,
    setShowColorPalette
  };
}
