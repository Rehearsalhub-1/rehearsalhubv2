import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Switch,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { SafeTrackPlayer as TrackPlayer, SafeCapability as Capability } from '../lib/safeNativeModules';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useUserStore } from '../hooks/useUser';
import { getHiddenFeatures } from '../config/roles';
import { getAccessToken } from '../lib/apiClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AudiolabScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const profile = useUserStore(s => s.profile);
  const isProfileLoading = useUserStore(s => s.isProfileLoading);
  const hf = getHiddenFeatures(profile);

  interface Track {
    id: string;
    name: string;
    type: 'voice' | 'backing' | 'sampler';
    color: string;
    uri?: string;
    mute: boolean;
    solo: boolean;
    volume: number;
    peaks?: number[];
    startTime?: number;
    duration?: number;
  }

  const [activeTab, setActiveTab] = useState<'waveform' | 'feather' | 'projects' | 'settings'>('waveform');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [displaySoundsShortcut, setDisplaySoundsShortcut] = useState(true);
  const [midiOverdub, setMidiOverdub] = useState(true);
  const [quantizeMidi, setQuantizeMidi] = useState(false);
  const [countIn, setCountIn] = useState<'Off' | '1 Bar' | '2 Bars'>('1 Bar');
  const [inputDevice, setInputDevice] = useState('Built-in Mic');
  const [inputChannel, setInputChannel] = useState('Channel 1');
  const [metronomeVolume, setMetronomeVolume] = useState(0.8);
  const [lyricsText, setLyricsText] = useState('Verse 1:\nBlinded by your grace\nEvery single day I am singing your praise...\n\nChorus:\nLord You are great\nAnd greatly to be praised...');
  const [timecode, setTimecode] = useState('00:00.0');

  const [newProjectName, setNewProjectName] = useState('');
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  useEffect(() => {
    loadSavedProjects();
  }, []);

  const loadSavedProjects = async () => {
    try {
      const raw = await AsyncStorage.getItem('audiolab_projects');
      if (raw) {
        setSavedProjects(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Failed to load projects', e);
    }
  };

  const saveCurrentProject = async (projectName: string) => {
    if (!projectName.trim()) {
      showToast('Please enter a project name');
      return;
    }
    try {
      const newProj = {
        id: String(Date.now()),
        name: projectName.trim(),
        timestamp: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        tracks,
        lyricsText,
        bpm,
        timeSig,
        loopEnabled
      };

      const existingIdx = savedProjects.findIndex(p => p.name.toLowerCase() === projectName.trim().toLowerCase());
      let updated = [...savedProjects];
      
      if (existingIdx >= 0) {
        updated[existingIdx] = { ...newProj, id: updated[existingIdx].id }; // preserve ID but update content
      } else {
        updated = [newProj, ...savedProjects];
      }
      
      setSavedProjects(updated);
      await AsyncStorage.setItem('audiolab_projects', JSON.stringify(updated));
      showToast(`Saved Project: ${projectName}`);
    } catch (e) {
      showToast('Failed to save project');
    }
  };

  const loadProject = (project: any) => {
    stopPlayback();
    setTracks(project.tracks || []);
    if (project.lyricsText !== undefined) setLyricsText(project.lyricsText);
    if (project.bpm) setBpm(project.bpm);
    if (project.timeSig) setTimeSig(project.timeSig);
    if (project.loopEnabled !== undefined) setLoopEnabled(project.loopEnabled);
    
    setNewProjectName(project.name); // Automatically set the save name so they can quick-save
    
    const maxId = (project.tracks || []).reduce((max: number, track: any) => {
      const idNum = parseInt(track.id, 10);
      return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 0);
    trackIdCounter.current = maxId;
    setActiveTab('waveform');
    showToast(`Loaded: ${project.name}`);
  };

  const deleteProject = async (projectId: string) => {
    try {
      const updated = savedProjects.filter(p => p.id !== projectId);
      setSavedProjects(updated);
      await AsyncStorage.setItem('audiolab_projects', JSON.stringify(updated));
      showToast('Project deleted');
    } catch (e) {
      showToast('Failed to delete project');
    }
  };
  const generateWavePeaks = (trackId: string, trackName: string = '') => {

    let seed = 0;
    const str = trackId + trackName;
    for (let i = 0; i < str.length; i++) {
      seed += str.charCodeAt(i);
    }
    const peaks = [];
    for (let i = 0; i < 120; i++) {
      const sin1 = Math.sin(i * 0.3 + seed);
      const sin2 = Math.cos(i * 0.7 - seed);
      const sin3 = Math.sin(i * 1.2 + seed * 2);
      const randomFactor = Math.abs((sin1 + sin2 + sin3) / 3);
      peaks.push(Math.max(4, Math.floor(randomFactor * 48) + 4));
    }
    return peaks;
  };

  const wasPlayingBeforeDragRef = useRef(false);

  const updateTimelinePosition = (locX: number) => {
    let newElapsed = ((locX - 20) / 45) * 1000;
    if (newElapsed < 0) newElapsed = 0;
    
    playTimeRef.current = newElapsed;

    TrackPlayer.seekTo(newElapsed / 1000).catch(() => {});
    
    const mins = Math.floor(newElapsed / 60000);
    const secs = Math.floor((newElapsed % 60000) / 1000);
    const ms = Math.floor((newElapsed % 1000) / 100);
    setTimecode(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`);
    setScrubberPosition(20 + (newElapsed / 1000) * 45);
  };

  const handleTimelineGrant = (evt: any) => {
    wasPlayingBeforeDragRef.current = isPlaying;
    if (isPlaying) stopPlayback(false);
    updateTimelinePosition(evt.nativeEvent.locationX);
  };

  const handleTimelineMove = (evt: any) => {
    updateTimelinePosition(evt.nativeEvent.locationX);
  };

  const handleTimelineRelease = async () => {
    if (wasPlayingBeforeDragRef.current) {
      await startPlayback(false);
    }
  };

  const [activeModal, setActiveModal] = useState<
    'fx' | 'autopitch' | 'addTrack' | 'mixer' | 'metronome' | 'export' | 'tuner' | 'collab' | 'trackSettings' | 'studioKit' | null>(
    null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [fxReverb, setFxReverb] = useState(false);
  const [fxDelay, setFxDelay] = useState(false);
  const [fxDoubler, setFxDoubler] = useState(false);
  const [fxEQ, setFxEQ] = useState(false);

  const [pitchKey, setPitchKey] = useState('Bbm');
  const [pitchScale, setPitchScale] = useState('Minor');
  const [formantShift, setFormantShift] = useState(false);

  const [bpm, setBpm] = useState(110);
  const [timeSig, setTimeSig] = useState('4/4');

  const [tracks, setTracks] = useState<Track[]>([]);
  const [scrubberPosition, setScrubberPosition] = useState(20);
  const [tunerNote, setTunerNote] = useState('E');
  const [tunerCents, setTunerCents] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [muteAll, setMuteAll] = useState(false);
  const [monitorEnabled, setMonitorEnabled] = useState(true);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingPeaksRef = useRef<number[]>([]);
  const [liveMeterLevel, setLiveMeterLevel] = useState(0); // 0-1 normalized live level
  const soundObjsRef = useRef<{ [trackId: string]: Audio.Sound }>({});
  const soundTimeoutsRef = useRef<any[]>([]);
  const playTimeRef = useRef<number>(0);
  const recordStartTimeRef = useRef<number>(0);
  const playTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const tunerInterval = useRef<NodeJS.Timeout | null>(null);
  const lastBeatRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);
  const trackIdCounter = useRef(Date.now());
  const activeRecordingTrackIdRef = useRef<string | null>(null);

  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const undoStackRef = useRef<Track[][]>([]);
  const redoStackRef = useRef<Track[][]>([]);
  const MAX_HISTORY = 20;

  const pushUndoSnapshot = (currentTracks: Track[]) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_HISTORY - 1)), JSON.parse(JSON.stringify(currentTracks))];
    redoStackRef.current = []; // Clear redo on new action
  };

  const lastTrackSnapshotRef = useRef<typeof tracks | null>(null);




  const showToast = (msg: string) => {

    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const [isBouncing, setIsBouncing] = useState(false);
  const [bounceProgress, setBounceProgress] = useState(0);

  const importAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        trackIdCounter.current += 1;
        
        let duration = 20000; // fallback
        try {
          const { sound } = await Audio.Sound.createAsync({ uri: file.uri });
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            duration = status.durationMillis;
          }
          await sound.unloadAsync();
        } catch (e) {

        }

        setTracks(prev => [
          ...prev,
          {
            id: String(trackIdCounter.current),
            name: file.name.replace(/\.[^/.]+$/, "") || 'Imported Audio',
            type: 'backing',
            color: theme.colors.accent,
            mute: false,
            solo: false,
            volume: 0.7,
            uri: file.uri,
            startTime: 0,
            duration: duration
          }
        ]);
        showToast(`Imported: ${file.name}`);
      }
    } catch {
      showToast('Failed to import audio file');
    }
  };

  const triggerExport = async (format: string) => {
    setActiveModal(null);

    const activeTracks = tracks.filter(t => t.uri && !t.mute);

    if (activeTracks.length === 0) {
      showToast('No active tracks to export. Record something first!');
      return;
    }

    setIsBouncing(true);
    setBounceProgress(10);

    try {
      const outExt = format.toLowerCase();
      const finalPath = `${FileSystem.cacheDirectory}audiolab_export_${Date.now()}.${outExt}`;
      
      const formData = new FormData();
      const volumes: number[] = [];
      
      for (let i = 0; i < activeTracks.length; i++) {
        const track = activeTracks[i];
        if (track.uri) {
          const uri = track.uri.startsWith('file://') ? track.uri : `file://${track.uri}`;
          formData.append(`track${i}`, {
            uri,
            name: `track${i}.m4a`,
            type: 'audio/m4a'
          } as any);
          volumes.push(track.volume);
        }
      }
      formData.append('volumes', JSON.stringify(volumes));

      const token = await getAccessToken();
      
      const progressInterval = setInterval(() => {
        setBounceProgress(prev => Math.min(prev + 5, 90));
      }, 1000); // Increased to 1s to reduce CPU usage

      const res = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/bounce`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);

      if (!res.ok) throw new Error('Failed to bounce audio on server');
      
      setBounceProgress(98);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = (reader.result as string).split(',')[1];
        await FileSystem.writeAsStringAsync(finalPath, base64data, { encoding: FileSystem.EncodingType.Base64 });
        
        setBounceProgress(100);
        setTimeout(async () => {
          setIsBouncing(false);
          try {
            await Share.share({
              url: finalPath,
              title: `Audiolab Export (${format})`,
            });
            showToast(`Exported successfully as ${format}`);
          } catch {
            showToast(`Export complete`);
          }
        }, 500);
      };
      reader.readAsDataURL(blob);

    } catch (err) {
      console.error(err);
      setIsBouncing(false);
      showToast('An error occurred during export');
    }
  };

  const handleTapTempo = () => {

    const now = Date.now();
    const taps = tapTimesRef.current;
    taps.push(now);

    if (taps.length > 1 && now - taps[taps.length - 2] > 3000) {
      tapTimesRef.current = [now];
      return;
    }

    if (taps.length > 5) taps.shift();

    if (taps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= 40 && newBpm <= 240) setBpm(newBpm);
    }
  };

  useEffect(() => {

    try {
      TrackPlayer.pause().catch(() => {});
      TrackPlayer.reset().catch(() => {});
    } catch (err) {

    }

    return () => {
      stopPlayback();
      if (playTimerInterval.current) clearInterval(playTimerInterval.current);
      if (tunerInterval.current) clearInterval(tunerInterval.current);

      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // Changed to false to prevent battery drain
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now() - playTimeRef.current;
      playTimerInterval.current = setInterval(async () => {
        let elapsed = Date.now() - startTime;

        const hasBacking = tracks.some(t => t.type === 'backing' && !t.mute);
        if (hasBacking) {
          try {
            const trackPlayerPos = await TrackPlayer.getPosition();
            if (trackPlayerPos > 0) {
              elapsed = Math.floor(trackPlayerPos * 1000);
            }
          } catch {}
        }

        if (loopEnabled) {
          const loopDuration = (12 * (60 / bpm)) * 1000;
          elapsed = elapsed % loopDuration;
          playTimeRef.current = elapsed;
        } else {
          playTimeRef.current = elapsed;
        }

        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        const ms = Math.floor((elapsed % 1000) / 100);
        setTimecode(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`);

        setScrubberPosition(20 + (elapsed / 1000) * 45);

        const beatDuration = (60 / bpm) * 1000;
        const beatIndex = Math.floor(elapsed / beatDuration) % 4 + 1;
        if (beatIndex !== lastBeatRef.current) {
          lastBeatRef.current = beatIndex;
          setCurrentBeat(beatIndex);
        }
      }, 250); // Increased from 100ms to 250ms (still smooth, reduces CPU by 60%)
    } else {
      if (playTimerInterval.current) {
        clearInterval(playTimerInterval.current);
        playTimerInterval.current = null;
      }
    }
    return () => {
      if (playTimerInterval.current) clearInterval(playTimerInterval.current);
    };
  }, [isPlaying, bpm, loopEnabled, tracks]);

  useEffect(() => {
    if (activeModal === 'tuner') {
      const notes = ['E', 'A', 'D', 'G', 'B', 'E'];
      tunerInterval.current = setInterval(() => {
        setTunerCents(prev => {
          const change = (Math.random() - 0.5) * 12;
          let next = prev + change;
          if (next > 45) next = 45;
          if (next < -45) next = -45;
          return next;
        });
        if (Math.random() > 0.94) {
          const randomNote = notes[Math.floor(Math.random() * notes.length)];
          setTunerNote(randomNote);
        }
      }, 500); // Increased from 250ms to 500ms to reduce CPU usage
    } else {
      if (tunerInterval.current) {
        clearInterval(tunerInterval.current);
        tunerInterval.current = null;
      }
    }
    return () => {
      if (tunerInterval.current) clearInterval(tunerInterval.current);
    };
  }, [activeModal]);

  const trimTrack = async (trackId: string, keep: 'left' | 'right') => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.uri) {
      showToast('No audio to trim');
      return;
    }

    const playTimeMs = playTimeRef.current;
    const trackStart = track.startTime || 0;
    const trackEnd = trackStart + (track.duration || 25000);
    if (playTimeMs <= trackStart || playTimeMs >= trackEnd) {
      showToast('Move playhead inside the track to trim');
      return;
    }
    const cutPointSec = (playTimeMs - trackStart) / 1000;
    
    showToast('Trimming...');
    const outPath = `${FileSystem.cacheDirectory}audiolab_trim_${Date.now()}.m4a`;

    pushUndoSnapshot(tracks);

    try {
      const formData = new FormData();
      formData.append('keep', keep);
      formData.append('cutPointSec', cutPointSec.toString());
      
      const uri = track.uri.startsWith('file://') ? track.uri : `file://${track.uri}`;
      formData.append('track', {
        uri,
        name: 'track.m4a',
        type: 'audio/m4a'
      } as any);

      const token = await getAccessToken();
      const res = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/trim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Trim API failed');
      
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = (reader.result as string).split(',')[1];
        await FileSystem.writeAsStringAsync(outPath, base64data, { encoding: FileSystem.EncodingType.Base64 });
        
        setTracks(prev => prev.map(t => {
          if (t.id === trackId) {
            if (keep === 'left') {
              return {
                ...t,
                uri: outPath,
                duration: Math.max(500, playTimeMs - trackStart)
              };
            } else {
              return {
                ...t,
                uri: outPath,
                startTime: playTimeMs,
                duration: Math.max(500, trackEnd - playTimeMs)
              };
            }
          }
          return t;
        }));
        showToast(keep === 'left' ? 'Trimmed end ✓' : 'Trimmed start ✓');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error(err);
      undoStackRef.current.pop();
      showToast('Trim failed');
    }
  };

  const splitTrack = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.uri) {
      showToast('No audio to split');
      return;
    }

    const playTimeMs = playTimeRef.current;
    const trackStart = track.startTime || 0;
    const trackEnd = trackStart + (track.duration || 25000);

    if (playTimeMs <= trackStart || playTimeMs >= trackEnd) {
      showToast('Move playhead inside the track to split');
      return;
    }    const cutPointSec = (playTimeMs - trackStart) / 1000;
    
    showToast('Splitting...');
    const ts = Date.now();
    const outLeft = `${FileSystem.cacheDirectory}audiolab_splitL_${ts}.m4a`;
    const outRight = `${FileSystem.cacheDirectory}audiolab_splitR_${ts}.m4a`;

    pushUndoSnapshot(tracks);

    try {
      const uri = track.uri.startsWith('file://') ? track.uri : `file://${track.uri}`;
      const token = await getAccessToken();

      const formLeft = new FormData();
      formLeft.append('keep', 'left');
      formLeft.append('cutPointSec', cutPointSec.toString());
      formLeft.append('track', { uri, name: 'track.m4a', type: 'audio/m4a' } as any);

      const resLeft = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/trim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formLeft
      });
      if (!resLeft.ok) throw new Error('Split Left API failed');
      const blobLeft = await resLeft.blob();
      
      const formRight = new FormData();
      formRight.append('keep', 'right');
      formRight.append('cutPointSec', cutPointSec.toString());
      formRight.append('track', { uri, name: 'track.m4a', type: 'audio/m4a' } as any);

      const resRight = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/trim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formRight
      });
      if (!resRight.ok) throw new Error('Split Right API failed');
      const blobRight = await resRight.blob();

      const readerL = new FileReader();
      readerL.onload = async () => {
        const b64L = (readerL.result as string).split(',')[1];
        await FileSystem.writeAsStringAsync(outLeft, b64L, { encoding: FileSystem.EncodingType.Base64 });
        
        const readerR = new FileReader();
        readerR.onload = async () => {
          const b64R = (readerR.result as string).split(',')[1];
          await FileSystem.writeAsStringAsync(outRight, b64R, { encoding: FileSystem.EncodingType.Base64 });
          
          trackIdCounter.current += 1;
          setTracks(prev => {
            const newTracks = [...prev];
            const idx = newTracks.findIndex(t => t.id === trackId);
            if (idx > -1) {
              const oldTrack = { ...newTracks[idx] };
              newTracks[idx] = {
                ...oldTrack,
                uri: outLeft,
                duration: Math.max(500, playTimeMs - trackStart)
              };
              newTracks.splice(idx + 1, 0, {
                ...oldTrack,
                id: String(trackIdCounter.current),
                name: `${oldTrack.name} (R)`,
                uri: outRight,
                startTime: playTimeMs,
                duration: Math.max(500, trackEnd - playTimeMs)
              });
            }
            return newTracks;
          });
          showToast('Split ✓');
        };
        readerR.readAsDataURL(blobRight);
      };
      readerL.readAsDataURL(blobLeft);
    } catch (err) {
      console.error(err);
      undoStackRef.current.pop();
      showToast('Split failed');
    }
  };
  const startRecording = async () => {
    try {
      try {
        await TrackPlayer.pause();
        const hasBackingTrack = tracks.some(t => t.uri && !t.mute && t.type === 'backing');
        if (!hasBackingTrack) {
          await TrackPlayer.reset();
        }
      } catch {}

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // Changed to false to prevent battery drain

        playThroughEarpieceAndroid: !monitorEnabled,
      });

      if (countIn !== 'Off') {
        const beats = countIn === '1 Bar' ? 4 : 8;
        const msPerBeat = 60000 / bpm;
        for (let i = beats; i > 0; i--) {
          setCountdownNum(i);

          await new Promise(r => setTimeout(r, msPerBeat));
        }
        setCountdownNum(null);
      }

      await startPlayback(true);

      recordingPeaksRef.current = []; // Reset peaks for new take
      setLiveMeterLevel(0);

      pushUndoSnapshot(tracks);

      trackIdCounter.current += 1;
      const newTrackId = String(trackIdCounter.current);
      activeRecordingTrackIdRef.current = newTrackId;

      setTracks(prev => [
        ...prev,
        {
          id: newTrackId,
          name: `Vocal Take ${prev.length + 1}`,
          type: 'voice',
          color: '#ef4444', // Red color indicator for recording track
          mute: false,
          solo: false,
          volume: 0.85,
          startTime: playTimeRef.current,
          duration: 100, // starting min duration
          isRecording: true,
          peaks: []
        }
      ]);

      let recordingObj: Audio.Recording;
      try {
        const unprocessedOptions = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            audioSource: 9, // AndroidAudioSource.UNPROCESSED (Raw mic, no AEC)
          }
        };
        const { recording } = await Audio.Recording.createAsync(unprocessedOptions);
        recordingObj = recording;
      } catch (e) {

        const micOptions = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            audioSource: 1, // AndroidAudioSource.MIC
          }
        };
        const { recording } = await Audio.Recording.createAsync(micOptions);
        recordingObj = recording;
      }

      recordingObj.setProgressUpdateInterval(50);
      recordingObj.setOnRecordingStatusUpdate((status) => {
        if (status.metering !== undefined) {

          const normalized = Math.max(0, Math.min(1, (status.metering + 90) / 90));
          const mappedHeight = Math.max(3, Math.floor(normalized * 52));
          recordingPeaksRef.current.push(mappedHeight);
          setLiveMeterLevel(normalized);

          const elapsed = status.durationMillis || (recordingPeaksRef.current.length * 50);
          setTracks(prev => prev.map(t => t.id === newTrackId ? {
            ...t,
            duration: elapsed,
            peaks: [...recordingPeaksRef.current]
          } : t));
        }
      });

      recordingRef.current = recordingObj;
      recordStartTimeRef.current = playTimeRef.current;
      setIsRecording(true);
      
    } catch {
      setCountdownNum(null);

      if (activeRecordingTrackIdRef.current) {
        const failedId = activeRecordingTrackIdRef.current;
        setTracks(prev => prev.filter(t => t.id !== failedId));
        activeRecordingTrackIdRef.current = null;
      }
      showToast('Mic Permission Denied or Device Unavailable');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      const status = await recordingRef.current.stopAndUnloadAsync();
      const rawUri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setLiveMeterLevel(0);
      setIsPlaying(false); // Fix: reset play state after recording stops
      
      await stopPlayback();

      const offsetMs = recordStartTimeRef.current;
      playTimeRef.current = offsetMs;
      const mins = Math.floor(offsetMs / 60000);
      const secs = Math.floor((offsetMs % 60000) / 1000);
      const ms = Math.floor((offsetMs % 1000) / 100);
      setTimecode(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`);
      setScrubberPosition(Math.min(20 + (offsetMs / 1000) * 45, SCREEN_WIDTH * 3 - 10));

      const activeTrackId = activeRecordingTrackIdRef.current;
      activeRecordingTrackIdRef.current = null;

      if (rawUri && activeTrackId) {
        const capturedPeaks = [...recordingPeaksRef.current];
        const recordedDurationMs = status.durationMillis || (capturedPeaks.length * 50);

        setTracks(prev => prev.map(t => t.id === activeTrackId ? { 
          ...t, 
          uri: rawUri, 
          peaks: capturedPeaks,
          startTime: offsetMs,
          duration: recordedDurationMs,
          color: theme.colors.accent,
          isRecording: false
        } : t));
        showToast('Vocal Recording Saved to Session!');
      } else {

        if (activeTrackId) {
          setTracks(prev => prev.filter(t => t.id !== activeTrackId));
        }
      }
    } catch {
      if (activeRecordingTrackIdRef.current) {
        const failedId = activeRecordingTrackIdRef.current;
        setTracks(prev => prev.filter(t => t.id !== failedId));
        activeRecordingTrackIdRef.current = null;
      }
    }
  };

  const startPlayback = async (isRecordingSync = false) => {
    try {
      try {
        await TrackPlayer.pause();
        const hasBackingTrack = tracks.some(t => t.uri && !t.mute && t.type === 'backing');
        if (!hasBackingTrack) {
          await TrackPlayer.reset();
        }
      } catch {}

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: isRecordingSync,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // Changed to false to prevent battery drain
        playThroughEarpieceAndroid: isRecordingSync ? !monitorEnabled : false,
      });

      await stopPlayback(false);

      const promises = tracks.map(async (track) => {
        if (track.uri && !track.mute) {
          const isAnySolo = tracks.some(t => t.solo);
          if (isAnySolo && !track.solo) return;

          const playTime = playTimeRef.current;
          const trackStart = track.startTime || 0;
          const trackDur = track.duration || 25000;

          if (playTime >= trackStart + trackDur) {
            return;
          }

          const shouldPlayImmediately = playTime >= trackStart;
          const offset = shouldPlayImmediately ? (playTime - trackStart) : 0;
          const delay = shouldPlayImmediately ? 0 : (trackStart - playTime);

          if (track.type === 'backing') {
            let trackPlayerSuccess = false;
            try {
              await TrackPlayer.reset();
              await TrackPlayer.add({
                id: track.id,
                url: track.uri!,
                title: track.name,
                artist: 'Backing Track',
                duration: trackDur / 1000,
              });
              await TrackPlayer.setVolume(track.volume);
              await TrackPlayer.seekTo(offset / 1000);
              if (shouldPlayImmediately) {
                await TrackPlayer.play();
              } else {
                const timeoutId = setTimeout(async () => {
                  try {
                    await TrackPlayer.play();
                  } catch {}
                }, delay);
                soundTimeoutsRef.current.push(timeoutId);
              }
              trackPlayerSuccess = true;
            } catch (e) {

            }
            if (trackPlayerSuccess) return;
          }

          const loadSound = async (suffix = '') => {
            let volumeVal = track.volume;
            if (suffix === '_doubler') volumeVal = track.volume * 0.45;
            else if (suffix === '_reverb') volumeVal = track.volume * 0.25;
            else if (suffix === '_delay') volumeVal = track.volume * 0.35;

            const { sound } = await Audio.Sound.createAsync(
              { uri: track.uri! },
              { 
                volume: volumeVal, 
                shouldPlay: shouldPlayImmediately && suffix === '', // Play immediately if within range (FX triggers delayed)
                isLooping: loopEnabled, 
                positionMillis: offset 
              }
            );
            soundObjsRef.current[`${track.id}${suffix}`] = sound;
            return sound;
          };

          try {
            const mainSound = await loadSound();

            if (!shouldPlayImmediately) {
              const timeoutId = setTimeout(async () => {
                try {
                  const s = soundObjsRef.current[track.id];
                  if (s) await s.playAsync();
                } catch {}
              }, delay);
              soundTimeoutsRef.current.push(timeoutId);
            }

            if (track.type === 'voice') {
              if (fxDoubler) {
                await loadSound('_doubler');
                const tId = setTimeout(async () => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_doubler`];
                    if (s) await s.playAsync();
                  } catch {}
                }, delay + 30);
                soundTimeoutsRef.current.push(tId);
              }

              if (fxReverb) {
                await loadSound('_reverb');
                const tId = setTimeout(async () => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_reverb`];
                    if (s) await s.playAsync();
                  } catch {}
                }, delay + 85);
                soundTimeoutsRef.current.push(tId);
              }

              if (fxDelay) {
                await loadSound('_delay');
                const tId = setTimeout(async () => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_delay`];
                    if (s) await s.playAsync();
                  } catch {}
                }, delay + 320);
                soundTimeoutsRef.current.push(tId);
              }
            }
          } catch (e) {

          }
        }
      });

      await Promise.all(promises);
      setIsPlaying(true);
    } catch {
      showToast('Error playing audio track');
    }
  };

  const stopPlayback = async (updateState = true) => {
    soundTimeoutsRef.current.forEach(t => clearTimeout(t));
    soundTimeoutsRef.current = [];

    try {
      await TrackPlayer.pause();
    } catch {}

    const promises = Object.values(soundObjsRef.current).map(async (sound) => {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
    });
    await Promise.all(promises);
    soundObjsRef.current = {};
    if (updateState) {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {

    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const toggleRecord = () => {

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const addTrack = (name: string, type: 'voice' | 'backing' | 'sampler', color: string, uri?: string) => {
    trackIdCounter.current += 1;
    setTracks(prev => [
      ...prev,
      {
        id: String(trackIdCounter.current),
        name: `${name} Track ${prev.length + 1}`,
        type,
        color,
        mute: false,
        solo: false,
        volume: 0.7,
        uri,
        startTime: 0,
        duration: 25000 // default duration
      }
    ]);
    showToast(`Added ${name} Track`);
  };

  const renameTrack = (trackId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, name: trimmed } : t));
    setRenamingTrackId(null);
    setRenameText('');
  };

  const performUndo = () => {
    if (undoStackRef.current.length === 0) {
      showToast('Nothing to undo');
      return;
    }

    redoStackRef.current = [...redoStackRef.current, JSON.parse(JSON.stringify(tracks))];

    const previousState = undoStackRef.current.pop()!;
    setTracks(previousState);
    showToast('Undo ✓');
  };

  const performRedo = () => {
    if (redoStackRef.current.length === 0) {
      showToast('Nothing to redo');
      return;
    }

    undoStackRef.current = [...undoStackRef.current, JSON.parse(JSON.stringify(tracks))];

    const nextState = redoStackRef.current.pop()!;
    setTracks(nextState);
    showToast('Redo ✓');
  };

  const toggleTrackMute = async (id: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id === id) {
        const nextMute = !t.mute;
        const sound = soundObjsRef.current[id];
        if (sound) {
          sound.setIsMutedAsync(nextMute);
        }

        if (t.type === 'backing') {
          TrackPlayer.setVolume(nextMute ? 0 : t.volume).catch(() => {});
        }
        return { ...t, mute: nextMute };
      }
      return t;
    }));
  };

  const toggleTrackSolo = async (id: string) => {
    setTracks(prev => {
      const nextTracks = prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t);
      const isAnySolo = nextTracks.some(t => t.solo);
      nextTracks.forEach(async (t) => {
        const sound = soundObjsRef.current[t.id];
        if (sound) {
          await sound.setVolumeAsync(isAnySolo ? (t.solo ? t.volume : 0) : t.volume);
        }

        if (t.type === 'backing') {
          const vol = isAnySolo ? (t.solo ? t.volume : 0) : t.volume;
          TrackPlayer.setVolume(vol).catch(() => {});
        }
      });
      return nextTracks;
    });
  };

  const handleVolumeChange = async (id: string, val: number) => {
    setTracks(prev => {
      const target = prev.find(t => t.id === id);
      if (target && target.type === 'backing') {
        TrackPlayer.setVolume(val).catch(() => {});
      }
      return prev.map(t => t.id === id ? { ...t, volume: val } : t);
    });
    const sound = soundObjsRef.current[id];
    if (sound) {
      try {
        await sound.setVolumeAsync(val);
      } catch {}
    }
  };

  if (!isProfileLoading && hf.hideAudioLab) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={theme.gradients.bgBase}
          locations={theme.gradients.bgBaseLocations}
          style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={theme.gradients.bgGlow}
          locations={theme.gradients.bgGlowLocations}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }]}>
          <Ionicons name="lock-closed" size={80} color={theme.colors.accent} style={{ marginBottom: 24 }} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>Access Restricted</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Audiolab is currently not enabled for your account.
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
      <LinearGradient
        colors={theme.gradients.bgBase}
        locations={theme.gradients.bgBaseLocations}
        style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={theme.gradients.bgGlow}
        locations={theme.gradients.bgGlowLocations}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (activeTab !== 'waveform') {
                setActiveTab('waveform');
              } else {
                navigation.goBack();
              }
            }}
            style={styles.headerButton}>
            <Ionicons name={activeTab === 'waveform' ? "arrow-back" : "close-outline"} size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {activeTab === 'waveform' && 'Audiolab'}
            {activeTab === 'feather' && 'Notepad & Lyrics'}
            {activeTab === 'projects' && 'Saved Projects'}
            {activeTab === 'settings' && 'Settings'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => { setActiveModal('export'); }} style={styles.headerIconBtn}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setActiveTab(activeTab === 'settings' ? 'waveform' : 'settings');
              }}
              style={[styles.headerIconBtn, activeTab === 'settings' && { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}>
              <Ionicons
                name="settings-outline"
                size={20}
                color={activeTab === 'settings' ? theme.colors.accent : theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
        {activeTab === 'waveform' && tracks.length > 0 && (
          <View style={styles.transportTopBar}>
            <View style={styles.timecodeBlock}>
              <Text style={styles.timecodeText}>{timecode}</Text>
              <Text style={styles.tempoText}>{bpm}.0</Text>
            </View>
            <View style={styles.transportControls}>
              <TouchableOpacity style={styles.transportSmallBtn} onPress={() => {
                setTimecode('00:00.0'); setScrubberPosition(20); playTimeRef.current = 0;
                TrackPlayer.seekTo(0).catch(() => {});
              }}>
                <Ionicons name="play-skip-back" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.transportPlayBtn} onPress={togglePlay}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.transportSmallBtn} onPress={() => {
                const newElapsed = playTimeRef.current + 5000;
                playTimeRef.current = newElapsed;
                const mins = Math.floor(newElapsed / 60000);
                const secs = Math.floor((newElapsed % 60000) / 1000);
                const ms = Math.floor((newElapsed % 1000) / 100);
                setTimecode(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`);
                setScrubberPosition(20 + (newElapsed / 1000) * 45);
                if (isPlaying) {
                  stopPlayback(false).then(() => startPlayback(false));
                } else {
                  TrackPlayer.seekTo(newElapsed / 1000).catch(() => {});
                }
              }}>
                <Ionicons name="play-skip-forward" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.transportRight}>
              <TouchableOpacity style={styles.transportSmallBtn} onPress={() => performUndo()}>
                <Ionicons name="arrow-undo" size={18} color={undoStackRef.current.length > 0 ? theme.colors.accent : theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.transportSmallBtn} onPress={() => {
                const next = !loopEnabled;
                setLoopEnabled(next);
                showToast(next ? 'Looping Enabled (12 Bars)' : 'Looping Disabled');
              }}>
                <Ionicons name="repeat" size={18} color={loopEnabled ? theme.colors.accent : theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.transportSmallBtn} onPress={() => performRedo()}>
                <Ionicons name="arrow-redo" size={18} color={redoStackRef.current.length > 0 ? theme.colors.accent : theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {toastMessage &&
          <View style={styles.toastContainer}>
            <BlurView intensity={40} tint="dark" style={styles.toastBlur}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </BlurView>
          </View>
        }
        {isRecording && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.2)', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', letterSpacing: 1, width: 28 }}>REC</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{
                height: '100%',
                width: `${Math.round(liveMeterLevel * 100)}%`,
                backgroundColor: liveMeterLevel > 0.85 ? '#ef4444' : liveMeterLevel > 0.6 ? '#eab308' : '#10b981',
                borderRadius: 5,
              }} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', width: 36, textAlign: 'right' }}>
              {liveMeterLevel > 0 ? `${Math.round(-90 * (1 - liveMeterLevel))} dB` : '–∞'}
            </Text>
          </View>
        )}

        <View style={styles.mainContent}>
          {activeTab === 'waveform' &&
            <View style={styles.tabContainer}>
              {tracks.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24, paddingVertical: 48 }}>
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <TouchableOpacity 
                      style={{ 
                        width: 90, 
                        height: 90, 
                        borderRadius: 45, 
                        backgroundColor: '#ef4444', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        shadowColor: '#ef4444',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 8
                      }}
                      onPress={startRecording}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="mic" size={40} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 16 }}>
                      Tap to Start Recording
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 280 }}>
                      Sing, record, and practice your vocal takes. Your session timeline will appear automatically.
                    </Text>
                  </View>

                  <View style={{ width: '100%', maxWidth: 280, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <TouchableOpacity 
                    style={{ 
                      width: '100%', 
                      maxWidth: 300, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 14, 
                      padding: 14, 
                      gap: 12 
                    }}
                    onPress={importAudioFile}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(52, 199, 89, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="cloud-upload" size={20} color="#34c759" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Import Audio File</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10, marginTop: 1 }}>Import backing tracks or voice stems from your device</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <View style={styles.timelineWrapper}>
                    <View style={styles.trackHeadersColumn}>
                      <View style={styles.trackHeaderRulerSpacer} />
                      {tracks.map((track) => (
                        <TouchableOpacity
                          key={track.id}
                          style={styles.trackHeaderCard}
                          onPress={() => {
                            setSelectedTrackId(track.id);
                            setRenameText(track.name);
                            setActiveModal('trackSettings');
                          }}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.trackAccentStripe, { backgroundColor: track.color || theme.colors.accent, width: 4 }]} />
                          
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 }}>
                            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600', lineHeight: 16 }} numberOfLines={2}>
                              {track.name}
                            </Text>
                            <Ionicons name="ellipsis-vertical" size={14} color={theme.colors.textMuted} />
                          </View>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={styles.addTrackHeaderCard} onPress={() => { setActiveModal('addTrack'); }}>
                        <Ionicons name="add" size={20} color={theme.colors.accent} />
                        <Text style={styles.addTrackText}>Add Track</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal style={styles.timelineGridScroll} showsHorizontalScrollIndicator={false}>
                      {(() => {
                        const maxDuration = tracks.reduce((max, track) => Math.max(max, (track.startTime || 0) + (track.duration || 25000)), Math.max(60000, playTimeRef.current + 10000));
                        const timelineWidth = Math.max(SCREEN_WIDTH * 3, 40 + (maxDuration / 1000) * 45);
                        const totalBeats = Math.ceil(timelineWidth / 118) + 2;

                        return (
                          <View style={[styles.timelineGridInner, { width: timelineWidth }]}>
                            <View 
                              style={styles.beatNumbersRow}
                              onStartShouldSetResponder={() => true}
                              onResponderGrant={handleTimelineGrant}
                              onResponderMove={handleTimelineMove}
                              onResponderRelease={handleTimelineRelease}
                            >
                              {Array.from({ length: totalBeats }).map((_, i) => (
                                <Text key={i} style={styles.beatNumber} pointerEvents="none">{i + 1}</Text>
                              ))}
                            </View>
                            {tracks.map((track) => {
                              const regionStartTime = track.startTime || 0;
                              const regionDuration = track.duration || 25000;
                              const regionLeft = 20 + (regionStartTime / 1000) * 45;
                              const regionWidth = (regionDuration / 1000) * 45;

                              const targetBarCount = Math.min(1500, Math.max(40, Math.floor(regionWidth / 6)));
                              const rawPeaks = track.peaks && track.peaks.length > 0
                                ? track.peaks
                                : generateWavePeaks(track.id, track.name);
                              
                              const step = rawPeaks.length / targetBarCount;
                              const displayPeaks = Array.from({ length: targetBarCount }, (_, i) => {
                                const idx = Math.floor(i * step);
                                return rawPeaks[Math.min(rawPeaks.length - 1, idx)] || 4;
                              });

                              return (
                                <View key={track.id} style={[styles.waveformTrackRow, { position: 'relative' }]}>
                                  {track.uri ? (
                                    <View
                                      style={[
                                        styles.waveformBlock,
                                        {
                                          position: 'absolute',
                                          left: regionLeft,
                                          width: regionWidth,
                                          backgroundColor: (track.color || theme.colors.accent) + '15',
                                          borderWidth: 1.5,
                                          borderColor: track.color || theme.colors.accent,
                                          borderRadius: 12,
                                          height: 60,
                                          paddingHorizontal: 6,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                        }
                                      ]}
                                    >
                                  <View style={[styles.waveVisualContainer, { justifyContent: 'space-between', paddingHorizontal: 2 }]}>
                                    {displayPeaks.map((h, i) => {
                                      const barAbsoluteX = regionLeft + (i / targetBarCount) * regionWidth;
                                      const played = scrubberPosition >= barAbsoluteX;
                                      const barWidth = Math.max(1, (regionWidth / targetBarCount) - 1.5);
                                      return (
                                        <View
                                          key={i}
                                          style={{
                                            height: Math.max(4, Math.min(50, h)),
                                            width: barWidth,
                                            borderRadius: 1,
                                            backgroundColor: played
                                              ? theme.colors.textPrimary
                                              : track.color || theme.colors.accentBright,
                                            opacity: played ? 1 : 0.65,
                                          }}
                                        />
                                      );
                                    })}
                                  </View>
                                </View>
                              ) : (
                                <View 
                                  style={{
                                    position: 'absolute',
                                    left: 20,
                                    width: SCREEN_WIDTH * 3 - 40,
                                    height: 60,
                                    borderStyle: 'dashed',
                                    borderWidth: 1,
                                    borderColor: theme.colors.textMuted + '66',
                                    borderRadius: 12,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                                    {track.type === 'voice' ? '🎙️ Tap Record to capture vocals' : '📁 Import audio file'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                        <View style={[styles.scrubberLine, { left: scrubberPosition }]} pointerEvents="none">
                          <View style={styles.scrubberHead} />
                        </View>
                      </View>
                      );
                      })()}
                    </ScrollView>
                  </View>
                  <View style={styles.studioToolbar}>
                    <TouchableOpacity style={styles.studioToolItem} onPress={() => { setActiveModal('addTrack'); }}>
                      <Ionicons name="add-circle-outline" size={22} color={theme.colors.textSecondary} />
                      <Text style={styles.studioToolLabel}>Add Track</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.studioToolItem} onPress={() => { setActiveModal('mixer'); }}>
                      <Ionicons name="options-outline" size={22} color={theme.colors.textSecondary} />
                      <Text style={styles.studioToolLabel}>Mixer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bigRecordBtn}
                      onPress={toggleRecord}
                      activeOpacity={0.8}>
                      <View style={[styles.bigRecordInner, isRecording && styles.bigRecordInnerActive]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.studioToolItem} onPress={() => { setActiveModal('studioKit'); }}>
                      <Ionicons name="construct-outline" size={22} color={theme.colors.textSecondary} />
                      <Text style={styles.studioToolLabel}>Studio Kit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.studioToolItem} onPress={() => { setActiveModal('export'); }}>
                      <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.textSecondary} />
                      <Text style={styles.studioToolLabel}>Export</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          }

          {activeTab === 'feather' &&
          <View style={styles.tabContainer}>
              <View style={styles.notepadHeader}>
                <Text style={styles.notepadTitle}>Studio Notepad & Lyrics</Text>
                <TouchableOpacity onPress={() => {setLyricsText('');showToast('Notepad Cleared');}}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              <TextInput
              style={styles.notepadInput}
              multiline
              value={lyricsText}
              onChangeText={setLyricsText}
              placeholder="Write your lyrics, chords, or ministration notes here..."
              placeholderTextColor={theme.colors.textMuted}
              textAlignVertical="top" />
            
            </View>
          }

          {activeTab === 'projects' &&
            <ScrollView style={styles.tabContainer} showsVerticalScrollIndicator={false}>
              <View style={[styles.settingsCard, { padding: 16, marginBottom: 20 }]}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Save Current Session</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.cardBackgroundLight,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      height: 44,
                      color: theme.colors.textPrimary,
                      fontSize: 14
                    }}
                    placeholder="Enter project name..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={newProjectName}
                    onChangeText={setNewProjectName}
                  />
                  <TouchableOpacity
                    style={{
                      backgroundColor: theme.colors.accent,
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: 44
                    }}
                    onPress={async () => {
                      if (!newProjectName.trim()) {
                        showToast('Please type a name first');
                        return;
                      }
                      await saveCurrentProject(newProjectName);
                      setNewProjectName('');
                    }}
                  >
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionHeadingText}>Saved Projects ({savedProjects.length})</Text>

              {savedProjects.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', fontSize: 14 }}>
                    No saved projects yet. Save your current tracks above to view them here.
                  </Text>
                </View>
              ) : (
                savedProjects.map((proj) => (
                  <View key={proj.id} style={[styles.settingsCard, { padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{proj.name}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        {proj.tracks.length} tracks • {proj.timestamp}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#10b981',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 6
                        }}
                        onPress={() => loadProject(proj)}
                      >
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Load</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          padding: 8,
                          borderRadius: 6
                        }}
                        onPress={() => deleteProject(proj.id)}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 120 }} />
            </ScrollView>
          }

          {activeTab === 'settings' &&
            <ScrollView style={styles.tabContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeadingText}>Audio Configuration</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity
                  style={styles.settingsRowBorder}
                  onPress={() => {
                    setCountIn(prev => {
                      if (prev === 'Off') return '1 Bar';
                      if (prev === '1 Bar') return '2 Bars';
                      return 'Off';
                    });
                  }}
                >
                  <View style={styles.settingsTextCol}>
                    <Text style={styles.settingsLabel}>Pre-Record Count-In</Text>
                    <Text style={styles.settingsSubDesc}>Gives you a countdown beat before recording starts</Text>
                  </View>
                  <Text style={styles.settingsValueText}>{countIn}</Text>
                </TouchableOpacity>
                <View style={styles.settingsRow}>
                  <View style={styles.settingsTextCol}>
                    <Text style={styles.settingsLabel}>Speaker Monitoring</Text>
                    <Text style={styles.settingsSubDesc}>Hear backing tracks through speaker while recording. Use headphones to avoid feedback.</Text>
                  </View>
                  <Switch
                    value={monitorEnabled}
                    onValueChange={(val) => {
                      setMonitorEnabled(val);
                      showToast(val ? 'Monitoring: Speaker ON' : 'Monitoring: Earpiece');
                      Audio.setAudioModeAsync({
                        allowsRecordingIOS: true,
                        playsInSilentModeIOS: true,
                        staysActiveInBackground: false, // Changed to false to prevent battery drain
                        playThroughEarpieceAndroid: !val, // false = speaker, true = earpiece
                      }).catch(() => {});
                    }}
                    trackColor={{ false: '#333', true: theme.colors.accent }}
                  />
                </View>
              </View>

              <Text style={styles.sectionHeadingText}>Studio Tools</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity style={styles.settingsRow} onPress={() => {setActiveModal('tuner');}}>
                  <View style={styles.settingsTextCol}>
                    <Text style={styles.settingsLabel}>Vocal & Instrument Tuner</Text>
                    <Text style={styles.settingsSubDesc}>Tune your vocals or musical instruments in real-time</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          }
        </View>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => { stopPlayback(); navigation.goBack(); }}>
            <Ionicons name="home" size={18} color={theme.colors.textMuted} />
            <Text style={[styles.bottomNavLabel, { color: theme.colors.textMuted, marginTop: 4, display: 'flex' }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomNavItem, activeTab === 'projects' && styles.bottomNavItemActive]}
            onPress={() => { setActiveTab('projects'); }}>
            <Ionicons name="folder-open-outline" size={18} color={activeTab === 'projects' ? theme.colors.textPrimary : theme.colors.textMuted} />
            {activeTab === 'projects' && <Text style={styles.bottomNavLabel}>Projects</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomNavItem, activeTab === 'waveform' && styles.bottomNavItemActive]}
            onPress={() => { setActiveTab('waveform'); }}>
            <Ionicons name="stats-chart-outline" size={18} color={activeTab === 'waveform' ? theme.colors.textPrimary : theme.colors.textMuted} />
            {activeTab === 'waveform' && <Text style={styles.bottomNavLabel}>Studio</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomNavItem, activeTab === 'feather' && styles.bottomNavItemActive]}
            onPress={() => { setActiveTab('feather'); }}>
            <Ionicons name="musical-notes-outline" size={18} color={activeTab === 'feather' ? theme.colors.textPrimary : theme.colors.textMuted} />
            {activeTab === 'feather' && <Text style={styles.bottomNavLabel}>My Songs</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={activeModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}>
        
        <BlurView intensity={50} tint="dark" style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setActiveModal(null)} />
          
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>
                {activeModal === 'fx' && 'Effects'}
                {activeModal === 'autopitch' && 'AutoPitch'}
                {activeModal === 'addTrack' && 'Add Track'}
                {activeModal === 'mixer' && 'Mixer'}
                {activeModal === 'metronome' && 'Tempo'}
                {activeModal === 'export' && 'Export'}
                {activeModal === 'tuner' && 'Tuner'}
                {activeModal === 'collab' && 'Collaborate'}
                {activeModal === 'trackSettings' && 'Track Controls'}
                {activeModal === 'studioKit' && 'Studio Kit'}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

             <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {activeModal === 'trackSettings' && (() => {
                const track = tracks.find(t => t.id === selectedTrackId);
                if (!track) return null;
                
                return (
                  <View style={styles.modalSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (track.color || theme.colors.accent) + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons
                          name={track.type === 'voice' ? 'mic' : track.type === 'sampler' ? 'musical-notes' : 'musical-note'}
                          size={20}
                          color={track.color || theme.colors.accentBright}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TextInput
                            style={{
                              color: theme.colors.textPrimary,
                              fontSize: 16,
                              fontWeight: '700',
                              borderBottomWidth: 1,
                              borderBottomColor: 'transparent',
                              paddingVertical: 2,
                              flex: 1
                            }}
                            value={renameText}
                            onChangeText={(txt) => {
                              setRenameText(txt);
                              renameTrack(track.id, txt);
                            }}
                            placeholder="Rename track..."
                            placeholderTextColor={theme.colors.textMuted}
                          />
                          <Ionicons name="pencil" size={14} color={theme.colors.textMuted} />
                        </View>
                        <Text style={{ fontSize: 9, color: theme.colors.textMuted, marginTop: 2, fontWeight: '600', letterSpacing: 0.5 }}>
                          {track.type.toUpperCase()} TRACK
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                      <TouchableOpacity
                        style={[
                          {
                            flex: 1.2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 42,
                            borderRadius: 10,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            gap: 6
                          },
                          track.mute && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }
                        ]}
                        onPress={() => toggleTrackMute(track.id)}
                      >
                        <Ionicons name={track.mute ? "volume-mute" : "volume-medium"} size={16} color={track.mute ? '#ef4444' : theme.colors.textPrimary} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: track.mute ? '#ef4444' : theme.colors.textPrimary }}>
                          {track.mute ? 'Muted' : 'Mute'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          {
                            flex: 1.2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 42,
                            borderRadius: 10,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            gap: 6
                          },
                          track.solo && { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308' }
                        ]}
                        onPress={() => toggleTrackSolo(track.id)}
                      >
                        <Ionicons name="star" size={16} color={track.solo ? '#eab308' : theme.colors.textPrimary} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: track.solo ? '#eab308' : theme.colors.textPrimary }}>
                          {track.solo ? 'Soloing' : 'Solo'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          borderWidth: 1,
                          borderColor: 'rgba(239, 68, 68, 0.2)',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onPress={() => {
                          Alert.alert(
                            'Delete Track',
                            `Are you sure you want to delete "${track.name}"? This cannot be undone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                onPress: () => {
                                  pushUndoSnapshot(tracks);
                                  setTracks(prev => prev.filter(t => t.id !== track.id));
                                  const sound = soundObjsRef.current[track.id];
                                  if (sound) sound.unloadAsync();
                                  setActiveModal(null);
                                },
                                style: 'destructive'
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', padding: 12, marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Volume</Text>
                        <Text style={{ color: track.color || theme.colors.accent, fontWeight: '700', fontSize: 12 }}>
                          {Math.round(track.volume * 100)}%
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="volume-low" size={16} color={theme.colors.textMuted} />
                        <Slider
                          style={{ flex: 1, height: 30 }}
                          minimumValue={0}
                          maximumValue={1}
                          value={track.volume}
                          onValueChange={(val) => {
                            setTracks(prev => prev.map(t => t.id === track.id ? { ...t, volume: val } : t));
                            if (track.type === 'backing') {
                              TrackPlayer.setVolume(val).catch(() => {});
                            }
                          }}
                          minimumTrackTintColor={track.color || theme.colors.accent}
                          maximumTrackTintColor="rgba(255,255,255,0.1)"
                        />
                        <Ionicons name="volume-high" size={16} color={theme.colors.textMuted} />
                      </View>
                    </View>
                    {track.type === 'voice' && (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', padding: 12, marginBottom: 18 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 12, marginBottom: 10 }}>
                          Vocal FX Tuning
                        </Text>
                        
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {[
                            { name: 'Reverb', active: fxReverb, setter: setFxReverb, icon: 'sparkles' },
                            { name: 'Delay', active: fxDelay, setter: setFxDelay, icon: 'repeat' },
                            { name: 'Doubler', active: fxDoubler, setter: setFxDoubler, icon: 'people' },
                            { name: 'EQ Boost', active: fxEQ, setter: setFxEQ, icon: 'options' }
                          ].map((fx) => (
                            <TouchableOpacity
                              key={fx.name}
                              style={{
                                width: '48%',
                                height: 48,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: fx.active ? (track.color || theme.colors.accent) + '20' : 'rgba(255,255,255,0.03)',
                                borderWidth: 1,
                                borderColor: fx.active ? (track.color || theme.colors.accent) : 'rgba(255,255,255,0.05)',
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                gap: 8
                              }}
                              onPress={() => fx.setter(!fx.active)}
                            >
                              <Ionicons name={fx.icon as any} size={16} color={fx.active ? (track.color || theme.colors.accentBright) : theme.colors.textMuted} />
                              <Text style={{ color: fx.active ? theme.colors.textPrimary : theme.colors.textMuted, fontWeight: '600', fontSize: 12 }}>
                                {fx.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 12, marginBottom: 12 }}>
                        Timeline Audio Tools
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <TouchableOpacity
                          style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: 'rgba(255,255,255,0.04)', 
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            borderRadius: 10, 
                            paddingVertical: 10,
                            gap: 4 
                          }}
                          onPress={() => {
                            setActiveModal(null);
                            splitTrack(track.id);
                          }}
                        >
                          <Ionicons name="cut" size={16} color={theme.colors.accentBright} />
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 10 }}>
                            Split Track
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: 'rgba(255,255,255,0.04)', 
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            borderRadius: 10, 
                            paddingVertical: 10,
                            gap: 4 
                          }}
                          onPress={() => {
                            setActiveModal(null);
                            trimTrack(track.id, 'right');
                          }}
                        >
                          <Ionicons name="arrow-back" size={16} color="#ef4444" />
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 10 }}>
                            Cut Left
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: 'rgba(255,255,255,0.04)', 
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            borderRadius: 10, 
                            paddingVertical: 10,
                            gap: 4 
                          }}
                          onPress={() => {
                            setActiveModal(null);
                            trimTrack(track.id, 'left');
                          }}
                        >
                          <Ionicons name="arrow-forward" size={16} color="#ef4444" />
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 10 }}>
                            Cut Right
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {activeModal === 'fx' &&
                <View style={styles.modalSection}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Studio Reverb</Text>
                      <Switch value={fxReverb} onValueChange={(val) => {setFxReverb(val);}} trackColor={{ false: '#333', true: '#10b981' }} />
                    </View>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Tape Delay</Text>
                      <Switch value={fxDelay} onValueChange={(val) => {setFxDelay(val);}} trackColor={{ false: '#333', true: '#10b981' }} />
                    </View>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Vocal Doubler</Text>
                      <Switch value={fxDoubler} onValueChange={(val) => {setFxDoubler(val);}} trackColor={{ false: '#333', true: '#10b981' }} />
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>7-Band Master EQ</Text>
                      <Switch value={fxEQ} onValueChange={(val) => {setFxEQ(val);}} trackColor={{ false: '#333', true: '#10b981' }} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.modalActionBtn} onPress={() => {setActiveModal(null);showToast('Saved FX Preset');}}>
                    <Text style={styles.modalActionBtnText}>Apply FX Preset</Text>
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'studioKit' &&
                <View style={styles.modalSection}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Metronome & Tempo</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>Set practice speed and beats</Text>
                      </View>
                      <TouchableOpacity 
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.cardBackgroundLight }}
                        onPress={() => setActiveModal('metronome')}
                      >
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Tempo Settings</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>BPM Speed</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={() => setBpm(Math.max(40, bpm - 5))}>
                          <Ionicons name="remove-circle" size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' }}>{bpm}</Text>
                        <TouchableOpacity onPress={() => setBpm(Math.min(240, bpm + 5))}>
                          <Ionicons name="add-circle" size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={{ 
                        marginTop: 12, 
                        height: 38, 
                        borderRadius: 8, 
                        backgroundColor: 'rgba(124, 58, 237, 0.1)', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(124, 58, 237, 0.3)'
                      }} 
                      onPress={handleTapTempo}
                    >
                      <Text style={{ color: theme.colors.accentBright, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>TAP TEMPO</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Pre-Record Count-In</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginBottom: 12 }}>Get a countdown beat before recording starts</Text>
                    
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['Off', '1 Bar', '2 Bars'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={{
                            flex: 1,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: countIn === mode ? theme.colors.accent + '22' : 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1.5,
                            borderColor: countIn === mode ? theme.colors.accent : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onPress={() => setCountIn(mode as any)}
                        >
                          <Text style={{ color: countIn === mode ? theme.colors.textPrimary : theme.colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>Speaker Monitoring</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          Hear backing tracks through speaker while recording. Use headphones to avoid feedback.
                        </Text>
                      </View>
                      <Switch
                        value={monitorEnabled}
                        onValueChange={async (val) => {
                          setMonitorEnabled(val);
                          showToast(val ? 'Monitoring: Speaker ON' : 'Monitoring: Earpiece');
                          try {
                            await Audio.setAudioModeAsync({
                              allowsRecordingIOS: true,
                              playsInSilentModeIOS: true,
                              staysActiveInBackground: false, // Changed to false to prevent battery drain
                              playThroughEarpieceAndroid: !val,
                            });
                          } catch {}
                        }}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.accent }}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(139,92,246,0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(139,92,246,0.25)',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 20,
                      gap: 12
                    }}
                    onPress={() => setActiveModal('tuner')}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="git-compare-outline" size={18} color={theme.colors.accentBright} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Vocal & Guitar Tuner</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>Find perfect pitch and tune vocals</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'autopitch' &&
                <View style={styles.modalSection}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Key Signature</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['C', 'G', 'Bbm', 'F#'].map((k) =>
                          <TouchableOpacity key={k} style={[styles.pillSelection, pitchKey === k && styles.pillSelectionActive]} onPress={() => {setPitchKey(k);}}>
                            <Text style={[styles.pillSelectionText, pitchKey === k && styles.pillSelectionTextActive]}>{k}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Scale Type</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['Major', 'Minor', 'Chromatic'].map((s) =>
                          <TouchableOpacity key={s} style={[styles.pillSelection, pitchScale === s && styles.pillSelectionActive]} onPress={() => {setPitchScale(s);}}>
                            <Text style={[styles.pillSelectionText, pitchScale === s && styles.pillSelectionTextActive]}>{s}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Formant Shift</Text>
                      <Switch value={formantShift} onValueChange={(val) => {setFormantShift(val);}} trackColor={{ false: '#333', true: theme.colors.accent }} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.modalActionBtn} onPress={() => {setActiveModal(null);showToast(`AutoPitch set to ${pitchKey} ${pitchScale}`);}}>
                    <Text style={styles.modalActionBtnText}>Confirm Pitch Settings</Text>
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'addTrack' &&
                <View style={styles.modalSection}>
                  <View style={styles.gridContainer}>
                    {[
                      { name: 'Voice / Mic', icon: 'mic', color: '#10b981' },
                      { name: 'Virtual Instruments', icon: 'musical-notes', color: theme.colors.accent },
                      { name: 'Guitar / Bass', icon: 'radio', color: '#f59e0b' },
                      { name: 'Import Audio', icon: 'folder', color: theme.colors.accent },
                      { name: 'Sampler', icon: 'grid', color: '#ec4899' },
                      { name: 'Looper', icon: 'infinite', color: '#06b6d4' }
                    ].map((inst) =>
                      <TouchableOpacity
                        key={inst.name}
                        style={styles.gridCard}
                        activeOpacity={0.8}
                        onPress={() => {
                          setActiveModal(null);
                          if (inst.name === 'Import Audio') {
                            importAudioFile();
                          } else {
                            const trackType = inst.name.includes('Voice') ? 'voice' : inst.name.includes('Sampler') ? 'sampler' : 'backing';
                            let presetUri: string | undefined = undefined;
                            addTrack(inst.name, trackType, inst.color, presetUri);
                          }
                        }}>
                        <View style={[styles.gridIconBox, { backgroundColor: inst.color }]}>
                          <Ionicons name={inst.icon as any} size={28} color={theme.colors.textPrimary} />
                        </View>
                        <Text style={styles.gridCardTitle}>{inst.name}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              }

              {activeModal === 'mixer' &&
                <View style={styles.modalSection}>
                  {tracks.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16 }}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="options-outline" size={32} color={theme.colors.textMuted} />
                      </View>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 20 }}>
                        Your multi-track session is empty. Add a backing track or record to use the mixer.
                      </Text>
                      <TouchableOpacity 
                        style={{ height: 38, borderRadius: 8, backgroundColor: theme.colors.accent, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}
                        onPress={() => setActiveModal('addTrack')}
                      >
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 12 }}>Add Track</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    tracks.map((track) => (
                      <View key={track.id} style={[styles.modalCard, { padding: 16, marginBottom: 16 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={styles.mixerTrackInfo}>
                            <Ionicons name={track.type === 'voice' ? 'mic' : 'musical-notes'} size={18} color={track.color} />
                            <Text style={[styles.mixerTrackTitle, { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }]}>{track.name}</Text>
                          </View>
                          <View style={styles.mixerTrackControls}>
                            <TouchableOpacity style={[styles.mixerBtn, track.mute && styles.mixerBtnMute]} onPress={() => toggleTrackMute(track.id)}>
                              <Text style={[styles.mixerBtnText, track.mute && styles.mixerBtnTextActive]}>M</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.mixerBtn, track.solo && styles.mixerBtnSolo]} onPress={() => toggleTrackSolo(track.id)}>
                              <Text style={[styles.mixerBtnText, track.solo && styles.mixerBtnTextActive]}>S</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Slider
                          value={track.volume}
                          onValueChange={(val) => handleVolumeChange(track.id, val)}
                          minimumValue={0}
                          maximumValue={1}
                          minimumTrackTintColor={track.color}
                          maximumTrackTintColor={theme.colors.trackMax}
                          thumbTintColor={theme.colors.thumbTint}
                          style={{ height: 40 }}
                        />
                      </View>
                    ))
                  )}
                  <TouchableOpacity style={styles.modalActionBtn} onPress={() => {setActiveModal(null);}}>
                    <Text style={styles.modalActionBtnText}>Close Mixer</Text>
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'metronome' &&
                <View style={styles.modalSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
                    {[1, 2, 3, 4].map((beat) => (
                      <View 
                        key={beat} 
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: currentBeat === beat ? theme.colors.accent : theme.colors.cardBackgroundLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: currentBeat === beat ? theme.colors.textPrimary : 'transparent'
                        }}
                      >
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold' }}>{beat}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.modalCard}>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Tempo (BPM)</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => {setBpm(Math.max(40, bpm - 1));}}>
                          <Ionicons name="remove-circle-outline" size={28} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.bpmText}>{bpm}</Text>
                        <TouchableOpacity onPress={() => {setBpm(Math.min(240, bpm + 1));}}>
                          <Ionicons name="add-circle-outline" size={28} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.modalRowBorder}>
                      <Text style={styles.modalLabel}>Time Signature</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['2/4', '3/4', '4/4', '6/8'].map((t) =>
                          <TouchableOpacity key={t} style={[styles.pillSelection, timeSig === t && styles.pillSelectionActive]} onPress={() => {setTimeSig(t);}}>
                            <Text style={[styles.pillSelectionText, timeSig === t && styles.pillSelectionTextActive]}>{t}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={styles.tapTempoBtn} onPress={handleTapTempo}>
                      <Text style={styles.tapTempoText}>TAP TEMPO</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.modalActionBtn} onPress={() => {setActiveModal(null);showToast(`Metronome set to ${bpm} BPM`);}}>
                    <Text style={styles.modalActionBtnText}>Save Tempo</Text>
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'export' &&
                <View style={styles.modalSection}>
                  <View style={styles.modalCard}>
                    {[
                      { title: 'WAV', desc: 'Lossless audio', icon: 'disc' },
                      { title: 'M4A', desc: 'Compressed AAC audio', icon: 'musical-note' }
                    ].map((exp, idx) =>
                      <TouchableOpacity
                        key={exp.title}
                        style={[styles.exportRow, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.bottomTabBorder }]}
                        onPress={() => {
                          if (exp.title === 'Share Session') {
                            Share.share({
                              message: `Check out my Audiolab session — ${tracks.length} tracks.`,
                            }).catch(() => {});
                          } else {
                            triggerExport(exp.title);
                          }
                        }}>
                        <View style={styles.exportIconBox}>
                          <Ionicons name={exp.icon as any} size={22} color={theme.colors.accent} />
                        </View>
                        <View style={styles.exportTextCol}>
                          <Text style={styles.exportTitleText}>{exp.title}</Text>
                          <Text style={styles.exportDescText}>{exp.desc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              }

              {activeModal === 'tuner' &&
                <View style={styles.modalSection}>
                  <View style={styles.tunerCard}>
                    <Text style={styles.tunerNoteText}>{tunerNote}</Text>
                    <Text style={styles.tunerSubText}>
                      {Math.abs(tunerCents) < 4 ? 'IN TUNE' : `${tunerCents > 0 ? '+' : ''}${Math.round(tunerCents)} cents`}
                    </Text>
                    <View style={styles.tunerMeter}>
                      <View style={styles.tunerMeterLineLeft} />
                      <View style={[styles.tunerMeterPointer, { left: 100 + tunerCents * 2 }]} />
                      <View style={styles.tunerMeterCenter} />
                      <View style={styles.tunerMeterLineRight} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.modalActionBtn} onPress={() => {setActiveModal(null);showToast('Tuner Closed');}}>
                    <Text style={styles.modalActionBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              }

              {activeModal === 'collab' &&
                <View style={styles.modalSection}>
                  <View style={styles.modalCard}>
                    <View style={[styles.modalRow, { gap: 12 }]}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={20} color={theme.colors.textPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }}>You (Host)</Text>
                        <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>Active</Text>
                      </View>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                    <Ionicons name="musical-notes" size={16} color={theme.colors.textMuted} />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>{tracks.length} tracks in session</Text>
                  </View>
                  
                  <Text style={{ color: theme.colors.accent, textAlign: 'center', marginBottom: 16, fontSize: 12, paddingHorizontal: 20 }}>
                    Live DAW sync is in beta. Sharing will export your current session tracks and settings to your partner.
                  </Text>

                  <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]} onPress={() => {
                    Share.share({
                      message: `Join my Audiolab studio session! ${tracks.length} tracks active.`,
                    }).catch(() => {});
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="person-add" size={20} color={theme.colors.textPrimary} />
                      <Text style={styles.modalActionBtnText}>Invite Partner</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              }

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {isBouncing && (
        <Modal transparent visible={isBouncing}>
          <BlurView intensity={90} tint="dark" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 20 }}>Bouncing Multitracks...</Text>
            <Text style={{ color: theme.colors.accent, fontSize: 28, fontWeight: '900', marginTop: 10 }}>{bounceProgress}%</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8 }}>Mixing levels, panning, and effects rack presets...</Text>
          </BlurView>
        </Modal>
      )}
      <Modal visible={renamingTrackId !== null} transparent animationType="fade" onRequestClose={() => setRenamingTrackId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: theme.colors.backgroundDark, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.colors.bottomTabBorder }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Rename Track</Text>
            <TextInput
              style={{ backgroundColor: theme.colors.cardBackgroundLight, color: theme.colors.textPrimary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: theme.colors.bottomTabBorder, marginBottom: 16 }}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Track name..."
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              onSubmitEditing={() => renameTrack(renamingTrackId!, renameText)}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, alignItems: 'center' }}
                onPress={() => setRenamingTrackId(null)}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.accent, alignItems: 'center' }}
                onPress={() => renameTrack(renamingTrackId!, renameText)}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {countdownNum !== null && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
          <Text style={{ fontSize: 120, fontWeight: '900', color: '#10b981', textShadowColor: 'rgba(16, 185, 129, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }}>
            {countdownNum}
          </Text>
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 20, fontWeight: '700' }}>Get Ready...</Text>
        </View>
      )}
    </View>);

}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  safeArea: {
    flex: 1
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  headerButton: {
    padding: 4
  },
  headerIconBtn: {
    padding: 6
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3
  },

  transportTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  timecodeBlock: {
    minWidth: 90
  },
  timecodeText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1
  },
  tempoText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginTop: 2
  },
  transportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20
  },
  transportPlayBtn: {
    padding: 6
  },
  transportSmallBtn: {
    padding: 6
  },
  transportRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    justifyContent: 'flex-end'
  },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  mainContent: {
    flex: 1
  },
  tabContainer: {
    flex: 1
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100
  },
  toastBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    overflow: 'hidden'
  },
  toastText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },

  timelineWrapper: {
    flex: 1,
    flexDirection: 'row'
  },
  trackHeadersColumn: {
    width: 148,
    borderRightWidth: 1,
    borderRightColor: theme.colors.bottomTabBorder,
    backgroundColor: T.backgroundDark
  },
  trackHeaderRulerSpacer: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)'
  },
  trackHeaderCard: {
    height: 84,
    flexDirection: 'row',
    backgroundColor: theme.colors.bottomSheetBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  trackAccentStripe: {
    width: 4,
    backgroundColor: theme.colors.accent
  },
  trackHeaderInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between'
  },
  trackHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  trackIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  trackHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  trackHeaderControlBtn: {
    backgroundColor: theme.colors.cardBackgroundLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackHeaderControlBtnActive: {
    backgroundColor: '#ef4444'
  },
  trackHeaderControlBtnActiveSolo: {
    backgroundColor: '#eab308'
  },
  trackHeaderControlBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800'
  },
  addTrackHeaderCard: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  addTrackText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600'
  },
  timelineGridScroll: {
    flex: 1
  },
  timelineGridInner: {
    width: SCREEN_WIDTH * 2,
    height: '100%',
    position: 'relative',
    backgroundColor: theme.colors.backgroundDark
  },
  beatNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    paddingLeft: 16,
    gap: 118
  },
  beatNumber: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  waveformTrackRow: {
    height: 84,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  waveformBlock: {
    flex: 1,
    height: 60,
    borderRadius: 6,
    backgroundColor: theme.colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  waveVisualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 6
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 0.7
  },
  emptyTrackText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    paddingLeft: 12
  },
  scrubberLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.textPrimary,
    zIndex: 10
  },
  scrubberHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textPrimary,
    position: 'absolute',
    top: 24,
    left: -4
  },

  studioToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: 14,
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  studioToolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1
  },
  studioToolLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center'
  },
  bigRecordBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.colors.bottomTabBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12
  },
  bigRecordInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ef4444'
  },
  bigRecordInnerActive: {
    borderRadius: 8,
    width: 30,
    height: 30
  },

  tunerMeterPointer: {
    width: 4,
    height: 28,
    backgroundColor: '#ff3b30',
    position: 'absolute',
    zIndex: 10,
    borderRadius: 2
  },

  notepadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  notepadTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  clearText: {
    color: '#3b8(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '600'
  },
  notepadInput: {
    flex: 1,
    padding: 20,
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500'
  },

  settingsCard: {
    backgroundColor: theme.colors.bottomSheetBackground,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 16,
    overflow: 'hidden'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  settingsRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  settingsLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  settingsValueText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '500'
  },
  settingsTextCol: {
    flex: 1,
    marginRight: 16
  },
  settingsSubDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4
  },
  settingsSliderRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sliderTrack: {
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center'
  },
  sliderFill: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2
  },
  sliderThumb: {
    position: 'absolute',
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.textPrimary
  },
  sectionHeadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginHorizontal: 20,
    marginTop: 28
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  modalContainer: {
    backgroundColor: theme.colors.bottomSheetBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  modalTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  closeModalBtn: {
    padding: 4
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingTop: 20
  },
  modalSection: {
    paddingBottom: 24
  },
  modalSubHeader: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16
  },
  modalCard: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24
  },
  modalRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  modalLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  pillSelection: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight
  },
  pillSelectionActive: {
    backgroundColor: theme.colors.accent
  },
  pillSelectionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  pillSelectionTextActive: {
    color: theme.colors.textPrimary
  },
  modalActionBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12
  },
  modalActionBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  gridCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    backgroundColor: theme.colors.cardBackgroundLight,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  gridIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  gridCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },

  mixerTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  mixerTrackRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  mixerTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  mixerTrackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  mixerTrackControls: {
    flexDirection: 'row',
    gap: 12
  },
  mixerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mixerBtnMute: {
    backgroundColor: '#ef4444'
  },
  mixerBtnSolo: {
    backgroundColor: '#eab308'
  },
  mixerBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700'
  },
  mixerBtnTextActive: {
    color: theme.colors.textPrimary
  },

  bpmText: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  tapTempoBtn: {
    backgroundColor: theme.colors.cardBackgroundLight,
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  tapTempoText: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2
  },

  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18
  },
  exportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  exportTextCol: {
    flex: 1,
    marginRight: 16
  },
  exportTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  exportDescText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  },

  tunerCard: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24
  },
  tunerNoteText: {
    color: '#10b981',
    fontSize: 72,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  tunerSubText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 24
  },
  tunerMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 40
  },
  tunerMeterLineLeft: {
    width: 80,
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2
  },
  tunerMeterCenter: {
    width: 12,
    height: 24,
    backgroundColor: '#10b981',
    borderRadius: 6,
    marginHorizontal: 12
  },
  tunerMeterLineRight: {
    width: 80,
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2
  },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  bottomNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  bottomNavItemActive: {
    backgroundColor: 'rgba(124,58,237,0.3)'
  },
  bottomNavIconWrap: {},
  bottomNavIconActive: {},
  bottomNavLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: theme.colors.textPrimary
  }
});
};
