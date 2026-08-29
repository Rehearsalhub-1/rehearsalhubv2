# Technical Design Document — UI-API Alignment

## Overview

This document specifies the exact implementation plan for every gap identified in the `ui-api-alignment` requirements. All changes are incremental — every step leaves the system shippable. No existing endpoints, DB columns, or response shapes are renamed.

The changes span four repos:
- `rehearsalhub-api` — 2 new route files, 1 GET annotation route, 2 registrations in `index.ts`
- `rehearsalhubv2` — 3 file changes (apiClient, useUser, DoodleLayer, SubgroupAdminScreen)
- `rehearsalhub-admin` — 1 hook change + up to 9 screen corrections
- `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode` — 1 file change (api-client.ts)

---

## Architecture Constraints

- Only `rehearsalhub-api` reads/writes the database. Clients communicate over HTTP/WebSocket only.
- All new API routes use `requireAuth` middleware from `src/auth/auth.middleware.ts`.
- New API files are single-responsibility and stay under ~300 lines.
- New dependencies are pinned to exact versions.
- No DB column renames, no API path renames, no response shape changes.

---

## Component Design

### 1. DoodleLayer Annotation Persistence

**Files changed:**
- `rehearsalhub-api/src/routes/writes.routes.ts` — add GET route
- `rehearsalhubv2/src/components/DoodleLayer.tsx` — add load + save

#### 1a. New API route — GET /songs/annotations/:songId

Add to the bottom of `writes.routes.ts` (above the OneSignal route):

```ts
// GET /songs/annotations/:songId — load user's doodle strokes for a song
writesRouter.get('/songs/annotations/:songId', requireAuth, async (req, res) => {
  const { songId } = req.params;
  const auth = res.locals.auth;

  const record = await prisma.mediaDoodle.findFirst({
    where: { songId, userId: auth.userId },
  });

  if (!record) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({ success: true, data: record });
});
```

The existing `PATCH /songs/annotations/:songId` already stores `{ data: { strokes: [...] } }` in `mediaDoodle.data`. The GET returns the same shape — callers read `res.data.data.strokes`.

#### 1b. DoodleLayer changes

Three additions to `DoodleLayer.tsx`:

**1. Import apiClient at the top:**
```ts
import { apiClient } from '../lib/apiClient';
```

**2. Add debounce ref and save function inside the component (before panResponder):**
```ts
const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const scheduleSave = useCallback((strokes: any[]) => {
  if (!activeTrackId) return;
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(async () => {
    try {
      await apiClient.patch(`/songs/annotations/${activeTrackId}`, {
        data: { strokes },
      });
    } catch (e) {
      console.warn('[DoodleLayer] Failed to save annotation:', e);
    }
  }, 500);
}, [activeTrackId]);
```

**3. Add load effect (after the existing annotationTool effect):**
```ts
useEffect(() => {
  if (!activeTrackId) return;
  let active = true;
  (async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(`/songs/annotations/${activeTrackId}`);
      if (!active) return;
      const serverStrokes = res?.data?.data?.strokes;
      if (Array.isArray(serverStrokes) && serverStrokes.length > 0) {
        storeSetStrokes(serverStrokes);
        if (setStrokes) setStrokes(serverStrokes);
      }
    } catch (e) {
      console.warn('[DoodleLayer] Failed to load annotation:', e);
    }
  })();
  return () => { active = false; };
}, [activeTrackId]);
```

**4. In `onPanResponderRelease` — after `storeSetStrokes(updatedStrokes)` call `scheduleSave(updatedStrokes)`:**
```ts
// existing:
storeSetStrokes(updatedStrokes);
if (setStrokes) setStrokes(updatedStrokes);
if (!activeTrackId) return;
// add:
scheduleSave(updatedStrokes);
```

**5. In the eraser path of `onPanResponderGrant` and `onPanResponderMove` — after `storeSetStrokes(otherStrokes)` call `scheduleSave(otherStrokes)`:**
```ts
storeSetStrokes(otherStrokes);
if (setStrokes) setStrokes(otherStrokes);
scheduleSave(otherStrokes); // add this line
```

**6. Clean up timeout on unmount:**
```ts
useEffect(() => {
  return () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  };
}, []);
```

---

