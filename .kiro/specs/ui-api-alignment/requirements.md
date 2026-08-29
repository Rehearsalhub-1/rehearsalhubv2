# Requirements Document

## Introduction

The RehearsalHub platform spans four repositories: **rehearsalhub-api** (Node.js/Express + PostgreSQL, source of truth), **rehearsalhubv2** (Expo/React Native mobile app), **rehearsalhub-admin** (Expo/React Native admin app), and **Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode** (Next.js zonal web portal). The API has been tested and passes all tests.

This feature, **ui-api-alignment**, fixes every confirmed integration gap between the three client apps and the API. All gaps were identified by direct code inspection. The scope covers:

1. Persisting doodle annotations from `DoodleLayer` to the server
2. Fixing a runtime crash in `useUser.tsx` `signOut` caused by a non-existent named export
3. Replacing illegal full-table scans in `SubgroupAdminScreen` member loading with the correct subgroup-scoped endpoint
4. Adding `RESOURCE_ALIASES` to `rehearsalhub-admin`'s WebSocket hook so chat events are not silently dropped
5. Fixing the `BackendAPI.generic.delete` stub in the Zonal Portal that unconditionally returns a failure
6. Implementing `AudioLab` API routes (models exist in Prisma; no routes exist)
7. Implementing an `Analytics` read endpoint (model exists; no route exists)
8. Verifying and correcting every unverified admin screen in `rehearsalhub-admin`
9. Verifying and correcting all page-level components in the Zonal Portal

---

## Glossary

- **API** — `rehearsalhub-api`, the Node.js/Express backend. The only component that holds `DATABASE_URL`.
- **Mobile App** — `rehearsalhubv2`, the Expo/React Native app for choir members.
- **Admin App** — `rehearsalhub-admin`, the Expo/React Native app for zone coordinators and HQ admins.
- **Zonal Portal** — `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode`, the Next.js web portal.
- **apiClient** — The typed HTTP client present in every client repo. Attaches `Authorization: Bearer <jwt>` automatically.
- **BackendAPI** — The Firestore-compatibility façade in the Zonal Portal (`src/lib/api-client.ts`) that wraps `apiClient`.
- **DoodleLayer** — `rehearsalhubv2/src/components/DoodleLayer.tsx`. Renders SVG annotation strokes during live rehearsal.
- **MediaDoodle** — Prisma model (`media_doodles` table) that stores per-user, per-song annotation data as JSON.
- **useUser** — Zustand store in `rehearsalhubv2/src/hooks/useUser.tsx`. Manages auth state.
- **clearTokens** — Named export from `rehearsalhubv2/src/lib/apiClient.ts` that deletes `jwt`, `refreshToken`, and `userId` from SecureStore.
- **clearCache** — Named export from `rehearsalhubv2/src/lib/apiClient.ts` that clears the in-memory GET cache. `clearTokens` and `clearCache` are **not** the same function.
- **RESOURCE_ALIASES** — A map in a WebSocket hook that allows a subscription to a canonical resource name (e.g. `chat`) to also receive events broadcast under alias names (e.g. `messages`, `chat_deleted`).
- **Organization** — A choir zone or HQ group. Maps to the `zones` table in Prisma.
- **Subgroup** — A sub-choir (e.g. a church choir). Belongs to an Organization. Maps to the `subgroups` table.
- **Membership** — A join-table record linking a User to an Organization and optionally a Subgroup (`memberships` table).
- **AudioLabProject** — Prisma model (`audiolab_projects` table). No API routes currently exist.
- **AudioLabSession** — Prisma model (`audiolab_sessions` table). No API routes currently exist.
- **AnalyticsEvent** — Prisma model (`analytics_events` table). No API routes currently exist.
- **Envelope** — The standard JSON response shape: `{ success: boolean, data: T, error?: string }`.
- **Tenant scope headers** — `x-zone-id`, `x-zone-code`, `x-organization-id`, `x-subgroup-id`, `x-scope` — automatically injected by `apiClient` from the stored tenant scope.

---

## Requirements

### Requirement 1: DoodleLayer Annotation Persistence

**User Story:** As a choir member using the live rehearsal player, I want my doodle annotations saved to the server, so that my strokes persist across sessions and devices.

