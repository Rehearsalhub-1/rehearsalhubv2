/**
 * Pure utility functions shared across Rehearsal components.
 * Extracted from RehearsalScreen.tsx — no JSX, no hooks.
 */

export const isInvalidUserCategory = (cat: string): boolean => {
  if (!cat || typeof cat !== 'string' || !cat.trim()) return true;
  const lower = cat.trim().toLowerCase();
  return lower === 'worship' || lower === 'praise night' || lower === 'uncategorized' || lower === 'none';
};

export const songBelongsToCategory = (song: any, targetCategory: string): boolean => {
  if (song.categories && Array.isArray(song.categories) && song.categories.length > 0) {
    return song.categories.some((cat: string) => cat.trim() === targetCategory.trim());
  }
  return (song.category || '').trim() === targetCategory.trim();
};

export const isSongHeard = (s: any): boolean => {
  if (!s) return false;
  if (s.isHeard === true || s.is_heard === true || s.heard === true) return true;
  if (s.isHeard === false || s.is_heard === false || s.heard === false) return false;
  const status = (s.status || '').toLowerCase().trim();
  if (status === 'heard') return true;
  if (status === 'unheard') return false;
  const audioUrls = s.audioUrls || s.audio_urls;
  if (audioUrls?._isHeard === true || audioUrls?._preLiveStatus === 'heard') return true;
  if (audioUrls?._isHeard === false || audioUrls?._preLiveStatus === 'unheard') return false;
  if (s._preLiveStatus === 'heard') return true;
  if (s._preLiveStatus === 'unheard') return false;
  return false;
};

export const getTrackImage = (track: any, _index?: number): any => {
  if (track?.imageUrl && typeof track.imageUrl === 'string' && track.imageUrl.startsWith('http')) {
    return { uri: track.imageUrl };
  }
  return null;
};

export const getRehearsalCount = (song: any): number => {
  const raw = song?.raw || song;
  const value =
    song?.rehearsalCount ??
    song?.rehearsal_count ??
    raw.rehearsalCount ??
    raw.rehearsal_count ??
    raw.metadata?.rehearsalCount;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};
