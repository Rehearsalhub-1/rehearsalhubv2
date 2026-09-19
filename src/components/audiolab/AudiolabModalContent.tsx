import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

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

interface Props {
  activeModal: string | null;
  onClose: () => void;
  // Track settings
  tracks: Track[];
  selectedTrackId: string | null;
  renameText: string;
  onRenameTextChange: (txt: string) => void;
  onRenameTrack: (id: string, name: string) => void;
  onToggleTrackMute: (id: string) => void;
  onToggleTrackSolo: (id: string) => void;
  onDeleteTrack: (track: Track) => void;
  onSetTrackVolume: (id: string, val: number) => void;
  onSplitTrack: (id: string) => void;
  onTrimTrack: (id: string, side: 'left' | 'right') => void;
  onAddTrack: (name: string, type: 'voice' | 'backing' | 'sampler', color: string, presetUri?: string) => void;
  onImportAudio: () => void;
  onVolumeChange: (id: string, val: number) => void;
  // FX
  fxReverb: boolean;
  setFxReverb: (v: boolean) => void;
  fxDelay: boolean;
  setFxDelay: (v: boolean) => void;
  fxDoubler: boolean;
  setFxDoubler: (v: boolean) => void;
  fxEQ: boolean;
  setFxEQ: (v: boolean) => void;
  // Studio Kit & Metronome
  bpm: number;
  setBpm: (fn: ((prev: number) => number) | number) => void;
  timeSig: string;
  setTimeSig: (v: string) => void;
  currentBeat: number;
  onTapTempo: () => void;
  countIn: 'Off' | '1 Bar' | '2 Bars';
  setCountIn: (v: 'Off' | '1 Bar' | '2 Bars') => void;
  monitorEnabled: boolean;
  onMonitorChange: (val: boolean) => void;
  onOpenModal: (modal: string) => void;
  // AutoPitch
  pitchKey: string;
  setPitchKey: (v: string) => void;
  pitchScale: string;
  setPitchScale: (v: string) => void;
  formantShift: boolean;
  setFormantShift: (v: boolean) => void;
  // Tuner
  tunerNote: string;
  tunerCents: number;
  // Export
  onTriggerExport: (format: string) => void;
  isUploading: boolean;
  onUploadTake: () => void;
  // Collab & Feedback
  showToast: (msg: string) => void;
  theme: any;
  styles: any;
}