#### Acceptance Criteria

1. WHEN `DoodleLayer.onPanResponderRelease` completes a non-eraser stroke on a song with a known `activeTrackId`, THE `DoodleLayer` SHALL call `apiClient.patch('/songs/annotations/:songId', { data: { strokes: updatedStrokes } })` using `activeTrackId` as `songId`, in addition to the existing local store update.

2. WHEN `DoodleLayer.onPanResponderRelease` completes an eraser operation on a song with a known `activeTrackId`, THE `DoodleLayer` SHALL call `apiClient.patch('/songs/annotations/:songId', { data: { strokes: remainingStrokes } })` to persist the post-erase stroke array.

3. WHEN `DoodleLayer` mounts with a non-null `activeTrackId`, OR WHEN `activeTrackId` changes from null/undefined to a non-null value after mount, THE `DoodleLayer` SHALL call `apiClient.get('/songs/annotations/:songId')` and, if the response contains `data.data.strokes`, SHALL merge those strokes with the local annotation store via `storeSetStrokes`. IF the merge operation throws, THEN THE `DoodleLayer` SHALL log the error and display a non-blocking toast or console warning without reverting the local state.

4. IF the annotation save request to `/songs/annotations/:songId` fails with a network error or non-2xx status, THEN THE `DoodleLayer` SHALL log the error to the console and SHALL NOT revert the local stroke state.

5. IF `activeTrackId` is null or undefined at the time of stroke release, THEN THE `DoodleLayer` SHALL skip the API call and continue saving to the local store only.

6. THE `DoodleLayer` SHALL debounce server saves so that rapid successive strokes within 500 milliseconds are coalesced into a single `PATCH` call.

7. WHEN the annotation load request (`GET /songs/annotations/:songId`) returns a 404 response, THE `DoodleLayer` SHALL treat this as "no prior annotations" and SHALL NOT display an error to the user.

---

### Requirement 2: useUser signOut Token Cleanup

**User Story:** As a choir member signing out of the mobile app, I want the sign-out process to complete without a runtime crash, so that I am reliably logged out and the app returns to the login screen.

#### Acceptance Criteria

1. WHEN `useUser.signOut` executes the token cleanup block, THE `signOut` function SHALL call `clearTokens()` (imported from `'../lib/apiClient'`), which is the correct named export that removes `jwt`, `refreshToken`, and `userId` from SecureStore. `clearTokens()` and `clearCache()` SHALL only be called together as a pair via `signOut` and SHALL NOT be called independently at other call sites.

2. THE `signOut` function SHALL NOT call `clearCache()` as the token-clearing step; `clearCache()` clears only the in-memory GET cache and SHALL always be called as a second step alongside `clearTokens()`.

3. WHEN `signOut` is called, THE `signOut` function SHALL call both `clearTokens()` and `clearCache()` — `clearTokens()` to remove auth credentials from SecureStore, and `clearCache()` to flush the in-memory GET cache.

4. WHEN `signOut` is called and the logout API call (`POST /auth/logout`) fails or times out, THE `signOut` function SHALL still call `clearTokens()` and `clearCache()` so that the local session is always torn down regardless of network state; the user SHALL be treated as fully logged out locally even if the server session remains technically active.

5. WHEN `signOut` completes successfully, THE `useUserStore` state SHALL be reset to its initial unauthenticated values: `user: null`, `isAuthenticated: false`, `profile: null`, `isProfileLoading: false`, `currentZone: null`, `userZones: []`, `isZoneLoading: false`, `isPremium: false`.

---

### Requirement 3: SubgroupAdminScreen Member Loading

**User Story:** As a subgroup administrator, I want member lists to load from the correct scoped endpoint, so that the screen does not perform full-table profile scans or rely on a phantom `memberIds` array that does not exist in the database schema.

#### Acceptance Criteria

1. WHEN the `SubgroupAdminScreen` members tab becomes active with a valid `activeSubgroupId`, THE screen SHALL fetch members by calling `apiClient.get('/subgroups/:id/members')` where `:id` is the `activeSubgroupId`.

