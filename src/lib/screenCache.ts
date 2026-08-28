
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = 'v1';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — after this, bg refresh always runs

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`screen_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;
    return entry.data;
  } catch {
    return null;
  }
}
export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    await AsyncStorage.setItem(`screen_cache_${key}`, JSON.stringify(entry));
  } catch {
  }
}
export async function isCacheStale(key: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(`screen_cache_${key}`);
    if (!raw) return true;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp > ttlMs;
  } catch {
    return true;
  }
}
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`screen_cache_${key}`);
  } catch {}
}
