import React from 'react';
import { View, Text, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { Dimensions } from 'react-native';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  shimmerOpacity: Animated.AnimatedInterpolation<string | number>;
  theme: any;
}

export const RehearsalSkeletonLoader: React.FC<Props> = ({ shimmerOpacity, theme }) => (
  <ScrollView style={{ flex: 1 }} scrollEnabled={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
    <Animated.View style={[{ width: '100%', height: SCREEN_WIDTH * 0.52, borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 20 }, { opacity: shimmerOpacity }]} />
    <Animated.View style={[{ height: 22, width: '60%', borderRadius: 8, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 10 }, { opacity: shimmerOpacity }]} />
    <Animated.View style={[{ height: 14, width: '40%', borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 24 }, { opacity: shimmerOpacity }]} />
    {[1, 2, 3, 4, 5, 6].map(i => (
      <Animated.View key={i} style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, { opacity: shimmerOpacity }]}>
        <View style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: theme.colors.cardBackgroundLight, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <View style={{ height: 14, width: `${55 + (i % 3) * 15}%`, borderRadius: 12, backgroundColor: theme.colors.cardBackgroundLight, marginBottom: 8 }} />
          <View style={{ height: 11, width: `${35 + (i % 4) * 10}%`, borderRadius: 5, backgroundColor: theme.colors.cardBackgroundLight }} />
        </View>
      </Animated.View>
    ))}
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <ActivityIndicator size="small" color="rgba(192,132,252,0.5)" />
      <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '500' }}>
        Connecting to server…
      </Text>
    </View>
  </ScrollView>
);
