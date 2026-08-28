# Stage 2 Technical Specification — Mobile Read API Completion (Task 36)

**Repos:** User approved 2026-08-06 after Stage 1 impact for blocked Mobile Firestore reads.

**Scope:**
1. `rehearsalhub-api` — Drizzle tables + JWT `requireAuth` **read-only** routes for collections still queried via Mobile `getDoc`/`getDocs`.
2. `rehearsalhubv2` — replace remaining one-shot `getDoc`/`getDocs` with those routes (task 36 → 37).

**Out of scope (explicit):**
- `/api/master-songs` and `/api/praise-night-songs` (x-api-key) — untouched.
- Write endpoints for new tables (Phase 9).
- `onSnapshot` → WebSocket (Phase 10). Screens that only use `onSnapshot` today may gain a one-shot API fetch for initial load where a `getDoc`/`getDocs` also exists; listeners remain until Phase 10.
- Admin / Zonal Portal clients.
- Firebase SDK removal (Phase 13).

**Already shipped (do not redo):** `GET /songs/master`, `GET /songs/master/:id`, `GET /songs/praise-night`, `GET /songs/praise-night/:id`, profiles directory, members mine/zone/hq/:groupId, chats list/by-id/messages.

---

## 1. Structural interface alterations

### 1.1 New Drizzle tables in `rehearsalhub-api/src/schema.ts`

Add tables only (no drops). IDs are `text` PKs matching Firestore doc IDs. `jsonb` for array/object fields that Firestore stored as arrays/maps.

| Table | Key columns (Drizzle camelCase → DB snake_case) |
|---|---|
| `user_favorites` | `id` (userId), `songs` jsonb, `updated_at` |
| `user_playlists` | `id`, `user_id`, `name`, `songs` jsonb, `created_at`, `updated_at` |
| `notifications` | `id`, `title`, `body`, `target_audience`, `target_group`, `target_user_id`, `created_at`, extras jsonb optional via existing fields only |
| `user_notifications` | `id` (`{userId}_{notificationId}`), `user_id`, `notification_id`, `read_at`, `created_at` |
| `user_groups` | `id`, `user_id`, `group_name` |
| `subgroups` | `id`, `name`, `zone_id`, `coordinator_id`, `member_ids` jsonb, `status`, `created_at`, `updated_at` |
| `subgroup_songs` | `id`, `sub_group_id`, `zone_id`, `title`, `key`, `writer`, `category`, `tempo`, `lead_singer`, `lyrics`, `audio_file`, `audio_urls` jsonb, `status`, `is_active`, `created_at` |
| `subgroup_praise_nights` | `id`, `sub_group_id`, `zone_id`, `name`, `title`, `date`, `location`, `category`, `song_ids` jsonb, `created_at` |
| `zone_songs` | same shape as `subgroup_songs` but `zone_id` required; `sub_group_id` omitted |
| `zone_praise_nights` | same shape as `subgroup_praise_nights` with `zone_id`; no `sub_group_id` |
| `settings` | `id` (e.g. `geofence_hq`), `latitude`, `longitude`, `radius`, `active_event_name`, jsonb `data` for forward-compat extras |
| `attendance` | `id`, `user_id`, `status`, `date`, `date_string`, `check_in_time`, `timestamp`, `zone_id`, `event_name`, `created_at` |

**Ops / data note (corrected):** Firebase → Supabase data migration already happened (`rehearsalhubv2/scripts/firebase-to-supabase`). **Do not re-migrate.** Stage 3 only maps Drizzle + JWT GET routes onto **existing** public tables (`user_favorites`, `user_playlists`, `notifications`, `subgroups`, `subgroup_songs`, `zone_songs`, etc.) and points Mobile at the API. No client may call Firebase for these reads.

No Prisma/SQL migration tooling is required for this slice unless a table is proven missing at runtime — then add Drizzle mapping only after verifying against live `information_schema`, never by re-running Firebase export.

### 1.2 New route modules (JWT only)

Mount in `src/index.ts` beside other protected routers. Each file ≤ ~300 lines; split if needed.

| Module | Base | Endpoints | Auth / ownership |
|---|---|---|---|
| `favorites.routes.ts` | `/favorites` | `GET /me` → `{ songs: string[] }` (empty array if no row) | `requireAuth`; row id = `auth.userId` |
| `playlists.routes.ts` | `/playlists` | `GET /me` → playlist rows for caller | `requireAuth`; filter `user_id = auth.userId` |
| `notifications.routes.ts` | `/notifications` | `GET /` → up to 50 newest; `GET /mine/state` → `{ groupNames: string[], readNotificationIds: string[] }` | `requireAuth`; filter audience client-side today → **server filters** using `user_groups` + `user_notifications` + `auth.userId` so clients receive already-scoped list with `is_read` |
| `subgroups.routes.ts` | `/subgroups` | `GET /mine` (member), `GET /coordinated` (coordinator), `GET /:id`, `GET /:id/songs`, `GET /:id/praise-nights` | `requireAuth`; mine = `member_ids ? userId`; coordinated = `coordinator_id = userId`; songs/praise-nights by `sub_group_id` |
| `zone-songs.routes.ts` | `/zone-songs` | `GET /:id`, `GET /by-zone/:zoneId` | `requireAuth` |
| `zone-praise-nights.routes.ts` | `/zone-praise-nights` | `GET /:id`, `GET /by-zone/:zoneId` | `requireAuth` |
| `settings.routes.ts` | `/settings` | `GET /:id` | `requireAuth`; 404 if missing |
| `attendance.routes.ts` | `/attendance` | `GET /mine` | `requireAuth`; `user_id = auth.userId` |

