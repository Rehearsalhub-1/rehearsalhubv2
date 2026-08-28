# Stage 2 Technical Specification — Portal Writes Slice A (Task 61 partial)

**Direction:** Move Zonal Portal **mapped** writes onto existing JWT write routes in `rehearsalhub-api`. Prefer live Postgres shapes. **Remove Firebase — do not keep Firestore as a fallback** for any migrated path (same rule as reads tasks 40–42). If no JWT route exists yet: no-op + warn, or add a minimal API route — never `addDoc`/`updateDoc`/`setDoc`/`deleteDoc`/`onSnapshot` as “temporary.” Delete Firebase modules/call sites once unused. Do not invent media/audiolab/support write APIs in this slice unless required to kill Firebase. Do not touch `/api/master-songs` or `/api/praise-night-songs`.

**Problem:** Portal chat (and related) still `addDoc`/`updateDoc`/`deleteDoc`/`setDoc` against Firestore while create/send/patch chat already exist on the API (`writes.routes.ts`). Profile updates already use `PATCH /profiles/:id` via `BackendAPI`. Activity-log and `database.ts` Supabase inserts have **no** matching JWT write routes — those must stop hitting Firebase/Supabase too (no-op or new route), not remain on Firebase.

---

## 0. Scope (Slice A)

### In

1. **Chat create / update membership / send message** in Portal `chat-service.ts` (primary UI path) → JWT writes.
2. Mirror the same write paths in `firebase-chat-service.ts` where those methods are still imported (or delete unused Firebase write wrappers after call-site audit).
3. Expand Portal `BackendAPI` / thin helpers for chat writes (`POST /chats`, `PATCH /chats/:id`, `POST /chats/:id/messages`).
4. Confirm profile update path stays on `PATCH /profiles/:id` only (no Firestore/Supabase).
5. `activity-logs-service.logActivity`: stop Firestore `addDoc` — either **defer with console.warn + no-op** (preferred if no POST route) or add minimal `POST /activity-logs` (only if Stage 3 explicitly expands API).
6. Spec + `tasks.md` note for partial task 61.

### Out (later slices / tasks 62–64)

- `onSnapshot` / RTDB `onValue` → WebSocket
- Typing (`typing_v2`), friend_requests, starred_messages
- Message edit / soft-delete / reactions (no message PATCH route yet)
- Voice/video call create (API exists — **Slice B**)
- `database.ts` Supabase page/song/media inserts
- Media / audiolab / calendar / schedule writes
- Admin/Mobile write migration

---

## 1. Structural interface alterations

### 1.1 Portal helpers (new or extend)

Add `src/app/pages/groups/_lib/chat-api-writes.ts` (or extend `chat-api-helpers.ts`) with typed wrappers:

| Helper | HTTP |
|---|---|
| `apiCreateChat({ type, name?, member_ids, zone_id? })` | `POST /chats` |
| `apiPatchChat(chatId, { name?, member_ids?, last_message?, last_message_at? })` | `PATCH /chats/:chatId` |
| `apiSendMessage(chatId, { content, type?, media_url?, reply_to? })` | `POST /chats/:chatId/messages` |

All use existing `apiClient` (JWT + refresh). Envelope: `{ success, data?, error? }`. On failure: log server-side detail only via API; surface generic string to UI.

### 1.2 `chat-service.ts` mapping

| Current Firestore write | Replacement |
|---|---|
| `getOrCreateDirectChat` → `addDoc(chats_v2)` | `findDirectChat` (API list) then `apiCreateChat({ type:'direct', member_ids:[a,b] })` |
| `createGroupChat` → `addDoc` + system `addDoc(messages)` | `apiCreateChat({ type:'group', name, member_ids })` then optional `apiSendMessage` for system text |
| `sendMessage` → `addDoc(messages)` + `updateDoc(chat lastMessage)` | `apiSendMessage` only (API updates last message + broadcasts) |
| `deleteChat` / leave / rename / avatar / members / admins via `updateDoc`/`deleteDoc` | Prefer `apiPatchChat` with `member_ids` / `name` where schema allows; **chat hard-delete** has no DELETE route → `apiPatchChat` remove self from `member_ids` (soft leave) or warn + no-op until DELETE exists — **never Firestore** |
| Typing `setDoc`/`deleteDoc` | **Remove Firebase.** No typing API → no-op + warn (or add minimal typing/WS later). Do not leave `setDoc` on `typing_v2` |
| Message edit/delete/reactions | **Remove Firebase.** No message PATCH → no-op + warn, or add minimal `PATCH /chats/:chatId/messages/:id` in Stage 3 if product-critical |

### 1.3 `firebase-chat-service.ts`

Same write replacements for methods still used by UI. After audit: if a method is only used by dead code, **delete** the method/file dependency rather than stub.