2. THE `SubgroupAdminScreen` SHALL NOT call `apiClient.get('/profiles')` to load subgroup members; that endpoint performs a full directory scan and is not scoped to a subgroup.

3. WHEN the `/subgroups/:id/members` response returns `{ success: true, data: Membership[] }`, THE screen SHALL derive the displayed member list from `data` directly, without filtering by a `memberIds` array.

4. IF the `/subgroups/:id/members` call returns an empty array, THEN THE `SubgroupAdminScreen` SHALL display a "No members yet" empty state rather than silently showing an empty list.

5. IF the `/subgroups/:id/members` call fails with a network error, non-2xx status, or a response whose `data` field is not a valid array, THEN THE `SubgroupAdminScreen` SHALL display an error message and provide a retry affordance.

6. WHEN the search modal is opened to add a new member, THE `SubgroupAdminScreen` SHALL call `apiClient.get('/members/zone/:zoneId')` to search zone members scoped to `activeSubgroup.zoneId` or `activeSubgroup.organizationId`; it SHALL NOT call `apiClient.get('/profiles')` for this search.

7. WHEN a member is successfully added via `POST /subgroups/members`, THE `SubgroupAdminScreen` SHALL refresh the member list by re-fetching `GET /subgroups/:id/members` rather than optimistically appending to a local `memberIds` array.

8. WHEN a member is successfully removed via `DELETE /subgroups/members`, THE `SubgroupAdminScreen` SHALL refresh the member list by re-fetching `GET /subgroups/:id/members`.

---

### Requirement 4: Admin App WebSocket Resource Aliases

**User Story:** As a zone administrator using the admin app, I want real-time chat and call events to be received without requiring an exact string match on the resource name, so that events broadcast by the API under alias names (e.g. `messages`, `chat_deleted`) are not silently dropped.

#### Acceptance Criteria

1. THE `rehearsalhub-admin` `useWebSocket.ts` module SHALL define a `RESOURCE_ALIASES` constant of type `Record<string, string[]>` containing at minimum the following mappings:
   - `'chat'` → `['chats', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt']`
   - `'chats'` → `['chat', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt']`
   - `'messages'` → `['chat', 'chats', 'message_reaction', 'message_receipt']`
   - `'call'` → `['calls', 'incoming_call', 'call_status', 'call_signal']`
   - `'calls'` → `['call']`

2. WHEN the admin WebSocket receives an event where `msg.resource` does not exactly match a subscription's `resource` string, THE admin WebSocket module SHALL consult `RESOURCE_ALIASES` and SHALL invoke the subscription handler if `msg.resource` is listed as an alias for the subscribed resource.

3. WHEN the admin WebSocket `socket.onopen` fires and replays subscriptions, THE admin WebSocket SHALL send subscribe frames for both the canonical resource name and all its aliases so the server delivers all relevant event types.

4. WHEN a subscription is torn down, THE admin WebSocket SHALL send unsubscribe frames for both the canonical resource name and all its aliases to avoid ghost subscriptions on the server.

5. THE `RESOURCE_ALIASES` map in `rehearsalhub-admin` SHALL be structurally identical to the one in the Zonal Portal's `useWebSocket.ts` to ensure consistent event routing across clients.

6. WHEN the admin WebSocket receives a `message` event with a non-null `sequence` number, THE admin WebSocket SHALL store the cursor in a per-resource-id map and include `since: <cursor>` on re-subscribe after reconnection, matching the Zonal Portal implementation.

---

### Requirement 5: Zonal Portal BackendAPI Delete Operations

**User Story:** As a portal user performing delete actions (removing a chat message, deleting a playlist, removing a song from a playlist), I want those deletes to actually reach the API, so that data is removed from the server and not just hidden locally.

#### Acceptance Criteria

1. WHEN `BackendAPI.generic.delete(collectionName, id)` is called with `collectionName = 'playlists'`, THE facade SHALL call `apiClient.delete('/playlists/:id')` using the provided `id` and SHALL return the API response envelope.

2. WHEN `BackendAPI.generic.delete(collectionName, id)` is called with `collectionName = 'chats'` or `'chats_v2'`, THE facade SHALL call `apiClient.delete('/chats/:id')` using the provided `id` and SHALL return the API response envelope.