### 2. useUser signOut Crash Fix

**Files changed:**
- `rehearsalhubv2/src/lib/apiClient.ts` — add `clearTokens` export
- `rehearsalhubv2/src/hooks/useUser.tsx` — fix signOut

#### 2a. Add clearTokens to apiClient.ts

Add this named export near the bottom of `apiClient.ts`, after `clearCache`:

```ts
import * as SecureStore from 'expo-secure-store';

/**
 * Removes all auth credentials from SecureStore.
 * Must be called on sign-out alongside clearCache().
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync('jwt').catch(() => {}),
    SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
    SecureStore.deleteItemAsync('userId').catch(() => {}),
  ]);
}
```

Note: `expo-secure-store` is already a dependency of `rehearsalhubv2` — no new package needed.

#### 2b. Fix signOut in useUser.tsx

Replace the current `signOut` token-cleanup block:

```ts
// BEFORE (broken):
try {
  const { apiClient, clearTokens } = require('../lib/apiClient');
  const refreshToken = await require('expo-secure-store').getItemAsync('refreshToken');
  if (refreshToken) {
    await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
  }
  await clearTokens();
} catch { }
```

```ts
// AFTER (correct):
try {
  const { apiClient: client, clearTokens: ct, clearCache: cc } = require('../lib/apiClient');
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (refreshToken) {
    await client.post('/auth/logout', { refreshToken }).catch(() => {});
  }
  await ct();
  cc();
} catch (e) {
  console.warn('[useUserStore] signOut cleanup error:', e);
}
```

Then add the store reset (already partially present — verify all fields are reset):

```ts
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
```

`SecureStore` is already imported at the top of `useUser.tsx` — the `require` inside the function was only needed to avoid circular dependencies at module load time. The pattern is preserved; only the destructured name `clearTokens` is corrected.

---

### 3. SubgroupAdminScreen Member Loading

**File changed:** `rehearsalhubv2/src/screens/SubgroupAdminScreen.tsx`

#### 3a. Replace fetchMembers useEffect

```ts
// BEFORE: calls GET /profiles and filters by activeSubgroup.memberIds
useEffect(() => {
  const fetchMembers = async () => {
    if (!activeSubgroup?.memberIds?.length) { ... }
    const profRes = await apiClient.get('/profiles');
    // filters by memberIds...
  };
  fetchMembers();
}, [activeSubgroupId, activeSubgroup?.memberIds]);
```

```ts
// AFTER: calls GET /subgroups/:id/members
useEffect(() => {
  if (!activeSubgroupId) return;
  let active = true;
  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(
        `/subgroups/${activeSubgroupId}/members`
      );
      if (!active) return;
      const fetchedMembers = Array.isArray(res?.data) ? res.data : [];
      setMembers(fetchedMembers);
      setStats(prev => ({ ...prev, recentMembers: fetchedMembers.slice(0, 5) }));
    } catch (e) {
      console.error('[SubgroupAdmin] Failed to load members:', e);
    } finally {
      if (active) setMembersLoading(false);
    }
  };
  fetchMembers();
  return () => { active = false; };
}, [activeSubgroupId]);
```

#### 3b. Replace search modal profile loading

```ts
// BEFORE: calls GET /profiles (full table)
const fetchZoneMembers = async () => {
  const profRes = await apiClient.get('/profiles');
  setZoneMembers(profRes?.data || []);
};
```

```ts
// AFTER: calls GET /members/zone/:zoneId
const fetchZoneMembers = async () => {
  if (!activeSubgroup?.organizationId && !activeSubgroup?.zoneId) return;
  setIsSearching(true);
  try {
    const zoneId = activeSubgroup.organizationId || activeSubgroup.zoneId;
    const res = await apiClient.get<{ success: boolean; data: any[] }>(
      `/members/zone/${encodeURIComponent(zoneId)}`
    );
    setZoneMembers(Array.isArray(res?.data) ? res.data : []);
  } catch (e) {
    console.error('[SubgroupAdmin] Failed to load zone members:', e);
  } finally {
    setIsSearching(false);
  }
};
```

#### 3c. Fix handleAddMember and handleRemoveMember to refresh from server

