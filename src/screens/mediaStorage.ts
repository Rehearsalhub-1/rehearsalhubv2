import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchProgressRecord {
  videoId: string;
  positionSeconds: number; // non-negative integer
  durationSeconds: number; // positive integer
  lastWatchedAt: string;   // ISO 8601 UTC
}

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const WATCH_PROGRESS_KEY = '@rh:watch_progress';
const MY_LIST_KEY = '@rh:my_list';

// ─── Pure functions (no I/O) ──────────────────────────────────────────────────

/**
 * Returns a new list with `videoId` added if absent, or removed if present.
 * Pure — no side effects.
 */
export function toggleMyList(currentList: string[], videoId: string): string[] {
  return currentList.includes(videoId)
    ? currentList.filter((id) => id !== videoId)
    : [...currentList, videoId];
}

/**
 * Returns the watch progress as a percentage in [0, 100].
 * Returns 0 when `durationSeconds` is zero or negative.
 */
export function watchProgressPercent(
  positionSeconds: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100));
}

/**
 * Returns true when the video is at least 95% complete.
 * Returns false when `durationSeconds` is zero or negative.
 */
export function isVideoCompleted(
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  if (durationSeconds <= 0) return false;
  return positionSeconds / durationSeconds >= 0.95;
}

/**
 * Returns true when `createdAt` is within the last 7 days relative to `now`.
 * Returns false for undefined or unparseable dates, or future-dated creation times.
 */
export function isNewVideo(
  createdAt: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return false;
  const diffMs = now.getTime() - created.getTime();
  return diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
}

// ─── Async persistence helpers ────────────────────────────────────────────────

/**
 * Loads the persisted watch-progress map from AsyncStorage.
 * Returns an empty object on any failure (parse error, storage error, etc.).
 */
export async function loadWatchProgress(): Promise<Record<string, WatchProgressRecord>> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WatchProgressRecord>) : {};
  } catch {
    return {};
  }
}

/**
 * Merges a new progress record into `existing`, persists it, and returns the
 * updated map. `positionSeconds` is clamped to a non-negative integer;
 * `durationSeconds` is clamped to a positive integer (minimum 1).
 */
export async function saveWatchProgress(
  existing: Record<string, WatchProgressRecord>,
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<Record<string, WatchProgressRecord>> {
  const updated: Record<string, WatchProgressRecord> = {
    ...existing,
    [videoId]: {
      videoId,
      positionSeconds: Math.max(0, Math.round(positionSeconds)),
      durationSeconds: Math.max(1, Math.round(durationSeconds)),
      lastWatchedAt: new Date().toISOString(),
    },
  };
  await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Loads the persisted My List (array of video IDs) from AsyncStorage.
 * Returns an empty array on any failure.
 */
export async function loadMyList(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MY_LIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persists `list` (array of video IDs) to AsyncStorage.
 */
export async function saveMyList(list: string[]): Promise<void> {
  await AsyncStorage.setItem(MY_LIST_KEY, JSON.stringify(list));
}
