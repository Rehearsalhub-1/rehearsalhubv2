import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl } from 'react-native';

interface Props {
  isRefreshing: boolean;
  onRefresh: () => void;
  theme: any;
}

export const RehearsalEmptyState: React.FC<Props> = ({ isRefreshing, onRefresh, theme }) => (
  <ScrollView
    contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}
    refreshControl={
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        tintColor={theme.colors.accent}
        colors={[theme.colors.accent]}
      />
    }
  >
    <Ionicons name="musical-notes-outline" size={64} color={theme.colors.textMuted} />
    <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 24, textAlign: 'center' }}>No Ongoing Program</Text>
    <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '500', marginTop: 8, textAlign: 'center' }}>Check back later for updates.</Text>
    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '400', marginTop: 16, textAlign: 'center' }}>Pull down to retry connecting</Text>
  </ScrollView>
);
