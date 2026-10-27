import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

export interface ExpandableTextProps {
  style: any;
  children: React.ReactNode;
  gradientColors?: readonly [string, string, ...string[]];
}

const MaskedViewAny: any = MaskedView;

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  style,
  children,
  gradientColors,
}) => {
  const [expanded, setExpanded] = useState(false);
  const textProps = {
    numberOfLines: expanded ? undefined : 1,
    ellipsizeMode: 'tail' as const,
    onPress: () => setExpanded(!expanded),
    suppressHighlighting: true,
  };

  const textElement = (
    <Text style={style} {...textProps}>
      {children}
    </Text>
  );

  if (gradientColors && gradientColors.length > 0) {
    return (
      <MaskedViewAny maskElement={textElement} style={style}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[style, { opacity: 0 }]} {...textProps}>
          {children}
        </Text>
      </MaskedViewAny>
    );
  }

  return textElement;
};
