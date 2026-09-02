import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as Sentry from '@sentry/react-native';
import { SyncAvatar } from '../components/SyncAvatar';
import { useUserStore } from '../hooks/useUser';
import { cleanSenderName } from '../components/chat';
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  } as any;
}

import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import { SafeVideoView as VideoView, safeRegisterGlobals as registerGlobals } from '../lib/safeNativeModules';
registerGlobals();

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://rehearsal-hub-livekit.cloud';
const { width: W, height: H } = Dimensions.get('window');

type CallStatus = 'ringing' | 'connecting' | 'connected' | 'ended' | 'declined';

export default function CallScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const s = styles;
  const T = theme.colors;

  const {
    callId,
    callType = 'voice',
    isIncoming = false,
    contactName = 'Unknown',
    contactAvatar,
    contactId,
    roomId,
    isGroupCall = false,
  } = route.params || {};

  const cu = useUserStore(s => s.user);

  useWebSocket('calls', callId || '', (data: any) => {
    if (data?.status === 'ended' || data?.status === 'declined') {
      endCall(false);
    } else if (data?.status === 'connected') {
      setStatus('connected');
    }
  });

  const [status, setStatus] = useState<CallStatus>(isGroupCall ? 'connecting' : (isIncoming ? 'ringing' : 'connecting'));
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(callType === 'video' || isGroupCall);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  const engineRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef(0);
  const ringAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let currentSound: Audio.Sound | null = null;

    const playRingtone = async () => {
      if (status === 'ringing' && isIncoming) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            require('../../assets/ringingtone/Calm Focus.mp3'),
            { isLooping: true, volume: 1.0 }
          );
          currentSound = newSound;
          await newSound.playAsync();
        } catch (e) {

        }
      }
    };

    const stop = async () => {
      if (currentSound) {
        await currentSound.stopAsync().catch(() => {});
        await currentSound.unloadAsync().catch(() => {});
        currentSound = null;
      }
    };

    if (status === 'ringing' && isIncoming) playRingtone();
    else stop();
    return () => { stop(); };
  }, [status, isIncoming]);
  useEffect(() => {
    let dialSound: Audio.Sound | null = null;

    const playDialTone = async () => {
      if (!isIncoming && !isGroupCall && status === 'connecting') {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            require('../../assets/ringingtone/dial_tone.wav'),
            { isLooping: true, volume: 0.6 }
          );
          dialSound = newSound;
          await newSound.playAsync();
        } catch (e) {

        }
      }
    };

    const stop = async () => {
      if (dialSound) {
        await dialSound.stopAsync().catch(() => {});
        await dialSound.unloadAsync().catch(() => {});
        dialSound = null;
      }
    };

    if (!isIncoming && !isGroupCall && status === 'connecting') playDialTone();
    else stop();
    return () => { stop(); };
  }, [status, isIncoming, isGroupCall]);
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    if (status === 'connected') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  const initLiveKit = async () => {
    try {
      const room = new Room({
        audioCaptureDefaults: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        videoCaptureDefaults: { resolution: VideoPresets.h720 },
      });
      engineRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(track);
        }
      });
      
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(null);
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteJoined(true);
        setStatus('connected');
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (!isGroupCall) {
          setRemoteJoined(false);
          endCall();
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        endCall();
      });

      if (!isIncoming) {
        await joinChannel();
        if (callId && !isGroupCall) {
          if (callId) await api.calls.update(callId, { status: 'ringing' }).catch(() => {});
        }
        if (isGroupCall) {
          setStatus('connected');
        }
      }
    } catch (e) {
      console.error('LiveKit init error', e);
    }
  };

  const joinChannel = async () => {
    if (!engineRef.current || !callId) return;
    try {
      let token: string | null = null;
      let dynamicUrl: string | null = null;
      try {
        const data: any = await api.calls.getToken(callId, cu?.uid || 'user');
        token = data?.token || null;
        dynamicUrl = data?.url || null;
      } catch (err) {
        console.warn('[LiveKit] Token fetch failed:', err);
      }

      if (!token) throw new Error('Failed to fetch token from backend');

      const serverUrl = dynamicUrl || LIVEKIT_URL;

      await engineRef.current.connect(serverUrl, token);
      
      if (callType === 'video') {
        await engineRef.current.localParticipant.setCameraEnabled(true);
        const camTrack = engineRef.current.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
        if (camTrack) setLocalVideoTrack(camTrack);
      }
      await engineRef.current.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      console.error('Join channel error', e);
    }
  };

  const cleanupLiveKit = async () => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.disconnect();
      engineRef.current = null;
    } catch {}
  };

  const navigatedRef = useRef(false);
  const acceptCall = async () => {
    setStatus('connecting');
    try {
      if (callId) await api.calls.update(callId, { status: 'accepted' });
      await joinChannel();
    } catch {
      setStatus('ringing');
    }
  };

  const endCall = useCallback(async (shouldLog = true) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    try {
      cleanupLiveKit();
      if (callId) await api.calls.update(callId, { status: 'ended' }).catch(() => {});
      let callResult: 'completed' | 'missed' | 'canceled' | 'declined' = 'completed';
      if (duration === 0) {
        if (!isIncoming) {
          callResult = 'canceled';
        } else {
          callResult = 'declined';
        }
      }
      await logCall(callResult, duration);
    } catch {}
    navigation.goBack();
  }, [status, callId, isGroupCall, duration, navigation, isIncoming]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => { 
      if (!navigatedRef.current) endCall(); 
      return true; 
    });
    return () => backHandler.remove();
  }, [endCall]);

  const handleRemoteEnd = () => {
    if (isGroupCall || navigatedRef.current) return; // Ignore if one person ends
    setStatus('ended');
    navigatedRef.current = true;
    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  const toggleMute = async () => {
    const nextVal = !muted;
    setMuted(nextVal);
    try {
      if (engineRef.current) {
        await engineRef.current.localParticipant.setMicrophoneEnabled(!nextVal);
      }
    } catch (e) {
      console.error('Mute error', e);
    }
  };

  const toggleCamera = async () => {
    const nextVal = !cameraOff;
    setCameraOff(nextVal);
    try {
      if (engineRef.current) {
        await engineRef.current.localParticipant.setCameraEnabled(!nextVal);
        const camTrack = engineRef.current.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
        setLocalVideoTrack(camTrack || null);
      }
    } catch (e) {
      console.error('Camera toggle error', e);
    }
  };

  const flipCamera = async () => {
    try {
      if (engineRef.current) {
        await engineRef.current.switchActiveDevice('videoinput');
      }
    } catch (e) {
      console.error('Flip camera error', e);
    }
  };

  const toggleSpeaker = async () => {
    const nextVal = !speakerOn;
    setSpeakerOn(nextVal);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !nextVal,
      });
    } catch (err) {
      console.error('Speaker toggle error', err);
    }
  };
  const logCall = async (result: 'completed' | 'missed' | 'canceled' | 'declined', dur: number) => {
    if (!cu || !roomId) return;
    const fmtD = (s: number) => `${Math.floor(s / 60)}:${(s % 60) < 10 ? '0' : ''}${s % 60}`;
    let text = '';
    if (result === 'completed') {
      text = `${callType === 'video' ? '📹 Video' : '📞 Voice'} call · ${fmtD(dur)}`;
    } else if (result === 'canceled') {
      text = `📵 Canceled ${callType} call`;
    } else if (result === 'declined') {
      text = `📵 Declined ${callType} call`;
    } else {
      text = `📵 Missed ${callType} call`;
    }
    try {
      const profile = useUserStore.getState().profile;
      const myName = cleanSenderName(
        profile 
          ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') 
          : ((cu as any)?.displayName || (cu as any)?.name || "Me" || '')
      );
      // message logged
    } catch {}
  };

  const fmtDur = (s: number) => {

    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const statusLabel = {
    ringing: isIncoming ? `Incoming ${callType} call…` : 'Calling…',
    connecting: 'Connecting…',
    connected: fmtDur(duration),
    ended: 'Call ended',
    declined: 'Call declined',
  }[status];
  if (callType === 'video' && status === 'connected') {
    return (
      <Animated.View style={[styles.videoContainer, { opacity: fadeAnim }]}>
        <StatusBar style="light" />
        {remoteVideoTrack && remoteJoined ? (
          <VideoView style={StyleSheet.absoluteFillObject} videoTrack={remoteVideoTrack} objectFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.videoPlaceholder]}>
            <SyncAvatar userId={contactId} initialAvatar={contactAvatar} fallbackName={contactName} size={130} bgColor={T.accent} />
            <Text style={styles.videoWaitText}>Waiting for video…</Text>
          </View>
        )}
        {localVideoTrack && !cameraOff ? (
          <View style={styles.localPip}>
            <VideoView style={{ flex: 1 }} videoTrack={localVideoTrack} mirror={true} objectFit="cover" />
          </View>
        ) : (
          <View style={[styles.localPip, styles.localPipOff]}>
            <Ionicons name="videocam-off" size={20} color={theme.colors.textMuted} />
          </View>
        )}
        <SafeAreaView style={styles.videoTopBar}>
          <Text style={styles.videoName}>{contactName}</Text>
          <Text style={styles.videoStatus}>{statusLabel}</Text>
        </SafeAreaView>
        <View style={styles.videoControls}>
          <Ctrl icon={muted ? 'mic-off' : 'mic-outline'} label={muted ? 'Unmute' : 'Mute'} onPress={toggleMute} active={muted} styles={styles} theme={theme} />
          <Ctrl icon={cameraOff ? 'videocam-off' : 'videocam-outline'} label={cameraOff ? 'Cam on' : 'Cam off'} onPress={toggleCamera} active={cameraOff} styles={styles} theme={theme} />
          <Ctrl icon="camera-reverse-outline" label="Flip" onPress={flipCamera} styles={styles} theme={theme} />
          <Ctrl icon={speakerOn ? 'volume-high' : 'volume-medium-outline'} label="Speaker" onPress={toggleSpeaker} active={speakerOn} styles={styles} theme={theme} />
          <TouchableOpacity style={styles.endBtnVideo} onPress={() => endCall(true)}>
            <Ionicons name="call" size={26} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0f0518', '#1a0535', '#0f0518']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
      />

      <SafeAreaView style={styles.voiceContainer}>
        <View style={styles.voiceTop}>
          {callType === 'video' && status !== 'connected' && (
            <View style={styles.videoCallBadge}>
              <Ionicons name="videocam" size={14} color={T.accent} />
              <Text style={styles.videoCallBadgeText}>Video call</Text>
            </View>
          )}
          <Text style={styles.voiceName}>{contactName}</Text>
          <Text style={[
            styles.voiceStatus,
            status === 'ended' && { color: T.danger },
            status === 'declined' && { color: T.danger },
            status === 'connected' && { color: T.success },
          ]}>
            {statusLabel}
          </Text>
        </View>
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.ring3, { transform: [{ scale: ringAnim }] }]} />
          <Animated.View style={[styles.ring2, { transform: [{ scale: ringAnim }], opacity: 0.7 }]} />
          <Animated.View style={[styles.ring1, { transform: [{ scale: ringAnim }], opacity: 0.5 }]} />
          <View style={styles.avatarBorder}>
            <SyncAvatar
              userId={contactId}
              initialAvatar={contactAvatar}
              fallbackName={contactName}
              size={114}
              bgColor={T.accent}
            />
          </View>
        </View>
        <View style={styles.voiceControls}>
          {(status === 'connected' || (!isIncoming && status === 'connecting') || isGroupCall) && (
            <View style={styles.ctrlRow}>
              <Ctrl icon={muted ? 'mic-off' : 'mic-outline'} label={muted ? 'Unmute' : 'Mute'} onPress={toggleMute} active={muted} styles={styles} theme={theme} />
              <Ctrl icon={speakerOn ? 'volume-high' : 'volume-medium-outline'} label="Speaker" onPress={toggleSpeaker} active={speakerOn} styles={styles} theme={theme} />
              {callType === 'video' && (
                <Ctrl icon="videocam-outline" label="Video" onPress={toggleCamera} styles={styles} theme={theme} />
              )}
            </View>
          )}
          {isIncoming && status === 'ringing' ? (
            <View style={styles.incomingRow}>
              <View style={styles.incomingBtnWrap}>
                <TouchableOpacity style={styles.declineBtn} onPress={(() => endCall(false))}>
                  <Ionicons name="call" size={28} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.incomingLabel}>Decline</Text>
              </View>
              <View style={styles.incomingBtnWrap}>
                <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                  <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={28} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.incomingLabel}>Accept</Text>
              </View>
            </View>
          ) : status !== 'ended' && status !== 'declined' ? (
            <View style={styles.endWrap}>
              <TouchableOpacity style={styles.endBtn} onPress={() => endCall(true)}>
                <Ionicons name="call" size={30} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endLabel}>End call</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