After successful `POST /subgroups/members`:
```ts
// Replace: setSubgroups(prev => prev.map(sg => sg.id === activeSubgroup.id ? { ...sg, memberIds: [...] } : sg));
// With:
const refreshRes = await apiClient.get<{ success: boolean; data: any[] }>(`/subgroups/${activeSubgroup.id}/members`);
setMembers(Array.isArray(refreshRes?.data) ? refreshRes.data : []);
```

Same pattern after successful `DELETE /subgroups/members`.

---

### 4. Admin WebSocket RESOURCE_ALIASES

**File changed:** `rehearsalhub-admin/src/hooks/useWebSocket.ts`

Full replacement of the module-level section and message/subscription handling. The structure mirrors the Zonal Portal's `useWebSocket.ts` exactly.

Add after imports, before `let socket`:

```ts
const RESOURCE_ALIASES: Record<string, string[]> = {
  chat: ['chats', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt'],
  chats: ['chat', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt'],
  messages: ['chat', 'chats', 'message_reaction', 'message_receipt'],
  call: ['calls', 'incoming_call', 'call_status', 'call_signal'],
  calls: ['call'],
};
const eventCursors = new Map<string, number>();

function matchesResource(subscribedResource: string, incomingResource: string): boolean {
  return subscribedResource === incomingResource ||
    (RESOURCE_ALIASES[subscribedResource] || []).includes(incomingResource);
}
```

Update `socket.onopen` subscription replay:
```ts
socket.onopen = () => {
  reconnectDelay = 1000;
  isConnecting = false;
  subscriptions.forEach(({ resource, id }) => {
    socket?.send(JSON.stringify({
      type: 'subscribe', resource, id,
      since: eventCursors.get(`${resource}:${id}`) || 0,
    }));
    (RESOURCE_ALIASES[resource] || []).forEach(alias => {
      socket?.send(JSON.stringify({
        type: 'subscribe', resource: alias, id,
        since: eventCursors.get(`${alias}:${id}`) || 0,
      }));
    });
  });
};
```

Update `socket.onmessage`:
```ts
socket.onmessage = (e) => {
  let msg: any;
  try { msg = JSON.parse(e.data); } catch { return; }
  if (msg.type !== 'event') return;
  if (Number.isFinite(msg.sequence)) {
    eventCursors.set(`${msg.resource}:${msg.id}`, Number(msg.sequence));
  }
  subscriptions.forEach(({ resource, id, handler }) => {
    if (matchesResource(resource, msg.resource) && id === msg.id) {
      handler(msg.data);
    }
  });
};
```

Update `subscribe` function to also send alias frames:
```ts
function subscribe(resource: string, id: string, handler: EventHandler): () => void {
  if (!subscriptions.some(s => s.resource === resource && s.id === id && s.handler === handler)) {
    subscriptions.push({ resource, id, handler });
  }
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'subscribe', resource, id, since: eventCursors.get(`${resource}:${id}`) || 0 }));
    (RESOURCE_ALIASES[resource] || []).forEach(alias => {
      socket?.send(JSON.stringify({ type: 'subscribe', resource: alias, id, since: eventCursors.get(`${alias}:${id}`) || 0 }));
    });
  } else {
    connect();
  }
  return () => {
    subscriptions = subscriptions.filter(
      s => !(s.resource === resource && s.id === id && s.handler === handler)
    );
    if (!subscriptions.some(s => s.resource === resource && s.id === id) &&
        socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'unsubscribe', resource, id }));
      (RESOURCE_ALIASES[resource] || []).forEach(alias => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'unsubscribe', resource: alias, id }));
        }
      });
    }
  };
}
```

---

### 5. Zonal Portal BackendAPI Delete

**File changed:** `clones/.../src/lib/api-client.ts`

Replace the `delete` function in `BackendAPI.generic`:

```ts
delete: async (collectionName: string, id: string) => {
  const deleteRoutes: Record<string, string> = {
    playlists: '/playlists',
    chats: '/chats',
    chats_v2: '/chats',
    programs: '/programs',
    praise_nights: '/programs',
    submitted_songs: '/submitted-songs',
  };
  const base = deleteRoutes[collectionName];
  if (!base) {
    console.warn(`[BackendAPI] delete(${collectionName}, ${id}) not mapped`);
    return { success: false, error: `Delete not supported for ${collectionName}` };
  }
  return apiClient.delete<ApiEnvelope>(`${base}/${encodeURIComponent(id)}`);
},
```

