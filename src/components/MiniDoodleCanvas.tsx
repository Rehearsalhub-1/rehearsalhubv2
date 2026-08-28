import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const MiniDoodleCanvas = ({ strokes, setStrokes, color = '#a855f7' }: any) => {
  const activeStrokeRef = useRef<any>(null);
  const activePathRef = useRef<any>(null);
  const latestStrokesRef = useRef<any[]>([]);

  useEffect(() => {
    latestStrokesRef.current = strokes || [];
  }, [strokes]);

  const generatePathData = (stroke: any) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return '';
    if (stroke.points.length === 1) {
      return `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[0].x} ${stroke.points[0].y}`;
    }
    if (stroke.points.length === 2) {
      return `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[1].x} ${stroke.points[1].y}`;
    }
    let pathData = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      pathData += ` Q ${stroke.points[i].x} ${stroke.points[i].y}, ${xc} ${yc}`;
    }
    pathData += ` L ${stroke.points[stroke.points.length - 1].x} ${stroke.points[stroke.points.length - 1].y}`;
    return pathData;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        activeStrokeRef.current = {
          id: Math.random().toString(36).substr(2, 9),
          color,
          type: 'pen',
          points: [{ x, y }],
        };
        activePathRef.current?.setNativeProps({
          d: generatePathData(activeStrokeRef.current),
        });
      },
      onPanResponderMove: (evt) => {
        if (!activeStrokeRef.current) return;
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        const points = activeStrokeRef.current.points;
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          const dx = x - lastPoint.x;
          const dy = y - lastPoint.y;
          if (dx * dx + dy * dy < 4) return; // Must move at least 2 pixels
        }

        activeStrokeRef.current.points.push({ x, y });
        try {
          activePathRef.current?.setNativeProps({
            d: generatePathData(activeStrokeRef.current),
          });
        } catch {}
      },
      onPanResponderRelease: () => {
        if (activeStrokeRef.current && activeStrokeRef.current.points.length > 1) {
          const newStrokes = [...latestStrokesRef.current, activeStrokeRef.current];
          latestStrokesRef.current = newStrokes;
          setStrokes(newStrokes); // Only re-render happens here, on lift-up
        }
        activeStrokeRef.current = null;
        activePathRef.current?.setNativeProps({ d: '' });
      },
      onPanResponderTerminate: () => {
        activeStrokeRef.current = null;
        activePathRef.current?.setNativeProps({ d: '' });
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {strokes.map((stroke: any) => (
          <Path
            key={stroke.id}
            d={generatePathData(stroke)}
            stroke={stroke.color || color}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <Path
          ref={activePathRef}
          d=""
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  }
});

