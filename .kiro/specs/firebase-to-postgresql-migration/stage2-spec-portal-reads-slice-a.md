# Stage 2 Technical Specification — Portal Reads Slice A (Tasks 40 partial)

**Direction:** Unblock Zonal Portal JWT reads. Do not re-migrate data. Prefer existing `rehearsalhub-api` GET routes. Realtime (`onSnapshot`) and most writes stay for later phases.

**Problem:** `FirebaseDatabaseService` and ~13 services import `BackendAPI` from `api-client.ts`, but **`BackendAPI` is not exported** — Portal “API-proxied” reads are broken even though Auth already uses `apiClient`.

---

## 0. Scope (Slice A)

**In:**
1. Restore `BackendAPI` on `api-client.ts` as thin wrappers over `apiClient` → existing JWT GETs (and existing write routes where present).
2. Map `generic.list` / `generic.get` / profiles / songs / attendance **reads** to real endpoints.
3. Client-side filter for `list(collection, limit, field, value)` (FDS `getCollectionWhere`).
4. Spec + tasks.md note for partial task 40 progress.

**Out:**
- Firestore `subscribe*` / counts (Phase 10+)
- Chat/media/schedule Firebase services rewrite
- Direct Supabase storage / support messages (task 41 follow-up)
- Inventing new write APIs for master_programs / song_history
- Full elimination of every `FirebaseDatabaseService` call site

---

## 1. `BackendAPI` read mapping

| Call | Endpoint |
|---|---|
| `profiles.get(id)` | `GET /profiles/:id` |
| `profiles.update(id, body)` | `PATCH /profiles/:id` |
| `generic.list('profiles')` | `GET /profiles/directory` |
| `generic.list('hq_members')` | `GET /members/hq` |
| `generic.list('zone_members')` + filter `userId` | `GET /members/by-user/:userId` or `/members/mine` |
| `generic.list('zone_members')` + filter `zoneId` | `GET /members/zone/:zoneId` |
| `generic.list('subgroups')` | `GET /subgroups/mine` (+ client filter zoneId if needed) |
| `generic.get('subgroups', id)` | `GET /subgroups/:id` |
| `generic.list('praise_nights')` | `GET /praise-nights` |
| `generic.get('praise_nights', id)` | `GET /praise-nights/:id` |
| `generic.list('categories')` | `GET /categories` |
| `generic.list('submitted_songs')` | `GET /submitted-songs` |
| `generic.list('schedule'\|'schedule_programs')` | `GET /schedule` |
| `generic.list('notifications')` | `GET /notifications` |
| `generic.list('attendance')` | `GET /attendance/mine` (narrow; HQ list may be empty until later) |
| `songs.getAll` / `getById` | `GET /songs/master`, `/songs/master/:id` |
| `generic.list('praise_night_songs')` | `GET /songs/praise-night` |
| `generic.get(collection, id)` fallback | collection-specific GET where mapped; else list+find |

Envelope: unwrap `{ success, data }` → `{ data }` for callers.

**Writes:** Prefer existing routes (`PATCH /profiles/:id`, writes router). Unmapped writes return `{ success: false, error: 'Not available' }` without hitting Firebase.

---

## 2. Verification

1. Portal TypeScript compiles (`BackendAPI` export resolves).
2. Smoke: with JWT, `BackendAPI.generic.list('profiles'|'hq_members'|'praise_nights'|'categories')` returns arrays (script or manual).
3. Update `tasks.md` task 40 with **partial** note (Slice A); 41–42 remain open.

**Approved via user “continue next” — implement Slice A.**
