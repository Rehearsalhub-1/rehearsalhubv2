import AsyncStorage from '@react-native-async-storage/async-storage';
const CURRENT_SCHEMA_VERSION = 5;
const SCHEMA_KEY = 'app_schema_version';

const CACHE_KEY_PREFIXES = [
  'chat_msgs_',
  'cached_messages_',
  'screen_cache_',
  'MINISTERED_',
  'SEARCH_SONGS_',
  'RESOLVED_TRACKS_',
  'cached_chat_',
  'CACHE_KEY_',
  'user_context_cache_',
];
export async function ensureCacheSchema(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SCHEMA_KEY);
    if (stored === String(CURRENT_SCHEMA_VERSION)) return;

    const allKeys = await AsyncStorage.getAllKeys();
    const staleKeys = allKeys.filter((key) =>
      CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );

    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
    }

    await AsyncStorage.setItem(SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
  } catch (error) {
    console.warn('[ensureCacheSchema] Failed to validate cache schema:', error);
  }
}
