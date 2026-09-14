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
  /** IDs of songs explicitly turned off via WebSocket, with the timestamp they were removed.
   *  Used to prevent stale HTTP fetches from re-adding already-removed songs. */
  recentlyRemovedIds: Map<string, number>;
  setActiveSongs: (songs: LiveSong[]) => void;
  handleSongUpdate: (rawUpdate: any) => void;
  removeSong: (songId: string) => void;
  fetchActiveSongs: (zoneId?: string) => Promise<void>;
}

/** How long (ms) to shield a removed song from HTTP re-addition. */
const REMOVAL_SHIELD_MS = 30_000;

export const useLiveSongStore = create<LiveSongStore>((set, get) => ({
  activeSongs: [],
  isLoading: false,
  recentlyRemovedIds: new Map(),

  setActiveSongs: (songs: LiveSong[]) => {
    const { recentlyRemovedIds } = get();
    const now = Date.now();

    const liveOnly = Array.isArray(songs)
      ? songs.filter(
          (s) =>
            s &&
            (s.status === 'live' ||
              s.isLive === true ||
              s.isActive === true ||
              String(s.isActive) === 'true') &&
            // Don't re-add songs recently turned off via WebSocket
            !isRecentlyRemoved(recentlyRemovedIds, String(s.id), now)
        )
      : [];

    const current = get().activeSongs;
    const currentSig = current.map((s) => `${s.id}-${s.title}`).join('|');
    const newSig = liveOnly.map((s) => `${s.id}-${s.title}`).join('|');

    if (currentSig !== newSig) {
      set({ activeSongs: liveOnly });
    }
  },

  removeSong: (songId: string) => {
    const { recentlyRemovedIds } = get();
    // Record removal time so HTTP fetches in flight can't re-add this song
    const updated = new Map(recentlyRemovedIds);
    updated.set(String(songId), Date.now());

    set((state) => ({
      activeSongs: state.activeSongs.filter((s) => String(s.id) !== String(songId)),
      recentlyRemovedIds: updated,
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

    // If song is going LIVE, clear any removal shield so it shows up again
    const isLiveNow = isLiveField === true || statusField === 'live';

    if (isLiveNow) {
      // Clear removal shield — song was explicitly re-activated
      const { recentlyRemovedIds } = get();
      if (recentlyRemovedIds.has(String(songId))) {
        const updated = new Map(recentlyRemovedIds);
        updated.delete(String(songId));
        set({ recentlyRemovedIds: updated });
      }

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
            category: update.category || '',
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
      const fetchStartTime = Date.now();
      const res = await api.songs.getActiveSongs(zoneId);
      if (res?.success && Array.isArray(res.data)) {
        // After the await, re-read the current removal shield state
        const { recentlyRemovedIds } = get();

        const liveOnly = res.data.filter(
          (s: any) =>
            s &&
            (s.status === 'live' || s.isLive === true) &&
            // Exclude songs that were turned OFF via WebSocket AFTER this fetch started.
            // This prevents a stale HTTP response from re-showing a song the admin just toggled off.
            !isRecentlyRemoved(recentlyRemovedIds, String(s.id), fetchStartTime)
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

/** Returns true if this song ID was removed AFTER the given reference timestamp. */
function isRecentlyRemoved(
  removedMap: Map<string, number>,
  songId: string,
  sinceTimestamp: number
): boolean {
  const removedAt = removedMap.get(songId);
  if (!removedAt) return false;
  // Shield is active if: removed recently AND the removal happened after the reference time
  const isStillShielded = Date.now() - removedAt < REMOVAL_SHIELD_MS;
  const removedAfterFetchStart = removedAt >= sinceTimestamp;
  return isStillShielded && removedAfterFetchStart;
}
