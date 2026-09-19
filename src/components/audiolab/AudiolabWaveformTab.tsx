import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Track {
  id: string; name: string; type: 'voice' | 'backing' | 'sampler';
  color: string; uri?: string; mute: boolean; solo: boolean;
  volume: number; peaks?: number[]; startTime?: number; duration?: number;
}

interface Props {
  tracks: Track[];
  isPlaying: boolean;
  isRecording: boolean;
  timecode: string;
  bpm: number;
  loopEnabled: boolean;
  scrubberPosition: number;
  undoAvailable: boolean;
  redoAvailable: boolean;
  liveMeterLevel: number;
  // Callbacks
  onStartRecording: () => void;
  onImportAudio: () => void;
  onTogglePlay: () => void;
  onSeekToStart: () => void;
  onSkipForward: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleLoop: () => void;
  onToggleRecord: () => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onTrackSettings: (id: string, name: string) => void;
  onAddTrack: () => void;
  onOpenMixer: () => void;
  onOpenStudioKit: () => void;
  onOpenExport: () => void;
  onTimelineGrant: (e: any) => void;
  onTimelineMove: (e: any) => void;
  onTimelineRelease: (e: any) => void;
  generateWavePeaks: (id: string, name: string) => number[];
  theme: any;
  styles: any;
}

