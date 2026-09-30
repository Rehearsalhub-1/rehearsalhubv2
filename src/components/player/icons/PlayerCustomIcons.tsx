import React from 'react';
import Svg, { Path, Rect, Circle, Line, G } from 'react-native-svg';

export interface PlayerCustomIconProps {
  size?: number;
  color?: string;
  style?: any;
}

/**
 * LyricsIcon - Document with top-right fold, musical notes, and horizontal lyric lines.
 */
export const LyricsIcon: React.FC<PlayerCustomIconProps> = ({
  size = 22,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {/* Document border with folded corner */}
      <Path
        d="M6 2h8l5 5v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corner fold crease */}
      <Path
        d="M14 2v5h5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Musical eighth notes at top */}
      {/* Left note */}
      <Path
        d="M9 10.5a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"
        fill={color}
      />
      <Path
        d="M9 10.5V5.5l4-1.2v5.2"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Connected beam */}
      <Path
        d="M9 5.5l4-1.2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Right notehead */}
      <Path
        d="M13 9.5a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"
        fill={color}
      />
      {/* Additional small floating note on right */}
      <Path
        d="M17 11.5a1 1 0 11-2 0 1 1 0 012 0z"
        fill={color}
      />
      <Path
        d="M17 11.5V7.5c1 0 1.8.8 1.8 1.5"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Lyric lines */}
      <Line
        x1="8"
        y1="14"
        x2="16"
        y2="14"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Line
        x1="8"
        y1="17"
        x2="16"
        y2="17"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="20"
        x2="16"
        y2="20"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
};

/**
 * NotesWithPenIcon - Document with folded corner, horizontal text lines, and a pencil writing on it.
 */
export const NotesWithPenIcon: React.FC<PlayerCustomIconProps> = ({
  size = 22,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {/* Document border with folded corner */}
      <Path
        d="M5 2h9l5 5v14a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fold crease */}
      <Path
        d="M14 2v5h5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Horizontal text lines */}
      <Line
        x1="7"
        y1="8"
        x2="15"
        y2="8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="7"
        y1="11"
        x2="15"
        y2="11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="7"
        y1="14"
        x2="12"
        y2="14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="7"
        y1="17"
        x2="11"
        y2="17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Line
        x1="7"
        y1="20"
        x2="10"
        y2="20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Slanted Pen / Pencil */}
      <G transform="translate(1, 0)">
        {/* Pencil body */}
        <Path
          d="M14.5 18.5l5.2-5.2a1.2 1.2 0 011.7 1.7l-5.2 5.2-2.5.8.8-2.5z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pencil cap divider */}
        <Line
          x1="18.5"
          y1="14.5"
          x2="20.2"
          y2="16.2"
          stroke={color}
          strokeWidth="1.3"
        />
      </G>
    </Svg>
  );
};

/**
 * ConductorGuideIcon - Conductor stick figure with raised baton and floating musical notes.
 */
export const ConductorGuideIcon: React.FC<PlayerCustomIconProps> = ({
  size = 22,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {/* Conductor Head */}
      <Circle
        cx="9"
        cy="5"
        r="2.4"
        stroke={color}
        strokeWidth="1.7"
      />
      {/* Conductor Torso & Left Arm */}
      <Path
        d="M4.5 10.5h2.5l1.5 6.5h3l1.5-6.5h2"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left outstretched hand */}
      <Path
        d="M4.5 10.5c-.8 0-1.2.6-1.2 1.2s.6 1 1.2 1"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Conductor Baton held in right hand pointing up-right */}
      <Line
        x1="14.5"
        y1="11"
        x2="17.5"
        y2="5.5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Legs */}
      <Line
        x1="7.8"
        y1="17"
        x2="7.8"
        y2="23"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Line
        x1="10.8"
        y1="17"
        x2="10.8"
        y2="23"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Floating Musical Notes in air */}
      {/* Top right note */}
      <Path
        d="M20.5 4a.9.9 0 11-1.8 0 .9.9 0 011.8 0z"
        fill={color}
      />
      <Path
        d="M20.5 4V1.8c.8 0 1.5.5 1.5 1.2"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Mid note */}
      <Path
        d="M16 8.5a.9.9 0 11-1.8 0 .9.9 0 011.8 0z"
        fill={color}
      />
      <Path
        d="M16 8.5V6.2c.8 0 1.4.5 1.4 1.1"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Double beamed note on right */}
      <Path
        d="M20 11a.8.8 0 11-1.6 0 .8.8 0 011.6 0z"
        fill={color}
      />
      <Path
        d="M23 10.2a.8.8 0 11-1.6 0 .8.8 0 011.6 0z"
        fill={color}
      />
      <Path
        d="M20 11V7.8l3-.8v3.2"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 7.8l3-.8"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
};

/**
 * MsgPhoneChatIcon - Smartphone with two chat bubbles (one with 3 dots, one with text lines).
 */
export const MsgPhoneChatIcon: React.FC<PlayerCustomIconProps> = ({
  size = 20,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {/* Smartphone frame */}
      <Rect
        x="5.5"
        y="1.5"
        width="13"
        height="21"
        rx="2.5"
        stroke={color}
        strokeWidth="1.6"
      />
      {/* Top speaker line */}
      <Line
        x1="10"
        y1="3.5"
        x2="14"
        y2="3.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Bottom indicator */}
      <Line
        x1="10"
        y1="20.5"
        x2="14"
        y2="20.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Left chat bubble with 3 dots */}
      <Path
        d="M2 6.5A1.5 1.5 0 013.5 5h6A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11H8l-2 2v-2H3.5A1.5 1.5 0 012 9.5v-3z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(20,20,28,0.9)"
      />
      {/* 3 dots */}
      <Circle cx="5" cy="8" r="0.75" fill={color} />
      <Circle cx="6.5" cy="8" r="0.75" fill={color} />
      <Circle cx="8" cy="8" r="0.75" fill={color} />

      {/* Right chat bubble with 2 lines */}
      <Path
        d="M13 10.5a1.5 1.5 0 011.5-1.5h6a1.5 1.5 0 011.5 1.5v3.5a1.5 1.5 0 01-1.5 1.5H18l-2 2v-2h-1.5a1.5 1.5 0 01-1.5-1.5v-3.5z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(20,20,28,0.9)"
      />
      {/* Two horizontal lines */}
      <Line
        x1="15.2"
        y1="12"
        x2="19.8"
        y2="12"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <Line
        x1="15.2"
        y1="14"
        x2="18.5"
        y2="14"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
};

/**
 * ScheduleSIcon - Sleek, modern stylized "S" icon for Schedule.
 */
export const ScheduleSIcon: React.FC<PlayerCustomIconProps> = ({
  size = 22,
  color = '#FFFFFF',
  style,
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      <Path
        d="M17 7.2C16.5 5 14.5 3.5 12 3.5C9 3.5 6.8 5.2 6.8 7.8C6.8 12.2 17.2 11.2 17.2 16.2C17.2 18.8 15 20.5 12 20.5C9 20.5 7.2 19 6.8 16.8"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

