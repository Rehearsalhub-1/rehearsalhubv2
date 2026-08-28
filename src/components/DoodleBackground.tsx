import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
const ICON_COUNT = 60;
const ICON_NAMES = ['musical-notes', 'mic', 'radio', 'headset', 'play-circle', 'volume-medium', 'mic-outline', 'headset-outline', 'musical-note', 'radio-outline', 'play-outline'];

export const DoodleBackground = React.memo(function DoodleBackground() {
  const { theme } = useTheme();

  const iconColor = theme.colors.background !== '#0b0514'
    ? 'rgba(108, 40, 217, 0.12)'
    : 'rgba(215, 233, 55, 0.06)';

  const icons = useMemo(() => {
    return Array.from({ length: ICON_COUNT }).map((_, i) => {
      const iconName = ICON_NAMES[i % ICON_NAMES.length];
      const size = 14 + ((i * 17) % 20);
      const rotate = ((i * 67) % 360) - 180 + 'deg';
      const top = ((i * 23) % 110) - 5 + '%';
      const left = ((i * 37) % 110) - 5 + '%';

      return (
        <Ionicons
          key={i}
          name={iconName as any}
          size={size}
          color={iconColor}
          style={{ position: 'absolute', top: top as any, left: left as any, transform: [{ rotate }] }}
        />
      );
    });
  }, [iconColor]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
      {icons}
    </View>
  );
});
