import { create } from 'zustand';
import { OneSignal } from 'react-native-onesignal';
import { Zone, isHQGroup } from '../config/zones';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { joinZoneChatRoom } from '../lib/zoneChat';
import { clearCache, setV2TenantScope } from '../lib/apiClient';
import { useShallow } from 'zustand/react/shallow';
import * as SecureStore from 'expo-secure-store';

export interface UserProfile {
  uid: string;
  username?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  birthday: string;
  region: string;
  zoneCode: string;
  church: string;
  kingschatId: string;
  designation: string;
  administration: string;
  avatar: string;
  role: string;
  hasHqAccess: boolean;
  canAccessArchive: boolean;
  canAccessPreRehearsal: boolean;
  isZoneCoordinator: boolean;
  hiddenFeatures: Record<string, boolean>;
  rehearsalCount: number;
  expoPushToken?: string;
  zoneId?: string;
  zoneName?: string;

  raw: Record<string, any>;
}

function checkPremium(
  hasHqAccess: boolean,
  currentZoneId: string | undefined,
  role: string | undefined,
  administration: string | undefined,
  subDoc: any
): boolean {
  if (role === 'boss' || administration === 'Boss') return true;
  if (currentZoneId && isHQGroup(currentZoneId)) return true;
  if (hasHqAccess) return true;

  if (subDoc && subDoc.status === 'active') {
    if (!subDoc.expiresAt) return true;
    return new Date(subDoc.expiresAt) > new Date();
  }
  return false;
}

interface UserStore {

  user: { uid: string; email: string | null } | null;
  isAuthenticated: boolean;

  profile: UserProfile | null;
  isProfileLoading: boolean;

  currentZone: Zone | null;
  userZones: Zone[];
  isZoneLoading: boolean;
  isHQ: boolean;
  zoneVersion: number;

  subscription: { status: string; expiresAt: string | null } | null;
  isPremium: boolean;

  switchZone: (zone: Zone) => Promise<boolean>;
  joinZone: (code: string) => Promise<{ success: boolean; message: string }>;
  refreshZones: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;

  _initialize: () => () => void;
}

function parseProfile(uid: string, rawInput: Record<string, any>): UserProfile {
  let rawData = rawInput.rawData || rawInput.raw_data || {};
  if (typeof rawData === 'string') {
    try { rawData = JSON.parse(rawData); } catch (e) {}
  }
  const d = { ...rawInput, ...rawData };
  const hiddenFeatures = (d.hidden_features || d.hiddenFeatures || {}) as Record<string, boolean>;
  const role = d.role || 'member';
  const isCoordinator = ['zone_admin', 'coordinator', 'admin', 'hq_admin', 'boss'].includes(role.toLowerCase());
  
  return {
    uid,
    username: d.username || d.user_name || d.alias || '',
    firstName: d.first_name || d.firstName || '',
    middleName: d.middle_name || d.middleName || '',
    lastName: d.last_name || d.lastName || '',
    email: d.email || '',
    phoneNumber: d.phone_number || d.phoneNumber || '',
    gender: d.gender || '',
    birthday: d.birthday || '',
    region: d.region || '',
    zoneCode: d.zone_code || d.zone || '',
    church: d.church || '',
    kingschatId: d.kingschat_id || d.kingschatId || '',
    designation: d.designation || '',
    administration: d.administration || '',
    avatar: d.profile_image_url || d.avatar_url || d.photoURL || d.avatar || d.avatarUrl || '',
    role,
    hasHqAccess: !!(d.has_hq_access || d.hasHqAccess),
    canAccessArchive: !!(d.can_access_archive || d.canAccessArchive || d.canSeeArchive),
    canAccessPreRehearsal: !!(d.can_access_pre_rehearsal || d.canAccessPreRehearsal),
    isZoneCoordinator: isCoordinator,
    hiddenFeatures,
    rehearsalCount: d.rehearsalCount || 0,
    expoPushToken: d.expoPushToken || d.expo_push_token || '',
    zoneId: d.zone_id || d.zoneId || d.zone_code || d.zoneCode || '',
    zoneName: d.zone_name || d.zoneName || '',
    raw: rawInput,
  };
}

