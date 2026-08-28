# Stage 2 Technical Specification — Portal Rename: Kill Misleading `firebase-*` Modules

**Direction:** Give new developers honest module names. Application services that already talk JWT / `BackendAPI` must not live under `firebase-*` filenames or `Firebase*` class names. Prefer **rename + update imports + delete old file** (no long-lived re-export stubs). Do **not** remove the Firebase SDK or `firebase-setup` until tasks 62–65 complete (Phase 13 / task 68). Do not touch `/api/master-songs` or `/api/praise-night-songs`. Portal-only; no API schema changes.

**Problem:** After reads/writes migration, files like `firebase-database.ts` and `firebase-chat-service.ts` still imply Firestore is the system of record. That conflicts with architecture (“clients talk only to `rehearsalhub-api`”) and confuses onboarding.

---

## 0. Scope

### In (this Stage 3 slice)

| # | Old path | New path | Symbol rename |
|---|---|---|---|
| 1 | `groups/_lib/firebase-chat-service.ts` | Consolidate into `groups/_lib/chat-service.ts` + thin `chat-types.ts` if needed | `FirebaseChatService` → `ChatApiService` (or fold static methods into existing exports); delete `firebase-chat-service.ts` |
| 2 | `src/lib/firebase-database.ts` | `src/lib/data-service.ts` | `FirebaseDatabaseService` → `DataService` |
| 3 | `media/_lib/firebase-media-service.ts` | `media/_lib/media-library-service.ts` | class/`firebaseMediaService` → `MediaLibraryService` / `mediaLibraryService` |
| 4 | `calendar/_lib/firebase-calendar-service.ts` | `calendar/_lib/calendar-service.ts` | Keep `CalendarService` / `calendarService` (already honest); file rename only |
| 5 | `src/lib/firebase-metadata-service.ts` | `src/lib/metadata-service.ts` | `FirebaseMetadataService` → `MetadataService` |
| 6 | Barrel / README updates | `groups/_lib/index.ts`, `media/_lib/index.ts`, `calendar/_lib/index.ts` | Stop exporting `firebase-*` paths |
| 7 | `tasks.md` note | Task 61 / Phase 12 | Record rename as clarity work; SDK delete still Phase 13 |

### Out (explicit)

- Deleting `src/lib/firebase-setup.ts`, `public/firebase-messaging-sw.js`, or removing `firebase` from `package.json` (task 68)
- Migrating remaining `onSnapshot` / RTDB → WebSocket (tasks 62–64)
- Finishing all Portal writes (remainder of task 61: audiolab, `database.ts` Supabase, etc.)
- Admin / Mobile renames
- Changing JWT route contracts or Postgres schema

### Optional follow-up (not this slice)

- Rename `firebase-setup.ts` → `firestore-client.ts` with file header: “Temporary Firestore client until Portal realtime (62–64) is WebSocket-only.” Only if imports are updated in the same PR; otherwise leave until Phase 13.

---

## 1. Structural interface alterations

### 1.1 Chat consolidation (highest confusion)

**Today:** Two parallel stacks:

- `chat-service.ts` — functional API helpers; JWT writes (Slice A); `onSnapshot` retained
- `firebase-chat-service.ts` — class `FirebaseChatService` used by `ChatContext` and groups UI; JWT writes partially done; types `Chat`, `ChatMessage`, `ChatUser`, `FriendRequest`, `formatTimestamp`

**Target:**

1. Move UI-facing types + `formatTimestamp` into `groups/_lib/chat-types.ts` (or keep at top of `chat-service.ts` if file stays &lt; ~300 lines after merge — if over, split types).
2. Expose a single class or namespace used by `ChatContext`:
   - Prefer: `export class ChatApiService` with the same static method names as today’s `FirebaseChatService` (behavior unchanged), implemented via `chat-api-helpers` / `chat-api-writes` / existing functions in `chat-service.ts`.
   - Avoid duplicate write logic: methods that already exist as functions in `chat-service.ts` should call those functions, not reimplement.
3. Update all imports from `firebase-chat-service` → `chat-service` (or `chat-types` for types-only).
4. Update `groups/_lib/index.ts` to `export * from './chat-service'` (+ types).
5. **Delete** `firebase-chat-service.ts`. Zero re-export shim.

**Call sites (verified):** `ChatContext.tsx`, `ChatHeader`, `ChatSidebar`, `ChatContainer`, `WhatsAppChat*`, `UserSearchModal`, `CreateGroupModal`, `whatsapp-optimistic-ui.ts`, `ProjectSettingsSheet.tsx`, barrel `index.ts`.

### 1.2 DataService rename

- Copy/move `firebase-database.ts` → `data-service.ts`.
- Rename class `FirebaseDatabaseService` → `DataService`.
- Method signatures **unchanged** (including temporary `subscribe*` that still use Firestore `onSnapshot` until task 62).
- Update every `import { FirebaseDatabaseService } from '@/lib/firebase-database'` → `import { DataService } from '@/lib/data-service'`.
- Replace all `FirebaseDatabaseService.` call sites with `DataService.`.
- **Delete** `firebase-database.ts`. No shim.

