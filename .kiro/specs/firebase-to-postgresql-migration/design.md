# Design Document — Firebase to PostgreSQL Migration

## Overview

The migration replaces Firebase (Auth, Firestore, Realtime Database) across four projects with a self-owned stack. The `rehearsalhub-api` (Node.js/Express/Drizzle/PostgreSQL on Supabase) becomes the single backend. All clients — `rehearsalhubv2` (Mobile), `rehearsalhub-admin` (Admin), and `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode` (Zonal Portal) — talk only to this API. No client ever touches the database directly.

The migration is strictly incremental. Each phase leaves every project in a deployable state.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   rehearsalhub-api                   │
│  Express + TypeScript + Drizzle ORM                  │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │  /auth   │  │  /api/*  │  │  WebSocket      │   │
│  │  routes  │  │  routes  │  │  Server (ws)    │   │
│  └──────────┘  └──────────┘  └─────────────────┘   │
│                     │                                │
│              ┌──────▼──────┐                        │
│              │  Drizzle    │                        │
│              │  ORM        │                        │
│              └──────┬──────┘                        │
└─────────────────────│────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  PostgreSQL      │
              │  (Supabase-      │
              │   managed)       │
              └─────────────────┘

Clients:
  rehearsalhubv2      → HTTP + WebSocket → rehearsalhub-api
  rehearsalhub-admin  → HTTP + WebSocket → rehearsalhub-api
  Zonal Portal        → HTTP + WebSocket → rehearsalhub-api
```

---

## Phase Order

Each phase must be complete and deployed before the next begins.

1. **Phase 1 — API: Auth Service** (JWT, refresh tokens, bcrypt, rate limiting)
2. **Phase 2 — Mobile: Auth Migration** (replace Firebase Auth with JWT)
3. **Phase 3 — Admin: Auth Migration** (replace Firebase Auth with JWT)
4. **Phase 4 — Zonal Portal: Auth Migration** (replace Firebase Auth with JWT)
5. **Phase 5 — API: Core Data Endpoints** (profiles, zones, members, songs, etc.)
6. **Phase 6 — Mobile: Firestore Read Replacement** (call API instead of Firestore)
7. **Phase 7 — Admin: Firestore Read Replacement**
8. **Phase 8 — Zonal Portal: Firestore/Supabase Read Replacement**
9. **Phase 9 — API: Write Endpoints + WebSocket Server**
10. **Phase 10 — Mobile: Write + Snapshot Listener Replacement**
11. **Phase 11 — Admin: Write + Snapshot Listener Replacement**
12. **Phase 12 — Zonal Portal: Write + Realtime Replacement**
13. **Phase 13 — Firebase SDK Cleanup** (all four projects)

---

## Phase 1 — API Auth Service

### New files in `rehearsalhub-api/src/`

```
src/
  auth/
    auth.routes.ts       — POST /auth/login, /auth/refresh, /auth/logout, /auth/me
    auth.service.ts      — issue/validate/revoke JWT + refresh tokens
    auth.middleware.ts   — requireAuth (replaces apiKeyAuth for user routes)
    password.ts          — bcrypt hash + compare
    token.ts             — sign/verify JWT, generate refresh token
    revocation.ts        — in-memory revocation list (Map + TTL cleanup)
  schema.ts              — add: users, refresh_tokens tables (Drizzle)
```

### JWT Design

- Algorithm: HS256, secret from `JWT_SECRET` env (min 256-bit)
- Access token TTL: 15 minutes
- Refresh token TTL: 30 days, stored as `bcrypt(token)` in `refresh_tokens` table
- Payload: `{ sub: userId, role, zoneId, iat, exp }`
- Replay protection: each refresh token is single-use; reuse triggers full session revocation

### New Drizzle tables

```typescript
// users — the auth identity table
users: {
  id: text (uuid, PK)
  email: text (unique, not null)
  password_hash: text (not null)
  role: text (not null)  // 'member' | 'admin' | 'hq_admin' | 'zone_admin'
  zone_id: text
  created_at: timestamp
  updated_at: timestamp
}

// refresh_tokens — one row per active session
refresh_tokens: {
  id: text (uuid, PK)
  user_id: text (FK → users.id)
  token_hash: text (not null)  // bcrypt of the raw token
  expires_at: timestamp (not null)
  created_at: timestamp
}
```

### Rate limiting

The existing `express-rate-limit` instance is already in `index.ts`. Auth routes get a tighter limiter: 10 attempts per IP per 15 minutes on `POST /auth/login`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | none | Email + password → JWT + refresh token |
| POST | `/auth/refresh` | none | Refresh token → new JWT + new refresh token |
| POST | `/auth/logout` | Bearer JWT | Revoke JWT + refresh token |
| GET | `/auth/me` | Bearer JWT | Return user profile from JWT claims |
| POST | `/auth/kingschat-login` | none | KingsChat accessToken → JWT + refresh token |
| POST | `/auth/reset-password` | none | Identity verification + password update |

---

## Phase 2–4 — Client Auth Migration

### Mobile (`rehearsalhubv2`)

- Replace `@react-native-firebase/auth` calls in `src/lib/firebase.ts` and auth-related stores
- New `src/lib/apiClient.ts` — thin fetch wrapper that attaches `Authorization: Bearer <jwt>` and handles 401 → silent refresh → retry
- Store JWT + refresh token in `expo-secure-store`
- Auth state held in existing Zustand store — swap Firebase `onAuthStateChanged` for a startup call to `GET /auth/me`

### Admin (`rehearsalhub-admin`)

- Same pattern as Mobile
- Role check (`admin`, `hq_admin`, `zone_admin`) sourced from JWT claims via `/auth/me`
- Remove `src/lib/firebase.ts` auth initialisation once complete

### Zonal Portal

- Replace `authStore.ts` `onAuthStateChanged` with a `GET /auth/me` fetch on page load
- JWT stored in `sessionStorage` (access) + `HttpOnly` cookie (refresh) via API `Set-Cookie`
- Next.js `src/middleware.ts` reads the session cookie to gate protected routes
- Replace `firebase-auth.ts` `signIn`, `signOut`, `signInWithCustomToken` with API calls

---

## Phase 5 — API Core Data Endpoints

### New route modules in `rehearsalhub-api/src/routes/`

All routes require `requireAuth` middleware unless marked public.

| Route module | Base path | Key endpoints |
|---|---|---|
| `profiles.routes.ts` | `/profiles` | GET `/:userId`, PATCH `/:userId` |
| `zones.routes.ts` | `/zones` | GET `/`, GET `/:zoneId`, GET `/:zoneId/members` |
| `members.routes.ts` | `/members` | GET `/zone/:zoneId`, GET `/hq` |
| `songs.routes.ts` | `/songs` | GET `/master`, GET `/master/:id`, GET `/praise-night` (already exists, keep) |
| `schedule.routes.ts` | `/schedule` | GET `/`, GET `/:scheduleId` |
| `praise-nights.routes.ts` | `/praise-nights` | GET `/`, GET `/:id` |
| `chats.routes.ts` | `/chats` | GET `/:chatId`, GET `/:chatId/messages` |
| `calls.routes.ts` | `/calls` | GET `/:callId` |
| `subscriptions.routes.ts` | `/subscriptions` | GET `/:userId` |
| `activity-logs.routes.ts` | `/activity-logs` | GET `/` |

Response shapes match current Firestore document shapes to avoid simultaneous client changes.

---

## Phase 9 — WebSocket Server

### Design

- Use `ws` package (already compatible with Express `http.Server`)
- Single `/ws` endpoint, auth via `?token=<jwt>` query param on upgrade
- Message protocol:

```typescript
// Client → Server
{ type: 'subscribe',   resource: string, id: string }
{ type: 'unsubscribe', resource: string, id: string }
{ type: 'ping' }

// Server → Client
{ type: 'subscribed',   resource: string, id: string }
{ type: 'event',        resource: string, id: string, data: unknown }
{ type: 'error',        message: string }
{ type: 'pong' }
```

- Subscription registry: `Map<connectionId, Set<`${resource}:${id}`>>`
- Event dispatch: when a write endpoint mutates data, it calls `wsServer.broadcast(resource, id, data)`
- Deduplication: write + broadcast are synchronous within the same request handler; no duplicate events possible
- Reconnect: client resubscribes after reconnect; server sends current state immediately on subscribe

### Subscribed resources

| Resource | Trigger |
|---|---|
| `profile` | Profile update |
| `subscription` | Subscription update |
| `chat` | Chat metadata update |
| `messages` | New message in chat |
| `call` | Call status change |
| `zone_activity` | Zone-level activity log entry |

---

## Phase 10–12 — Client Realtime Migration

### Mobile

- Single `useWebSocket` hook in `src/hooks/useWebSocket.ts`
- Opened after successful auth, closed on logout
- Replaces all `onSnapshot` calls in: `App.tsx` (profile, calls), `ChatRoomScreen`, `CallScreen`, profile store, subscription store
- Exponential backoff reconnect: 1s → 2s → 4s … max 30s

### Admin

- Same `useWebSocket` hook pattern
- Replaces Firestore listeners on admin data screens

### Zonal Portal

- `useWebSocket` hook or equivalent in `src/hooks/useWebSocket.ts`
- Replaces `useRealtimeData`, `useRealtimeSong`, `useRealtimeComments`, `useRealtimeNotifications`
- Replaces `CallContext.tsx` Firebase Realtime DB listener
- Replaces `RealtimeNotifications.tsx` Firebase listener

---

## Phase 13 — Firebase SDK Cleanup

Order matters — only remove once all callers are confirmed gone.

### Mobile
1. Remove `src/lib/firebase.ts`, `src/lib/firebase-polyfill/`
2. Remove from `package.json`: `firebase`, `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`, `@react-native-firebase/storage`
3. Remove `google-services.json` Firebase config entries

### Admin
1. Remove `src/lib/firebase.ts`
2. Remove `firebase` from `package.json`
3. Remove `EXPO_PUBLIC_FIREBASE_*` env vars

### Zonal Portal
1. Remove: `firebase-setup.ts`, `firebase-auth.ts`, `firebase-database.ts`, `firebase-low-data-service.ts`, `firebase-metadata-service.ts`, `firebase-comment-service.ts`, `fcm-web.ts` (after push migration), `supabase-client.ts`, `supabase.ts`, `supabase-support.ts`
2. Remove `firebase` and `@supabase/supabase-js` from `package.json`
3. Remove all `NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_SUPABASE_*` env vars

---

## Security Decisions

| Concern | Decision |
|---|---|
| JWT algorithm | HS256 with env-provided secret ≥ 256 bits |
| Refresh token storage | Hashed with bcrypt (cost 12) in PostgreSQL |
| Refresh token rotation | Single-use; reuse = full session revocation |
| Rate limiting (login) | 10 req / 15 min / IP via `express-rate-limit` |
| Password hashing | bcrypt cost 12, min length 8 |
| SQL injection | Drizzle ORM parameterised queries only |
| Input validation | `zod` schemas at route boundary |
| Error messages | Generic to client, detailed server-side only |
| CSRF | `X-Requested-With` header check on state-changing endpoints |
| Cookies (Zonal Portal) | `HttpOnly`, `Secure`, `SameSite=Strict` on refresh token cookie |

---

## New Dependencies (API only)

| Package | Version | Purpose |
|---|---|---|
| `jsonwebtoken` | `9.0.2` | JWT sign/verify |
| `@types/jsonwebtoken` | `9.0.6` | Types |
| `bcrypt` | `5.1.1` | Password + refresh token hashing |
| `@types/bcrypt` | `5.0.2` | Types |
| `zod` | `3.23.8` | Input validation schemas |
| `ws` | `8.18.0` | WebSocket server |
| `@types/ws` | `8.5.13` | Types |

All other existing dependencies remain unchanged.

---

## What Does NOT Change

- Existing `/api/master-songs` and `/api/praise-night-songs` endpoints — untouched throughout
- Existing `x-api-key` auth on those public endpoints — untouched
- Database schema for `master_songs` and `praise_night_songs` tables — untouched
- Cloudinary, KingsPay, OneSignal integrations in Zonal Portal — untouched
- Mobile `AsyncStorage` cache layer (`screenCache`, `lowDataOptimizer`) — populated from API responses, not modified