Also fix the `listCollection` settings path:

```ts
// BEFORE:
settings: '/settings/geofence_hq',

// AFTER:
settings: '/settings',
```

When a specific key is needed, callers should use `getDocument('settings', keyId)` which already maps to `/settings/:id`.

---

### 6. AudioLab API Routes

**New file:** `rehearsalhub-api/src/routes/audiolab.routes.ts`

Since the Prisma `AudioLabProject` and `AudioLabSession` models only have `id` and `rawData`, all business fields are stored in `rawData`. The `userId` is embedded in `rawData` on create.

```ts
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// GET /audiolab/projects
router.get('/projects', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const rows = await prisma.audioLabProject.findMany();
  const owned = rows.filter((r: any) => {
    const raw = r.rawData as Record<string, any> | null;
    return raw?.userId === auth.userId;
  });
  res.json({ success: true, data: owned });
});

// POST /audiolab/projects
router.post('/projects', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const project = await prisma.audioLabProject.create({
    data: {
      id: crypto.randomUUID(),
      rawData: { ...req.body, userId: auth.userId, createdAt: new Date().toISOString() },
    },
  });
  res.status(201).json({ success: true, data: project });
});

// GET /audiolab/projects/:id
router.get('/projects/:id', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const row = await prisma.audioLabProject.findUnique({ where: { id: req.params.id } });
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const raw = row.rawData as Record<string, any> | null;
  if (raw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  res.json({ success: true, data: row });
});

// PATCH /audiolab/projects/:id
router.patch('/projects/:id', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const row = await prisma.audioLabProject.findUnique({ where: { id: req.params.id } });
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const raw = row.rawData as Record<string, any> | null;
  if (raw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  const updated = await prisma.audioLabProject.update({
    where: { id: req.params.id },
    data: { rawData: { ...raw, ...req.body, userId: auth.userId, updatedAt: new Date().toISOString() } },
  });
  res.json({ success: true, data: updated });
});

// DELETE /audiolab/projects/:id
router.delete('/projects/:id', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const row = await prisma.audioLabProject.findUnique({ where: { id: req.params.id } });
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const raw = row.rawData as Record<string, any> | null;
  if (raw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  await prisma.audioLabProject.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// GET /audiolab/projects/:projectId/sessions
router.get('/projects/:projectId/sessions', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const project = await prisma.audioLabProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
  const pRaw = project.rawData as Record<string, any> | null;
  if (pRaw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  const rows = await prisma.audioLabSession.findMany();
  const sessions = rows.filter((s: any) => {
    const r = s.rawData as Record<string, any> | null;
    return r?.projectId === req.params.projectId;
  });
  res.json({ success: true, data: sessions });
});

// POST /audiolab/projects/:projectId/sessions
router.post('/projects/:projectId/sessions', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const project = await prisma.audioLabProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
  const pRaw = project.rawData as Record<string, any> | null;
  if (pRaw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  const session = await prisma.audioLabSession.create({
    data: {
      id: crypto.randomUUID(),
      rawData: { ...req.body, projectId: req.params.projectId, userId: auth.userId, createdAt: new Date().toISOString() },
    },
  });
  res.status(201).json({ success: true, data: session });
});

// PATCH /audiolab/sessions/:sessionId
router.patch('/sessions/:sessionId', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const row = await prisma.audioLabSession.findUnique({ where: { id: req.params.sessionId } });
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const raw = row.rawData as Record<string, any> | null;
  if (raw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  const updated = await prisma.audioLabSession.update({
    where: { id: req.params.sessionId },
    data: { rawData: { ...raw, ...req.body, updatedAt: new Date().toISOString() } },
  });
  res.json({ success: true, data: updated });
});

// DELETE /audiolab/sessions/:sessionId
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  const row = await prisma.audioLabSession.findUnique({ where: { id: req.params.sessionId } });
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const raw = row.rawData as Record<string, any> | null;
  if (raw?.userId !== auth.userId) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
  await prisma.audioLabSession.delete({ where: { id: req.params.sessionId } });
  res.json({ success: true });
});

export default router;
```