export const AudiolabModalContent: React.FC<Props> = ({
  activeModal,
  onClose,
  tracks,
  selectedTrackId,
  renameText,
  onRenameTextChange,
  onRenameTrack,
  onToggleTrackMute,
  onToggleTrackSolo,
  onDeleteTrack,
  onSetTrackVolume,
  onSplitTrack,
  onTrimTrack,
  onAddTrack,
  onImportAudio,
  onVolumeChange,
  fxReverb,
  setFxReverb,
  fxDelay,
  setFxDelay,
  fxDoubler,
  setFxDoubler,
  fxEQ,
  setFxEQ,
  bpm,
  setBpm,
  timeSig,
  setTimeSig,
  currentBeat,
  onTapTempo,
  countIn,
  setCountIn,
  monitorEnabled,
  onMonitorChange,
  onOpenModal,
  pitchKey,
  setPitchKey,
  pitchScale,
  setPitchScale,
  formantShift,
  setFormantShift,
  tunerNote,
  tunerCents,
  onTriggerExport,
  isUploading,
  onUploadTake,
  showToast,
  theme,
  styles,
}) => {
  return (
    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
      {activeModal === 'trackSettings' && (() => {
        const track = tracks.find((t) => t.id === selectedTrackId);
        if (!track) return null;

        return (
          <View style={styles.modalSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: (track.color || theme.colors.accent) + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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
                      flex: 1,
                    }}
                    value={renameText}
                    onChangeText={(txt) => {
                      onRenameTextChange(txt);
                      onRenameTrack(track.id, txt);
                    }}
                    placeholder="Rename track..."
                    placeholderTextColor={theme.colors.textMuted}
                  />
                  <Ionicons name="pencil" size={14} color={theme.colors.textMuted} />
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    color: theme.colors.textMuted,
                    marginTop: 2,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                  }}
                >
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
                    gap: 6,
                  },
                  track.mute && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' },
                ]}
                onPress={() => onToggleTrackMute(track.id)}
              >
                <Ionicons
                  name={track.mute ? 'volume-mute' : 'volume-medium'}
                  size={16}
                  color={track.mute ? '#ef4444' : theme.colors.textPrimary}
                />
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
                    gap: 6,
                  },
                  track.solo && { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308' },
                ]}
                onPress={() => onToggleTrackSolo(track.id)}
              >
                <Ionicons
                  name="star"
                  size={16}
                  color={track.solo ? '#eab308' : theme.colors.textPrimary}
                />
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
                  justifyContent: 'center',
                }}
                onPress={() => onDeleteTrack(track)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.04)',
                padding: 12,
                marginBottom: 18,
              }}
            >
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
                  onValueChange={(val) => onSetTrackVolume(track.id, val)}
                  minimumTrackTintColor={track.color || theme.colors.accent}
                  maximumTrackTintColor="rgba(255,255,255,0.1)"
                />
                <Ionicons name="volume-high" size={16} color={theme.colors.textMuted} />
              </View>
            </View>
            {track.type === 'voice' && (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.04)',
                  padding: 12,
                  marginBottom: 18,
                }}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 12, marginBottom: 10 }}>
                  Vocal FX Tuning
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { name: 'Reverb', active: fxReverb, setter: setFxReverb, icon: 'sparkles' },
                    { name: 'Delay', active: fxDelay, setter: setFxDelay, icon: 'repeat' },
                    { name: 'Doubler', active: fxDoubler, setter: setFxDoubler, icon: 'people' },
                    { name: 'EQ Boost', active: fxEQ, setter: setFxEQ, icon: 'options' },
                  ].map((fx) => (
                    <TouchableOpacity
                      key={fx.name}
                      style={{
                        width: '48%',
                        height: 48,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: fx.active
                          ? (track.color || theme.colors.accent) + '20'
                          : 'rgba(255,255,255,0.03)',
                        borderWidth: 1,
                        borderColor: fx.active ? track.color || theme.colors.accent : 'rgba(255,255,255,0.05)',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        gap: 8,
                      }}
                      onPress={() => fx.setter(!fx.active)}
                    >
                      <Ionicons
                        name={fx.icon as any}
                        size={16}
                        color={fx.active ? track.color || theme.colors.accentBright : theme.colors.textMuted}
                      />
                      <Text
                        style={{
                          color: fx.active ? theme.colors.textPrimary : theme.colors.textMuted,
                          fontWeight: '600',
                          fontSize: 12,
                        }}
                      >
                        {fx.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.04)',
                padding: 12,
                marginBottom: 10,
              }}
            >
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
                    gap: 4,
                  }}
                  onPress={() => {
                    onClose();
                    onSplitTrack(track.id);
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
                    gap: 4,
                  }}
                  onPress={() => {
                    onClose();
                    onTrimTrack(track.id, 'right');
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
                    gap: 4,
                  }}
                  onPress={() => {
                    onClose();
                    onTrimTrack(track.id, 'left');
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

      {activeModal === 'fx' && (
        <View style={styles.modalSection}>
          <View style={styles.modalCard}>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Studio Reverb</Text>
              <Switch
                value={fxReverb}
                onValueChange={(val) => {
                  setFxReverb(val);
                }}
                trackColor={{ false: '#333', true: '#10b981' }}
              />
            </View>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Tape Delay</Text>
              <Switch
                value={fxDelay}
                onValueChange={(val) => {
                  setFxDelay(val);
                }}
                trackColor={{ false: '#333', true: '#10b981' }}
              />
            </View>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Vocal Doubler</Text>
              <Switch
                value={fxDoubler}
                onValueChange={(val) => {
                  setFxDoubler(val);
                }}
                trackColor={{ false: '#333', true: '#10b981' }}
              />
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>7-Band Master EQ</Text>
              <Switch
                value={fxEQ}
                onValueChange={(val) => {
                  setFxEQ(val);
                }}
                trackColor={{ false: '#333', true: '#10b981' }}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              onClose();
              showToast('Saved FX Preset');
            }}
          >
            <Text style={styles.modalActionBtnText}>Apply FX Preset</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'studioKit' && (
        <View style={styles.modalSection}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Metronome & Tempo</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>Set practice speed and beats</Text>
              </View>
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.cardBackgroundLight }}
                onPress={() => onOpenModal('metronome')}
              >
                <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Tempo Settings</Text>
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>BPM Speed</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setBpm((prev: number) => Math.max(40, prev - 5))}>
                  <Ionicons name="remove-circle" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' }}>
                  {bpm}
                </Text>
                <TouchableOpacity onPress={() => setBpm((prev: number) => Math.min(240, prev + 5))}>
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
                borderColor: 'rgba(124, 58, 237, 0.3)',
              }}
              onPress={onTapTempo}
            >
              <Text style={{ color: theme.colors.accentBright, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>
                TAP TEMPO
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
              Pre-Record Count-In
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginBottom: 12 }}>
              Get a countdown beat before recording starts
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Off', '1 Bar', '2 Bars'] as const).map((mode) => (
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
                    justifyContent: 'center',
                  }}
                  onPress={() => setCountIn(mode)}
                >
                  <Text
                    style={{
                      color: countIn === mode ? theme.colors.textPrimary : theme.colors.textMuted,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>
                  Speaker Monitoring
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                  Hear backing tracks through speaker while recording. Use headphones to avoid feedback.
                </Text>
              </View>
              <Switch
                value={monitorEnabled}
                onValueChange={onMonitorChange}
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
              gap: 12,
            }}
            onPress={() => onOpenModal('tuner')}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(139,92,246,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="git-compare-outline" size={18} color={theme.colors.accentBright} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Vocal & Guitar Tuner</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                Find perfect pitch and tune vocals
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'autopitch' && (
        <View style={styles.modalSection}>
          <View style={styles.modalCard}>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Key Signature</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['C', 'G', 'Bbm', 'F#'].map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.pillSelection, pitchKey === k && styles.pillSelectionActive]}
                    onPress={() => {
                      setPitchKey(k);
                    }}
                  >
                    <Text style={[styles.pillSelectionText, pitchKey === k && styles.pillSelectionTextActive]}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Scale Type</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Major', 'Minor', 'Chromatic'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pillSelection, pitchScale === s && styles.pillSelectionActive]}
                    onPress={() => {
                      setPitchScale(s);
                    }}
                  >
                    <Text style={[styles.pillSelectionText, pitchScale === s && styles.pillSelectionTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Formant Shift</Text>
              <Switch
                value={formantShift}
                onValueChange={(val) => {
                  setFormantShift(val);
                }}
                trackColor={{ false: '#333', true: theme.colors.accent }}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              onClose();
              showToast(`AutoPitch set to ${pitchKey} ${pitchScale}`);
            }}
          >
            <Text style={styles.modalActionBtnText}>Confirm Pitch Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'addTrack' && (
        <View style={styles.modalSection}>
          <View style={styles.gridContainer}>
            {[
              { name: 'Voice / Mic', icon: 'mic', color: '#10b981' },
              { name: 'Virtual Instruments', icon: 'musical-notes', color: theme.colors.accent },
              { name: 'Guitar / Bass', icon: 'radio', color: '#f59e0b' },
              { name: 'Import Audio', icon: 'folder', color: theme.colors.accent },
              { name: 'Sampler', icon: 'grid', color: '#ec4899' },
              { name: 'Looper', icon: 'infinite', color: '#06b6d4' },
            ].map((inst) => (
              <TouchableOpacity
                key={inst.name}
                style={styles.gridCard}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  if (inst.name === 'Import Audio') {
                    onImportAudio();
                  } else {
                    const trackType = inst.name.includes('Voice')
                      ? 'voice'
                      : inst.name.includes('Sampler')
                      ? 'sampler'
                      : 'backing';
                    let presetUri: string | undefined = undefined;
                    onAddTrack(inst.name, trackType, inst.color, presetUri);
                  }
                }}
              >
                <View style={[styles.gridIconBox, { backgroundColor: inst.color }]}>
                  <Ionicons name={inst.icon as any} size={28} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.gridCardTitle}>{inst.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {activeModal === 'mixer' && (
        <View style={styles.modalSection}>
          {tracks.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="options-outline" size={32} color={theme.colors.textMuted} />
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 20 }}>
                Your multi-track session is empty. Add a backing track or record to use the mixer.
              </Text>
              <TouchableOpacity
                style={{
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: theme.colors.accent,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => onOpenModal('addTrack')}
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
                    <Text style={[styles.mixerTrackTitle, { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }]}>
                      {track.name}
                    </Text>
                  </View>
                  <View style={styles.mixerTrackControls}>
                    <TouchableOpacity
                      style={[styles.mixerBtn, track.mute && styles.mixerBtnMute]}
                      onPress={() => onToggleTrackMute(track.id)}
                    >
                      <Text style={[styles.mixerBtnText, track.mute && styles.mixerBtnTextActive]}>M</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mixerBtn, track.solo && styles.mixerBtnSolo]}
                      onPress={() => onToggleTrackSolo(track.id)}
                    >
                      <Text style={[styles.mixerBtnText, track.solo && styles.mixerBtnTextActive]}>S</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Slider
                  value={track.volume}
                  onValueChange={(val) => onVolumeChange(track.id, val)}
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
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              onClose();
            }}
          >
            <Text style={styles.modalActionBtnText}>Close Mixer</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'metronome' && (
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
                  borderColor: currentBeat === beat ? theme.colors.textPrimary : 'transparent',
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
                <TouchableOpacity
                  onPress={() => {
                    setBpm((prev: number) => Math.max(40, prev - 1));
                  }}
                >
                  <Ionicons name="remove-circle-outline" size={28} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.bpmText}>{bpm}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setBpm((prev: number) => Math.min(240, prev + 1));
                  }}
                >
                  <Ionicons name="add-circle-outline" size={28} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalRowBorder}>
              <Text style={styles.modalLabel}>Time Signature</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['2/4', '3/4', '4/4', '6/8'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pillSelection, timeSig === t && styles.pillSelectionActive]}
                    onPress={() => {
                      setTimeSig(t);
                    }}
                  >
                    <Text style={[styles.pillSelectionText, timeSig === t && styles.pillSelectionTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.tapTempoBtn} onPress={onTapTempo}>
              <Text style={styles.tapTempoText}>TAP TEMPO</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              onClose();
              showToast(`Metronome set to ${bpm} BPM`);
            }}
          >
            <Text style={styles.modalActionBtnText}>Save Tempo</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'export' && (
        <View style={styles.modalSection}>
          <View style={styles.modalCard}>
            {[
              { title: 'WAV', desc: 'Lossless audio — save to device', icon: 'disc' },
              { title: 'M4A', desc: 'Compressed AAC — save to device', icon: 'musical-note' },
            ].map((exp, idx) => (
              <TouchableOpacity
                key={exp.title}
                style={[styles.exportRow, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.bottomTabBorder }]}
                onPress={() => onTriggerExport(exp.title)}
              >
                <View style={styles.exportIconBox}>
                  <Ionicons name={exp.icon as any} size={22} color={theme.colors.accent} />
                </View>
                <View style={styles.exportTextCol}>
                  <Text style={styles.exportTitleText}>{exp.title}</Text>
                  <Text style={styles.exportDescText}>{exp.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Upload Take to Server */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(99, 102, 241, 0.3)',
              borderRadius: 14,
              padding: 16,
              marginTop: 12,
              gap: 14,
            }}
            onPress={onUploadTake}
            disabled={isUploading}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(99,102,241,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Ionicons name="cloud-upload" size={22} color="#6366f1" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                Upload Take to Server
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                Mix and save this take to Rehearsal Hub cloud
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'tuner' && (
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
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              onClose();
              showToast('Tuner Closed');
            }}
          >
            <Text style={styles.modalActionBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeModal === 'collab' && (
        <View style={styles.modalSection}>
          <View style={styles.modalCard}>
            <View style={[styles.modalRow, { gap: 12 }]}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#10b981',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={20} color={theme.colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }}>You (Host)</Text>
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>Active</Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Ionicons name="musical-notes" size={16} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
              {tracks.length} tracks in session
            </Text>
          </View>

          <Text
            style={{
              color: theme.colors.accent,
              textAlign: 'center',
              marginBottom: 16,
              fontSize: 12,
              paddingHorizontal: 20,
            }}
          >
            Live DAW sync is in beta. Sharing will export your current session tracks and settings to your partner.
          </Text>

          <TouchableOpacity
            style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]}
            onPress={() => {
              Share.share({
                message: `Join my Audiolab studio session! ${tracks.length} tracks active.`,
              }).catch(() => {});
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="person-add" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.modalActionBtnText}>Invite Partner</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};