3. WHEN `BackendAPI.generic.delete(collectionName, id)` is called with a `collectionName` for which no API delete route exists (e.g. `'profiles'`), THEN THE facade SHALL return `{ success: false, error: 'Delete not supported for <collectionName>' }` and SHALL log a warning to the console.

4. WHEN `BackendAPI.generic.delete(collectionName, id)` is called with `collectionName = 'programs'` or `'praise_nights'`, THE facade SHALL call `apiClient.delete('/programs/:id')` using the provided `id`.

5. THE `BackendAPI.generic.delete` function SHALL NOT unconditionally return `{ success: false, error: 'Delete not available' }` for any collection that maps to an existing DELETE route in the API.

6. IF a `BackendAPI.generic.delete` call to the API returns a non-2xx status or `{ success: false }`, THEN THE facade SHALL propagate the error envelope to the caller without throwing.
---

### Requirement 6: AudioLab API Routes

**User Story:** As a choir member using the AudioLab feature, I want my recording projects and sessions to be saved to and loaded from the server, so that my work persists across app restarts.

#### Acceptance Criteria

1. THE API (`rehearsalhub-api`) SHALL expose `GET /audiolab/projects` which returns all `AudioLabProject` records belonging to the authenticated user as `{ success: true, data: AudioLabProject[] }`.

2. THE API SHALL expose `POST /audiolab/projects` which creates a new `AudioLabProject` record owned by the authenticated user and returns `{ success: true, data: AudioLabProject }` with HTTP 201.

3. THE API SHALL expose `GET /audiolab/projects/:id` which returns the `AudioLabProject` with the given `id` if the authenticated user is the owner, or HTTP 404 if not found.

4. THE API SHALL expose `PATCH /audiolab/projects/:id` which updates mutable fields of an `AudioLabProject` and returns `{ success: true, data: AudioLabProject }`.

5. THE API SHALL expose `DELETE /audiolab/projects/:id` which deletes the `AudioLabProject` with the given `id` if the authenticated user is the owner and returns `{ success: true }`.

6. THE API SHALL expose `GET /audiolab/projects/:projectId/sessions` which returns all `AudioLabSession` records for the given project as `{ success: true, data: AudioLabSession[] }`.

7. THE API SHALL expose `POST /audiolab/projects/:projectId/sessions` which creates a new `AudioLabSession` linked to the given project and returns `{ success: true, data: AudioLabSession }` with HTTP 201.

8. THE API SHALL expose `PATCH /audiolab/sessions/:sessionId` which updates mutable fields of an `AudioLabSession` and returns `{ success: true, data: AudioLabSession }`.

9. THE API SHALL expose `DELETE /audiolab/sessions/:sessionId` which deletes the `AudioLabSession` with the given `id` and returns `{ success: true }`.

10. IF a request to any `/audiolab/*` route is made without a valid JWT Bearer token, THEN THE API SHALL return HTTP 401 with `{ success: false, error: 'Unauthorized' }`.

11. IF a request attempts to access or modify an `AudioLabProject` or `AudioLabSession` that belongs to a different user, THEN THE API SHALL return HTTP 403 with `{ success: false, error: 'Forbidden' }`, regardless of whether the requestor's token is otherwise valid.

12. WHERE the `AudiolabScreen` component exists in `rehearsalhubv2`, THE screen SHALL call the `/audiolab/projects` endpoints via `apiClient` for all project CRUD operations.

---

### Requirement 7: Analytics Read Endpoint

**User Story:** As an HQ administrator viewing the Analytics screen in the admin app, I want to read recorded analytics events from the API, so that the screen displays real data rather than crashing or staying blank.

#### Acceptance Criteria

1. THE API SHALL expose `GET /analytics/events` which returns `AnalyticsEvent` records accessible to the authenticated user as `{ success: true, data: AnalyticsEvent[], count: number }`.

2. THE `GET /analytics/events` endpoint SHALL accept an optional `?limit=<n>` query parameter (default 100, maximum 500) to paginate results.

3. THE `GET /analytics/events` endpoint SHALL accept an optional `?since=<iso8601>` query parameter to filter records created after the given timestamp.

