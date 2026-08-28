import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import TrackPlayer from 'react-native-track-player';
import { downsampleWaveform } from './ChatTypes';

interface LocalAudioSliderProps {
  msgId: string;
  playingId: string | null;
  isAudioPlaying: boolean;
  onSeek: (value: number) => void;
  theme: any;
}

export const LocalAudioSlider = React.memo(({ msgId, playingId, isAudioPlaying, onSeek, theme }: LocalAudioSliderProps) => {
  const isActive = playingId === msgId && isAudioPlaying;
  const [progressData, setProgressData] = useState({ position: 0, duration: 0 });

  useEffect(() => {
    if (!isActive) {
      setProgressData({ position: 0, duration: 0 });
      return;
    }
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();
        if (isMounted) setProgressData({ position, duration });
      } catch {}
    }, 500);
    return () => { isMounted = false; clearInterval(interval); };
  }, [isActive]);

  const progress = (isActive && progressData.duration > 0) ? (progressData.position / progressData.duration) : 0;
  return (
    <Slider
      style={{ width: '100%', height: 18, marginTop: 2 }}
      minimumValue={0}
      maximumValue={1}
      value={progress}
      minimumTrackTintColor={theme.colors.trackMin}
      maximumTrackTintColor={theme.colors.trackMax}
      thumbTintColor={theme.colors.thumbTint}
      onSlidingComplete={onSeek}
    />
  );
});

interface VoiceWaveformVisualizerProps {
  msgId: string;
  playingId: string | null;
  isAudioPlaying: boolean;
  rawBars: number[];
  duration?: string;
  onSeek: (position: number) => void;
  styles: any;
  theme: any;
  isMe?: boolean;
  time?: string;
  status?: string;
}

export const VoiceWaveformVisualizer = React.memo(({
  msgId, playingId, isAudioPlaying, rawBars, duration, onSeek, styles, theme
}: VoiceWaveformVisualizerProps) => {
  const isActive = playingId === msgId && isAudioPlaying;
  const [progressData, setProgressData] = useState({ position: 0, duration: 0 });

  useEffect(() => {
    if (!isActive) {
      setProgressData({ position: 0, duration: 0 });
      return;
    }
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();
        if (isMounted) setProgressData({ position, duration });
      } catch {}
    }, 500);
    return () => { isMounted = false; clearInterval(interval); };
  }, [isActive]);

  const totalSecs = duration ? (() => { const p = duration.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1] || '0'); })() : 0;
  const activeDuration = (isActive && progressData.duration > 0) ? progressData.duration : totalSecs;
  const progress = (isActive && activeDuration > 0) ? (progressData.position / activeDuration) : 0;
  
  const BAR_COUNT = 40;
  const bars = rawBars?.length > 0 ? downsampleWaveform(rawBars, BAR_COUNT) : new Array(BAR_COUNT).fill(0);
  const filledBars = Math.floor(progress * BAR_COUNT);

  const displayTime = isActive
    ? (() => {
        const m = Math.floor(progressData.position / 60);
        const s = Math.floor(progressData.position % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      })()
    : (duration || '0:00');

  return (
    <View style={styles.voiceWaveArea}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.voiceWaveTouch}
        onPress={(e) => {
          const ratio = e.nativeEvent.locationX / (Dimensions.get('window').width * 0.38);
          onSeek(Math.max(0, Math.min(1, ratio)));
        }}
      >
        <View style={styles.voiceWaveBars}>
          {bars.map((amp: number, i: number) => {
            const filled = i < filledBars;
            const barHeight = 4 + (amp * 28);
            return (
              <View
                key={i}
                style={[
                  styles.voiceBar,
                  {
                    height: barHeight,
                    backgroundColor: filled ? theme.colors.textPrimary : theme.colors.textMuted
                  }
                ]}
              />
            );
          })}
        </View>
      </TouchableOpacity>
      <View style={styles.voiceMetaRow}>
        <Text style={[styles.tsText, { color: theme.colors.textMuted }]}>{displayTime}</Text>
      </View>
    </View>
  );
});
