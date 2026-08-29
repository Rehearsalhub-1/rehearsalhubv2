# Implementation Plan: UI-API Alignment

## Overview

Incremental fixes across four repos to close every confirmed integration gap between the three client apps and `rehearsalhub-api`. All changes are additive or corrective — no endpoints renamed, no DB columns changed, no response shapes altered. Every task leaves the system in a deployable state.

Implementation sequence follows design doc section "Implementation Sequence":
1. **Group 1 — API changes** (no client dependency — ship these first)
2. **Group 2 — Mobile fixes** (2.1 before 2.2; 2.3 needs 1.1 deployed)
3. **Group 3 — Admin app fixes** (all independent of each other)
4. **Group 4 — Zonal Portal fixes** (independent of all other groups)

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2, 3, 4],
      "description": "Group 1 — API: new route files and registrations. No client dependencies."
    },
    {
      "wave": 2,
      "tasks": [5, 8],
      "description": "Group 2 — Mobile prerequisites: clearTokens export (5) and SubgroupAdminScreen fix (8) are independent of each other and of wave 1 client-side."
    },
    {
      "wave": 3,
      "tasks": [6],
      "description": "Group 2 — Mobile: fix signOut (depends on task 5 clearTokens export)."
    },
    {
      "wave": 4,
      "tasks": [7],
      "description": "Group 2 — Mobile: DoodleLayer annotation persistence (depends on task 1 GET /songs/annotations route)."
    },
    {
      "wave": 5,
      "tasks": [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      "description": "Group 3 — Admin fixes (all independent). Group 4 — Zonal Portal fixes (all independent)."
    }
  ]
}
```

---

## Tasks

### Group 1 — API Changes

- [x] 1. Add GET /songs/annotations/:songId to writes.routes.ts
  - **File:** `rehearsalhub-api/src/routes/writes.routes.ts`
  - Add the GET route handler above the OneSignal route at the bottom of the file. Handler calls `prisma.mediaDoodle.findFirst({ where: { songId, userId: auth.userId } })` and returns `{ success: true, data: record }` (or `data: null` when no record exists). Uses `requireAuth` middleware. Do not touch any existing routes.
  - See design doc section 1a for the exact code block.
  - _Verification: `curl -H "Authorization: Bearer $TOKEN" GET /songs/annotations/:songId` returns HTTP 200; call without token returns HTTP 401. `tsc --noEmit` passes._
  - _Requirements: 1.1, 1.3, 1.7_

- [x] 2. Create rehearsalhub-api/src/routes/audiolab.routes.ts
  - **File:** `rehearsalhub-api/src/routes/audiolab.routes.ts` (new file)
  - Implement all 9 routes exactly as specified in design doc section 6. All routes use `requireAuth`. Ownership enforced by checking `rawData.userId === auth.userId`. Use `crypto.randomUUID()` for IDs on create. POST routes return HTTP 201. 404 and 403 guards on every single-resource route. Export router as default. Keep file under 300 lines.
  - Routes: `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`, `GET /projects/:projectId/sessions`, `POST /projects/:projectId/sessions`, `PATCH /sessions/:sessionId`, `DELETE /sessions/:sessionId`
  - _Verification: `POST /audiolab/projects` with valid JWT returns 201; `GET /audiolab/projects/:id` with another user's JWT returns 403; no token returns 401. `tsc --noEmit` passes._
  - _Requirements: 6.1–6.11_

- [x] 3. Create rehearsalhub-api/src/routes/analytics.routes.ts
  - **File:** `rehearsalhub-api/src/routes/analytics.routes.ts` (new file)
  - Implement single route `GET /events`. Check `auth.role` — only `hq_admin` or `super_admin` may proceed (403 otherwise). Accept optional `?limit=<n>` (default 100, max 500) and `?since=<iso8601>`. Fetch `prisma.analyticsEvent.findMany()` ordered by `id desc`. Apply `since` filter in application code via `rawData.createdAt`. Return `{ success: true, data: filtered, count: filtered.length }`. Export router as default.
  - See design doc section 7 for the exact code block.
  - _Verification: `GET /analytics/events` with `hq_admin` JWT returns 200; with `member` JWT returns 403; without token returns 401; `?limit=5` returns ≤ 5 records. `tsc --noEmit` passes._
  - _Requirements: 7.1–7.5_

- [-] 4. Register audiolab and analytics routers in rehearsalhub-api index.ts
  - **File:** `rehearsalhub-api/src/index.ts`
  - Import `audiolabRouter` from `./routes/audiolab.routes` and `analyticsRouter` from `./routes/analytics.routes`. Register with `app.use('/audiolab', audiolabRouter)` and `app.use('/analytics', analyticsRouter)`. Place alongside existing `app.use()` calls. Do not reorder or touch any other registration.
  - _Verification: `GET /audiolab/projects` and `GET /analytics/events` are reachable (not 404). Existing routes (`GET /auth/me`, `GET /songs/master`) still return correct responses. `tsc --noEmit` passes._
  - _Requirements: 6.1, 7.1_

---

### Group 2 — Mobile Fixes

- [x] 5. Add clearTokens export to rehearsalhubv2/src/lib/apiClient.ts
  - **File:** `rehearsalhubv2/src/lib/apiClient.ts`
  - Add named async export `clearTokens()` after the existing `clearCache` export. Must call `SecureStore.deleteItemAsync` for keys `'jwt'`, `'refreshToken'`, and `'userId'` with `.catch(() => {})` on each so it never throws. `expo-secure-store` is already a dependency — add the import only if not already present. Do not modify `clearCache` or any other existing export.
  - See design doc section 2a for the exact code block.
  - _Verification: `clearTokens` importable as a named export; after calling it `SecureStore.getItemAsync('jwt')` returns null; `clearCache` still works independently. `tsc --noEmit` passes._
  - _Requirements: 2.1, 2.3_

- [-] 6. Fix useUser.tsx signOut to use clearTokens + clearCache correctly
  - **File:** `rehearsalhubv2/src/hooks/useUser.tsx`
  - **Depends on:** Task 5
  - Replace the broken token-cleanup block inside `signOut` with the corrected pattern from design doc section 2b. The corrected block must: (1) retrieve `refreshToken` from `SecureStore` using the already-imported binding; (2) call `client.post('/auth/logout', { refreshToken })` with `.catch(() => {})`; (3) `await ct()` to wipe SecureStore; (4) `cc()` to flush in-memory cache; (5) reset Zustand store to the full unauthenticated initial state (all 10 fields listed in design 2b); (6) wrap entire block in `try/catch` with `console.warn`.
  - _Verification: `signOut()` does not throw; after call `SecureStore.getItemAsync('jwt')` returns null; `useUserStore.getState().isAuthenticated` is false; logout API failure does not block local cleanup. `tsc --noEmit` passes._
  - _Requirements: 2.1–2.5_

- [ ] 7. Add annotation load + debounced save to DoodleLayer.tsx
  - **File:** `rehearsalhubv2/src/components/DoodleLayer.tsx`
  - **Depends on:** Task 1 (GET /songs/annotations/:songId must be deployed)
  - Six targeted additions per design doc section 1b: (1) import `apiClient`; (2) add `saveTimeoutRef` ref and `scheduleSave` callback before the panResponder; (3) add load `useEffect` that calls `GET /songs/annotations/:activeTrackId` on mount/trackId change and calls `storeSetStrokes` if strokes are returned; (4) call `scheduleSave(updatedStrokes)` in `onPanResponderRelease` after `storeSetStrokes`; (5) call `scheduleSave(otherStrokes)` in eraser paths of `onPanResponderGrant` and `onPanResponderMove` after `storeSetStrokes`; (6) cleanup `useEffect` that clears timeout on unmount. All error paths wrapped in try/catch with `console.warn`.
  - _Verification: Drawing a stroke and waiting 500ms produces a PATCH in server logs; reloading screen with known `activeTrackId` restores strokes; API failure does not crash the canvas; null `activeTrackId` produces no API calls. `tsc --noEmit` passes._
  - _Requirements: 1.1–1.7_

- [-] 8. Fix SubgroupAdminScreen member loading
  - **File:** `rehearsalhubv2/src/screens/SubgroupAdminScreen.tsx`
  - Three targeted replacements per design doc section 3: (1) replace `fetchMembers` useEffect — call `GET /subgroups/${activeSubgroupId}/members` instead of `GET /profiles`; include `active` flag, `setMembersLoading`, and error handling; (2) replace `fetchZoneMembers` in search modal to call `GET /members/zone/${encodeURIComponent(zoneId)}` using `activeSubgroup.organizationId || activeSubgroup.zoneId`; (3) after successful `POST /subgroups/members` and after successful `DELETE /subgroups/members`, re-fetch from `GET /subgroups/:id/members` instead of mutating a local `memberIds` array.
  - _Verification: Members tab shows real names from `GET /subgroups/:id/members`; `GET /profiles` is no longer called from this screen; adding a member triggers a re-fetch; null `activeSubgroupId` skips the effect. `tsc --noEmit` passes._
  - _Requirements: 3.1–3.8_

---

### Group 3 — Admin App Fixes

- [-] 9. Update rehearsalhub-admin useWebSocket.ts with RESOURCE_ALIASES and cursor tracking
  - **File:** `rehearsalhub-admin/src/hooks/useWebSocket.ts`
  - Four targeted additions/replacements per design doc section 4: (1) add `RESOURCE_ALIASES` constant (5 entries matching Requirement 4.1 exactly), `eventCursors` Map, and `matchesResource` helper after imports; (2) replace `socket.onopen` to send subscribe frames for canonical resource + all aliases with `since: eventCursors.get(...)` on each; (3) replace `socket.onmessage` to store cursor from `msg.sequence` in `eventCursors` and use `matchesResource` when dispatching; (4) replace `subscribe` function body to send alias frames on subscribe/unsubscribe and include `since` on initial frames.
  - _Verification: Admin chat subscribed to `'chat'` receives `'messages'` events; reconnect subscribe frames include `since`; teardown sends unsubscribe for canonical + aliases; `RESOURCE_ALIASES` matches Zonal Portal's map structurally. `tsc --noEmit` passes._
  - _Requirements: 4.1–4.6_

- [ ] 10. Fix AttendanceScreen — remove phantom endpoints
  - **File:** `rehearsalhub-admin/src/screens/AttendanceScreen.tsx`
  - Read the file first. Then: (1) remove any call to `/attendance/code` — replace with `// TODO: attendance code management not yet implemented`; (2) replace any call to `/attendance/manual` with `apiClient.post('/attendance/check-in', payload)` using fields `{ userId?, eventName, status, checkInTime }`; (3) remove any `apiClient.delete('/attendance/:id')` call and its UI affordance — add `// TODO: delete endpoint not yet built`. Add `Array.isArray(res?.data) ? res.data : []` null-guards before every `.map()` on API response data.
  - _Verification: File contains no calls to `/attendance/code` or `/attendance/manual`; no `delete('/attendance/` call exists; all response `.map()` calls are null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.11, 8.1–8.3_