### 1.4 Profile

No change required if `useOptimizedProfile` already uses `BackendAPI.profiles.update`. Verify zero Firestore/Supabase profile writes remain.

### 1.5 Activity logs

`logActivity`: remove `addDoc`. Default: `console.warn` + return (read path already API). Do **not** add `POST /activity-logs` unless user expands Stage 3 to include API work.

### 1.6 BackendAPI.generic.create/update

Map:
- `create('chats'|'chats_v2', …)` → `POST /chats` (adapt body to `member_ids`/`type`)
- `update('chats'|'chats_v2', id, …)` → `PATCH /chats/:id` where fields fit schema

Unmapped collections: `{ success:false }` — never fall back to Firebase.

---

## 2. Data contracts

### `POST /chats` body (existing zod)

```ts
{ type: string; member_ids: string[]; name?: string; zone_id?: string }
```

Response `201`: `{ success:true, data: ChatRow }` (`chats_v2` row; id = server UUID).

### `PATCH /chats/:chatId` body

```ts
{ name?: string; last_message?: string; last_message_at?: string /* ISO datetime */; member_ids?: string[] }
```

Must be non-empty. Membership-gated.

### `POST /chats/:chatId/messages` body

```ts
{ content: string; type?: string; media_url?: string /* URL */; reply_to?: string }
```

Note: Portal today sends richer media (voice duration, attachment object). Slice A maps:
- text → `content`
- image/document/voice → `type` + `media_url` when a public URL exists; otherwise omit media fields and put placeholder text in `content` (e.g. `"Voice message"`)
- `reply_to` → message id string only

Server sets `senderId` from JWT — client must not trust client-supplied sender for auth.

### Identity

All writes use `profiles.id` as JWT `sub` (already Stage 3 auth). Chat `participants` must store profile ids.

---

## 3. Error-handling matrix

| Failure | Client behavior | Server |
|---|---|---|
| 401 / refresh fail | Existing `SessionExpiredError` / logout path | — |
| 403 not a chat member | Return `false` / null; toast generic “Unable to update chat” | `Forbidden` |
| 404 chat | Return `false` / null | `Not found` |
| 400 validation | Return `false`; log field issues client-side at warn | `Invalid body` |
| Network / 500 | Return `false`; never show raw DB/network text | Generic `Something went wrong` + server log |

**No dual-write and no Firebase fallback.** Migrated paths use API only. Unmapped paths use no-op/warn or a new JWT route — never Firestore/Supabase.

**Realtime:** Slice A writes must not depend on `onSnapshot`. Prefer optimistic local state after successful API write. Replacing remaining `onSnapshot`/`onValue` is tasks 62–64 — those listeners are **removed**, not left on Firebase long-term.

---

## 4. Type-safety & boundaries

- Strict TS on helpers; no `any` on request bodies — use explicit interfaces matching zod fields.
- Portal talks **only** to `rehearsalhub-api` over HTTP for these writes.
- Pin no new deps.
- Keep files under ~300 lines; helpers single-purpose.

---

## 5. Verification plan

1. Static: `rg "addDoc\(|updateDoc\(|deleteDoc\(|setDoc\(" src/app/pages/groups/_lib/chat-service.ts` → **zero**.
2. Same for `firebase-chat-service.ts` write paths (or delete the file if unused after migration).
3. `rg "addDoc|updateDoc|setDoc|deleteDoc" src/lib/activity-logs-service.ts` → **zero**.
4. Smoke script (API): JWT login → `POST /chats` → `POST /chats/:id/messages` → `GET /chats/:id/messages` returns row; optional WS broadcast not required for Slice A gate.
5. Portal: typecheck changed files / `tsc --noEmit` on touched modules if project script exists.
6. Update `tasks.md` task 61 **PARTIAL** with Slice A note; 62–65 remain open.
7. Aikido scan on new/changed Portal first-party files when MCP available.

---

## 6. Micro-task checklist (Stage 3 preview — do not execute until approved)

1. Add `chat-api-writes.ts` helpers + types.
2. Migrate `chat-service.ts` create/send/patch/leave/rename paths; remove all Firestore writes (typing/edit/react → API or no-op).
3. Migrate or **delete** `firebase-chat-service.ts` after call-site audit (prefer delete when redundant with `chat-service.ts`).
4. Map `BackendAPI.generic` chat create/update; verify profile update-only path.
5. Remove `activity-logs` Firestore write (no-op or POST if added).
6. Smoke + `tasks.md` + Aikido. Zero `addDoc`/`updateDoc`/`setDoc`/`deleteDoc` in migrated files.

---

**Halt.** Reply **“Approved. Proceed to Stage 3”** (or adjust scope: e.g. include activity-logs POST / calls Slice B) before any implementation.
