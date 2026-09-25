import React, { useRef } from 'react';
import { View, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface PlayerAnnotationFABProps {
  isPrivileged: boolean;
  isAnnotationMode: boolean;
  onToggleAnnotationMode: () => void;
  showColorPalette: boolean;
  onToggleColorPalette: () => void;
  selectedColor: string | null;
  getMyColor: () => string;
  onSelectColor: (color: string) => void;
  annotationTool: 'pen' | 'eraser' | 'line' | 'rectangle' | 'circle';
  onSelectTool: (tool: 'pen' | 'eraser' | 'line' | 'rectangle' | 'circle') => void;
  onClearMyAnnotations: () => void;
  theme: any;
  initialBottom?: number;
  initialRight?: number;
}

const COLORS = ['#ff3b30', '#34c759', '#007aff', '#ffcc00', '#af52de', '#ffffff'];

export const PlayerAnnotationFAB: React.FC<PlayerAnnotationFABProps> = ({
  isPrivileged,
  isAnnotationMode,
  onToggleAnnotationMode,
  showColorPalette,
  onToggleColorPalette,
  selectedColor,
  getMyColor,
  onSelectColor,
  annotationTool,
  onSelectTool,
  onClearMyAnnotations,
  theme,
  initialBottom = 110,
  initialRight = 20,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gestureState);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setTimeout(() => {
          isDragging.current = false;
        }, 150);
      },
    })
  ).current;

  if (!isPrivileged) return null;

  const handleMainFabPress = () => {
    if (isDragging.current) return;
    onToggleAnnotationMode();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: initialBottom,
        right: initialRight,
        flexDirection: 'row',
        alignItems: 'flex-end',
        zIndex: 101,
        gap: 12,
        transform: pan.getTranslateTransform(),
      }}
      pointerEvents="box-none"
    >
      {/* Color palette row */}
      {isAnnotationMode && showColorPalette && (
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: 8,
            borderRadius: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
            marginBottom: 6,
          }}
        >
          {COLORS.map((c) => {
            const isCurrent = (selectedColor || getMyColor()) === c;
            return (
              <TouchableOpacity
                key={c}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: c,
                  borderWidth: isCurrent ? 2.5 : 0,
                  borderColor: '#fff',
                  transform: [{ scale: isCurrent ? 1.15 : 1 }],
                }}
                onPress={() => onSelectColor(c)}
              />
            );
          })}
        </View>
      )}

      {/* Tool buttons column */}
      <View style={{ alignItems: 'center', gap: 10 }} pointerEvents="box-none">
        {isAnnotationMode && (
          <>
            {/* Clear */}
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(255,59,48,0.95)',
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
              onPress={onClearMyAnnotations}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Color palette toggle */}
            <TouchableOpacity
              style={{
                backgroundColor: showColorPalette ? theme.colors.accent : 'rgba(0,0,0,0.7)',
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                borderWidth: 1,
                borderColor: showColorPalette ? theme.colors.accent : 'rgba(255,255,255,0.1)',
              }}
              onPress={onToggleColorPalette}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Eraser */}
            <TouchableOpacity
              style={{
                backgroundColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(0,0,0,0.7)',
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                borderWidth: 1,
                borderColor: annotationTool === 'eraser' ? theme.colors.accent : 'rgba(255,255,255,0.1)',
              }}
              onPress={() => onSelectTool('eraser')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="eraser" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Pen */}
            <TouchableOpacity
              style={{
                backgroundColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(0,0,0,0.7)',
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                borderWidth: 1,
                borderColor: annotationTool === 'pen' ? theme.colors.accent : 'rgba(255,255,255,0.1)',
              }}
              onPress={() => onSelectTool('pen')}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
          </>
        )}

        {/* Main brush FAB — Draggable anywhere */}
        <View {...panResponder.panHandlers}>
          <TouchableOpacity
            style={{
              backgroundColor: isAnnotationMode ? theme.colors.accent : 'rgba(0,0,0,0.6)',
              width: 56,
              height: 56,
              borderRadius: 28,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 8,
              borderWidth: 1,
              borderColor: isAnnotationMode ? theme.colors.accent : 'rgba(255,255,255,0.1)',
            }}
            onPress={handleMainFabPress}
            activeOpacity={0.8}
          >
            <Ionicons name="brush" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};