- [ ] 11. Fix MembersScreen — replace /profiles/:userId/role with /members/:userId
  - **File:** `rehearsalhub-admin/src/screens/MembersScreen.tsx`
  - Read the file first. Replace every `apiClient.patch('/profiles/:userId/role', ...)` call with `apiClient.patch('/members/:userId', { role })`. Add `Array.isArray(res?.data) ? res.data : []` null-guards before every `.map()` on API response data. Do not change any other logic.
  - _Verification: File contains no calls to `/profiles/:userId/role`; role change reaches `PATCH /members/:userId` with `{ role }` in body; all response `.map()` calls are null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.12, 8.1–8.3_

- [ ] 12. Wire AnalyticsScreen to GET /analytics/events
  - **File:** `rehearsalhub-admin/src/screens/AnalyticsScreen.tsx`
  - **Depends on:** Task 3 (GET /analytics/events endpoint must exist)
  - Read the file first. Replace any placeholder or broken call with `apiClient.get('/analytics/events')` in a `useEffect` on mount. Store result in component state initialised to `[]`. Render the `data` array with `Array.isArray` guard. If call returns `{ success: false }` or throws, display a visible error state (inline text or Alert).
  - _Verification: On mount `GET /analytics/events` is called with Bearer token; events render in screen; error response displays error message; data state initialises to `[]`. `tsc --noEmit` passes._
  - _Requirements: 7.6, 7.7, 8.1–8.3_

