# Stage 2 Technical Specification — API Foundation Fixes

**Scope:** Re-opened tasks 43, 48, 45, 1, 10 in `rehearsalhub-api` only. No client code changes. No changes to `/api/master-songs` or `/api/praise-night-songs`.

**Verified current state (Stage 1 audit):**
- `src/ws/wsServer.ts` imports `ws` but the package is not in `package.json` — fresh install crashes at import.
- `broadcast()` is exported and correct but never called; four write routes carry `// broadcast(...) — wired in task 48` comments.
- No chat create/update endpoints exist; `chats_v2` schema has `id, name, type, zone_id, member_ids (jsonb), last_message, last_message_at, created_at, updated_at`.
- Migration-added deps use caret ranges (`^`), violating Requirement 15.7 (exact pins).
- Two boundary violations found during audit: `POST /chats/:chatId/messages` and `PATCH /calls/:callId` perform no participant/ownership check (Requirement 5.3).

---

## 1. Structural interface alterations

### 1.1 `package.json` (Task 43 + Task 1 remainder)

- Add `"ws": "8.18.0"` to dependencies; `"@types/ws": "8.5.13"` to devDependencies (exact, no `^`).
- Re-pin migration-added deps to exact versions already installed: `jsonwebtoken 9.0.2`, `bcrypt 5.1.1`, `zod 3.23.8`, `@types/jsonwebtoken 9.0.6`, `@types/bcrypt 5.0.2`. Pre-existing deps (express, cors, etc.) untouched.

### 1.2 New endpoints (Task 45 remainder) — in `src/routes/writes.routes.ts`

| Method | Path | Auth rule | Body (zod, `.strict()`) | Response |
|---|---|---|---|---|
| POST | `/chats` | `requireAuth`; creator auto-included in `member_ids` | `{ name?: string, type: string, zone_id?: string, member_ids: string[] (min 1) }` | 201 `{ success, data: chat }` |
| PATCH | `/chats/:chatId` | `requireAuth`; 403 unless `auth.userId ∈ chat.memberIds` | `{ name?, last_message?, last_message_at?, member_ids? }` (≥1 key) | 200 `{ success, data: chat }` |

File grows to ~320 lines — accepted deviation from the 300-line guideline: keeping all Phase 9 writes in one module keeps broadcast wiring reviewable in one place.

### 1.3 Broadcast wiring (Task 48)

`import { broadcast } from '../ws/wsServer'` where needed. Calls placed synchronously after the awaited DB write, before the HTTP response (guarantees per-resource ordering, Requirement 7.4; no duplicates, Requirement 7.8):

| Route | Broadcast |
|---|---|
| `PATCH /profiles/:userId` (`profiles.routes.ts`) | `broadcast('profile', userId, updated)` |
| `PATCH /profiles/:userId/onesignal` | `broadcast('profile', userId, updatedRow)` (change `.set(...)` to `.returning()` to get the row) |
| `POST /members/zone-switch` | `broadcast('profile', auth.userId, updatedRow)` (side-effect parity, Requirement 14.7) |
| `PATCH /subscriptions/:userId` | `broadcast('subscription', userId, updated)` |
| `POST /chats/:chatId/messages` | `broadcast('messages', chatId, msg)` **and** `broadcast('chat', chatId, updatedChat)` after updating `last_message`/`last_message_at` (Firestore parity: clients previously `updateDoc`'d chat metadata on every send) |
| `POST /chats` | `broadcast('chat', chat.id, chat)` |
| `PATCH /chats/:chatId` | `broadcast('chat', chatId, updated)` |
| `POST /calls` | `broadcast('call', call.id, call)` |
| `PATCH /calls/:callId` | `broadcast('call', callId, updated)` |

`zone_activity` broadcasts deferred: no activity-log write endpoint exists yet; will be wired when that endpoint is created.

### 1.4 Boundary hardening (Requirement 5.3 fixes)

- `POST /chats/:chatId/messages`: load chat first; 404 if missing; 403 unless `auth.userId ∈ memberIds`. This read also feeds the `last_message` update — one extra query total.
- `PATCH /calls/:callId`: 403 unless `auth.userId === callerId || auth.userId === receiverId`.

## 2. Data contract / schema migrations

**None.** No table or column changes; `chats_v2` already holds every field the new endpoints touch. No route renames.

## 3. Error-handling matrix

| Failure | Where | Client sees | Server logs |
|---|---|---|---|
| Invalid body | zod `.safeParse` at every handler top | 400 `{ success: false, error: 'Invalid body' }` | zod issue detail |
| Not a chat member / not a call party / not owner | ownership guard before write | 403 `{ success: false, error: 'Forbidden' }` | userId + resource id |
| Chat/call/profile/subscription not found | post-query check | 404 `{ success: false, error: 'Not found' }` | — |
| DB error (network, constraint) | existing Express error path | 500 generic | full error server-side |
| Broadcast to closed socket | `readyState !== OPEN` guard already in `wsServer.ts` | n/a (skipped silently) | — |
| `member_ids` malformed jsonb | normalize with `Array.isArray()` check before `.includes` | treated as non-member → 403 | — |

Broadcast failures can never fail the HTTP write: `broadcast()` only iterates in-memory maps and `socket.send` on open sockets; the DB write has already committed.

## 4. Type-safety and boundary isolation

- All new code TypeScript strict; zod schemas use `.strict()` so unknown keys are rejected at the boundary.
- `memberIds` (jsonb) narrowed via `Array.isArray(chat.memberIds) ? chat.memberIds as string[] : []` — no unchecked casts on untrusted DB jsonb.
- Clients remain unaware of any of this until their own phases — response envelope `{ success, data }` unchanged; only additive endpoints/events.
- Only `rehearsalhub-api` touches the database; no cross-repo edits in this phase.

## 5. Verification plan (Task 10 + 51 checkpoint re-run)

1. `rmdir node_modules` (or fresh clone) → `npm install` → `npm run build` — zero TS errors proves the `ws` fix.
2. Start server: `GET /health` → 200.
3. `POST /auth/login` bad creds → 401 generic; 11 rapid logins → 429 on 11th.
4. `GET /api/master-songs` with `x-api-key` → 200 (untouched-endpoint guarantee).
5. WebSocket smoke test (node script): connect `ws://localhost:3000/ws?token=<jwt>` → `subscribe {resource:'profile', id:<uid>}` → receive `subscribed` → `PATCH /profiles/<uid>` via HTTP → assert one `event` frame arrives with the updated row; repeat for `chat` + `messages` via `POST /chats` and message send.
6. Negative: message send to a chat the user is not a member of → 403, no event emitted.

## Stage 3 micro-task checklist (pending approval)

1. **T1** — package.json: add `ws`/`@types/ws`, re-pin migration deps, `npm install`, `npm run build`.
2. **T2** — writes.routes.ts: add `POST /chats` + `PATCH /chats/:chatId` with membership guards.
3. **T3** — writes.routes.ts: membership guard + chat metadata update in `POST /chats/:chatId/messages`; party guard in `PATCH /calls/:callId`.
4. **T4** — wire all `broadcast()` calls (writes.routes.ts + profiles.routes.ts).
5. **T5** — checkpoint: full verification plan above; update tasks.md checkboxes 43/45/48/1/10/51 on pass.