let profileUnsub: (() => void) | null = null;
let subscriptionUnsub: (() => void) | null = null;
let loadedForUser: string | null = null;

async function loadZoneMemberships(
  userId: string,
  profileData: Record<string, any>,
  resolvedCurrentZone: Zone | null
) {
  useUserStore.setState({ isZoneLoading: true });
  try {
    const { apiClient } = require('../lib/apiClient');

    const result = await apiClient.get('/members/mine');
    
    let allMemberships: any[] = [];
    if (result.success && result.data) {
      allMemberships = [
        ...(result.data.zoneMembers || []),
        ...(result.data.hqMembers || [])
      ];
    }


    // Fetch all zones from DB to resolve membership zone details
    let dbZones: Zone[] = [];
    try {
      const zonesRes = await apiClient.get('/organizations');
      if (zonesRes.success && Array.isArray(zonesRes.data)) dbZones = zonesRes.data;
    } catch {}

    const zones: Zone[] = [];
    for (const mem of allMemberships) {
      const zId = mem.zoneId || mem.hqGroupId;
      if (zId) {
        const zoneConfig = dbZones.find((z: Zone) => z.id === zId || z.invitationCode === zId) ||
          ({ id: zId, name: mem.zoneName || mem.hqGroupName || zId, invitationCode: zId } as Zone);
        if (!zones.some(z => z.id === zoneConfig.id)) {
          zones.push({
            ...zoneConfig,
            membershipId: mem.id,
            role: mem.role || 'member'
          } as Zone & { membershipId?: string; role?: string });
        }
      }
    }

    if (!resolvedCurrentZone && zones.length > 0) {
      resolvedCurrentZone = zones[0];
      useUserStore.setState({ currentZone: zones[0] });
    }

    if (resolvedCurrentZone && !zones.some(z => z.id === resolvedCurrentZone!.id)) {
      zones.push(resolvedCurrentZone);
    }

    // Seed the API client scope store so every future request carries the correct zone headers
    if (resolvedCurrentZone) {
      setV2TenantScope({
        zoneId: resolvedCurrentZone.id,
        zoneCode: resolvedCurrentZone.invitationCode,
        scope: 'zone',
      });
    }

    useUserStore.setState({ userZones: zones });
  } catch (e: any) {
    console.warn('[useUserStore] Failed to load zone memberships:', e);
  } finally {
    useUserStore.setState({ isZoneLoading: false });
  }
}

