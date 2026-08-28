import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, PanResponder, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAnnotationStore } from '../stores/useAnnotationStore';

export const DoodleLayer = React.memo(({ 
  isAnnotationMode, 
  activeTrackId, 
  db, 
  user,
  getMyColor,
  insets,
  annotationTool,
  strokes,
  setStrokes,
  isPlayer
}: any) => {
  const activeStrokeRef = useRef<any>(null);
  const activePathRef = useRef<any>(null);
  const latestStrokesRef = useRef<any[]>([]);
  const storeSetStrokes = useAnnotationStore(s => s.setStrokes);
  const annotationToolRef = useRef(annotationTool);

  useEffect(() => {
    annotationToolRef.current = annotationTool;
  }, [annotationTool]);

  useEffect(() => {
    latestStrokesRef.current = strokes || [];
  }, [strokes]);

  const generatePathData = (stroke: any) => {
    if (!stroke) return '';
    let pathData = '';
    if (stroke.type === 'rectangle') {
      pathData = `M ${stroke.startX} ${stroke.startY} L ${stroke.endX} ${stroke.startY} L ${stroke.endX} ${stroke.endY} L ${stroke.startX} ${stroke.endY} Z`;
    } else if (stroke.type === 'circle') {
      const r = Math.sqrt((stroke.endX - stroke.startX) ** 2 + (stroke.endY - stroke.startY) ** 2);
      pathData = `M ${stroke.startX - r} ${stroke.startY} A ${r} ${r} 0 1 0 ${stroke.startX + r} ${stroke.startY} A ${r} ${r} 0 1 0 ${stroke.startX - r} ${stroke.startY}`;
    } else if (stroke.type === 'line') {
      pathData = `M ${stroke.startX} ${stroke.startY} L ${stroke.endX} ${stroke.endY}`;
    } else {
      if (!stroke?.points || stroke.points.length === 0) return '';
      if (stroke.points.length === 1) {
        return `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[0].x} ${stroke.points[0].y}`;
      }
      if (stroke.points.length === 2) {
        return `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[1].x} ${stroke.points[1].y}`;
      }
      
      let pData = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        pData += ` Q ${stroke.points[i].x} ${stroke.points[i].y}, ${xc} ${yc}`;
      }
      pData += ` L ${stroke.points[stroke.points.length - 1].x} ${stroke.points[stroke.points.length - 1].y}`;
      return pData;
    }
    return pathData;
  };

  const shouldRejectDrawingTouch = (x: number, y: number) => {
    const { width: W, height: H } = Dimensions.get('window');
    if (y < 90 + insets.top) return true;
    if (isAnnotationMode) {
      if (x > W - 90 && y > H - 520 && y < H - 80) return true;
    } else {
      if (x > W - 90 && y > H - 180 && y < H - 90) return true;
    }
    if (isPlayer) {
      if (y > H - 240) return true;
    } else {
      if (y > H - 100) return true;
    }
    
    return false;
  };

  const getMyColorRef = useRef(getMyColor);
  useEffect(() => {
    getMyColorRef.current = getMyColor;
  }, [getMyColor]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        return !shouldRejectDrawingTouch(pageX, pageY);
      },
      onMoveShouldSetPanResponder: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        return !shouldRejectDrawingTouch(pageX, pageY);
      },
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX;
        const y = pageY;
        const tool = annotationToolRef.current;

        if (tool === 'eraser') {
          const otherStrokes = latestStrokesRef.current.filter(s => {
            const isNear = s.points?.some((p: any) => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 25) ||
              (s.type === 'rectangle' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25) ||
              (s.type === 'circle' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25) ||
              (s.type === 'line' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25);
            return !isNear;
          });
          if (otherStrokes.length !== latestStrokesRef.current.length) {
            latestStrokesRef.current = otherStrokes;
            storeSetStrokes(otherStrokes); // instant update across all screens
            if (setStrokes) setStrokes(otherStrokes);
          }
          return;
        }

        const color = getMyColorRef.current();
        const newStroke = {
          userId: user?.uid || 'unknown',
          color: color,
          type: tool,
          startX: x,
          startY: y,
          endX: x,
          endY: y,
          points: [{ x, y }]
        };
        activeStrokeRef.current = newStroke;

        if (activePathRef.current) {
          activePathRef.current.setNativeProps({
            stroke: color,
            d: generatePathData(newStroke)
          });
        }
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX;
        const y = pageY;
        const tool = annotationToolRef.current;

        if (tool === 'eraser') {
          const otherStrokes = latestStrokesRef.current.filter(s => {
            const isNear = s.points?.some((p: any) => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 25) ||
              (s.type === 'rectangle' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25) ||
              (s.type === 'circle' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25) ||
              (s.type === 'line' && Math.sqrt((s.startX - x) ** 2 + (s.startY - y) ** 2) < 25);
            return !isNear;
          });
          if (otherStrokes.length !== latestStrokesRef.current.length) {
            latestStrokesRef.current = otherStrokes;
            storeSetStrokes(otherStrokes); // instant update across all screens
            if (setStrokes) setStrokes(otherStrokes);
          }
          return;
        }
        if (shouldRejectDrawingTouch(x, y)) {
          if (activeStrokeRef.current) {
            activeStrokeRef.current = null;
            if (activePathRef.current) {
              activePathRef.current.setNativeProps({ d: '' });
            }
          }
          return;
        }

        if (!activeStrokeRef.current) return;

        if (tool === 'pen') {
          const points = activeStrokeRef.current.points;
          if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            const dx = x - lastPoint.x;
            const dy = y - lastPoint.y;
            if (dx * dx + dy * dy < 4) return; // Must move at least 2 pixels to reduce jitter
          }
          points.push({ x, y });
        } else {
          activeStrokeRef.current.endX = x;
          activeStrokeRef.current.endY = y;
        }

        if (activePathRef.current) {
          try {
            const pathData = generatePathData(activeStrokeRef.current);
            activePathRef.current.setNativeProps({ d: pathData });
          } catch(e) {}
        }
      },
      onPanResponderRelease: async () => {
        const tool = annotationToolRef.current;
        if (tool === 'eraser') {
          if (!activeTrackId) return;
          try {
            // doodle saved locally
          } catch {}
          return;
        }

        const strokeToSave = activeStrokeRef.current;
        activeStrokeRef.current = null;
        if (activePathRef.current) {
          activePathRef.current.setNativeProps({ d: '' });
        }

        if (!strokeToSave || (strokeToSave.type === 'pen' && strokeToSave.points.length <= 1)) {
          return;
        }
        const updatedStrokes = [...latestStrokesRef.current, strokeToSave];
        storeSetStrokes(updatedStrokes);
        if (setStrokes) setStrokes(updatedStrokes);

        if (!activeTrackId) return;
      }
    })
  );
  useEffect(() => {
    panResponder.current.panHandlers.onStartShouldSetResponder = (evt: any) => {
      const { pageX, pageY } = evt.nativeEvent;
      return !shouldRejectDrawingTouch(pageX, pageY);
    };
    panResponder.current.panHandlers.onMoveShouldSetResponder = (evt: any) => {
      const { pageX, pageY } = evt.nativeEvent;
      return !shouldRejectDrawingTouch(pageX, pageY);
    };
  }, [isAnnotationMode, insets, annotationTool]);

  if (!(strokes?.length > 0 || isAnnotationMode)) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 99 }]} pointerEvents={isAnnotationMode ? 'auto' : 'none'} {...(isAnnotationMode ? panResponder.current.panHandlers : {})}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {(strokes || []).map((stroke: any, i: number) => (
          <Path
            key={i}
            d={generatePathData(stroke)}
            stroke={stroke.color || '#fff'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        <Path
          ref={activePathRef}
          d=""
          stroke="#fff"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
});