4. IF the authenticated user's role is not `hq_admin` or `super_admin`, THEN THE API SHALL return HTTP 403 with `{ success: false, error: 'Forbidden' }` for `GET /analytics/events`. The JWT token SHALL be validated first; if the token is missing or invalid, HTTP 401 SHALL be returned before role-checking.

5. IF the request to `GET /analytics/events` is made without a valid JWT Bearer token, THEN THE API SHALL return HTTP 401 with `{ success: false, error: 'Unauthorized' }` before evaluating role permissions.
6. WHERE the `AnalyticsScreen` component exists in `rehearsalhub-admin`, THE screen SHALL call `apiClient.get('/analytics/events')` on mount and SHALL render the returned data.

7. IF the `GET /analytics/events` call returns `{ success: false }` or a network error, THEN THE `AnalyticsScreen` SHALL display a visible error state rather than rendering a blank screen.

---

### Requirement 8: Admin App Screen API Alignment

**User Story:** As an administrator using the admin app, I want every screen to use `apiClient` with correct endpoint paths and correct response-shape handling, so that screens load real data, handle errors gracefully, and do not crash due to incorrect destructuring of API envelopes.

#### Acceptance Criteria

**8.1 — General rule for all admin screens:**

1. THE every screen in `rehearsalhub-admin` SHALL source its data exclusively through `apiClient` (imported from `'../lib/apiClient'`) with a valid JWT Bearer token injected automatically; no screen SHALL make raw `fetch()` calls or embed base URLs.

2. WHEN any `apiClient` call returns `{ success: false }` or throws a network error, THE screen SHALL display a non-crashing error state (inline message or Alert) and SHALL NOT attempt to access `.data` from the response without a null-guard.

3. THE every screen SHALL guard array responses with `Array.isArray(res?.data) ? res.data : []` or an equivalent null-safe pattern before calling `.map()`, `.filter()`, or `.forEach()` on the response data.

**8.2 — ChurchesScreen:**

4. WHEN `ChurchesScreen` mounts, THE screen SHALL call `apiClient.get('/subgroups')` to load the subgroup list and SHALL render each item using fields from the Envelope `data` array.

5. WHEN the zone context changes, THE `ChurchesScreen` SHALL re-fetch subgroups scoped to the active zone using the `x-zone-id` tenant header injected by `apiClient`, without appending manual query parameters that duplicate the header.

**8.3 — SubmittedSongsScreen:**

6. WHEN `SubmittedSongsScreen` mounts, THE screen SHALL call `apiClient.get('/submitted-songs')` and SHALL render the returned array.

7. WHEN an admin approves or rejects a submitted song, THE screen SHALL call the appropriate mutation endpoint and SHALL re-fetch the list on success.

**8.4 — PraiseNightScreen (admin):**

8. WHEN `PraiseNightScreen` mounts, THE screen SHALL call `apiClient.get('/programs')` to load programs and SHALL call `apiClient.get('/songs/master')` to load the song catalogue.

9. WHEN an admin creates a program, THE screen SHALL call `apiClient.post('/programs', payload)` and on success SHALL refresh the program list.

10. WHEN an admin updates or deletes a program, THE screen SHALL call `apiClient.patch('/programs/:id', payload)` or `apiClient.delete('/programs/:id')` respectively.

**8.5 — SupportChatScreen:**

11. WHEN `SupportChatScreen` mounts, THE screen SHALL call `apiClient.get('/support-tickets')` to load the ticket list.

12. WHEN a ticket is selected, THE screen SHALL call `apiClient.get('/support-tickets/:id')` and `apiClient.get('/support-tickets/:id/messages')` to load ticket detail and message thread.

13. WHEN an admin sends a reply, THE screen SHALL call `apiClient.post('/support-tickets/:id/messages', { text })`.

14. WHEN an admin updates ticket status, THE screen SHALL call `apiClient.patch('/support-tickets/:id', { status })`.

**8.6 — CategoriesScreen:**

15. WHEN `CategoriesScreen` mounts, THE screen SHALL call `apiClient.get('/categories')` and SHALL render the returned array.

16. WHEN a category is created, THE screen SHALL call `apiClient.post('/categories', payload)`.

