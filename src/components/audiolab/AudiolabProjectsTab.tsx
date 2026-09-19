import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Project { id: string; name: string; tracks: any[]; timestamp: string; }

interface Props {
  savedProjects: Project[];
  newProjectName: string;
  onProjectNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (proj: Project) => void;
  onDelete: (id: string) => void;
  theme: any;
  styles: any;
}

export const AudiolabProjectsTab: React.FC<Props> = ({
  savedProjects, newProjectName, onProjectNameChange, onSave, onLoad, onDelete, theme, styles,
}) => (
  <ScrollView style={styles.tabContainer} showsVerticalScrollIndicator={false}>
    <View style={[styles.settingsCard, { padding: 16, marginBottom: 20 }]}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Save Current Session</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: theme.colors.cardBackgroundLight, borderRadius: 8, paddingHorizontal: 12, height: 44, color: theme.colors.textPrimary, fontSize: 14 }}
          placeholder="Enter project name..."
          placeholderTextColor={theme.colors.textMuted}
          value={newProjectName}
          onChangeText={onProjectNameChange}
        />
        <TouchableOpacity
          style={{ backgroundColor: theme.colors.accent, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', height: 44 }}
          onPress={onSave}
        >
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>

    <Text style={styles.sectionHeadingText}>Saved Projects ({savedProjects.length})</Text>

    {savedProjects.length === 0 ? (
      <View style={{ padding: 30, alignItems: 'center' }}>
        <Ionicons name="folder-open-outline" size={48} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', fontSize: 14 }}>
          No saved projects yet. Save your current tracks above to view them here.
        </Text>
      </View>
    ) : (
      savedProjects.map((proj) => (
        <View key={proj.id} style={[styles.settingsCard, { padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{proj.name}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {proj.tracks.length} tracks • {proj.timestamp}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#10b981', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 }}
              onPress={() => onLoad(proj)}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Load</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: 8, borderRadius: 6 }}
              onPress={() => onDelete(proj.id)}
            >
              <Ionicons name="trash" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))
    )}
    <View style={{ height: 120 }} />
  </ScrollView>
);
