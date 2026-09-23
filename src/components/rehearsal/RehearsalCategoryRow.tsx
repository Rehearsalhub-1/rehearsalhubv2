import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  cat: { id: string; name: string; icon: string };
  songCount: number;
  onPress: () => void;
  theme: any;
  styles: any;
}

export const RehearsalCategoryRow: React.FC<Props> = React.memo(({ cat, songCount, onPress, theme, styles }) => (
  <View style={{ paddingHorizontal: 16 }}>
    <TouchableOpacity style={styles.categoryListItem} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.categoryItemLeft}>
        <View style={styles.categoryIconWrapper}>
          <Ionicons name={cat.icon as any} size={20} color={theme.colors.textPrimary} />
        </View>
        <View style={styles.categoryTextInfo}>
          <Text style={styles.categoryListTitle} numberOfLines={1} ellipsizeMode="tail">{cat.name}</Text>
          <Text style={styles.categoryListSubtitle} numberOfLines={1} ellipsizeMode="tail">{songCount} songs available</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  </View>
));
