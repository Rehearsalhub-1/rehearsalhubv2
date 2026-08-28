
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';

interface ThemedHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function ThemedHeader({ children, style }: ThemedHeaderProps) {
  const { theme, themeName } = useTheme();
  const isLight = themeName === 'light';

  if (!isLight) {
    return (
      <View style={[styles.wrapper, style]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.wrapper, style]}>
      <StatusBar style="light" backgroundColor="#5b21b6" />
      <LinearGradient
        colors={theme.gradients.header as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
});
