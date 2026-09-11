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
  setActiveSongs: (songs: LiveSong[]) => void;
  handleSongUpdate: (rawUpdate: any) => void;
  removeSong: (songId: string) => void;
  fetchActiveSongs: (zoneId?: string) => Promise<void>;
}

export const useLiveSongStore = create<LiveSongStore>((set, get) => ({
  activeSongs: [],
  isLoading: false,

  setActiveSongs: (songs: LiveSong[]) => {
    set({
      activeSongs: Array.isArray(songs)
        ? songs.filter((s) => s && (s.isActive === true || s.isLive === true || s.status === 'live'))
        : [],
    });
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

    // Determine if song is active/live now
    const isActiveField =
      update.isActive !== undefined
        ? update.isActive === true || String(update.isActive) === 'true'
        : undefined;
    const isLiveField =
      update.isLive !== undefined ? Boolean(update.isLive) : undefined;
    const statusField =
      update.status !== undefined ? String(update.status).toLowerCase() : undefined;

    // If explicit inactive / off
    if (isActiveField === false || statusField === 'inactive' || statusField === 'unheard') {
      get().removeSong(songId);
      return;
    }

    // If explicit active / live
    const isLiveNow =
      isActiveField === true || isLiveField === true || statusField === 'live';

    if (isLiveNow) {
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
            category: update.category || 'Live Rehearsal',
            audioUrl: resolvedAudioUrl,
            audioUrls: resolvedAudioUrls,
            isActive: true,
            isLive: true,
            ...update,
          };
          return { activeSongs: [newSong, ...state.activeSongs] };
        }
      });
    } else {
      // Song might already be active and this is a metadata patch (e.g. lyrics updated while live)
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
      const res = await api.songs.getActiveSongs(zoneId);
      if (res?.success && Array.isArray(res.data)) {
        const liveOnly = res.data.filter(
          (s: any) => s && (s.isActive === true || s.isLive === true || s.status === 'live')
        );
        set({ activeSongs: liveOnly, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
    }
  },
}));