Register in `index.ts`:
```ts
import audiolabRouter from './routes/audiolab.routes';
// ... after existing app.use() calls:
app.use('/audiolab', audiolabRouter);
```

---

### 7. Analytics Read Endpoint

**New file:** `rehearsalhub-api/src/routes/analytics.routes.ts`

```ts
import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// GET /analytics/events
router.get('/events', requireAuth, async (req, res) => {
  const auth = res.locals.auth;
  if (auth.role !== 'hq_admin' && auth.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  const rows = await prisma.analyticsEvent.findMany({
    take: limit,
    orderBy: { id: 'desc' },
  });

  // Apply since filter in application layer (model only has rawData + id)
  const filtered = since
    ? rows.filter((r: any) => {
        const raw = r.rawData as Record<string, any> | null;
        return raw?.createdAt && new Date(raw.createdAt) >= since;
      })
    : rows;

  res.json({ success: true, data: filtered, count: filtered.length });
});

export default router;
```

Register in `index.ts`:
```ts
import analyticsRouter from './routes/analytics.routes';
app.use('/analytics', analyticsRouter);
```

---

### 8. Admin Screen Corrections

Each screen is a read-verify-fix pass. Screens confirmed correct need null-guard audits only. Screens with known bad endpoints need direct endpoint replacement.

#### 8a. Known bad endpoints

**AttendanceScreen** — remove calls to:
- `/attendance/code` (does not exist) — remove or stub as TODO
- `/attendance/manual` (does not exist) — replace with `POST /attendance/check-in`
- `DELETE /attendance/:id` (does not exist) — remove delete button until endpoint is built

**MembersScreen** — replace:
- `PATCH /profiles/:userId/role` → `PATCH /members/:userId` (the write endpoint that accepts `{ role }` in body)

#### 8b. Screens needing verification pass

For each of these screens, the task executor will:
1. Read the current file
2. Confirm the endpoint paths match the API
3. Add `Array.isArray(res?.data) ? res.data : []` guards before any `.map()` call
4. Add a `catch` block that sets an error state string rather than letting the error propagate

Screens: `ChurchesScreen`, `SubmittedSongsScreen`, `PraiseNightScreen`, `SupportChatScreen`, `CategoriesScreen`, `MasterLibraryScreen`, `ActivityLogsScreen`, `MoreScreen`.

**NotificationsScreen** — already confirmed correct (DashboardScreen review showed correct pattern). Needs only the `GET /notifications` mount call verified and a null-guard on notifications list rendering.

**AnalyticsScreen** — wire to new `GET /analytics/events` endpoint. Replace current placeholder/empty state with `apiClient.get('/analytics/events')` call on mount and render the `data` array.

---

### 9. Zonal Portal Page Alignment

Beyond the `api-client.ts` changes in section 5, portal pages need the same verification pass:

- `authStore.ts` — confirm `GET /auth/me` is called on rehydration; if `onAuthStateChanged` import remains, remove it
- All pages under `src/app/` — add `Array.isArray(data) ? data : []` guards before list renders
- Settings page — after the `listCollection` path fix, verify the settings page renders correctly

---

## Data Flow

### Annotation Persistence Flow

```
User draws stroke
  → onPanResponderRelease fires
  → storeSetStrokes(updatedStrokes)  [local — immediate]
  → setStrokes(updatedStrokes)       [prop callback — immediate]
  → scheduleSave(updatedStrokes)     [debounced 500ms]
      → apiClient.patch('/songs/annotations/:songId', { data: { strokes } })
          → writes.routes.ts PATCH handler
          → prisma.mediaDoodle.upsert({ songId, userId })
```

### Sign-Out Flow

```
User taps Sign Out
  → signOut() in useUserStore
  → apiClient.post('/auth/logout', { refreshToken }) [try/catch — never throws]
  → await clearTokens()  [SecureStore.deleteItemAsync × 3]
  → clearCache()         [in-memory GET cache flush]
  → set({ user: null, isAuthenticated: false, ... })
  → Navigation to Login screen (handled by App.tsx auth state listener)
```

### Admin WebSocket Event Flow (after fix)

