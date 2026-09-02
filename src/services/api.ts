import { apiClient } from '../lib/apiClient';

/**
 * ============================================================================
 * Centralized API Service (The Single Hub)
 * All screens connect through this single service — no fragmented calls.
 * ============================================================================
 */

export const api = {
  // ── Auth & Identity ──────────────────────────────────────────────────────
  auth: {
    me: () => apiClient.get<{ success: boolean; data: any }>('/auth/me'),
    login: (identifier: string, password: string) =>
      apiClient.post<{ success: boolean; data: any }>('/auth/login', { identifier, password }),
    logout: (refreshToken?: string) =>
      apiClient.post<{ success: boolean }>('/auth/logout', { refreshToken }),
  },

  // ── Profiles ─────────────────────────────────────────────────────────────
  profiles: {
    get: (userId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/profiles/${userId}`),
    update: (userId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean; data: any }>(`/profiles/${userId}`, data),
    getDirectory: (limit = 200) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles/directory?limit=${limit}`),
  },

  // ── Songs & Master Library ───────────────────────────────────────────────
  songs: {
    getAll: (params?: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/songs${params ? `?${params}` : ''}`),
    getById: (songId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/songs/${songId}`),
    getMasterSongs: (params?: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/master-songs${params ? `?${params}` : ''}`),
    getPraiseNights: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/praise-nights'),
    getPraiseNightSongs: (praiseNightId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/praise-night-songs?praiseNightId=${praiseNightId}`),
  },

  // ── Favorites (Liked Songs) ───────────────────────────────────────────────
  favorites: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/favorites/me'),
    add: (songId: string) =>
      apiClient.post<{ success: boolean; data: any }>('/favorites', { songId }),
    remove: (songId: string) =>
      apiClient.delete<{ success: boolean }>(`/favorites/${songId}`),
  },

  // ── Playlists ────────────────────────────────────────────────────────────
  playlists: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/playlists'),
    getById: (playlistId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/playlists/${playlistId}`),
    create: (data: { name: string; description?: string; isPublic?: boolean }) =>
      apiClient.post<{ success: boolean; data: any }>('/playlists', data),
    update: (playlistId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean; data: any }>(`/playlists/${playlistId}`, data),
    delete: (playlistId: string) =>
      apiClient.delete<{ success: boolean }>(`/playlists/${playlistId}`),
    addSong: (playlistId: string, songId: string) =>
      apiClient.post<{ success: boolean }>(`/playlists/${playlistId}/songs`, { songId }),
    removeSong: (playlistId: string, songId: string) =>
      apiClient.delete<{ success: boolean }>(`/playlists/${playlistId}/songs/${songId}`),
  },

  // ── Chats & Messages ─────────────────────────────────────────────────────
  chats: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/chats'),
    getById: (chatId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/chats/${chatId}`),
    getMessages: (chatId: string, limit = 50) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/chats/${chatId}/messages?limit=${limit}`),
    sendMessage: (chatId: string, message: Record<string, any>) =>
      apiClient.post<{ success: boolean; data: any }>(`/chats/${chatId}/messages`, message),
    markRead: (chatId: string) =>
      apiClient.post<{ success: boolean }>(`/chats/${chatId}/read`, {}),
    clearMessages: (chatId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/${chatId}/messages`),
  },

  // ── Organizations & Zones ────────────────────────────────────────────────
  zones: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/organizations'),
    join: (invitationCode: string) =>
      apiClient.post<{ success: boolean; message?: string }>('/members/zone-join', { invitationCode }),
    getMySubgroups: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/subgroups/mine'),
  },

  // ── Attendance ───────────────────────────────────────────────────────────
  attendance: {
    checkIn: (data: { location?: any; note?: string }) =>
      apiClient.post<{ success: boolean; data: any }>('/attendance/check-in', data),
    getMyRecords: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/attendance/my-records'),
  },
};

export default api;