**8.7 — MasterLibraryScreen:**

17. WHEN `MasterLibraryScreen` mounts, THE screen SHALL call `apiClient.get('/songs/master')` to load the master song catalogue.

18. WHEN a search query is present, THE `MasterLibraryScreen` SHALL filter client-side on the already-fetched list; it SHALL NOT make additional API calls per keystroke.

**8.8 — ActivityLogsScreen:**

19. WHEN `ActivityLogsScreen` mounts, THE screen SHALL call `apiClient.get('/activity-logs')` and SHALL render the returned array.

20. IF the `GET /activity-logs` response `data` field is not an array, THEN THE `ActivityLogsScreen` SHALL render an empty list rather than crashing.

**8.9 — MoreScreen:**

21. WHEN `MoreScreen` renders links or menu items that navigate to other admin screens, THE links SHALL not embed hardcoded API URLs; any data the screen displays directly SHALL be sourced through `apiClient`.

**8.10 — NotificationsScreen (admin):**

22. WHEN `NotificationsScreen` mounts, THE screen SHALL call `apiClient.get('/notifications')` and SHALL render the `data` array from the Envelope.

23. WHEN an admin broadcasts a notification, THE screen SHALL call `apiClient.post('/notifications/broadcast', payload)` and on success SHALL display a confirmation.

24. WHEN an admin marks a notification as read, THE screen SHALL call `apiClient.patch('/notifications/:id/read', {})`.

**8.11 — AttendanceScreen corrections:**

25. THE `AttendanceScreen` SHALL NOT call `/attendance/code` — that endpoint does not exist in `rehearsalhub-api`; attendance code management SHALL be handled client-side or deferred until the endpoint is built.

26. THE `AttendanceScreen` SHALL NOT call `/attendance/manual` — that endpoint does not exist in `rehearsalhub-api`; manual check-in SHALL use `apiClient.post('/attendance/check-in', payload)` with valid fields matching the existing schema.

27. THE `AttendanceScreen` SHALL NOT call `apiClient.delete('/attendance/:id')` — that endpoint does not exist; delete actions SHALL be removed or guarded until the endpoint is built.

**8.12 — MembersScreen corrections:**

28. THE `MembersScreen` SHALL NOT call `apiClient.patch('/profiles/:userId/role', { role })` — that endpoint does not exist; role changes SHALL be implemented via `apiClient.patch('/members/:userId', { role })` which is the existing members write endpoint.

---

### Requirement 9: Zonal Portal Page API Alignment

**User Story:** As a zone coordinator using the web portal, I want every page to load data from the API correctly and handle errors gracefully, so that the portal is reliable and does not silently fail or display stale/incorrect data.

#### Acceptance Criteria

**9.1 — General rule for all portal pages:**

1. THE every page under `src/app/` in the Zonal Portal SHALL source its data through either `apiClient` directly or through the `BackendAPI` façade; no page SHALL embed base URLs or make raw `fetch()` calls with manual `Authorization` header construction.

2. WHEN any `apiClient` or `BackendAPI` call returns `{ success: false }` or throws, THE page SHALL render a visible error state and SHALL NOT proceed to render data-dependent UI without guarding against null/undefined.

3. THE every page that renders a list from an API response SHALL guard with `Array.isArray(data) ? data : []` before mapping.

**9.2 — Settings/geofence:**

4. WHEN `listCollection('settings', ...)` is called, THE BackendAPI facade SHALL NOT hardcode the path to `/settings/geofence_hq`; it SHALL use `apiClient.get('/settings')` to list all settings, or `apiClient.get('/settings/:key')` when a specific key is provided as the filter value.

5. WHERE the geofence settings page calls `listCollection('settings')` with no filter, THE facade SHALL return all setting rows, not only the geofence row.

**9.3 — authStore rehydration:**

6. WHEN the Zonal Portal page loads and `authStore` detects a stored JWT, THE `authStore` SHALL call `apiClient.get('/auth/me')` to validate the token and rehydrate the user object; IF the call returns 401, THEN `authStore` SHALL clear tokens and redirect to the login page.