export const AudiolabWaveformTab: React.FC<Props> = ({
  tracks, isPlaying, isRecording, timecode, bpm, loopEnabled, scrubberPosition,
  undoAvailable, redoAvailable, liveMeterLevel,
  onStartRecording, onImportAudio, onTogglePlay, onSeekToStart, onSkipForward,
  onUndo, onRedo, onToggleLoop, onToggleRecord,
  onToggleMute, onToggleSolo, onTrackSettings,
  onAddTrack, onOpenMixer, onOpenStudioKit, onOpenExport,
  onTimelineGrant, onTimelineMove, onTimelineRelease,
  generateWavePeaks, theme, styles,
}) => (
  <View style={styles.tabContainer}>
    {tracks.length === 0 ? (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24, paddingVertical: 48 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity
            style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
            onPress={onStartRecording}
            activeOpacity={0.85}
          >
            <Ionicons name="mic" size={40} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 16 }}>Tap to Start Recording</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 280 }}>
            Sing, record, and practice your vocal takes. Your session timeline will appear automatically.
          </Text>
        </View>
        <View style={{ width: '100%', maxWidth: 280, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <TouchableOpacity
          style={{ width: '100%', maxWidth: 300, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, gap: 12 }}
          onPress={onImportAudio}
        >
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(52, 199, 89, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="folder-open" size={20} color="#34c759" />
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
        {/* Timeline area */}
        <View style={styles.timelineWrapper}>
          {/* Track headers column */}
          <View style={styles.trackHeadersColumn}>
            <View style={styles.trackHeaderRulerSpacer} />
            {tracks.map((track) => (
              <View key={track.id} style={styles.trackHeaderCard}>
                <View style={[styles.trackAccentStripe, { backgroundColor: track.color || theme.colors.accent, width: 4 }]} />
                <View style={styles.trackHeaderInner}>
                  <TouchableOpacity
                    style={styles.trackHeaderTop}
                    onPress={() => onTrackSettings(track.id, track.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.trackIconBox, { backgroundColor: (track.color || theme.colors.accent) + '22' }]}>
                      <Ionicons name={track.type === 'voice' ? 'mic' : 'musical-note'} size={13} color={track.color || theme.colors.accent} />
                    </View>
                    <Text style={styles.trackTitleText} numberOfLines={1}>{track.name}</Text>
                    <Ionicons name="ellipsis-vertical" size={12} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  <View style={styles.trackHeaderControls}>
                    <TouchableOpacity style={[styles.trackHeaderControlBtn, track.mute && styles.trackHeaderControlBtnActive]} onPress={() => onToggleMute(track.id)}>
                      <Text style={[styles.trackHeaderControlBtnText, track.mute && { color: '#fff' }]}>M</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.trackHeaderControlBtn, track.solo && styles.trackHeaderControlBtnActiveSolo]} onPress={() => onToggleSolo(track.id)}>
                      <Text style={[styles.trackHeaderControlBtnText, track.solo && { color: '#fff' }]}>S</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 9, color: theme.colors.textMuted, marginLeft: 'auto' }}>{Math.round(track.volume * 100)}%</Text>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addTrackHeaderCard} onPress={onAddTrack}>
              <Ionicons name="add" size={20} color={theme.colors.accent} />
              <Text style={styles.addTrackText}>Add Track</Text>
            </TouchableOpacity>
          </View>

          {/* Timeline grid */}
          <ScrollView horizontal style={styles.timelineGridScroll} showsHorizontalScrollIndicator={false}>
            {(() => {
              const maxDuration = tracks.reduce((max, track) => Math.max(max, (track.startTime || 0) + (track.duration || 25000)), 60000);
              const timelineWidth = Math.max(SCREEN_WIDTH * 3, 40 + (maxDuration / 1000) * 45);
              const totalBeats = Math.ceil(timelineWidth / 118) + 2;
              return (
                <View style={[styles.timelineGridInner, { width: timelineWidth }]}>
                  <View style={styles.beatNumbersRow} onStartShouldSetResponder={() => true} onResponderGrant={onTimelineGrant} onResponderMove={onTimelineMove} onResponderRelease={onTimelineRelease}>
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
                    const rawPeaks = track.peaks && track.peaks.length > 0 ? track.peaks : generateWavePeaks(track.id, track.name);
                    const step = rawPeaks.length / targetBarCount;
                    const displayPeaks = Array.from({ length: targetBarCount }, (_, i) => {
                      const idx = Math.floor(i * step);
                      return rawPeaks[Math.min(rawPeaks.length - 1, idx)] || 4;
                    });
                    return (
                      <View key={track.id} style={[styles.waveformTrackRow, { position: 'relative' }]}>
                        {track.uri ? (
                          <View style={[styles.waveformBlock, { position: 'absolute', left: regionLeft, width: regionWidth, backgroundColor: (track.color || theme.colors.accent) + '15', borderWidth: 1.5, borderColor: track.color || theme.colors.accent, borderRadius: 12, height: 60, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' }]}>
                            <View style={[styles.waveVisualContainer, { justifyContent: 'space-between', paddingHorizontal: 2 }]}>
                              {displayPeaks.map((h, i) => {
                                const barAbsoluteX = regionLeft + (i / targetBarCount) * regionWidth;
                                const played = scrubberPosition >= barAbsoluteX;
                                const barWidth = Math.max(1, (regionWidth / targetBarCount) - 1.5);
                                return (
                                  <View key={i} style={{ height: Math.max(4, Math.min(50, h)), width: barWidth, borderRadius: 1, backgroundColor: played ? theme.colors.textPrimary : track.color || theme.colors.accentBright, opacity: played ? 1 : 0.65 }} />
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <View style={{ position: 'absolute', left: 20, width: SCREEN_WIDTH * 3 - 40, height: 60, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.textMuted + '66', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
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

        {/* Studio toolbar */}
        <View style={styles.studioToolbar}>
          <TouchableOpacity style={styles.studioToolItem} onPress={onAddTrack}>
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.studioToolLabel}>Add Track</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.studioToolItem} onPress={onOpenMixer}>
            <Ionicons name="options-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.studioToolLabel}>Mixer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bigRecordBtn} onPress={onToggleRecord} activeOpacity={0.8}>
            <View style={[styles.bigRecordInner, isRecording && styles.bigRecordInnerActive]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.studioToolItem} onPress={onOpenStudioKit}>
            <Ionicons name="construct-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.studioToolLabel}>Studio Kit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.studioToolItem} onPress={onOpenExport}>
            <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.studioToolLabel}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
  </View>
);