const Ctrl = ({ icon, label, onPress, active, styles, theme }: { icon: string; label: string; onPress: () => void; active?: boolean; styles: any; theme: any }) => (
  <TouchableOpacity style={styles.ctrlBtn} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.ctrlIcon, active && styles.ctrlIconActive]}>
      <Ionicons name={icon as any} size={22} color={active ? theme.colors.accent : '#ffffff'} />
    </View>
    <Text style={styles.ctrlLabel}>{label}</Text>
  </TouchableOpacity>
);
const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  voiceContainer: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  voiceTop: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },
  videoCallBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(192,132,252,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  videoCallBadgeText: { fontSize: 12, color: T.accent, fontWeight: '600' },
  voiceName: { fontSize: 32, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 8 },
  voiceStatus: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  avatarSection: { alignItems: 'center', justifyContent: 'center', width: 260, height: 260 },
  ring1: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(192,132,252,0.07)' },
  ring2: { position: 'absolute', width: 175, height: 175, borderRadius: 88, backgroundColor: 'rgba(192,132,252,0.11)' },
  ring3: { position: 'absolute', width: 145, height: 145, borderRadius: 73, backgroundColor: 'rgba(192,132,252,0.16)' },
  avatarBorder: { width: 124, height: 124, borderRadius: 62, overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(192,132,252,0.5)' },
  voiceControls: { width: '100%', paddingHorizontal: 32, alignItems: 'center', gap: 28 },
  ctrlRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  incomingBtnWrap: { alignItems: 'center', gap: 10 },
  incomingLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
  declineBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.danger, justifyContent: 'center', alignItems: 'center', shadowColor: T.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  acceptBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.success, justifyContent: 'center', alignItems: 'center', shadowColor: T.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  endWrap: { alignItems: 'center', gap: 8 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.danger, justifyContent: 'center', alignItems: 'center', shadowColor: T.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  endLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  ctrlBtn: { alignItems: 'center', gap: 7, minWidth: 64 },
  ctrlIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  ctrlIconActive: { backgroundColor: 'rgba(192,132,252,0.2)', borderWidth: 1.5, borderColor: T.accent },
  ctrlLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
  videoContainer: { flex: 1, backgroundColor: '#000000' },
  videoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d1a', gap: 16 },
  videoWaitText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  localPip: { position: 'absolute', top: 70, right: 14, width: 96, height: 136, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  localPipOff: { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  videoTopBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, alignItems: 'center' },
  videoName: { fontSize: 20, fontWeight: '700', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  videoStatus: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  videoControls: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 44, paddingTop: 18, backgroundColor: 'rgba(0,0,0,0.6)' },
  endBtnVideo: { width: 58, height: 58, borderRadius: 29, backgroundColor: T.danger, justifyContent: 'center', alignItems: 'center' },
});
};