```
Server broadcasts: { type: 'event', resource: 'messages', id: chatId, data: {...} }

Admin app subscribes to: { resource: 'chat', id: chatId }

Before fix: 'messages' !== 'chat' → handler NOT called
After fix:  matchesResource('chat', 'messages')
              → RESOURCE_ALIASES['chat'].includes('messages') = true
              → handler called ✓
```

---

## File Change Map

| File | Repo | Change |
|------|------|--------|
| `src/routes/audiolab.routes.ts` | `rehearsalhub-api` | NEW |
| `src/routes/analytics.routes.ts` | `rehearsalhub-api` | NEW |
| `src/routes/writes.routes.ts` | `rehearsalhub-api` | ADD GET /songs/annotations/:songId |
| `src/index.ts` | `rehearsalhub-api` | MODIFY — register audiolab + analytics routers |
| `src/lib/apiClient.ts` | `rehearsalhubv2` | MODIFY — add clearTokens export |
| `src/hooks/useUser.tsx` | `rehearsalhubv2` | MODIFY — fix signOut token cleanup |
| `src/components/DoodleLayer.tsx` | `rehearsalhubv2` | MODIFY — add load + debounced save |
| `src/screens/SubgroupAdminScreen.tsx` | `rehearsalhubv2` | MODIFY — fix member loading |
| `src/hooks/useWebSocket.ts` | `rehearsalhub-admin` | MODIFY — add RESOURCE_ALIASES + cursors |
| `src/screens/AttendanceScreen.tsx` | `rehearsalhub-admin` | MODIFY — remove phantom endpoints |
| `src/screens/MembersScreen.tsx` | `rehearsalhub-admin` | MODIFY — fix role endpoint |
| `src/screens/AnalyticsScreen.tsx` | `rehearsalhub-admin` | MODIFY — wire to new endpoint |
| `src/screens/ChurchesScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/SubmittedSongsScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/PraiseNightScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/SupportChatScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/CategoriesScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/MasterLibraryScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/ActivityLogsScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/MoreScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/screens/NotificationsScreen.tsx` | `rehearsalhub-admin` | VERIFY + null-guards |
| `src/lib/api-client.ts` | Zonal Portal | MODIFY — fix generic.delete + settings path |

---

## Implementation Sequence

The order respects dependencies — no client change requires an unreleased API change.

1. **API — new routes** (no client dependency)
   - Create `audiolab.routes.ts`
   - Create `analytics.routes.ts`
   - Add GET `/songs/annotations/:songId` to `writes.routes.ts`
   - Register all in `index.ts`

2. **Mobile — apiClient.ts** (prerequisite for useUser fix)
   - Add `clearTokens` export

3. **Mobile — useUser.tsx** (depends on step 2)
   - Fix signOut to use `clearTokens` + `clearCache`

4. **Mobile — DoodleLayer.tsx** (depends on step 1 GET annotation route)
   - Add load effect + debounced save

5. **Mobile — SubgroupAdminScreen.tsx** (independent)
   - Replace member loading with `/subgroups/:id/members`

6. **Admin — useWebSocket.ts** (independent)
   - Add RESOURCE_ALIASES + cursor tracking

7. **Admin — screen corrections** (independent of each other, can be done in parallel)
   - AttendanceScreen, MembersScreen, AnalyticsScreen, then verification passes

8. **Zonal Portal — api-client.ts** (independent)
   - Fix generic.delete routing
   - Fix settings path

---

## Testing Strategy

Each change has a verifiable outcome:

| Change | Verification |
|--------|-------------|
| GET /songs/annotations | `curl -H "Authorization: Bearer $TOKEN" /songs/annotations/:songId` returns 200 |
| clearTokens | After signOut, `SecureStore.getItemAsync('jwt')` returns null |
| DoodleLayer save | Draw stroke → check API server logs for PATCH call |
| DoodleLayer load | Reload screen — server-side strokes appear on canvas |
| SubgroupAdmin members | Members tab shows real member names, not empty |
| Admin WS aliases | Admin chat screen receives 'messages' events |
| BackendAPI delete | Portal delete action reaches API; DB record removed |
| AudioLab routes | POST /audiolab/projects returns 201 with valid project |
| Analytics route | GET /analytics/events returns 200 for hq_admin, 403 for member |
