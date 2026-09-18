import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ABLooperStripProps {
  visible: boolean;
  abLoop: { active: boolean; start: number | null; end: number | null };
  onClearLoop: () => void;
  onClose: () => void;
  onSetPointA: () => Promise<void> | void;
  onSetPointB: () => Promise<void> | void;
  onToggleLoop: () => void;
  formatTime: (msOrSec: number) => string;
  theme: any;
  styles: any;
}

export const ABLooperStrip: React.FC<ABLooperStripProps> = ({
  visible,
  abLoop,
  onClearLoop,
  onClose,
  onSetPointA,
  onSetPointB,
  onToggleLoop,
  formatTime,
  theme,
  styles,
}) => {
  if (!visible) return null;

  const isLoopReady =
    abLoop.start !== null && abLoop.end !== null && abLoop.end > abLoop.start;

  return (
    <View style={styles.abLooperStrip}>
      {/* Header: Title and Reset */}
      <View style={styles.abLooperHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="infinite" size={16} color={theme.colors.accent} />
          <Text style={styles.abLooperTitle}>A-B Loop</Text>
          {abLoop.active && (
            <View
              style={{
                backgroundColor: theme.colors.accent + '25',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: theme.colors.accent, fontSize: 10, fontWeight: '800' }}>
                ACTIVE
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(abLoop.start !== null || abLoop.end !== null) && (
            <TouchableOpacity onPress={onClearLoop} style={styles.abResetBtn}>
              <Ionicons name="trash-outline" size={12} color="#ff453a" />
              <Text style={styles.abResetText}>Reset</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Simple 2-Point Set Buttons + Loop Toggle */}
      <View style={styles.abPointsRow}>
        {/* Point A */}
        <TouchableOpacity
          style={[
            styles.abPointBox,
            { flex: 1 },
            abLoop.start !== null && {
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
            },
          ]}
          onPress={onSetPointA}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name="flag"
              size={12}
              color={abLoop.start !== null ? '#38bdf8' : theme.colors.textMuted}
            />
            <Text style={styles.abPointLabel}>START (A)</Text>
          </View>
          <Text style={[styles.abPointTime, abLoop.start !== null && { color: '#38bdf8' }]}>
            {abLoop.start !== null ? formatTime(abLoop.start) : 'Set Current'}
          </Text>
        </TouchableOpacity>

        {/* Point B */}
        <TouchableOpacity
          style={[
            styles.abPointBox,
            { flex: 1 },
            abLoop.end !== null && {
              borderColor: '#ec4899',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
            },
          ]}
          onPress={onSetPointB}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name="flag"
              size={12}
              color={abLoop.end !== null ? '#ec4899' : theme.colors.textMuted}
            />
            <Text style={styles.abPointLabel}>END (B)</Text>
          </View>
          <Text style={[styles.abPointTime, abLoop.end !== null && { color: '#ec4899' }]}>
            {abLoop.end !== null ? formatTime(abLoop.end) : 'Set Current'}
          </Text>
        </TouchableOpacity>

        {/* Loop / Play Toggle */}
        <TouchableOpacity
          style={[
            styles.abLoopToggleBtn,
            abLoop.active && {
              backgroundColor: theme.colors.accent,
              borderColor: theme.colors.accent,
            },
            !isLoopReady && { opacity: 0.45 },
          ]}
          disabled={!isLoopReady}
          onPress={onToggleLoop}
          activeOpacity={0.8}
        >
          <Ionicons
            name={abLoop.active ? 'infinite' : 'play'}
            size={18}
            color={abLoop.active ? theme.colors.backgroundDark : theme.colors.textPrimary}
          />
          <Text
            style={[
              styles.abLoopToggleText,
              abLoop.active && { color: theme.colors.backgroundDark },
            ]}
          >
            {abLoop.active ? 'Looping' : 'Loop'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
