import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const API_KEY = process.env.EXPO_PUBLIC_INTERNAL_API_KEY ?? '';
let deviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  deviceId = await SecureStore.getItemAsync('message_device_id');
  if (!deviceId) {
    deviceId = `mobile-${Math.random().toString(36).slice(2, 14)}`;
    await SecureStore.setItemAsync('message_device_id', deviceId);
  }
  return deviceId;
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

const apiGetCache = new Map<string, any>();

export function clearCache(): void { apiGetCache.clear(); }

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('jwt');
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync('refreshToken');
}

export async function getUserId(): Promise<string | null> {
  return SecureStore.getItemAsync('userId');
}

export async function storeTokens(accessToken: string, refreshToken: string, userId: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync('jwt', accessToken),
    SecureStore.setItemAsync('refreshToken', refreshToken),
    SecureStore.setItemAsync('userId', userId),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync('jwt'),
    SecureStore.deleteItemAsync('refreshToken'),
    SecureStore.deleteItemAsync('userId'),
  ]);
}

async function refreshSession(): Promise<string> {
  const [refreshToken, userId] = await Promise.all([getRefreshToken(), getUserId()]);

  if (!refreshToken || !userId) {
    throw new SessionExpiredError();
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ refreshToken, userId }),
    });

    if (res.status === 401 || res.status === 403) {
      await clearTokens();
      throw new SessionExpiredError();
    }

    if (!res.ok) {
      throw new Error(`Server temporarily unavailable (${res.status})`);
    }

    const body = await res.json();
    if (body?.data?.accessToken) {
      await storeTokens(body.data.accessToken, body.data.refreshToken || refreshToken, userId);
      return body.data.accessToken;
    }
    throw new Error('Invalid refresh response');
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    throw err;
  }
}

// ── TENANT SCOPE STORE ───────────────────────────────────────────────────────
// The useUserStore (Zustand) writes here whenever the user switches zones.
// The request() function reads from here synchronously on every API call.
// This replaces the fragile require()-inside-function pattern.

interface V2TenantScope {
  zoneId: string | null;
  zoneCode: string | null;
  scope: 'global' | 'zone';
}

let _v2TenantScope: V2TenantScope = { zoneId: null, zoneCode: null, scope: 'global' };

export function setV2TenantScope(scope: V2TenantScope): void {
  _v2TenantScope = scope;
}

export function getV2TenantScope(): V2TenantScope {
  return _v2TenantScope;
}
// ────────────────────────────────────────────────────────────────────────────

function ensureMessageId(method: string, path: string, body: unknown): void {
  if (method !== 'POST' || !/^\/(?:chats\/[^/]+\/messages|attendance(?:\/check-in)?)$/.test(path) || !body || typeof body !== 'object') return;
  const messageBody = body as Record<string, unknown>;
  if (typeof messageBody.id === 'string' && messageBody.id.trim()) return;
  const randomUuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  messageBody.id = randomUuid
    ? randomUuid()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
  timeoutMs = 25000,
): Promise<T> {
  ensureMessageId(method, path, body);
  const token = await getAccessToken();
  const requestDeviceId = await getDeviceId();

  // ── TENANT SCOPE HEADERS (synchronous — no async required) ───────────────
  const scope = getV2TenantScope();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
  if (scope.zoneId) {
    headers['x-zone-id'] = scope.zoneId;
  }
  if (scope.zoneCode) {
    headers['x-zone-code'] = scope.zoneCode;
  }
  if (scope.scope) {
    headers['x-scope'] = scope.scope;
  }
  headers['x-device-id'] = requestDeviceId;
  // ─────────────────────────────────────────────────────────────────────────
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Create an AbortController so every fetch has a hard timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    clearTimeout(timeoutId);

    const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/refresh');

    if (res.status === 401 && !isAuthRoute && !retried) {
      try {
        const newToken = await refreshSession();
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);
        const retryRes = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: retryHeaders,
          signal: retryController.signal,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        clearTimeout(retryTimeoutId);
        if (retryRes.status !== 401) {
          let data: any = null;
          const retryText = await retryRes.text();
          if (retryText && retryText.trim().length > 0 && retryText.trim() !== 'undefined') {
            try {
              data = JSON.parse(retryText);
            } catch {
              data = { success: retryRes.ok, data: null };
            }
          } else {
            data = { success: retryRes.ok, data: null };
          }
          if (method === 'GET' && data?.success !== false) {
            apiGetCache.set(path, data);
          }
          return data as T;
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          throw err;
        }
        console.warn(`[apiClient] Refresh attempt failed:`, err);
        throw err;
      }
    }

    let json: any = null;
    const text = await res.text();
    if (text && text.trim().length > 0 && text.trim() !== 'undefined') {
      try {
        json = JSON.parse(text);
      } catch {
        json = { success: res.ok, data: null };
      }
    } else {
      json = { success: res.ok, data: null };
    }

    if (method !== 'GET') {
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || json?.message || `Request failed (${res.status})`;
        console.warn(`[apiClient] ${method} ${path} failed:`, errMsg);
        const err = new Error(errMsg);
        (err as any).status = res.status;
        (err as any).data = json;
        throw err;
      }
      // On any successful write mutation, immediately invalidate the GET cache
      apiGetCache.clear();
    } else if (json?.success !== false && json?.data !== undefined) {
      apiGetCache.set(path, json);
    }
    return json as T;
  } catch (netErr: any) {
    clearTimeout(timeoutId);
    // Surface timeout as a user-friendly error
    if (netErr?.name === 'AbortError') {
      throw new Error('Request timed out. The server took too long to respond. Please try again.');
    }
    if (method === 'GET' && apiGetCache.has(path)) {
      console.warn(`[apiClient] Network drop detected. Serving cached response for ${path}`);
      return apiGetCache.get(path) as T;
    }
    throw netErr;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, timeoutMs?: number) => request<T>('POST', path, body, false, timeoutMs),
  patch: <T>(path: string, body?: unknown, timeoutMs?: number) => request<T>('PATCH', path, body, false, timeoutMs),
  delete: <T>(path: string, body?: unknown, timeoutMs?: number) => request<T>('DELETE', path, body, false, timeoutMs),
  getBaseUrl: () => BASE_URL,
  storeTokens,
  clearTokens,
  /** Call this when the user switches zones. All future requests will carry the correct X-Zone-Id headers. */
  setV2TenantScope,
  getV2TenantScope,
};

export { BASE_URL };
