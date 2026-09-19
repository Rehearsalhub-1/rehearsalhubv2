import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

interface Props {
  lyricsText: string;
  onLyricsChange: (text: string) => void;
  onClear: () => void;
  theme: any;
  styles: any;
}

export const AudiolabFeatherTab: React.FC<Props> = ({ lyricsText, onLyricsChange, onClear, theme, styles }) => (
  <View style={styles.tabContainer}>
    <View style={styles.notepadHeader}>
      <Text style={styles.notepadTitle}>Studio Notepad &amp; Lyrics</Text>
      <TouchableOpacity onPress={onClear}>
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </View>
    <TextInput
      style={styles.notepadInput}
      multiline
      value={lyricsText}
      onChangeText={onLyricsChange}
      placeholder="Write your lyrics, chords, or ministration notes here..."
      placeholderTextColor={theme.colors.textMuted}
      textAlignVertical="top"
    />
  </View>
);
