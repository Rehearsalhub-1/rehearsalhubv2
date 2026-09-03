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
      apiClient.post<{ success: boolean; data?: any; error?: string }>('/auth/login', { identifier, password }),
    logout: (refreshToken?: string) =>
      apiClient.post<{ success: boolean }>('/auth/logout', { refreshToken }),
    storeTokens: (accessToken: string, refreshToken: string, userId: string = '') =>
      apiClient.storeTokens(accessToken, refreshToken, userId),
    register: (data: Record<string, any>) =>
      apiClient.post<any>('/auth/register', data),
    kingschatLogin: (data: Record<string, any>) =>
      apiClient.post<any>('/auth/kingschat-login', data),
    sendOtp: (email: string, timeoutMs = 20000) =>
      apiClient.post<{ success: boolean; error?: string }>('/auth/forgot-password/send-otp', { email }, timeoutMs),
    forgotPassword: (email: string) =>
      apiClient.post<{ success: boolean; error?: string }>('/auth/forgot-password', { email }),
    verifyOtp: (email: string, otp: string) =>
      apiClient.post<{ success: boolean; error?: string }>('/auth/forgot-password/verify-otp', { email, otp }),
    resetPassword: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; error?: string }>('/auth/reset-password', data),
  },

  // ── Profiles ─────────────────────────────────────────────────────────────
  profiles: {
    get: (userId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/profiles/${userId}`),
    update: (userId: string, data: Record<string, any>) =>
      apiClient.patch<{ success: boolean; data: any }>(`/profiles/${userId}`, data),
    getDirectory: (limit = 500, search = '') =>
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    directory: (limit = 500, search = '') =>
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    getBirthdays: (zoneId?: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/profiles/birthdays${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ''}`),
  },

  // ── Events & Calendar ────────────────────────────────────────────────────
  events: {
    getUpcoming: (zoneId?: string) =>
      apiClient.get<any>(`/upcoming-events${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ''}`),
  },

  // ── Songs & Master Library ───────────────────────────────────────────────
  songs: {
    getAll: (params?: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/songs${params ? `?${params}` : ''}`),
    getById: (songId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/songs/${songId}`),
    getMaster: () =>
      apiClient.get<any>('/songs/master'),
    getMasterSongs: (params?: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/master-songs${params ? `?${params}` : ''}`),
    getZoneSongs: (zoneId: string) =>
      apiClient.get<any>(`/songs/zone?zoneId=${encodeURIComponent(zoneId)}`),
    getSubgroupSongs: (params: { subGroupId?: string; zoneId?: string }) =>
      apiClient.get<any>(`/songs/subgroup?${params.subGroupId ? `subGroupId=${encodeURIComponent(params.subGroupId)}` : `zoneId=${encodeURIComponent(params.zoneId || '')}`}`),
    importFromMinistered: (songIds: string[]) =>
      apiClient.post<{ success: boolean; message?: string }>('/songs/import-from-ministered', { songIds }),
    getPraiseNights: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/praise-nights'),
    getPraiseNightSongs: (praiseNightId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/praise-night-songs?praiseNightId=${praiseNightId}`),
    getHistory: (songId: string) =>
      apiClient.get<{ success: boolean; data: any[] }>(`/songs/history?songId=${encodeURIComponent(songId)}`),
    getSchedule: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/schedule'),
    getEndpoint: (endpoint: string) =>
      apiClient.get<any>(endpoint),
  },

  // ── Programs & Rehearsals ────────────────────────────────────────────────
  programs: {
    getAll: (zoneId?: string) =>
      apiClient.get<any>(zoneId ? `/programs?zoneId=${encodeURIComponent(zoneId)}` : '/programs'),
    getMemberRehearsals: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/subgroups/member-rehearsals'),
  },

  // ── Categories ───────────────────────────────────────────────────────────
  categories: {
    getPage: (zoneId?: string) =>
      apiClient.get<any>(zoneId ? `/categories/zone-page?zoneId=${encodeURIComponent(zoneId)}` : '/categories/page'),
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
    deleteChat: (chatId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/${chatId}`),
    acceptRequest: (chatId: string) =>
      apiClient.post<{ success: boolean }>(`/chats/requests/${chatId}/accept`, {}),
    declineRequest: (chatId: string) =>
      apiClient.post<{ success: boolean }>(`/chats/requests/${chatId}/decline`, {}),
    addParticipants: (chatId: string, userIds: string[]) =>
      apiClient.post<{ success: boolean }>(`/chats/${chatId}/participants`, { userIds }),
    removeParticipant: (chatId: string, targetUserId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/${chatId}/participants/${targetUserId}`),
    setParticipantRole: (chatId: string, targetUserId: string, role: 'admin' | 'member') =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/participants/${targetUserId}/role`, { role }),
    updateSettings: (chatId: string, settings: Record<string, any>) =>
      apiClient.patch<{ success: boolean }>(`/chats/${chatId}/settings`, settings),
    getBlockedUsers: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/chats/users/blocked'),
    blockUser: (targetUserId: string) =>
      apiClient.post<{ success: boolean }>('/chats/users/block', { targetUserId }),
    unblockUser: (targetUserId: string) =>
      apiClient.delete<{ success: boolean }>(`/chats/users/block/${targetUserId}`),
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
      apiClient.get<{ success: boolean; data: any[] }>('/attendance/mine'),
    clockIn: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean; data?: any }>('/attendance', data),
  },

  // ── Notifications ────────────────────────────────────────────────────────
  notifications: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/notifications'),
    send: (data: Record<string, any>) =>
      apiClient.post<{ success: boolean }>('/notifications', data),
    markRead: (id: string, is_read = true) =>
      apiClient.patch<{ success: boolean }>(`/notifications/${id}`, { is_read }),
    delete: (id: string) =>
      apiClient.delete<{ success: boolean }>(`/notifications/${id}`),
    markAllRead: () =>
      apiClient.patch<{ success: boolean }>('/notifications/read-all', {}),
  },

  // ── Settings (KV Store) ──────────────────────────────────────────────────
  settings: {
    get: (docId: string) =>
      apiClient.get<{ success: boolean; data: any }>(`/settings/${docId}`),
  },

  // ── Media Library ────────────────────────────────────────────────────────
  media: {
    getAll: (zoneId?: string, limit = 50) =>
      apiClient.get<any>(`/media?limit=${limit}${zoneId ? `&zoneId=${encodeURIComponent(zoneId)}` : ''}`),
    getCategories: () =>
      apiClient.get<any>('/media/categories'),
  },

  // ── Lexicon & AI ─────────────────────────────────────────────────────────
  lexicon: {
    chat: (messages: any[]) =>
      apiClient.post<any>('/lexicon/chat', { messages }),
  },

  // ── Links ────────────────────────────────────────────────────────────────
  links: {
    getAll: () =>
      apiClient.get<{ success: boolean; data: any[] }>('/links'),
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

export { clearCache, getAccessToken } from '../lib/apiClient';
export default api;
