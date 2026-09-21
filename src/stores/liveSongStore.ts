import { create } from 'zustand';
import { api } from '../services/api';
import { resolveSongAudioUrl, resolveSongAudioUrls } from '../lib/mediaUtils';

export interface LiveSong {
  id: string;
  title: string;
  subtitle?: string;
  leadSinger?: string;
  writer?: string;
  conductor?: string;
  category?: string;
  categories?: string[];
  audioUrl?: string;
  audioUrls?: Record<string, string>;
  lyrics?: string;
  solfa?: string;
  key?: string;
  tempo?: string;
  isActive?: boolean;
  isLive?: boolean;
  status?: string;
  [key: string]: any;
}

interface LiveSongStore {
  activeSongs: LiveSong[];
  isLoading: boolean;
  hasInitialFetched: boolean;
  setActiveSongs: (songs: LiveSong[]) => void;
  handleSongUpdate: (rawUpdate: any) => void;
  removeSong: (songId: string) => void;
  fetchActiveSongs: (zoneId?: string) => Promise<void>;
}

export function isLiveSong(s: any): boolean {
  if (!s || typeof s !== 'object') return false;
  if (isSongExplicitlyOff(s)) return false;

  const status = s.status !== undefined && s.status !== null ? String(s.status).toLowerCase().trim() : '';
  if (status === 'live') {
    if (s.isActive === false || s.is_active === false || s.isLive === false || s.live === false) {
      return false;
    }
    return true;
  }

  const isTruthy = (v: any) =>
    v === true ||
    v === 1 ||
    v === '1' ||
    (typeof v === 'string' && (v.toLowerCase() === 'true' || v.toLowerCase() === 'live'));

  return Boolean(
    isTruthy(s.isLive) ||
    isTruthy(s.live) ||
    isTruthy(s.is_live)
  );
}

export function isSongExplicitlyOff(s: any): boolean {
  if (!s || typeof s !== 'object') return false;
  const status = s.status !== undefined && s.status !== null ? String(s.status).toLowerCase().trim() : '';
  if (
    status === 'inactive' ||
    status === 'ended' ||
    status === 'off' ||
    status === 'stopped' ||
    status === 'heard' ||
    status === 'unheard'
  ) {
    return true;
  }
  const isFalsy = (v: any) =>
    v === false ||
    v === 0 ||
    v === '0' ||
    (typeof v === 'string' && (v.toLowerCase() === 'false' || v.toLowerCase() === 'off' || v.toLowerCase() === 'inactive'));

  if (s.isActive !== undefined && isFalsy(s.isActive)) return true;
  if (s.is_active !== undefined && isFalsy(s.is_active)) return true;
  if (s.active !== undefined && isFalsy(s.active)) return true;
  if (s.isLive !== undefined && isFalsy(s.isLive)) return true;
  if (s.is_live !== undefined && isFalsy(s.is_live)) return true;
  if (s.live !== undefined && isFalsy(s.live)) return true;
  return false;
}