- [ ] 13. Verify and add null-guards to ChurchesScreen
  - **File:** `rehearsalhub-admin/src/screens/ChurchesScreen.tsx`
  - Read the file. Confirm data-fetching uses `apiClient.get('/subgroups')`; correct if different. Add `Array.isArray(res?.data) ? res.data : []` null-guards before every `.map()` on API response data. Add a `catch` block that sets a visible error state string if one does not already exist. Do not change any other logic.
  - _Verification: Screen calls `GET /subgroups`; no `.map()` directly on `res.data` without `Array.isArray` guard; API failure sets error state that renders. `tsc --noEmit` passes._
  - _Requirements: 8.2, 8.1, 8.3_

- [ ] 14. Verify and add null-guards to SubmittedSongsScreen
  - **File:** `rehearsalhub-admin/src/screens/SubmittedSongsScreen.tsx`
  - Read the file. Confirm data loading uses `apiClient.get('/submitted-songs')`; correct if different. Confirm approve/reject mutations use correct endpoints. Add null-guards before all `.map()` calls on API responses. Add `catch` blocks for errors if missing.
  - _Verification: Screen calls `GET /submitted-songs`; all `.map()` calls are null-guarded; failed API call renders error state. `tsc --noEmit` passes._
  - _Requirements: 8.3, 8.1–8.3_