function persistCache() {
  const { user, profile, currentZone, userZones } = useUserStore.getState();
  if (!user?.uid || !profile) return;
  AsyncStorage.setItem(
    `user_context_cache_${user.uid}`,
    JSON.stringify({ profile, currentZone, userZones })
  ).catch(() => {});
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  profile: null,
  isProfileLoading: true,
  currentZone: null,
  userZones: [],
  isZoneLoading: true,
  isHQ: false,
  zoneVersion: 0,
  subscription: null,
  isPremium: false,

  _initialize: () => {

    const init = async () => {
      const jwt = await SecureStore.getItemAsync('jwt');
      const userId = await SecureStore.getItemAsync('userId');

      if (!jwt || !userId) {

        try { OneSignal.logout(); } catch {}
        clearCache();
        set({
          user: null, isAuthenticated: false,
          profile: null, isProfileLoading: false,
          currentZone: null, userZones: [], isZoneLoading: false,
          isHQ: false, zoneVersion: 0,
          subscription: null, isPremium: false,
        });
        return;
      }

      const uid = userId;
      set({ user: { uid, email: null }, isAuthenticated: true });

      try {
        OneSignal.login(uid);

        setTimeout(async () => {
          try {
            const subId = await OneSignal.User.pushSubscription.getIdAsync();
            if (subId) {
              const { apiClient } = require('../lib/apiClient');
              await apiClient.patch(`/profiles/${uid}/onesignal`, { subscription_id: subId }).catch(() => {});
            } else {
              console.warn('[OneSignal DEBUG] Subscription ID is null/undefined â€” notifications will NOT work');
            }
          } catch (e) {
            console.warn('[OneSignal] Could not save subscription ID:', e);
          }
        }, 3000);
      } catch (err) {
        console.warn('OneSignal login failed', err);
      }

      try {
        const cached = await AsyncStorage.getItem(`user_context_cache_${uid}`);
        if (cached) {
          const { profile: cProfile, currentZone: cZone, userZones: cZones } = JSON.parse(cached);
          set({
            ...(cProfile ? { profile: cProfile } : {}),
            ...(cZone ? { currentZone: cZone, isHQ: isHQGroup(cZone.id) } : {}),
            ...(cZones?.length ? { userZones: cZones } : {}),
            isProfileLoading: false,
            isZoneLoading: false,
          });
        }
      } catch {}
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }

      const fetchAndApplyProfile = async () => {
        try {
          const { apiClient } = require('../lib/apiClient');
          const result = await apiClient.get(`/profiles/${uid}`);
          if (!result.success || !result.data) {
            set({ isProfileLoading: false, isZoneLoading: false });
            return;
          }

          const data = result.data;
          const parsed = parseProfile(uid, data);
          const { currentZone, subscription } = get();
          const isPrem = checkPremium(
            parsed.hasHqAccess,
            currentZone?.id,
            parsed.role,
            parsed.administration,
            subscription
          );
          set({ profile: parsed, isProfileLoading: false, isPremium: isPrem });
          set({ user: { uid, email: data.email || null } });

          const zoneCode = data.zone_code || '';
          const resolved = getZoneByInvitationCode(zoneCode);
          if (resolved) {
            const prev = get().currentZone;
            if (prev?.id !== resolved.id) {
              const nextPremium = checkPremium(
                parsed.hasHqAccess,
                resolved.id,
                parsed.role,
                parsed.administration,
                subscription
              );
              set(s => ({
                currentZone: resolved,
                isHQ: isHQGroup(resolved.id),
                zoneVersion: s.zoneVersion + 1,
                isPremium: nextPremium
              }));
            }
          }

          if (loadedForUser !== uid) {
            loadedForUser = uid;
            await loadZoneMemberships(uid, data, resolved || null);
          } else if (resolved) {
            const { userZones } = get();
            if (!userZones.some(z => z.id === resolved.id)) {
              set({ userZones: [...userZones, resolved] });
            }
          }

          persistCache();
        } catch (err) {
          console.warn('[useUserStore] profile fetch error:', err);
          set({ isProfileLoading: false, isZoneLoading: false });
        }
      };

      await fetchAndApplyProfile();
      if (subscriptionUnsub) { subscriptionUnsub(); subscriptionUnsub = null; }

      try {
        const { apiClient } = require('../lib/apiClient');
        const subResult = await apiClient.get(`/subscriptions/${uid}`);
        const subData = subResult.success ? subResult.data : null;
        const { profile, currentZone } = get();
        const isPrem = checkPremium(
          profile?.hasHqAccess || false,
          currentZone?.id,
          profile?.role,
          profile?.administration,
          subData
        );
        set({
          subscription: subData ? {
            status: subData.status,
            expiresAt: subData.expiresAt || null
          } : null,
          isPremium: isPrem
        });
      } catch (err) {
        console.warn('[useUserStore] subscription fetch error:', err);
      }
    };

    init();

    return () => {
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (subscriptionUnsub) { subscriptionUnsub(); subscriptionUnsub = null; }
    };
  },

  switchZone: async (zone) => {
    const { user, profile } = get();
    if (!user?.uid) return false;
    try {
      const { apiClient } = require('../lib/apiClient');
      await apiClient.patch(`/profiles/${user.uid}`, { zone_code: zone.invitationCode });
      set(s => ({ currentZone: zone, isHQ: isHQGroup(zone.id), zoneVersion: s.zoneVersion + 1 }));
      clearCache();

      // ── Update scope store so all future requests carry correct X-Zone-Id headers
      setV2TenantScope({
        zoneId: zone.id,
        zoneCode: zone.invitationCode,
        scope: 'zone',
      });

      try {
        const userName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || 'Member' : 'Member';
        await joinZoneChatRoom(user.uid, zone.invitationCode, userName, profile?.avatar || '');
      } catch {}

      persistCache();
      return true;
    } catch (e) {
      console.error('[useUserStore] Failed to switch zone:', e);
      return false;
    }
  },

  refreshZones: async () => {
    const { user, currentZone } = get();
    if (!user?.uid) return;
    loadedForUser = null;
    try {
      const { apiClient } = require('../lib/apiClient');
      const result = await apiClient.get(`/profiles/${user.uid}`);
      if (result.success && result.data) {
        const parsed = parseProfile(user.uid, result.data);
        set({ profile: parsed });
        const resolved = getZoneByInvitationCode(result.data.zone_code || '');
        await loadZoneMemberships(user.uid, result.data, resolved || currentZone);
        persistCache();
      }
    } catch (e) {
      console.error('[useUserStore] Failed to refresh zones:', e);
    }
  },

  refreshProfile: async () => {
    await get().refreshZones();
  },

  joinZone: async (code) => {
    const { user, profile, userZones, refreshZones } = get();
    if (!user?.uid) return { success: false, message: 'Not logged in' };

    try {
      const zone = getZoneByInvitationCode(code);
      if (!zone) return { success: false, message: 'Invalid invitation code.' };
      if (userZones.some(z => z.id === zone.id)) {
        return { success: true, message: `You are already a member of ${zone.name}.` };
      }

      const userName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || 'Member' : 'Member';
      const userEmail = profile?.email || '';
      const isHQ = isHQGroup(zone.id);

      const { apiClient } = require('../lib/apiClient');
      await apiClient.post('/members/zone-join', {
        zone_id: zone.id,
        is_hq: isHQ,
        user_email: userEmail,
        user_name: userName,
      });

      await joinZoneChatRoom(user.uid, zone.invitationCode, userName);
      await refreshZones();
      return { success: true, message: `Welcome to ${zone.name}!` };
    } catch (e) {
      console.error('[useUserStore] Failed to join zone:', e);
      return { success: false, message: 'Failed to join zone. Please try again.' };
    }
  },

  signOut: async () => {
    const { user } = get();
    try {
      if (user?.uid) {
        try {
          const { apiClient } = require('../lib/apiClient');
          await apiClient.patch(`/profiles/${user.uid}`, {
            current_device_id: '',
          }).catch(() => {});
        } catch {}

        await AsyncStorage.removeItem(`user_context_cache_${user.uid}`);
      }

      // 1. Tell the server to revoke the refresh token (best-effort)
      try {
        const { apiClient } = require('../lib/apiClient');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (refreshToken) {
          await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
        }
      } catch {}

      // 2. Wipe credentials from SecureStore
      try {
        const { clearTokens: ct } = require('../lib/apiClient');
        await ct();
      } catch {}

      // 3. Flush in-memory GET cache
      clearCache();

      // 4. Reset Zustand store to unauthenticated state
      set({
        user: null,
        isAuthenticated: false,
        profile: null,
        isProfileLoading: false,
        currentZone: null,
        userZones: [],
        isZoneLoading: false,
        isHQ: false,
        zoneVersion: 0,
        subscription: null,
        isPremium: false,
      });

      try { OneSignal.logout(); } catch {}
    } catch (e) {
      console.error('[useUserStore] Sign out error:', e);
    }
  },
}));



export function useUser() {
  return useUserStore();
}

export function useZone() {
  return useUserStore(useShallow(s => ({
    currentZone: s.currentZone,
    userZones: s.userZones,
    isLoading: s.isZoneLoading,
    isHQ: s.isHQ,
    zoneVersion: s.zoneVersion,
    switchZone: s.switchZone,
    refreshZones: s.refreshZones,
    joinZone: s.joinZone,
  })));
}



let _cleanup: (() => void) | null = null;

export function initializeUserStore() {
  if (_cleanup) return; // Already initialized
  _cleanup = useUserStore.getState()._initialize();
}

/**
 * Called after login — resets state and re-runs the full init flow
 * so Settings screen shows the correct profile immediately after login.
 */
export function reinitializeUserStore() {
  loadedForUser = null; // Reset deduplication guard
  useUserStore.setState({
    user: null, isAuthenticated: false, profile: null, isProfileLoading: true,
    currentZone: null, userZones: [], isZoneLoading: true, isHQ: false,
    zoneVersion: 0, subscription: null, isPremium: false,
  });
  useUserStore.getState()._initialize();
}
