import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';

interface Props {
  countIn: 'Off' | '1 Bar' | '2 Bars';
  onCycleCountIn: () => void;
  monitorEnabled: boolean;
  onMonitorChange: (val: boolean) => void;
  onOpenTuner: () => void;
  showToast: (msg: string) => void;
  theme: any;
  styles: any;
}

export const AudiolabSettingsTab: React.FC<Props> = ({
  countIn, onCycleCountIn, monitorEnabled, onMonitorChange, onOpenTuner, showToast, theme, styles,
}) => (
  <ScrollView style={styles.tabContainer} showsVerticalScrollIndicator={false}>
    <Text style={styles.sectionHeadingText}>Audio Configuration</Text>
    <View style={styles.settingsCard}>
      <TouchableOpacity style={styles.settingsRowBorder} onPress={onCycleCountIn}>
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
            onMonitorChange(val);
            showToast(val ? 'Monitoring: Speaker ON' : 'Monitoring: Earpiece');
            setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
              shouldPlayInBackground: false,
              shouldRouteThroughEarpiece: !val,
            }).catch(() => {});
          }}
          trackColor={{ false: '#333', true: theme.colors.accent }}
        />
      </View>
    </View>

    <Text style={styles.sectionHeadingText}>Studio Tools</Text>
    <View style={styles.settingsCard}>
      <TouchableOpacity style={styles.settingsRow} onPress={onOpenTuner}>
        <View style={styles.settingsTextCol}>
          <Text style={styles.settingsLabel}>Vocal &amp; Instrument Tuner</Text>
          <Text style={styles.settingsSubDesc}>Tune your vocals or musical instruments in real-time</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </View>

    <View style={{ height: 120 }} />
  </ScrollView>
);