- [ ] 15. Verify and add null-guards to PraiseNightScreen
  - **File:** `rehearsalhub-admin/src/screens/PraiseNightScreen.tsx`
  - Read the file. Confirm data loading uses `apiClient.get('/programs')` and `apiClient.get('/songs/master')` on mount; correct if different. Confirm create/update/delete calls use `POST /programs`, `PATCH /programs/:id`, `DELETE /programs/:id`. Add null-guards before all `.map()` calls. Add `catch` blocks.
  - _Verification: Screen calls `GET /programs` and `GET /songs/master` on mount; program mutations use correct paths; all `.map()` calls are null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.4, 8.1–8.3_

- [ ] 16. Verify and add null-guards to SupportChatScreen
  - **File:** `rehearsalhub-admin/src/screens/SupportChatScreen.tsx`
  - Read the file. Confirm: ticket list from `GET /support-tickets`; ticket detail from `GET /support-tickets/:id`; messages from `GET /support-tickets/:id/messages`; reply via `POST /support-tickets/:id/messages`; status update via `PATCH /support-tickets/:id`. Correct any that differ. Add null-guards before all `.map()` calls. Add `catch` blocks.
  - _Verification: All five endpoint paths are correct; all `.map()` calls are null-guarded; errors render as visible error state. `tsc --noEmit` passes._
  - _Requirements: 8.5, 8.1–8.3_

- [ ] 17. Verify and add null-guards to CategoriesScreen
  - **File:** `rehearsalhub-admin/src/screens/CategoriesScreen.tsx`
  - Read the file. Confirm `GET /categories` loads list and `POST /categories` creates. Correct if different. Add null-guards before all `.map()` calls. Add `catch` blocks.
  - _Verification: Screen calls `GET /categories` on mount; create calls `POST /categories`; all `.map()` calls are null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.6, 8.1–8.3_

- [ ] 18. Verify and add null-guards to MasterLibraryScreen
  - **File:** `rehearsalhub-admin/src/screens/MasterLibraryScreen.tsx`
  - Read the file. Confirm `GET /songs/master` loads catalogue once on mount. Confirm search/filter is client-side only (no per-keystroke API calls). Add null-guards before all `.map()` calls. Add `catch` blocks.
  - _Verification: Screen calls `GET /songs/master` once on mount; no additional API calls per search keystroke; all `.map()` calls are null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.7, 8.1–8.3_

