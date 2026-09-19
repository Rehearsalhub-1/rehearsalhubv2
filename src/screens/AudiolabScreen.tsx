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
import { AudioModule, setAudioModeAsync, AudioPlayer, AudioRecorder, createAudioPlayer, RecordingPresets } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { SafeTrackPlayer as TrackPlayer, SafeCapability as Capability } from '../lib/safeNativeModules';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useUserStore } from '../hooks/useUser';
import { getHiddenFeatures } from '../config/roles';
import { getAccessToken } from '../services/api';
import { AudiolabWaveformTab } from '../components/audiolab/AudiolabWaveformTab';
import { AudiolabFeatherTab } from '../components/audiolab/AudiolabFeatherTab';
import { AudiolabProjectsTab } from '../components/audiolab/AudiolabProjectsTab';
import { AudiolabSettingsTab } from '../components/audiolab/AudiolabSettingsTab';
import { AudiolabModalContent } from '../components/audiolab/AudiolabModalContent';
import { getStyles } from '../components/audiolab/audiolabStyles';

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
  const [isUploading, setIsUploading] = useState(false);

  const recordingRef = useRef<AudioRecorder | null>(null);
  const recordingPeaksRef = useRef<number[]>([]);
  const [liveMeterLevel, setLiveMeterLevel] = useState(0); // 0-1 normalized live level
  const soundObjsRef = useRef<{ [trackId: string]: AudioPlayer }>({});
  const soundTimeoutsRef = useRef<any[]>([]);
  const playTimeRef = useRef<number>(0);
  const recordStartTimeRef = useRef<number>(0);
  const meterIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
          const player = createAudioPlayer({ uri: file.uri });
          if (player.duration) {
            duration = Math.round(player.duration * 1000);
          }
          player.remove();
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

  const uploadTake = async () => {
    const activeTracks = tracks.filter(t => t.uri && !t.mute);
    if (activeTracks.length === 0) {
      showToast('No active tracks to upload. Record something first!');
      return;
    }
    setActiveModal(null);
    setIsUploading(true);
    showToast('Preparing upload...');
    try {
      // Step 1: bounce all tracks server-side to a single audio blob
      const formData = new FormData();
      const volumes: number[] = [];
      for (let i = 0; i < activeTracks.length; i++) {
        const track = activeTracks[i];
        if (track.uri) {
          const uri = track.uri.startsWith('file://') ? track.uri : `file://${track.uri}`;
          formData.append(`track${i}`, { uri, name: `track${i}.m4a`, type: 'audio/m4a' } as any);
          volumes.push(track.volume);
        }
      }
      formData.append('volumes', JSON.stringify(volumes));
      const token = await getAccessToken();
      const bounceRes = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/api\/?$/, '')}/audio/bounce`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!bounceRes.ok) throw new Error('Bounce failed');

      // Step 2: convert bounced blob to base64 and write to temp file
      const blob = await bounceRes.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const tempPath = `${FileSystem.cacheDirectory}audiolab_take_${Date.now()}.m4a`;
      await FileSystem.writeAsStringAsync(tempPath, base64, { encoding: FileSystem.EncodingType.Base64 });

      // Step 3: upload the bounced file to R2 via POST /upload
      const rawBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const effectiveBackendUrl = (!rawBackendUrl || rawBackendUrl.includes('loveworld-singers-backend.vercel.app'))
        ? 'https://rehearsalhub-api-production-6a17.up.railway.app'
        : rawBackendUrl.replace(/\/+$/, '').replace(/\/api$/, '');

      const uploadRes = await FileSystem.uploadAsync(`${effectiveBackendUrl}/upload`, tempPath, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        parameters: { folder: 'audiolab/takes' },
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (uploadRes.status < 200 || uploadRes.status >= 300) throw new Error('Upload failed');
      const uploadData = JSON.parse(uploadRes.body);
      showToast(`Take uploaded ✓`);
      console.log('[AudioLab] Take uploaded to R2:', uploadData?.data?.url);
    } catch (err) {
      console.error('[AudioLab] Upload take error:', err);
      showToast('Upload failed — please try again');
    } finally {
      setIsUploading(false);
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
      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
      if (playTimerInterval.current) clearInterval(playTimerInterval.current);
      if (tunerInterval.current) clearInterval(tunerInterval.current);

      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
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
        showToast(keep === 'left' ? 'Trimmed end âœ“' : 'Trimmed start âœ“');
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
          showToast('Split âœ“');
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

      await AudioModule.requestRecordingPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: !monitorEnabled,
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

      const rec = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await rec.prepareToRecordAsync();
      rec.record();

      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = setInterval(() => {
        if (!recordingRef.current) {
          if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
          return;
        }
        try {
          const status = rec.getStatus();
          if (status.metering !== undefined) {
            const normalized = Math.max(0, Math.min(1, (status.metering + 90) / 90));
            const mappedHeight = Math.max(3, Math.floor(normalized * 52));
            recordingPeaksRef.current.push(mappedHeight);
            setLiveMeterLevel(normalized);

            // Throttle tracks state update to once every 500ms (10 ticks) so UI renders smoothly without heating CPU
            if (recordingPeaksRef.current.length % 10 === 0) {
              const elapsed = status.durationMillis || (recordingPeaksRef.current.length * 50);
              setTracks(prev => prev.map(t => t.id === newTrackId ? {
                ...t,
                duration: elapsed,
                peaks: [...recordingPeaksRef.current]
              } : t));
            }
          }
        } catch {}
      }, 50);

      recordingRef.current = rec;
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
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
      }
      if (!recordingRef.current) return;
      const rec = recordingRef.current;
      const st = rec.getStatus();
      await rec.stop();
      const rawUri = rec.uri;
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
        const recordedDurationMs = st.durationMillis || (capturedPeaks.length * 50);

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

      await setAudioModeAsync({
        allowsRecording: isRecordingSync,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: isRecordingSync ? !monitorEnabled : false,
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

            const player = createAudioPlayer({ uri: track.uri! });
            player.volume = volumeVal;
            player.loop = loopEnabled;
            if (offset > 0) {
              player.seekTo(offset / 1000);
            }
            if (shouldPlayImmediately && suffix === '') {
              player.play();
            }
            soundObjsRef.current[`${track.id}${suffix}`] = player;
            return player;
          };

          try {
            const mainSound = await loadSound();

            if (!shouldPlayImmediately) {
              const timeoutId = setTimeout(() => {
                try {
                  const s = soundObjsRef.current[track.id];
                  if (s) s.play();
                } catch {}
              }, delay);
              soundTimeoutsRef.current.push(timeoutId);
            }

            if (track.type === 'voice') {
              if (fxDoubler) {
                await loadSound('_doubler');
                const tId = setTimeout(() => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_doubler`];
                    if (s) s.play();
                  } catch {}
                }, delay + 30);
                soundTimeoutsRef.current.push(tId);
              }

              if (fxReverb) {
                await loadSound('_reverb');
                const tId = setTimeout(() => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_reverb`];
                    if (s) s.play();
                  } catch {}
                }, delay + 85);
                soundTimeoutsRef.current.push(tId);
              }

              if (fxDelay) {
                await loadSound('_delay');
                const tId = setTimeout(() => {
                  try {
                    const s = soundObjsRef.current[`${track.id}_delay`];
                    if (s) s.play();
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

    Object.values(soundObjsRef.current).forEach((player) => {
      try {
        player.pause();
        player.remove();
      } catch {}
    });
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
    showToast('Undo âœ“');
  };

  const performRedo = () => {
    if (redoStackRef.current.length === 0) {
      showToast('Nothing to redo');
      return;
    }

    undoStackRef.current = [...undoStackRef.current, JSON.parse(JSON.stringify(tracks))];

    const nextState = redoStackRef.current.pop()!;
    setTracks(nextState);
    showToast('Redo âœ“');
  };

  const toggleTrackMute = async (id: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id === id) {
        const nextMute = !t.mute;
        const sound = soundObjsRef.current[id];
        if (sound) {
          sound.muted = nextMute;
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
      nextTracks.forEach((t) => {
        const sound = soundObjsRef.current[t.id];
        if (sound) {
          sound.volume = isAnySolo ? (t.solo ? t.volume : 0) : t.volume;
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
        sound.volume = val;
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => setActiveTab(activeTab === 'feather' ? 'waveform' : 'feather')}
              style={[styles.headerIconBtn, activeTab === 'feather' && { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}
            >
              <Ionicons
                name="document-text-outline"
                size={19}
                color={activeTab === 'feather' ? theme.colors.accent : theme.colors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab(activeTab === 'projects' ? 'waveform' : 'projects')}
              style={[styles.headerIconBtn, activeTab === 'projects' && { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}
            >
              <Ionicons
                name="folder-open-outline"
                size={19}
                color={activeTab === 'projects' ? theme.colors.accent : theme.colors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab(activeTab === 'settings' ? 'waveform' : 'settings');
              }}
              style={[styles.headerIconBtn, activeTab === 'settings' && { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}
            >
              <Ionicons
                name="settings-outline"
                size={19}
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
              {liveMeterLevel > 0 ? `${Math.round(-90 * (1 - liveMeterLevel))} dB` : 'â€“âˆž'}
            </Text>
          </View>
        )}

        <View style={styles.mainContent}>
          {activeTab === 'waveform' &&
            <AudiolabWaveformTab
              tracks={tracks}
              isPlaying={isPlaying}
              isRecording={isRecording}
              timecode={timecode}
              bpm={bpm}
              loopEnabled={loopEnabled}
              scrubberPosition={scrubberPosition}
              undoAvailable={undoStackRef.current.length > 0}
              redoAvailable={redoStackRef.current.length > 0}
              liveMeterLevel={liveMeterLevel}
              onStartRecording={startRecording}
              onImportAudio={importAudioFile}
              onTogglePlay={togglePlay}
              onSeekToStart={() => { setTimecode('00:00.0'); setScrubberPosition(20); playTimeRef.current = 0; TrackPlayer.seekTo(0).catch(() => {}); }}
              onSkipForward={() => {
                const newElapsed = playTimeRef.current + 5000;
                playTimeRef.current = newElapsed;
                const mins = Math.floor(newElapsed / 60000);
                const secs = Math.floor((newElapsed % 60000) / 1000);
                const ms = Math.floor((newElapsed % 1000) / 100);
                setTimecode(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`);
                setScrubberPosition(20 + (newElapsed / 1000) * 45);
                if (isPlaying) { stopPlayback(false).then(() => startPlayback(false)); } else { TrackPlayer.seekTo(newElapsed / 1000).catch(() => {}); }
              }}
              onUndo={performUndo}
              onRedo={performRedo}
              onToggleLoop={() => { const next = !loopEnabled; setLoopEnabled(next); showToast(next ? 'Looping Enabled (12 Bars)' : 'Looping Disabled'); }}
              onToggleRecord={toggleRecord}
              onToggleMute={toggleTrackMute}
              onToggleSolo={toggleTrackSolo}
              onTrackSettings={(id, name) => { setSelectedTrackId(id); setRenameText(name); setActiveModal('trackSettings'); }}
              onAddTrack={() => setActiveModal('addTrack')}
              onOpenMixer={() => setActiveModal('mixer')}
              onOpenStudioKit={() => setActiveModal('studioKit')}
              onOpenExport={() => setActiveModal('export')}
              onTimelineGrant={handleTimelineGrant}
              onTimelineMove={handleTimelineMove}
              onTimelineRelease={handleTimelineRelease}
              generateWavePeaks={generateWavePeaks}
              theme={theme}
              styles={styles}
            />
          }

          {activeTab === 'feather' &&
            <AudiolabFeatherTab
              lyricsText={lyricsText}
              onLyricsChange={setLyricsText}
              onClear={() => { setLyricsText(''); showToast('Notepad Cleared'); }}
              theme={theme}
              styles={styles}
            />
          }

          {activeTab === 'projects' &&
            <AudiolabProjectsTab
              savedProjects={savedProjects}
              newProjectName={newProjectName}
              onProjectNameChange={setNewProjectName}
              onSave={async () => {
                if (!newProjectName.trim()) { showToast('Please type a name first'); return; }
                await saveCurrentProject(newProjectName);
                setNewProjectName('');
              }}
              onLoad={loadProject}
              onDelete={deleteProject}
              theme={theme}
              styles={styles}
            />
          }

          {activeTab === 'settings' &&
            <AudiolabSettingsTab
              countIn={countIn}
              onCycleCountIn={() => setCountIn(prev => prev === 'Off' ? '1 Bar' : prev === '1 Bar' ? '2 Bars' : 'Off')}
              monitorEnabled={monitorEnabled}
              onMonitorChange={setMonitorEnabled}
              onOpenTuner={() => setActiveModal('tuner')}
              showToast={showToast}
              theme={theme}
              styles={styles}
            />
          }
        </View>
        {activeTab !== 'waveform' && (
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
              style={styles.bottomNavItem}
              onPress={() => { setActiveTab('waveform'); }}>
              <Ionicons name="stats-chart-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.bottomNavLabel}>Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomNavItem, activeTab === 'feather' && styles.bottomNavItemActive]}
              onPress={() => { setActiveTab('feather'); }}>
              <Ionicons name="musical-notes-outline" size={18} color={activeTab === 'feather' ? theme.colors.textPrimary : theme.colors.textMuted} />
              {activeTab === 'feather' && <Text style={styles.bottomNavLabel}>My Songs</Text>}
            </TouchableOpacity>
          </View>
        )}
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

            <AudiolabModalContent
              activeModal={activeModal}
              onClose={() => setActiveModal(null)}
              tracks={tracks}
              selectedTrackId={selectedTrackId}
              renameText={renameText}
              onRenameTextChange={setRenameText}
              onRenameTrack={(id, name) => renameTrack(id, name)}
              onToggleTrackMute={toggleTrackMute}
              onToggleTrackSolo={toggleTrackSolo}
              onDeleteTrack={(track) => {
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
                        if (sound) {
                          try {
                            sound.pause();
                            sound.remove();
                          } catch {}
                        }
                        setActiveModal(null);
                      },
                      style: 'destructive',
                    },
                  ]
                );
              }}
              onSetTrackVolume={(id, val) => {
                setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: val } : t));
                const track = tracks.find(t => t.id === id);
                if (track?.type === 'backing') {
                  TrackPlayer.setVolume(val).catch(() => {});
                }
              }}
              onSplitTrack={(id) => splitTrack(id)}
              onTrimTrack={(id, side) => trimTrack(id, side)}
              onAddTrack={(name, type, color, presetUri) => addTrack(name, type, color, presetUri)}
              onImportAudio={importAudioFile}
              onVolumeChange={handleVolumeChange}
              fxReverb={fxReverb}
              setFxReverb={setFxReverb}
              fxDelay={fxDelay}
              setFxDelay={setFxDelay}
              fxDoubler={fxDoubler}
              setFxDoubler={setFxDoubler}
              fxEQ={fxEQ}
              setFxEQ={setFxEQ}
              bpm={bpm}
              setBpm={setBpm}
              timeSig={timeSig}
              setTimeSig={setTimeSig}
              currentBeat={currentBeat}
              onTapTempo={handleTapTempo}
              countIn={countIn}
              setCountIn={setCountIn}
              monitorEnabled={monitorEnabled}
              onMonitorChange={async (val) => {
                setMonitorEnabled(val);
                showToast(val ? 'Monitoring: Speaker ON' : 'Monitoring: Earpiece');
                try {
                  await setAudioModeAsync({
                    allowsRecording: true,
                    playsInSilentMode: true,
                    shouldPlayInBackground: false,
                    shouldRouteThroughEarpiece: !val,
                  });
                } catch {}
              }}
              onOpenModal={(modal) => setActiveModal(modal as any)}
              pitchKey={pitchKey}
              setPitchKey={setPitchKey}
              pitchScale={pitchScale}
              setPitchScale={setPitchScale}
              formantShift={formantShift}
              setFormantShift={setFormantShift}
              tunerNote={tunerNote}
              tunerCents={tunerCents}
              onTriggerExport={triggerExport}
              isUploading={isUploading}
              onUploadTake={uploadTake}
              showToast={showToast}
              theme={theme}
              styles={styles}
            />
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
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 32 }}>
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

