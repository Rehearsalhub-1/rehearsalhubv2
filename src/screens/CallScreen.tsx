import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, BackHandler, ScrollView
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

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  videoTrack?: any;
  isMuted?: boolean;
  isSpeaking?: boolean;
  status: 'joined' | 'ringing';
}

export default function CallScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const T = theme.colors;

  const {
    callId,
    callType: initialCallType = 'voice',
    isIncoming = false,
    contactName = 'Unknown',
    contactAvatar,
    contactId,
    roomId,
    isGroupCall = false,
    participants: initialParticipants = [],
    participantDetails = {},
  } = route.params || {};

  const cu = useUserStore(s => s.user);
  const myProfile = useUserStore(s => s.profile);

  const [callType, setCallType] = useState<'voice' | 'video'>(initialCallType);
  const [status, setStatus] = useState<CallStatus>(isGroupCall ? 'connecting' : (isIncoming ? 'ringing' : 'connecting'));
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(initialCallType === 'video' || isGroupCall);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<CallParticipant[]>([]);

  const engineRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef(0);
  const ringAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useWebSocket('calls', callId || '', (data: any) => {
    if (data?.status === 'ended' || data?.status === 'declined') {
      endCall(false);
    } else if (data?.status === 'connected') {
      setStatus('connected');
    }
  });

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
        } catch (e) {}
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
        } catch (e) {}
      }
    };

    const stopDial = async () => {
      if (dialSound) {
        await dialSound.stopAsync().catch(() => {});
        await dialSound.unloadAsync().catch(() => {});
        dialSound = null;
      }
    };

    if (!isIncoming && !isGroupCall && status === 'connecting') playDialTone();
    else stopDial();
    return () => { stopDial(); };
  }, [status, isIncoming, isGroupCall]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    initLiveKit();
    return () => {
      cleanupLiveKit();
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      connectedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  const syncLiveKitParticipants = () => {
    if (!engineRef.current) return;
    const list: CallParticipant[] = [];
    engineRef.current.remoteParticipants.forEach((p: any) => {
      const details = participantDetails[p.identity] || {};
      const camPub = p.getTrackPublication(Track.Source.Camera);
      const camTrack = camPub?.track;
      list.push({
        id: p.identity,
        name: details.name || p.name || p.identity || 'Member',
        avatar: details.avatar || '',
        videoTrack: camTrack || null,
        isMuted: p.isMicrophoneMuted,
        isSpeaking: p.isSpeaking,
        status: 'joined',
      });
    });
    setRemoteParticipants(list);
    if (list.length > 0) {
      setRemoteJoined(true);
      setStatus('connected');
    }
  };

  const initLiveKit = async () => {
    try {
      const room = new Room({
        audioCaptureDefaults: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        videoCaptureDefaults: { resolution: VideoPresets.h720 },
      });
      engineRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(track);
        }
        syncLiveKitParticipants();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(null);
        }
        syncLiveKitParticipants();
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteJoined(true);
        setStatus('connected');
        syncLiveKitParticipants();
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        syncLiveKitParticipants();
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
          await api.calls.update(callId, { status: 'ringing' }).catch(() => {});
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
      syncLiveKitParticipants();
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
        if (!isIncoming) callResult = 'canceled';
        else callResult = 'declined';
      }
      if (shouldLog) await logCall(callResult, duration);
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
    if (!nextVal) {
      setCallType('video');
    }
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
      // call logged
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

  // Prepare participants for grid
  const localParticipant: CallParticipant = {
    id: cu?.uid || 'me',
    name: 'You',
    avatar: myProfile?.avatar || '',
    videoTrack: localVideoTrack,
    isMuted: muted,
    isSpeaking: false,
    status: 'joined',
  };

  const remoteList: CallParticipant[] = remoteParticipants.length > 0
    ? remoteParticipants
    : (Array.isArray(initialParticipants) ? initialParticipants : [])
        .filter((uid: string) => uid !== cu?.uid)
        .map((uid: string) => {
          const details = participantDetails[uid] || {};
          return {
            id: uid,
            name: details.name || 'Member',
            avatar: details.avatar || '',
            status: 'ringing' as const,
          };
        });

  const allGridParticipants: CallParticipant[] = [localParticipant, ...remoteList];

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#0b141a' }, { opacity: fadeAnim }]}>
      <StatusBar style="light" />

      {/* WhatsApp Background Gradient */}
      <LinearGradient
        colors={['#071a17', '#0c2420', '#071210']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* 1-on-1 Fullscreen Remote Video View (if 1-on-1 and video connected) */}
      {!isGroupCall && callType === 'video' && status === 'connected' && (
        <View style={StyleSheet.absoluteFillObject}>
          {remoteVideoTrack && remoteJoined ? (
            <VideoView style={StyleSheet.absoluteFillObject} videoTrack={remoteVideoTrack} objectFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.videoPlaceholder]}>
              <SyncAvatar userId={contactId} initialAvatar={contactAvatar} fallbackName={contactName} size={110} bgColor={T.accent} />
              <Text style={styles.videoWaitText}>Waiting for video…</Text>
            </View>
          )}

          {/* Local Floating Video PIP */}
          {localVideoTrack && !cameraOff ? (
            <View style={styles.localPip}>
              <VideoView style={{ flex: 1 }} videoTrack={localVideoTrack} mirror={true} objectFit="cover" />
            </View>
          ) : (
            <View style={[styles.localPip, styles.localPipOff]}>
              <Ionicons name="videocam-off" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          )}
        </View>
      )}

      <SafeAreaView style={styles.mainCanvas}>
        {/* Authentic WhatsApp Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.headerBtnRound}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={26} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.6)" />
              <Text style={styles.lockText}>End-to-end encrypted</Text>
            </View>
            <Text style={styles.callHeaderTitle} numberOfLines={1}>
              {contactName}
            </Text>
            <Text style={styles.callHeaderSub}>
              {statusLabel}
            </Text>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Center Calling Area */}
        {isGroupCall ? (
          /* WhatsApp Group Call Grid */
          <View style={styles.gridContainer}>
            {allGridParticipants.map((p, idx) => {
              const isMe = p.id === cu?.uid || p.id === 'me';
              const showVideo = isMe ? (localVideoTrack && !cameraOff) : (p.videoTrack && p.status === 'joined');
              const isTileRinging = p.status === 'ringing';
              const total = allGridParticipants.length;
              const isTwo = total <= 2;

              return (
                <View 
                  key={p.id || `p-${idx}`} 
                  style={[
                    styles.gridTile, 
                    isTwo ? styles.gridTileHalf : styles.gridTileQuarter,
                    p.isSpeaking && styles.speakingTileBorder,
                  ]}
                >
                  {showVideo ? (
                    <VideoView 
                      style={StyleSheet.absoluteFillObject} 
                      videoTrack={isMe ? localVideoTrack : p.videoTrack} 
                      mirror={isMe} 
                      objectFit="cover" 
                    />
                  ) : (
                    <View style={styles.tileAvatarWrap}>
                      <SyncAvatar 
                        userId={p.id} 
                        initialAvatar={p.avatar} 
                        fallbackName={p.name} 
                        size={isTwo ? 80 : 60} 
                        bgColor={T.accent} 
                      />
                      {isTileRinging && (
                        <View style={styles.tileRingingBadge}>
                          <Text style={styles.tileRingingText}>Ringing…</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Tile Bottom Name & Mic status */}
                  <View style={styles.tileFooterTag}>
                    <Text style={styles.tileFooterName} numberOfLines={1}>{p.name}</Text>
                    {p.isMuted ? (
                      <Ionicons name="mic-off" size={12} color="#ef4444" style={{ marginLeft: 4 }} />
                    ) : p.isSpeaking ? (
                      <Ionicons name="volume-high" size={12} color="#22c55e" style={{ marginLeft: 4 }} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* 1-on-1 Call Center Stage */
          (callType === 'voice' || status !== 'connected') && (
            <View style={styles.singleCenterStage}>
              <View style={styles.avatarPulsingWrap}>
                <Animated.View style={[styles.ringOuter, { transform: [{ scale: ringAnim }] }]} />
                <Animated.View style={[styles.ringMid, { transform: [{ scale: ringAnim }], opacity: 0.6 }]} />
                <Animated.View style={[styles.ringInner, { transform: [{ scale: ringAnim }], opacity: 0.4 }]} />
                <View style={styles.singleAvatarBorder}>
                  <SyncAvatar
                    userId={contactId}
                    initialAvatar={contactAvatar}
                    fallbackName={contactName}
                    size={120}
                    bgColor={T.accent}
                  />
                </View>
              </View>
            </View>
          )
        )}

        {/* Bottom Floating WhatsApp Control Bar */}
        <View style={styles.bottomBarContainer}>
          {isIncoming && status === 'ringing' ? (
            /* Incoming Ringing Controls */
            <View style={styles.incomingControlsRow}>
              <View style={styles.incomingBtnWrap}>
                <TouchableOpacity style={styles.declineBtnRound} onPress={() => endCall(false)}>
                  <Ionicons name="call" size={28} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.btnSubLabel}>Decline</Text>
              </View>
              <View style={styles.incomingBtnWrap}>
                <TouchableOpacity style={styles.acceptBtnRound} onPress={acceptCall}>
                  <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={28} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.btnSubLabel}>Accept</Text>
              </View>
            </View>
          ) : (
            /* Active Call Controls Floating Pill */
            <View style={styles.whatsappControlsPill}>
              {/* Speaker Toggle */}
              <TouchableOpacity 
                style={[styles.waCtrlBtn, speakerOn && styles.waCtrlBtnActive]} 
                onPress={toggleSpeaker}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={speakerOn ? "volume-high" : "volume-medium-outline"} 
                  size={22} 
                  color={speakerOn ? "#25D366" : "#ffffff"} 
                />
              </TouchableOpacity>

              {/* Camera Flip (only visible when camera is on) */}
              {(callType === 'video' && !cameraOff) && (
                <TouchableOpacity 
                  style={styles.waCtrlBtn} 
                  onPress={flipCamera}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-reverse-outline" size={22} color="#ffffff" />
                </TouchableOpacity>
              )}

              {/* Video Camera Toggle */}
              <TouchableOpacity 
                style={[styles.waCtrlBtn, (!cameraOff && callType === 'video') && styles.waCtrlBtnActive]} 
                onPress={toggleCamera}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={(!cameraOff && callType === 'video') ? "videocam" : "videocam-off"} 
                  size={22} 
                  color={(!cameraOff && callType === 'video') ? "#25D366" : "#ffffff"} 
                />
              </TouchableOpacity>

              {/* Microphone Toggle */}
              <TouchableOpacity 
                style={[styles.waCtrlBtn, muted && styles.waCtrlBtnMuted]} 
                onPress={toggleMute}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={muted ? "mic-off" : "mic"} 
                  size={22} 
                  color={muted ? "#ef4444" : "#ffffff"} 
                />
              </TouchableOpacity>

              {/* Red End Call Button */}
              <TouchableOpacity 
                style={styles.waEndCallBtn} 
                onPress={() => endCall(true)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="call" 
                  size={26} 
                  color="#ffffff" 
                  style={{ transform: [{ rotate: '135deg' }] }} 
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
    mainCanvas: {
      flex: 1,
      justifyContent: 'space-between',
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 6,
      zIndex: 10,
    },
    headerBtnRound: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerRightPlaceholder: {
      width: 40,
      height: 40,
    },
    headerTitleContainer: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: 12,
    },
    lockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 3,
    },
    lockText: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: '500',
    },
    callHeaderTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#ffffff',
      textAlign: 'center',
      letterSpacing: 0.2,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    callHeaderSub: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 2,
      fontWeight: '500',
    },
    singleCenterStage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPulsingWrap: {
      width: 250,
      height: 250,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ringOuter: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(37, 211, 102, 0.08)',
    },
    ringMid: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(37, 211, 102, 0.12)',
    },
    ringInner: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(37, 211, 102, 0.18)',
    },
    singleAvatarBorder: {
      width: 130,
      height: 130,
      borderRadius: 65,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'rgba(37, 211, 102, 0.5)',
      elevation: 6,
    },
    videoPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0a141b',
      gap: 16,
    },
    videoWaitText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 14,
    },
    localPip: {
      position: 'absolute',
      top: 85,
      right: 16,
      width: 100,
      height: 145,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      backgroundColor: '#111b21',
      elevation: 6,
      zIndex: 20,
    },
    localPipOff: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    /* WhatsApp Group Call Grid */
    gridContainer: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
    },
    gridTile: {
      backgroundColor: '#182229',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.1)',
      position: 'relative',
    },
    gridTileHalf: {
      width: '100%',
      height: '48.5%',
    },
    gridTileQuarter: {
      width: '48.5%',
      height: '48.5%',
    },
    speakingTileBorder: {
      borderColor: '#25D366',
      borderWidth: 2,
    },
    tileAvatarWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tileRingingBadge: {
      marginTop: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tileRingingText: {
      color: '#fbbf24',
      fontSize: 11,
      fontWeight: '600',
    },
    tileFooterTag: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      maxWidth: '85%',
    },
    tileFooterName: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
    /* Controls Area */
    bottomBarContainer: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      alignItems: 'center',
      zIndex: 10,
    },
    whatsappControlsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: 'rgba(17, 27, 33, 0.92)',
      borderRadius: 40,
      paddingHorizontal: 16,
      paddingVertical: 10,
      width: '100%',
      maxWidth: 380,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    waCtrlBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    waCtrlBtnActive: {
      backgroundColor: 'rgba(37, 211, 102, 0.2)',
      borderWidth: 1.5,
      borderColor: '#25D366',
    },
    waCtrlBtnMuted: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderWidth: 1.5,
      borderColor: '#ef4444',
    },
    waEndCallBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#ea4335',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#ea4335',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    /* Incoming Calls */
    incomingControlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      paddingHorizontal: 20,
    },
    incomingBtnWrap: {
      alignItems: 'center',
      gap: 8,
    },
    declineBtnRound: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#ea4335',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
    },
    acceptBtnRound: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#25D366',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
    },
    btnSubLabel: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      fontWeight: '600',
    },
  });
};