- [ ] 19. Verify and add null-guards to ActivityLogsScreen
  - **File:** `rehearsalhub-admin/src/screens/ActivityLogsScreen.tsx`
  - Read the file. Confirm `GET /activity-logs` is used. List state must be initialised to `[]`. Add null-guards before all `.map()` calls. Add `catch` blocks.
  - _Verification: Screen calls `GET /activity-logs` on mount; list state initialised to `[]`; non-array `data` field does not crash screen. `tsc --noEmit` passes._
  - _Requirements: 8.8, 8.1–8.3_

- [ ] 20. Verify and add null-guards to MoreScreen
  - **File:** `rehearsalhub-admin/src/screens/MoreScreen.tsx`
  - Read the file. Confirm no hardcoded API base URLs or raw `fetch()` calls. For any data displayed directly (not just nav links), confirm sourced via `apiClient`. Add null-guards for any API response arrays. Add `catch` blocks.
  - _Verification: File contains no hardcoded base URLs or raw `fetch()` calls; any API-sourced data is null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.9, 8.1–8.3_

- [ ] 21. Verify and add null-guards to NotificationsScreen (admin)
  - **File:** `rehearsalhub-admin/src/screens/NotificationsScreen.tsx`
  - Read the file. Confirm `GET /notifications` on mount; `POST /notifications/broadcast` for broadcast; `PATCH /notifications/:id/read` for mark-as-read. Add null-guards before notifications list `.map()`. Add `catch` blocks.
  - _Verification: `GET /notifications` called on mount; broadcast calls `POST /notifications/broadcast`; mark-as-read calls `PATCH /notifications/:id/read`; list is null-guarded. `tsc --noEmit` passes._
  - _Requirements: 8.10, 8.1–8.3_

---

### Group 4 — Zonal Portal Fixes

- [-] 22. Fix BackendAPI.generic.delete routing in api-client.ts
  - **File:** `clones/Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode/src/lib/api-client.ts`
  - Replace the stub `generic.delete` (which unconditionally returns `{ success: false, error: 'Delete not available' }`) with the route-map pattern from design doc section 5. Define a `deleteRoutes` map: `playlists → /playlists`, `chats → /chats`, `chats_v2 → /chats`, `programs → /programs`, `praise_nights → /programs`, `submitted_songs → /submitted-songs`. If `collectionName` is not in the map, log a warning and return `{ success: false, error: 'Delete not supported for <collectionName>' }`. If found, call `apiClient.delete<ApiEnvelope>(\`${base}/${encodeURIComponent(id)}\`)` and return the result. Do not change any other methods.
  - _Verification: `BackendAPI.generic.delete('playlists', id)` reaches `DELETE /playlists/:id` and removes the DB record; `delete('chats', id)` reaches `DELETE /chats/:id`; `delete('unknown', id)` returns `{ success: false, ... }` without throwing. TypeScript build passes._
  - _Requirements: 5.1–5.6_

- [ ] 23. Fix listCollection settings path from hardcoded /settings/geofence_hq to /settings
  - **File:** `clones/Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode/src/lib/api-client.ts`
  - In the `listCollection` path map, find the entry that hardcodes `/settings/geofence_hq` for the `'settings'` collection. Replace it with `/settings`. Add a comment: `// Use getDocument('settings', keyId) for a specific key — maps to GET /settings/:id`. Do not change `getDocument`.
  - _Verification: `listCollection('settings')` calls `GET /settings` and returns all settings rows; `getDocument('settings', 'geofence_hq')` still calls `GET /settings/geofence_hq`; the string `/settings/geofence_hq` no longer appears in the listCollection path map. TypeScript build passes._
  - _Requirements: 9.2, 9.1_

---

## Notes

- **Never assume — verify.** Read each target file before editing it. The task descriptions state the intended change; if the file already implements the change correctly, mark the task complete without edits.
- **Do not touch unrelated code.** Each task targets a specific file and specific lines. Do not clean up surrounding code, rename symbols, or reformat files.
- **Build verification after every task.** Run `tsc --noEmit` in the affected repo before marking a task complete. For `rehearsalhub-api`, also run `npm run build` if a build script exists.
- **Group 3 tasks 13–21 are verification-first.** Read the file, confirm the endpoint paths, then add null-guards only if missing. If the file is already correct, the task is a no-op — that is a valid outcome.
- **Pin any new dependencies** to exact versions. No range specifiers.
