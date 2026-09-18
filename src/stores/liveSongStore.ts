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
  /** IDs of songs explicitly turned off via WebSocket, with the timestamp they were removed.
   *  Used to prevent stale HTTP fetches from re-adding already-removed songs. */
  recentlyRemovedIds: Map<string, number>;
  setActiveSongs: (songs: LiveSong[]) => void;
  handleSongUpdate: (rawUpdate: any) => void;
  removeSong: (songId: string) => void;
  fetchActiveSongs: (zoneId?: string) => Promise<void>;
}

/** How long (ms) to shield a removed song from HTTP re-addition. */
const REMOVAL_SHIELD_MS = 12_000;

export function isLiveSong(s: any): boolean {
  if (!s || typeof s !== 'object') return false;
  const status = s.status !== undefined && s.status !== null ? String(s.status).toLowerCase().trim() : '';
  if (status === 'live') {
    return true;
  }
  // If status is heard, unheard, or inactive, it is definitively NOT live
  if (
    status === 'heard' ||
    status === 'unheard' ||
    status === 'inactive' ||
    status === 'ended' ||
    status === 'off' ||
    status === 'stopped'
  ) {
    return false;
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
  if (status === 'inactive' || status === 'ended' || status === 'off' || status === 'stopped' || status === 'heard' || status === 'unheard') {
    return true;
  }
  const isFalsy = (v: any) =>
    v === false ||
    v === 0 ||
    v === '0' ||
    (typeof v === 'string' && (v.toLowerCase() === 'false' || v.toLowerCase() === 'off' || v.toLowerCase() === 'inactive'));

  if (s.isLive !== undefined && isFalsy(s.isLive)) return true;
  if (s.live !== undefined && isFalsy(s.live)) return true;
  return false;
}

export const useLiveSongStore = create<LiveSongStore>((set, get) => ({
  activeSongs: [],
  isLoading: false,
  hasInitialFetched: false,
  recentlyRemovedIds: new Map(),

  setActiveSongs: (songs: LiveSong[]) => {
    const rawList = Array.isArray(songs) ? songs : [];
    const liveOnly = rawList.filter(isLiveSong);
    if (liveOnly.length === 0) {
      set({ activeSongs: [] });
      return;
    }

    const { recentlyRemovedIds, activeSongs: current } = get();
    const updatedShields = new Map(recentlyRemovedIds);
    liveOnly.forEach((s) => updatedShields.delete(String(s.id)));

    // Do NOT merge old zombie songs! Incoming list from the server/action is authoritative.
    const validLive = liveOnly.filter((s) => !isRecentlyRemoved(recentlyRemovedIds, String(s.id)));

    // Sort by latest update so the newest active song is always index 0
    validLive.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const currentSig = current.map((s) => `${s.id}-${s.title}`).join('|');
    const newSig = validLive.map((s) => `${s.id}-${s.title}`).join('|');

    if (currentSig !== newSig) {
      set({ activeSongs: validLive, recentlyRemovedIds: updatedShields });
    }
  },

  removeSong: (songId: string) => {
    const { recentlyRemovedIds } = get();
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

    // If explicitly inactive / off
    if (isSongExplicitlyOff(update)) {
      get().removeSong(songId);
      return;
    }

    // If song is live / active now
    if (isLiveSong(update)) {
      // Clear removal shield — song was explicitly activated
      const { recentlyRemovedIds } = get();
      const updatedShields = new Map(recentlyRemovedIds);
      updatedShields.delete(String(songId));

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
          return { activeSongs: next, recentlyRemovedIds: updatedShields };
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
          return { activeSongs: [newSong, ...state.activeSongs], recentlyRemovedIds: updatedShields };
        }
      });
    } else {
      // Song is NOT live (e.g. status changed to 'heard', 'unheard', etc.)
      const status = update.status !== undefined && update.status !== null ? String(update.status).toLowerCase().trim() : '';
      if (status && status !== 'live') {
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

      const { recentlyRemovedIds } = get();
      const seenIds = new Set<string>();
      const prepped: LiveSong[] = [];

      for (const s of rawData) {
        if (!s || !s.id) continue;
        const idStr = String(s.id);

        if (seenIds.has(idStr)) continue;
        seenIds.add(idStr);

        // Any song returned from GET /songs/active is an active live song
        if (!isRecentlyRemoved(recentlyRemovedIds, idStr) && !isSongExplicitlyOff(s)) {
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

/** Returns true if this song ID was removed recently within REMOVAL_SHIELD_MS. */
function isRecentlyRemoved(
  removedMap: Map<string, number>,
  songId: string
): boolean {
  const removedAt = removedMap.get(songId);
  if (!removedAt) return false;
  return Date.now() - removedAt < REMOVAL_SHIELD_MS;
}