export const useLiveSongStore = create<LiveSongStore>((set, get) => ({
  activeSongs: [],
  isLoading: false,
  hasInitialFetched: false,

  setActiveSongs: (songs: LiveSong[]) => {
    const rawList = Array.isArray(songs) ? songs : [];
    const liveOnly = rawList.filter(isLiveSong);
    if (liveOnly.length === 0) {
      set({ activeSongs: [] });
      return;
    }

    // Sort by latest update so the newest active song is always index 0
    liveOnly.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    set({ activeSongs: liveOnly });
  },

  removeSong: (songId: string) => {
    set((state) => ({
      activeSongs: state.activeSongs.filter((s) => String(s.id) !== String(songId)),
    }));
  },

  handleSongUpdate: (rawUpdate: any) => {
    const update = (rawUpdate as any)?.data || rawUpdate;
    if (!update || typeof update !== 'object') return;
    const songId = update.id;
    if (!songId) return;

    // Check if song is deleted or removed
    if (update.deleted || update.isDeleted || update._action === 'removed') {
      get().removeSong(songId);
      return;
    }

    // If explicitly inactive / off / heard / unheard
    if (isSongExplicitlyOff(update)) {
      get().removeSong(songId);
      return;
    }

    // If song is live / active now
    if (isLiveSong(update)) {
      set((state) => {
        const existingIndex = state.activeSongs.findIndex(
          (s) => String(s.id) === String(songId)
        );
        const resolvedAudioUrl = resolveSongAudioUrl(update);
        const resolvedAudioUrls = resolveSongAudioUrls(update);

        if (existingIndex >= 0) {
          const next = [...state.activeSongs];
          next[existingIndex] = {
            ...next[existingIndex],
            ...update,
            isActive: true,
            isLive: true,
            status: 'live',
            audioUrl: resolvedAudioUrl || next[existingIndex].audioUrl,
            audioUrls:
              resolvedAudioUrls && Object.keys(resolvedAudioUrls).length > 0
                ? resolvedAudioUrls
                : next[existingIndex].audioUrls,
          };
          return { activeSongs: next };
        } else {
          const newSong: LiveSong = {
            id: String(update.id),
            title: update.title || 'Live Rehearsal Song',
            subtitle: update.leadSinger || update.writer || 'Loveworld Singers',
            leadSinger: update.leadSinger || 'Loveworld Singers',
            writer: update.writer || '',
            conductor: update.conductor || '',
            category: update.category || '',
            audioUrl: resolvedAudioUrl,
            audioUrls: resolvedAudioUrls,
            isActive: true,
            isLive: true,
            status: 'live',
            ...update,
          };

          // Retain all other active live songs (do NOT remove other songs in the same program)
          const cleaned = state.activeSongs.filter((s) => {
            if (String(s.id) === String(songId)) return false;
            if (isSongExplicitlyOff(s)) return false;
            return true;
          });

          return { activeSongs: [newSong, ...cleaned] };
        }
      });
    } else {
      // Song is NOT live (e.g. status changed to 'heard', 'unheard', or isActive: false)
      const status = update.status !== undefined && update.status !== null ? String(update.status).toLowerCase().trim() : '';
      if ((status && status !== 'live') || update.isActive === false || update.isLive === false) {
        get().removeSong(songId);
        return;
      }

      // Otherwise if it is a harmless metadata patch (e.g. audioUrl, solfa) without status change, update in-place
      set((state) => {
        const existingIndex = state.activeSongs.findIndex(
          (s) => String(s.id) === String(songId)
        );
        if (existingIndex >= 0) {
          const next = [...state.activeSongs];
          next[existingIndex] = {
            ...next[existingIndex],
            ...update,
          };
          return { activeSongs: next };
        }
        return state;
      });
    }
  },

  fetchActiveSongs: async (zoneId?: string) => {
    try {
      set({ isLoading: true });
      let rawData: any[] = [];
      if (zoneId) {
        const scopedRes = await api.songs.getActiveSongs(zoneId).catch(() => null);
        if (scopedRes?.success && Array.isArray(scopedRes.data)) {
          rawData = scopedRes.data;
        }
      } else {
        const allRes = await api.songs.getActiveSongs().catch(() => null);
        if (allRes?.success && Array.isArray(allRes.data)) {
          rawData = allRes.data;
        }
      }

      const seenIds = new Set<string>();
      const prepped: LiveSong[] = [];

      for (const s of rawData) {
        if (!s || !s.id) continue;
        const idStr = String(s.id);

        if (seenIds.has(idStr)) continue;
        seenIds.add(idStr);

        if (!isSongExplicitlyOff(s) && isLiveSong(s)) {
          const resolvedAudioUrl = resolveSongAudioUrl(s);
          const resolvedAudioUrls = resolveSongAudioUrls(s);
          prepped.push({
            ...s,
            id: idStr,
            isLive: true,
            isActive: true,
            status: 'live',
            audioUrl: resolvedAudioUrl || s.audioUrl,
            audioUrls: resolvedAudioUrls || s.audioUrls,
          });
        }
      }

      if (prepped.length > 0) {
        get().setActiveSongs(prepped);
      } else {
        set({ activeSongs: [] });
      }
      set({ isLoading: false, hasInitialFetched: true });
    } catch (e) {
      set({ isLoading: false, hasInitialFetched: true });
    }
  },
}));
