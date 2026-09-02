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
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles?limit=${limit}`),
    directory: (limit = 500) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles?limit=${limit}`),
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
    getSchedule: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/schedule'),
  },

  // ── Song Submissions ──────────────────────────────────────────────────────
  submissions: {
    mine: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/submissions/mine'),
    create: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data: any }>('/submissions', data),
    update: (id: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean; data: any }>(`/submissions/${id}`, data),
    delete: (id: string) =>
      apiClient.delete<{ success: boolean }>(`/submissions/${id}`),
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
    create: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data: any }>('/chats', data),
    getMessages: (chatId: string, limit = 50) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/chats/${chatId}/messages?limit=${limit}`),
    sendMessage: (chatId: string, message: Record<string, any>) =>
      apiClient.post<{ success: boolean; data: any }>(`/chats/${chatId}/messages`, message),
    updateMessage: (chatId: string, messageId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/messages/${messageId}`, data),
    deleteMessage: (chatId: string, messageId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/${chatId}/messages/${messageId}`),
    updateChat: (chatId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}`, data),
    markRead: (chatId: string) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/read`, {}).catch(() => apiClient.post(`/chats/${chatId}/read`, {})),
    archive: (chatId: string, archived: boolean) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/archive`, { archived }),
    leave: (chatId: string, userId?: string) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/leave`, { userId }),
    clearFor: (chatId: string, userId?: string) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}`, { clearFor: userId }),
    clearMessages: (chatId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/${chatId}/messages`),
    acceptRequest: (chatId: string) =>
      apiClient.post<{ success: boolean }>(`/chats/requests/${chatId}/accept`, {}),
    declineRequest: (chatId: string) =>
      apiClient.post<{ success: boolean }>(`/chats/requests/${chatId}/decline`, {}),
    addParticipants: (chatId: string, userIds: string[]) =>
      apiClient.post<{ success: boolean }>(`/chats/${chatId}/participants`, { userIds }),
  },

  // ── Subgroups & Churches ─────────────────────────────────────────────────
  subgroups: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/subgroups'),
    mine: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/subgroups/mine'),
    coordinated: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/subgroups/coordinated'),
    getSongs: (subgroupId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/subgroups/${subgroupId}/songs`),
    getMembers: (subgroupId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/subgroups/${subgroupId}/members`),
    addMember: (data: { subGroupId: string; userId: string; role?: string; addedBy?: string }) =>
      apiClient.post<{ success: boolean }>('/subgroups/members', data),
    removeMember: (subgroupId: string, userId: string) =>
      apiClient.delete<{ success: boolean }>(`/subgroups/members?subGroupId=${subgroupId}&userId=${userId}`),
    update: (subgroupId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/subgroups/${subgroupId}`, data),
    createSong: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data?: any }>('/subgroups/songs', data),
    updateSong: (songId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/subgroups/songs/${songId}`, data),
    deleteSong: (songId: string) =>
      apiClient.delete<{ success: boolean }>(`/subgroups/songs/${songId}`),
    requestJoin: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean }>('/subgroups/requests', data),
    updatePraiseNight: (rehearsalId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/subgroups/praise-nights/${rehearsalId}`, data),
    createPraiseNight: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data?: any }>('/subgroups/praise-nights', data),
    deletePraiseNight: (rehearsalId: string) =>
      apiClient.delete<{ success: boolean }>(`/subgroups/praise-nights/${rehearsalId}`),
    getZoneMembers: (zoneId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/members/zone/${encodeURIComponent(zoneId)}`),
  },

  // ── Organizations & Zones ────────────────────────────────────────────────
  zones: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/organizations'),
    join: (invitationCode: string) =>
      apiClient.post<{ success: boolean; message?: string }>('/members/zone-join', { invitationCode }),
    leave: (membershipId: string) =>
      apiClient.delete<{ success: boolean }>(`/members/zone/${membershipId}`),
  },

  // ── Attendance ───────────────────────────────────────────────────────────
  attendance: {
    checkIn: (data: { location?: any; note?: string }) =>
      apiClient.post<{ success: boolean; data: any }>('/attendance/check-in', data),
    getMyRecords: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/attendance/my-records'),
    clockIn: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data?: any }>('/attendance', data),
  },

  // ── Notifications ────────────────────────────────────────────────────────
  notifications: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/notifications'),
    send: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean }>('/notifications', data),
  },

  // ── Settings (KV Store) ──────────────────────────────────────────────────
  settings: {
    get: (docId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/settings/${docId}`),
  },

  // ── Calls ───────────────────────────────────────────────────────────────
  calls: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/calls'),
    create: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data: any }>('/calls', data),
    update: (callId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/calls/${callId}`, data),
    deleteMany: (ids: string[]) =>
      apiClient.delete<{ success: boolean }>('/calls', { ids }),
    getToken: (room: string, participant: string) =>
      apiClient.get<{ success: boolean; token?: string; [key: string]: any }>(`/livekit-token?room=${encodeURIComponent(room)}&participant=${encodeURIComponent(participant)}`),
  },

  // ── Reports ──────────────────────────────────────────────────────────────
  reports: {
    submit: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean }>('/reports', data),
  },

  // ── Health ───────────────────────────────────────────────────────────────
  health: () =>
    apiClient.get<{ ok: boolean }>('/health').catch(() => null),
};

export default api;