7. WHEN `authStore.rehydrate()` resolves with a valid user, THE portal SHALL set `isAuthenticated = true` before rendering any protected page content.

**9.4 — Programs/Praise Nights page:**

8. WHEN the programs page mounts, THE page SHALL call `apiClient.get('/programs')` (or `BackendAPI.programs.list()`) and SHALL render each program from `data`.

9. WHEN an admin creates a program via the portal, THE page SHALL call `apiClient.post('/programs', payload)` and on success SHALL invalidate and re-fetch the program list.

**9.5 — Chats page:**

10. WHEN the chats page mounts, THE page SHALL call `apiClient.get('/chats')` and SHALL render the chat list from `data`.

11. WHEN a new chat is created via the portal, THE page SHALL call `BackendAPI.generic.create('chats', payload)` which maps to `apiClient.post('/chats', ...)`.

12. WHEN a chat is deleted via the portal, THE page SHALL call `BackendAPI.generic.delete('chats', chatId)` which — after Requirement 5 is implemented — SHALL route to `apiClient.delete('/chats/:id')`.

**9.6 — Members page:**

13. WHEN the members page mounts, THE page SHALL call `apiClient.get('/profiles/directory')` or `BackendAPI.generic.list('profiles')` and SHALL handle both `{ data: [] }` and `{ data: { zoneMembers: [], hqMembers: [] } }` response shapes from `asArray()`.

**9.7 — Playlists page:**

14. WHEN the playlists page mounts, THE page SHALL call `apiClient.get('/playlists/me')` and SHALL render each playlist from `data`.

15. WHEN a playlist is deleted, THE page SHALL call `BackendAPI.generic.delete('playlists', playlistId)` which — after Requirement 5 — routes to `apiClient.delete('/playlists/:id')`.

**9.8 — Notifications page:**

16. WHEN the notifications page mounts, THE page SHALL call `apiClient.get('/notifications')` and SHALL render each notification from `data`.

17. WHEN a broadcast is sent from the portal, THE page SHALL call `apiClient.post('/notifications/broadcast', payload)`.

**9.9 — Attendance page:**

18. WHEN the attendance page mounts, THE page SHALL call `apiClient.get('/attendance')` (with optional `?zoneId=` from the active scope header) and SHALL render the returned records.

19. WHEN a manual check-in is submitted via the portal, THE page SHALL call `apiClient.post('/attendance/check-in', payload)` with fields: `{ userId?, eventName, status, checkInTime }`.

**9.10 — Song management pages:**

20. WHEN the master library page mounts, THE page SHALL call `apiClient.get('/songs/master')` and SHALL render the returned array.

21. WHEN a submitted song is reviewed, THE page SHALL call `apiClient.patch('/submitted-songs/:id', { status })`.

---

### Requirement 10: API Response Shape Consistency

**User Story:** As a developer maintaining any client app, I want every client to correctly handle the standard `{ success, data, error }` envelope and never crash on an unexpected shape, so that end users never see white screens or unhandled promise rejections.

#### Acceptance Criteria

1. THE every client-side function that reads from an API response SHALL access `.data` only after confirming `res?.success !== false` or confirming `res?.data !== undefined`.

2. WHEN an API response has `success: false` and an `error` string, THE client SHALL surface the `error` string to the user (via `Alert.alert`, a toast, or an inline error message) rather than silently failing.

3. WHEN an API call throws (network down, timeout, CORS failure), THE client SHALL catch the exception, log it, and display a recoverable error state; it SHALL NOT propagate the exception to a React render cycle uncaught.

4. THE every screen that calls an API on mount and renders the result as a list SHALL initialise its list state to an empty array `[]`; screens that render a single record SHALL initialise to `null`. Screens that do not render API response data (e.g. pure settings or form-only screens) are exempt from this requirement.

5. WHEN an API call returns an HTTP 401, THE client SHALL clear stored tokens, reset auth state, and redirect the user to the login screen without displaying a technical error message.

6. WHEN an API call returns an HTTP 403, THE client SHALL display a user-friendly "You don't have permission" message and SHALL NOT crash.

7. WHEN an API call returns an HTTP 404, THE client SHALL display a user-friendly "Not found" message and SHALL NOT crash.
