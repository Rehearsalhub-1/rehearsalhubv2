# Stage 2 Technical Specification — Admin Firestore Read Replacement (Tasks 38–39)

**Direction:** Adapt Admin + API to **existing** Supabase tables. No Firebase for one-shot `getDocs`. Do not re-migrate. Writes (`addDoc`/`updateDoc`/`deleteDoc`) stay on Firebase until Phase 10 (task 57).

**Verified live (2026-08-10):**

| Table | Rows | Live shape notes |
|---|---|---|
| `activity_logs` | 52859 | **Only** `id`, `raw_data` (fields in JSON: type, action, message, section, userName, timestamp, …) |
| `categories` | 85 | **Only** `id`, `raw_data` (name, color, isActive, …) |
| `praise_nights` | 70 | `id, name, date, scope, zone_id, category, location, banner_image, songs, raw_data` |
| `schedule_programs` | 23 | Real schedule table — **`schedule` table MISSING** |
| `submitted_songs` | 200 | `id, user_id, title, status, created_at, raw_data, zone_id, submitted_by, submitted_by_email` (writer/zoneName in `raw_data`) |
| `master_songs` | 796 | Matches existing Drizzle closely (+ `raw_data`) |
| `profiles` | 701 | Directory endpoint already aligned |

---

## 0. Scope

**In:**
1. Align Drizzle + JWT list routes for the tables above so Admin can load them.
2. Replace Admin `getDocs` in 7 screens with those routes via `apiClient`.

**Out:**
- Admin Firebase writes (Categories save/delete, SubmittedSongs approve/reject, Notifications `addDoc`)
- `onSnapshot` / WebSocket
- Firebase SDK removal
- Touching `/api/master-songs` or `/api/praise-night-songs`

---

## 1. Structural interface alterations (`rehearsalhub-api`)

### 1.1 Drizzle schema (map to live only)

| Drizzle export | Table | Columns |
|---|---|---|
| `activityLogs` | `activity_logs` | `id`, `rawData` jsonb |
| `categories` | `categories` | `id`, `rawData` jsonb |
| `praiseNights` | `praise_nights` | live columns above (`name` not `title`; drop invented `status` if not live) |
| `schedule` → rename mapping to `schedulePrograms` | `schedule_programs` | `id, name, date, createdAt, rawData, zoneId, days, weeks, newSongs, isArchived, dailySchedules, updatedAt` |
| `submittedSongs` | `submitted_songs` | live columns; keep `rawData` |

Do not invent columns that are not live. Prefer reading nested fields from `raw_data` in the route DTO.

### 1.2 Route DTO behavior

| Route | Change |
|---|---|
| `GET /activity-logs` | Select live rows; map DTO from `raw_data` + id; return newest **100** (sort by `raw_data.timestamp` / `createdAt` descending server-side if practical, else client). Role gate unchanged. |
| `GET /categories` | Map `{ id, name, color, isActive }` from `raw_data`. |
| `GET /praise-nights` | Return live columns (camelCase). Client may use `name`. |
| `GET /schedule` | Query **`schedule_programs`**; return camelCase including `isArchived`, `name`, `zoneId`. |
| `GET /submitted-songs` | Return row + merge `writer`/`zoneName` from `raw_data` for Admin UI. |
| `GET /songs/master` | Unchanged (already works). |
| `GET /profiles/directory` | Unchanged (Members list). |

Envelope: `{ success: true, data: T[] }`.

### 1.3 Admin screens (`rehearsalhub-admin`)

| Screen | Call | Notes |
|---|---|---|
| ActivityLogsScreen | `GET /activity-logs` | Drop Firestore; format timestamp from ISO/string |
| MasterLibraryScreen | `GET /songs/master` | Sort by title client-side if needed |
| CategoriesScreen | `GET /categories` | **Keep** Firebase add/update/delete |
| PraiseNightScreen | `GET /praise-nights` | Use `name` |
| MembersScreen | `GET /profiles/directory` | Map directory DTO → member list |
| ScheduleScreen | `GET /schedule` | Map `isArchived` / `name` / `zoneId` |
| SubmittedSongsScreen | `GET /submitted-songs` | **Keep** Firebase `updateDoc` for approve/reject |

---

## 2. Error handling

- Auth failures: existing `requireAuth` 401.
- Activity-logs non-admin: 403.
- DB/shape errors: 500 generic; log server-side.
- Never return stack traces.

---

## 3. Verification plan

1. `npm run build` in `rehearsalhub-api`.
2. Optional live smoke: JWT GET each list route returns `success: true` and non-throwing shape.
3. `rg getDoc|getDocs` under `rehearsalhub-admin/src` → **zero**.
4. `rg addDoc|updateDoc|deleteDoc` may remain (writes deferred).
5. Update `tasks.md` 38–39.

---

## 4. Stage 3 micro-tasks

1. Align Drizzle for activity_logs, categories, praise_nights, schedule_programs, submitted_songs.
2. Update corresponding GET routes / DTO merge.
3. Wire 7 Admin screens to `apiClient`.
4. Grep verify + tasks.md.

**Halt:** Reply **Approved. Proceed to Stage 3.** to implement.