**Also extend** `songs.routes.ts` (already exists):
- `GET /songs/zone/:id` → `zone_songs` by id  
- `GET /songs/subgroup/:id` → `subgroup_songs` by id  

Response envelope: `{ success: true, data: T }` or `{ success: false, error: string }`. Generic errors to client; log details server-side. No stack traces.

### 1.3 Mobile consumer changes (`rehearsalhubv2`)

| File | Change |
|---|---|
| `SettingsScreen.tsx` | favorites count → `GET /favorites/me`; subgroups → `GET /subgroups/mine`; attendance → `GET /attendance/mine`; geofence → `GET /settings/:id` |
| `NotificationsScreen.tsx` | one-shot → `GET /notifications` (server-filtered + `is_read`) |
| `PlaylistsScreen.tsx` | track resolve: remove Firestore fallbacks; use `/songs/praise-night/:id`, `/songs/master/:id`, `/songs/zone/:id`, `/songs/subgroup/:id`; program → `/praise-nights/:id` then `/zone-praise-nights/:id` then subgroup program via subgroup praise-nights list/by id. Playlist/favorites **listeners** stay onSnapshot until Phase 10 (not `getDoc`) |
| `PlayerScreen.tsx` | replace favorites `getDoc` in toggle path with `GET /favorites/me` before write (write still Firestore until Phase 9) |
| `SubgroupAdminScreen.tsx` | coordinated list → `GET /subgroups/coordinated`; songs/praise-nights initial load via `GET /subgroups/:id/songs` + `.../praise-nights` (may still keep onSnapshot until Phase 10) |
| `RehearsalScreen.tsx` | remove zone/subgroup Firestore `getDoc`; use `/songs/zone/:id` + `/songs/subgroup/:id` |
| `ChatInfoScreen` / `ChatRoomScreen` / `ChatListScreen` / `ShareToChatSheet` | replace mid-flow `getDoc(chats_v2)` with `GET /chats/:id` |

---

## 2. Data contracts (selected)

```ts
// GET /favorites/me
{ success: true, data: { songs: string[] } }

// GET /playlists/me
{ success: true, data: Array<{ id: string; userId: string; name: string; songs: string[] }> }

// GET /notifications
{ success: true, data: Array<{ id: string; title?: string; body?: string; target_audience?: string; is_read: boolean; created_at?: string }> }

// GET /subgroups/mine | /coordinated
{ success: true, data: Array<{ id: string; name?: string; zoneId?: string; coordinatorId?: string; memberIds?: string[]; status?: string }> }

// GET /settings/:id
{ success: true, data: { id: string; latitude?: number; longitude?: number; radius?: number; activeEventName?: string } }

// GET /attendance/mine
{ success: true, data: Array<{ id: string; userId: string; status?: string; date?: string; checkInTime?: string; zoneId?: string }> }
```

Zod: validate path params (`id` non-empty string). No request bodies on these GETs.

---

## 3. Error-handling matrix

| Failure | HTTP | Client message | Server log |
|---|---|---|---|
| Missing/invalid JWT | 401 | `Unauthorized` | none / auth middleware |
| Resource missing | 404 | `Not found` | optional warn with id |
| Forbidden (future writes) | 403 | `Forbidden` | userId + path |
| DB / unexpected | 500 | `Something went wrong` | full error + route |
| Mobile network / non-OK | n/a | existing generic UI strings; never surface raw body | console.error with path |

Empty favorites / empty lists → **200** with `data: []` or `songs: []`, not 404.

---

## 4. Type-safety & boundaries

- Strict TS on new routes; explicit response types on Mobile call sites (no new `any` beyond existing screen state shapes).
- Clients call only `rehearsalhub-api` via `apiClient` (Bearer JWT). No `DATABASE_URL` on clients.
- New routes use `requireAuth` only — never `apiKeyAuth`; never mount under `/api/master-songs` or `/api/praise-night-songs`.

---

## 5. Verification plan

| Step | Command / check |
|---|---|
| API compile | `cd rehearsalhub-api && npm run build` → exit 0 |
| Route smoke (local) | With JWT: `GET /favorites/me`, `/subgroups/mine`, `/notifications`, `/settings/geofence_hq`, `/attendance/mine`, `/songs/zone/:id` → 401 without token; 200 with token (empty data OK if tables empty) |
| Untouched guarantee | `GET /api/master-songs` with `x-api-key` still works (manual if env available) |
| Mobile grep | `getDoc`/`getDocs` in `rehearsalhubv2/src` excluding `firebase-polyfill` → **zero** after Stage 3 mobile tasks |
| Task 37 note | `collection(db` may remain for writes/`onSnapshot` until Phases 9–10; update `tasks.md` checkpoint wording to match (reads cleared) |
| Aikido | `aikido_full_scan` on new/changed source after Stage 3 (requires user sign-in) |

---

## 6. Stage 3 micro-task checklist (execute only after “Approved. Proceed to Stage 3”)

1. Add Drizzle tables to `schema.ts`.
2. Implement + mount `favorites`, `playlists`, `attendance`, `settings` routes; verify build.
3. Implement + mount `notifications` routes (filtered list); verify build.
4. Implement + mount `subgroups` + zone/subgroup song/praise-night GETs; verify build.
5. Mobile: Settings + Notifications reads.
6. Mobile: Playlists/Rehearsal/Player song + favorites getDoc paths.
7. Mobile: SubgroupAdmin getDocs reads + Chat* mid-flow chat getDoc → API.
8. Grep checkpoint + `tasks.md` update for 36/37; Aikido scan.

After each numbered task: report changes + verification + halt for “Proceed with Task N+1” unless user grants batch-continue.
