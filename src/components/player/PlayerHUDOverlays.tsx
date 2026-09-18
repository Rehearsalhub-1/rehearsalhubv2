import React, { useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useTrackPlayerProgress } from '../../hooks/useTrackPlayer';

// --- ToastHUD ---
export interface ToastHUDProps {
  message: { text: string; icon?: string } | null;
  opacity: Animated.Value;
  theme: any;
}

export const ToastHUD: React.FC<ToastHUDProps> = ({ message, opacity, theme }) => {
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 92,
        alignSelf: 'center',
        zIndex: 999,
        opacity,
        transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        backgroundColor: 'rgba(15, 15, 25, 0.92)',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 12,
      }}
    >
      {message.icon && <Ionicons name={message.icon as any} size={18} color={theme.colors.accent} />}
      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>{message.text}</Text>
    </Animated.View>
  );
};

// --- DoubleTapOverlay ---
export interface DoubleTapOverlayProps {
  side: 'left' | 'right' | null;
  anim: Animated.Value;
  theme: any;
}

export const DoubleTapOverlay: React.FC<DoubleTapOverlayProps> = ({ side, anim, theme }) => {
  if (!side) return null;
  const isLeft = side === 'left';
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: isLeft ? 'flex-start' : 'flex-end', paddingHorizontal: 32, zIndex: 50, opacity: anim }]}
    >
      <Animated.View
        style={{
          width: 68, height: 68, borderRadius: 34,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          borderWidth: 1.5, borderColor: theme.colors.accent,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.05] }) }],
          shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12,
        }}
      >
        <Ionicons name={isLeft ? 'play-back' : 'play-forward'} size={26} color={theme.colors.accent} />
        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', marginTop: 2 }}>{isLeft ? '-10s' : '+10s'}</Text>
      </Animated.View>
    </Animated.View>
  );
};

// --- PlayerProgressSlider ---
export interface PlayerProgressSliderProps {
  theme: any;
  styles: any;
  formatTime: (ms: number) => string;
  seekTo: (ms: number) => Promise<void> | void;
  hasAudio: boolean;
  abLoop: { start: number | null; end: number | null };
}

export const PlayerProgressSlider: React.FC<PlayerProgressSliderProps> = ({ theme, styles, formatTime, seekTo, hasAudio, abLoop }) => {
  const progress = useTrackPlayerProgress(200);
  const duration = hasAudio ? progress.duration : 0;
  const position = hasAudio ? progress.position : 0;
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayValue, setSeekDisplayValue] = useState(0);

  const handleSlidingStart = () => { setIsSeeking(true); setSeekDisplayValue(position); };
  const handleSlidingComplete = async (val: number) => {
    await seekTo(val);
    setTimeout(() => setIsSeeking(false), 150);
  };

  const currentValue = isSeeking ? seekDisplayValue : position;
  const startPercent = (duration > 0 && abLoop?.start !== null) ? Math.min(100, Math.max(0, (abLoop.start! / duration) * 100)) : null;
  const endPercent = (duration > 0 && abLoop?.end !== null) ? Math.min(100, Math.max(0, (abLoop.end! / duration) * 100)) : null;

  return (
    <View style={styles.progressContainer}>
      <View style={{ position: 'relative', width: '100%', justifyContent: 'center' }}>
        {startPercent !== null && endPercent !== null && endPercent > startPercent && (
          <View style={{ position: 'absolute', left: `${startPercent}%`, width: `${endPercent - startPercent}%`, height: 4, backgroundColor: theme.colors.accent, borderRadius: 2, top: 18, zIndex: 1, opacity: 0.6 }} />
        )}
        {startPercent !== null && (
          <View style={{ position: 'absolute', left: `${startPercent}%`, top: 8, width: 3, height: 24, backgroundColor: '#38bdf8', borderRadius: 2, zIndex: 3, marginLeft: -1.5 }} />
        )}
        {endPercent !== null && (
          <View style={{ position: 'absolute', left: `${endPercent}%`, top: 8, width: 3, height: 24, backgroundColor: '#ec4899', borderRadius: 2, zIndex: 3, marginLeft: -1.5 }} />
        )}
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 100}
          value={currentValue}
          minimumTrackTintColor={hasAudio ? theme.colors.trackMin : theme.colors.textMuted}
          maximumTrackTintColor={theme.colors.trackMax}
          thumbTintColor={hasAudio ? theme.colors.thumbTint : 'transparent'}
          onSlidingStart={handleSlidingStart}
          onValueChange={(val) => setSeekDisplayValue(val)}
          onSlidingComplete={handleSlidingComplete}
          disabled={!hasAudio}
        />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{hasAudio ? formatTime(currentValue) : '--:--'}</Text>
        <Text style={styles.timeText}>{hasAudio && duration > 0 ? `-${formatTime(Math.max(0, duration - currentValue))}` : '--:--'}</Text>
      </View>
    </View>
  );
};
