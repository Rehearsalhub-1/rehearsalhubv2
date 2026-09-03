export interface ChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  senderColor: string;
  type: 'text' | 'image' | 'voice' | 'system' | 'song_share' | 'playlist_share' | 'video' | 'document' | 'group_call' | 'audio' | 'profile_share' | 'contact_share' | 'poll';
  imageUrl: string | null;
  isVoiceNote: boolean;
  isSystem: boolean;
  duration?: string;
  audioUrl: string | null;
  timestampObj: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions: Record<string, string>;
  replyTo: { id: string; text: string; senderName: string; type?: string; imageUrl?: string } | null;
  edited: boolean;
  isDeleted: boolean;
  starred: boolean;
  viewOnce: boolean;
  viewOnceViewed: boolean;
  pinned: boolean;
  waveform?: number[];
  songData?: {
    id: string;
    title: string;
    leadSinger: string;
    program: string;
    key: string;
    tempo: string;
    audioUrl: string;
    collectionName?: string;
    zoneId?: string;
    imageUrl?: string;
  };
  playlistData?: {
    id: string;
    name: string;
    songCount: number;
    songs: Array<{
      id: string;
      title: string;
      leadSinger: string;
      program: string;
      key: string;
      tempo: string;
      audioUrl: string;
      note?: string;
    }>;
  };
  note?: string;
  callType?: 'voice' | 'video';
  callId?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  documentSize?: number;
  profileData?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    zone?: string;
  };
  contactData?: {
    id?: string;
    uid?: string;
    name?: string;
    avatar?: string;
    role?: string;
    zone?: string;
    zoneName?: string;
    displayName?: string;
    email?: string;
    phone?: string;
  };
  pollOptions?: any[];
}

export const SENDER_COLORS_DARK = ['#53bdeb', '#7bc67e', '#fcb97d', '#e06c75', '#c678dd', '#61afef', '#e5c07b', '#98c379'];
export const SENDER_COLORS_LIGHT = ['#0284c7', '#16a34a', '#ea580c', '#dc2626', '#9333ea', '#2563eb', '#ca8a04', '#65a30d'];

export function getSenderColor(uid: string, isLight: boolean = false): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  const colors = isLight ? SENDER_COLORS_LIGHT : SENDER_COLORS_DARK;
  return colors[Math.abs(h) % colors.length];
}

export const isOnlyEmojis = (str?: string | null): boolean => {
  if (!str) return false;
  const clean = str.trim();
  if (!clean || clean.length > 14) return false;
  const stripped = clean.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\uFE0F\u200D\u20E3]/gu, '').trim();
  return stripped.length === 0;
};

export const downsampleWaveform = (data: number[], targetCount: number) => {
  if (!data || data.length === 0) return new Array(targetCount).fill(0);
  if (data.length === targetCount) return data;
  const result = [];
  const step = data.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0, count = 0;
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j];
      count++;
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
};

export function cleanSenderName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  if (parts.length === 4 && 
      parts[0].toLowerCase() === parts[2].toLowerCase() && 
      parts[1].toLowerCase() === parts[3].toLowerCase()) {
    return `${parts[0]} ${parts[1]}`;
  }
  return trimmed;
}