**Call sites:** ~40 files under `src/` (components, hooks, stores, lib services, pages). Use `rg FirebaseDatabaseService|firebase-database` → expect **zero** after Stage 3.

### 1.3 Media library rename

- Move `firebase-media-service.ts` → `media-library-service.ts` (name avoids clash with existing `media/_lib/media-service.ts`).
- Rename class to `MediaLibraryService`; singleton `mediaLibraryService`.
- Update `media/_lib/index.ts` to export `mediaLibraryService` (alias `mediaService` may remain for compatibility **only if** current barrels already alias — prefer one name: `mediaLibraryService`).
- Update importers of `firebaseMediaService` / `firebase-media-service`.
- **Delete** old file.

### 1.4 Calendar file rename

- Move `firebase-calendar-service.ts` → `calendar-service.ts`.
- Keep exports `CalendarService`, `calendarService`, `CalendarEvent`, `EventAttendee`.
- Update barrel + importers (`calendar/page.tsx`, Event modals, `calendar-cache.ts`).
- **Delete** old file.

### 1.5 MetadataService rename

- Move `firebase-metadata-service.ts` → `metadata-service.ts`.
- Rename class `FirebaseMetadataService` → `MetadataService`.
- Update `praise-night-songs-service.ts`, audiolab/praise-night/subgroup callers.
- **Delete** old file.

### 1.6 What stays named Firebase (temporary)

| Path | Reason |
|---|---|
| `src/lib/firebase-setup.ts` | Still initializes Firestore/Auth for residual listeners / FCM |
| `public/firebase-messaging-sw.js` | FCM service worker until push migration |
| Internal imports of `firebase/firestore` inside services | Allowed until tasks 62–64 kill listeners |

---

## 2. Data contracts

**None.** No HTTP/API/schema changes. Pure Portal module identity refactor. Response shapes and JWT envelopes unchanged.

Identity rule unchanged: profile ids = JWT `sub`.

---

## 3. Error-handling matrix

| Failure | Behavior |
|---|---|
| Missed import after rename | TypeScript / Next build fails — fix before claiming done |
| Accidental behavior change in chat merge | Treat as bug; Stage 3 must preserve method semantics (API vs no-op+warn already established in write Slice A) |
| Caller still imports deleted path | Build fail; `rg` gate catches |

No new user-facing error strings.

---

## 4. Type-safety and boundary isolation

- Strict TypeScript; no new `any` beyond what already exists in moved files (no drive-by typing cleanup in this slice).
- Clients still only call `rehearsalhub-api` via `apiClient` / `BackendAPI` for data; rename does not reintroduce direct DB URLs.
- Class renames must update **all** references in the same Stage 3 task as the file move (no half-rename).
- Files should stay single-responsibility; if chat merge exceeds ~300 lines, split `chat-types.ts` and/or keep `ChatApiService` in `chat-api-service.ts` that reuses helpers — prefer one primary entry for UI (`chat-service.ts` barrel or `ChatApiService` export).

**Preferred chat layout after consolidation:**

```
groups/_lib/
  chat-types.ts          # Chat, ChatMessage, ChatUser, FriendRequest, formatTimestamp
  chat-api-helpers.ts    # reads (existing)
  chat-api-writes.ts     # writes (existing)
  chat-service.ts        # functions + ChatApiService class used by UI
```

---

## 5. Verification plan

After each micro-task and at end of slice:

1. `rg -n "firebase-chat-service|FirebaseChatService|firebase-database|FirebaseDatabaseService|firebase-media-service|firebaseMediaService|firebase-calendar-service|firebase-metadata-service|FirebaseMetadataService" src` → **zero** matches (except comments documenting migration if unavoidable — prefer zero).
2. `rg -n "from ['\\\"].*firebase-(chat|database|media|calendar|metadata)" src` → **zero**.
3. Portal typecheck: `npx tsc --noEmit` (or project’s existing typecheck script) on Portal — exit 0 for changed graph.
4. Smoke (manual or script if exists): open Groups chat list (JWT), confirm send still hits `POST /chats/:id/messages` (network tab); profile/members screen that used `DataService` still loads.
5. Aikido scan on modified first-party files before declaring complete.
6. Update `tasks.md` task 61 (or a short note under Phase 12) with **VERIFIED** date + rename list; SDK removal still unchecked under task 68.

---

## 6. Stage 3 micro-task checklist (execute one-at-a-time after approval)

1. Chat: extract types → `chat-types.ts`; add/rename `ChatApiService` in `chat-service.ts`; point `ChatContext` + groups components at new imports; delete `firebase-chat-service.ts`; update barrel; `rg` + tsc.
2. DataService: create `data-service.ts`, update all call sites, delete `firebase-database.ts`; `rg` + tsc.
3. Media: `media-library-service.ts`, update barrel + callers, delete old; `rg` + tsc.
4. Calendar: rename file + imports + barrel; delete old; `rg` + tsc.
5. Metadata: rename file/class + callers; delete old; `rg` + tsc.
6. Final gate: full `rg` zero for old names; Aikido; `tasks.md` note.

---

## 7. Approval gate

Reply **Approved. Proceed to Stage 3** to start micro-task 1 (chat consolidation only).  
Or request changes to naming (`DataService` vs `ApiDataService`, chat class name, etc.) before execution.
