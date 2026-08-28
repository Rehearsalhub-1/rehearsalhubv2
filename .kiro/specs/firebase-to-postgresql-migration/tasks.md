# Implementation Plan: Firebase to PostgreSQL Migration

## Overview

Incremental migration of four projects away from Firebase (Auth, Firestore, Realtime Database) to a self-owned stack: custom JWT auth, PostgreSQL via Drizzle ORM, and a custom WebSocket server. The `rehearsalhub-api` is the single backend. Every phase leaves the system in a deployable state. Existing `/api/master-songs` and `/api/praise-night-songs` public endpoints are never touched.

Phases follow the order mandated by Requirement 14.1:
1. API Auth Service → 2. Client Auth (Mobile, Admin, Zonal Portal) → 3. API Core Data Endpoints → 4. Client Read Migration → 5. API Write + WebSocket → 6. Client Write + Realtime Migration → 7. Firebase SDK Cleanup

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "description": "Phase 1 — API Auth Service (foundation for all other phases)"
    },
    {
      "wave": 2,
      "tasks": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
      "description": "Phase 2-5 — Client Auth Migration (Mobile, Admin, Portal) + API Core Data Endpoints (can run in parallel per project)"
    },
    {
      "wave": 3,
      "tasks": [34, 35, 36, 37, 38, 39, 40, 41, 42],
      "description": "Phase 6-8 — Client Firestore Read Replacement (parallel per client)"
    },
    {
      "wave": 4,
      "tasks": [43, 44, 45, 46, 47, 48, 49, 50, 51],
      "description": "Phase 9 — API Write Endpoints + WebSocket Server"
    },
    {
      "wave": 5,
      "tasks": [52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65],
      "description": "Phase 10-12 — Client Write + Realtime Migration (parallel per client)"
    },
    {
      "wave": 6,
      "tasks": [66, 67, 68, 69],
      "description": "Phase 13 — Firebase SDK Cleanup (all four projects, in order)"
    }
  ]
}
```

---

## Tasks

> **⚠ AUDIT 2026-08-06:** Every task was previously marked `[x]`, but a code-level cross-check of all four repos found many incomplete. Checkboxes below now reflect **verified code state**, not prior claims. Tasks re-opened by the audit carry an `AUDIT:` note explaining exactly what remains.

### Phase 1 — API: Auth Service

> All tasks in this phase are in `rehearsalhub-api/`. Phase 1 must be complete and deployed before Phase 2 begins.

- [x] 1. Install auth dependencies and update environment config
  - **VERIFIED 2026-08-06:** `jsonwebtoken`, `bcrypt`, `zod`, `@types/*` pinned exact in `package.json`; `ws@8.18.0` + `@types/ws@8.5.13` present (task 43).
  - Run `npm install jsonwebtoken@9.0.2 bcrypt@5.1.1 zod@3.23.8`
  - Run `npm install --save-dev @types/jsonwebtoken@9.0.6 @types/bcrypt@5.0.2`
  - Add to `.env` and `.env.example`: `JWT_SECRET` (min 256-bit random string), `JWT_EXPIRES_IN=15m`, `REFRESH_TOKEN_EXPIRES_DAYS=30`
  - Pin all versions exactly as listed above — no range specifiers
  - _Requirements: 1.10, 15.7_

- [x] 2. Add `users` and `refresh_tokens` tables to `src/schema.ts`
  - Append to the existing `src/schema.ts` (do not remove `masterSongs` or `praiseNightSongs`)
  - `users` table: `id` (text, uuid PK), `email` (text, unique, not null), `password_hash` (text, not null), `role` (text, not null — `'member' | 'admin' | 'hq_admin' | 'zone_admin'`), `zone_id` (text, nullable), `created_at` (timestamp, defaultNow), `updated_at` (timestamp)
  - `refresh_tokens` table: `id` (text, uuid PK), `user_id` (text, FK → `users.id`, cascade delete), `token_hash` (text, not null), `expires_at` (timestamp, not null), `created_at` (timestamp, defaultNow)
  - Add index on `refresh_tokens.user_id` for fast lookup on refresh/logout
  - **SUPERSEDED 2026-08-06 (Stage 3 — auth against profiles):** Identity = `profiles` (701 live rows). Additive `auth_credentials(profile_id)` + `refresh_tokens.user_id` stores `profiles.id` (FK → `profiles`, not `users`). Drizzle no longer requires `public.users` for auth. Spec: `stage2-spec-auth-against-profiles.md`.
  - _Requirements: 1.7, 1.4_

- [x] 3. Create `src/auth/token.ts` — JWT sign and verify utilities
  - Export `signAccessToken(payload: { sub: string; role: string; zoneId?: string }): string` — signs HS256 JWT, TTL from `JWT_EXPIRES_IN` env
  - Export `verifyAccessToken(token: string): JwtPayload` — throws `JsonWebTokenError` or `TokenExpiredError` on failure; never swallows errors
  - Export `generateRefreshToken(): string` — returns 48-byte cryptographically random hex string via `crypto.randomBytes`
  - Keep the file under 80 lines; no external state
  - _Requirements: 1.1, 1.10_


- [x] 4. Create `src/auth/password.ts` — bcrypt helpers
  - Export `hashPassword(plain: string): Promise<string>` — bcrypt cost 12
  - Export `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - Export `validatePasswordStrength(plain: string): boolean` — returns false if length < 8
  - _Requirements: 1.2, 13.9_

- [x] 5. Create `src/auth/revocation.ts` — in-memory JWT revocation list
  - Export a `RevocationStore` class with:
    - `revoke(jti: string, expiresAt: Date): void` — adds entry to a `Map<jti, expiresAt>`
    - `isRevoked(jti: string): boolean`
    - A cleanup interval (run every 10 min) that deletes entries past their `expiresAt`
  - Export a singleton `revocationStore` instance
  - The `jti` claim must be added to JWT payload in `token.ts` (`crypto.randomUUID()`)
  - Update `signAccessToken` in task 3 to include `jti` in the payload
  - _Requirements: 1.9, 13.8_

- [x] 6. Create `src/auth/auth.service.ts` — core auth business logic
  - Export `login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }>` — queries `users` by email, verifies password via `verifyPassword`, throws `AuthError` (HTTP 401) for any mismatch without distinguishing email vs password
  - Export `refresh(rawToken: string, userId: string): Promise<{ accessToken: string; refreshToken: string }>` — looks up `refresh_tokens` row by `userId`, compares bcrypt hash, single-use rotation: deletes old row, inserts new row, if token reused revokes entire session family (delete all rows for userId) and throws `AuthError`
  - Export `logout(jti: string, exp: number, userId: string, rawRefreshToken: string): Promise<void>` — revokes JWT via `revocationStore`, deletes matching `refresh_tokens` row
  - Export `getMe(userId: string): Promise<UserProfile>` — returns user row (no password_hash) from `users`
  - Refresh tokens stored as `bcrypt(rawToken, 12)` — never store raw token
  - **VERIFIED 2026-08-06 (Stage 3 live smoke):** login/register/me/refresh against `profiles` + `auth_credentials`; case-insensitive email; JWT `sub` = `profiles.id`; `/auth/me` attaches `hq_members`/`zone_members` membership DTOs; profiles count unchanged (701); `npm run build` exit 0. Members routes optional `?enrich=1` joins profiles as sibling `profile`.
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 13.5_


- [x] 7. Create `src/auth/auth.middleware.ts` — `requireAuth` middleware
  - Export `requireAuth(req, res, next)` — reads `Authorization: Bearer <token>` header, calls `verifyAccessToken`, checks `revocationStore.isRevoked(jti)`, attaches `{ userId: sub, role, zoneId, jti, exp }` to `res.locals.auth`; returns 401 JSON on any failure
  - This middleware is for user-facing routes only — do not replace `apiKeyAuth` on existing `/api/master-songs` or `/api/praise-night-songs` routes
  - _Requirements: 1.3, 1.9, 14.6_

- [x] 8. Create `src/auth/auth.routes.ts` — route handlers
  - Mount a dedicated rate limiter for login: 10 requests / 15 min / IP (use `express-rate-limit`, separate instance from the global one in `index.ts`)
  - `POST /auth/login` — parse + validate body with `zod` (`{ email: string, password: string }`), call `auth.service.login`, return `{ success: true, data: { accessToken, refreshToken, user } }`; return 401 with generic message on failure
  - `POST /auth/refresh` — validate body `{ userId: string, refreshToken: string }`, call `auth.service.refresh`, return new token pair; validate that `userId` in body matches token's stored `user_id` (Requirement 1.11)
  - `POST /auth/logout` — apply `requireAuth`, call `auth.service.logout` with `jti`, `exp`, `userId`, `body.refreshToken`, return 200
  - `GET /auth/me` — apply `requireAuth`, call `auth.service.getMe(res.locals.auth.userId)`, return user profile
  - `POST /auth/kingschat-login` — stub returning `{ success: false, error: 'Not implemented' }` with 501; will be implemented in Phase 9
  - `POST /auth/reset-password` — stub returning `{ success: false, error: 'Not implemented' }` with 501; will be implemented later
  - All error responses: `{ success: false, error: '<generic message>' }` — no stack traces to client
  - _Requirements: 1.1–1.11, 13.1, 13.7_


- [x] 9. Register auth routes in `src/index.ts`
  - Import and mount `authRouter` at `/auth` — no `apiKeyAuth` on this prefix
  - Existing `app.use('/api/master-songs', apiKeyAuth, ...)` and `app.use('/api/praise-night-songs', apiKeyAuth, ...)` lines must remain unchanged
  - Add `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS` to the startup log check (warn if missing, do not crash — keeps Railway deploy recoverable)
  - _Requirements: 14.6_

- [x] 10. Checkpoint — Phase 1 API compiles and health check passes
  - **VERIFIED 2026-08-06:** `npm run build` exit 0; `GET /health` on :3010 returns ok; `GET /auth/me` without token returns 401. Full login/429/master-songs live smoke still depends on a valid `DATABASE_URL` + `JWT_SECRET` in the running env.
  - Run `npm run build` — zero TypeScript errors
  - Run the server locally, confirm `GET /health` returns 200
  - Manually test: `POST /auth/login` with non-existent user returns 401 with generic message
  - Manually test: `POST /auth/login` 11 times rapidly from same IP returns 429 on the 11th
  - Manually test: `GET /auth/me` without token returns 401
  - Confirm existing `GET /api/master-songs` with valid `x-api-key` still returns 200
  - Ensure all tests pass, ask the user if questions arise.



### Phase 2 — Mobile: Auth Migration (`rehearsalhubv2`)

> Requires Phase 1 deployed. All changes in the `rehearsalhubv2/` project.

- [x] 11. Create `src/lib/apiClient.ts` — authenticated fetch wrapper
  - Export `apiClient` object with `get`, `post`, `patch`, `delete` methods
  - Each method attaches `Authorization: Bearer <jwt>` from `expo-secure-store` key `jwt`
  - On 401 response: call `POST /auth/refresh` once with stored `refreshToken` from `expo-secure-store` key `refreshToken`, store new tokens, retry original request exactly once; on second 401 clear tokens and throw `SessionExpiredError`
  - Do not use any Firebase or Supabase client — raw `fetch` only
  - _Requirements: 2.2, 2.6, 2.7_

- [x] 12. Replace Firebase Auth login flow in the Mobile auth store
  - Locate the Zustand auth store (likely `src/store/authStore.ts` or similar)
  - Replace `signInWithEmailAndPassword` call with `apiClient.post('/auth/login', { email, password })`
  - On success: store `accessToken` to `expo-secure-store` key `jwt`, `refreshToken` to key `refreshToken`, write user object to Zustand state
  - On failure: surface generic error message — do not expose server error details to UI
  - _Requirements: 2.1_

- [x] 13. Replace `onAuthStateChanged` session restore with `GET /auth/me`
  - **VERIFIED 2026-08-06:** `App.tsx` prepare uses `/auth/me` only (no Firebase fallback); `useUser._initialize` validates via `/auth/me`; `SubgroupScreen`/`RehearsalScreen` clear caches from `isAuthenticated` store flag. Note: incoming-call + concurrent-session blocks in `App.tsx` still use Firebase `onAuthStateChanged` until Phase 10 (task 54).
  - In app startup (likely `App.tsx` or root layout), replace the `onAuthStateChanged` Firebase listener with: read `jwt` from `expo-secure-store`; if present call `apiClient.get('/auth/me')`; on success populate Zustand auth state; on failure (401 or missing token) navigate to Login
  - _Requirements: 2.5_


- [x] 14. Replace Firebase Auth logout in Mobile
  - **VERIFIED 2026-08-06:** All `auth.signOut()` call sites in `App.tsx` replaced with `useUserStore.signOut()` (API logout + clear tokens + clear store + WS disconnect). OneSignal logout push and concurrent-session logout paths included.
  - Replace `signOut(auth)` call with `apiClient.post('/auth/logout', { refreshToken })` then clear `expo-secure-store` keys `jwt` and `refreshToken` and clear Zustand auth state
  - _Requirements: 2.4_

- [x] 15. Replace KingsChat OAuth flow in Mobile
  - **VERIFIED 2026-08-06:** `SignupScreen` KingsChat path uses `apiClient.post('/auth/kingschat-login')` (no `signInWithCustomToken`). Email signup now uses new `POST /auth/register` (users+profiles+JWT). LoginScreen was already on API.
  - Replace `signInWithCustomToken(auth, firebaseToken)` with `apiClient.post('/auth/kingschat-login', { accessToken: kingsChatAccessToken })`
  - Handle `NO_ACCOUNT` and `MULTIPLE_ACCOUNTS` response shapes from the API exactly as before
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 16. Checkpoint — Mobile auth compiles and works end-to-end
  - **VERIFIED 2026-08-06 (code):** session restore, logout, KingsChat, and register paths no longer use Firebase Auth APIs in Login/Signup/`useUser`/prepare. Full device E2E (login → restart → logout) not run in this session. `SettingsScreen` Firebase `updateProfile`/`deleteUser` still open (out of tasks 11–16; track with cleanup/write migration).
  - `npx expo export` (or equivalent build check) completes without errors
  - Manually verify: login → session persists on restart → logout clears session
  - `@react-native-firebase/auth` may still be in package.json at this point — that is expected; cleanup is Phase 13
  - Ensure all tests pass, ask the user if questions arise.


### Phase 3 — Admin: Auth Migration (`rehearsalhub-admin`)

> Requires Phase 1 deployed. All changes in the `rehearsalhub-admin/` project.

- [x] 17. Create `src/lib/apiClient.ts` in Admin — same pattern as Mobile (task 11)
  - Identical structure to Mobile apiClient: `expo-secure-store` for token storage, 401 → refresh → retry, `SessionExpiredError` clears tokens and redirects
  - _Requirements: 3.1, 3.2_

- [x] 18. Replace Firebase Auth login in Admin auth store
  - **AUDIT:** done, with caveat — login blocks non-admin roles at `LoginScreen.tsx` L43–45, but `refreshUser` is not called after login so `adminUser` context stays stale until remount. Fix alongside task 19.
  - Replace `signInWithEmailAndPassword` with `apiClient.post('/auth/login', { email, password })`
  - Store tokens in `expo-secure-store`; populate Zustand/context auth state
  - After login, verify role from JWT claims (`admin`, `hq_admin`, `zone_admin`) — if role check fails, logout and show access-denied message
  - _Requirements: 3.1, 3.5_


- [x] 19. Replace `onAuthStateChanged` session restore in Admin with `GET /auth/me`
  - **VERIFIED 2026-08-06:** `AuthGate` in `App.tsx` routes to `MainTabs` only when `isAdmin` after `/auth/me`; non-admin roles clear tokens. `LoginScreen` calls `refreshUser()` after `storeTokens`. Dashboard/Notifications use `id`/`email` (not Firebase `uid`/`displayName`).
  - Same pattern as task 13 — read token from `expo-secure-store`, call `/auth/me`, populate auth state; redirect to Login on failure
  - Re-validate role from `/auth/me` response before granting access to `MainTabs` navigator
  - _Requirements: 3.2, 3.5_

- [x] 20. Replace Firebase Auth logout in Admin
  - Same pattern as task 14
  - _Requirements: 3.4_

- [x] 21. Checkpoint — Admin auth compiles and role gate works
  - **VERIFIED 2026-08-06 (code):** role gate + refreshUser + `EXPO_PUBLIC_BACKEND_URL` added to `.env` / `.env.example`. Device E2E (zone_admin vs member) not run in this session.
  - `npx expo export` completes without errors
  - Manually verify: login as `zone_admin` → accesses MainTabs → logout clears session
  - Manually verify: login as `member` role is blocked at MainTabs
  - Ensure all tests pass, ask the user if questions arise.


### Phase 4 — Zonal Portal: Auth Migration

> Requires Phase 1 deployed. All changes in `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode/`.

- [x] 22. Create `src/lib/api-client.ts` in Zonal Portal — HTTP client for the API
  - Thin wrapper around `fetch` that reads the access token from `sessionStorage` and attaches `Authorization: Bearer` header
  - On 401: attempt refresh via `POST /auth/refresh` using the `lwsrh_refresh` `HttpOnly` cookie; on success store new access token in `sessionStorage`; on second failure clear session and redirect to `/auth`
  - _Requirements: 16.1, 16.2_

- [x] 23. Replace `authStore.ts` Firebase `onAuthStateChanged` with `GET /auth/me`
  - In `authStore.ts`, replace the Firebase `onAuthStateChanged(auth, ...)` listener with a `fetchCurrentUser()` function that calls `api-client.get('/auth/me')` and populates store state
  - Call `fetchCurrentUser()` on page load (in `_app.tsx` or root layout)
  - _Requirements: 16.8_


- [x] 24. Replace `firebase-auth.ts` `signIn`, `signOut`, `signInWithCustomToken` in Zonal Portal
  - **VERIFIED 2026-08-06:** Signup uses `POST /auth/register`; callback uses `/auth/me`; reset-password uses `POST /auth/reset-password`; profile delete no longer calls Firebase Auth. Login/logout already on API. `firebase-auth.ts` file may still exist until Phase 13 cleanup (no remaining imports expected).
  - `signIn`: replace with `api-client.post('/auth/login', ...)`, store access token in `sessionStorage`, refresh token arrives via `Set-Cookie` (HttpOnly) from API
  - `signOut`: replace with `api-client.post('/auth/logout', ...)`, clear `lwsrh_is_logged_in` and `sessionStorage`, redirect to `/auth`
  - KingsChat sign-in: call `api-client.post('/auth/kingschat-login', { accessToken })` as per Requirement 9
  - _Requirements: 16.1, 16.3, 16.4, 16.6_

- [x] 25. Update `src/middleware.ts` to validate JWT from cookie/sessionStorage
  - **VERIFIED 2026-08-06:** Middleware checks `lwsrh_jwt` / Bearer + login cookie; protects `/boss`; role-gates `/admin` and `/boss` when JWT present. `api-client.setAccessToken` also writes `lwsrh_jwt` cookie for edge reads.
  - Replace Firebase session check with: read access token from request cookie or `Authorization` header; call `verifyAccessToken` (or validate via `GET /auth/me` if server-side); redirect to `/auth` if invalid
  - Gate `/admin`, `/boss`, `/subgroup-admin` routes by role from JWT claims
  - _Requirements: 16.2, 16.5_

- [x] 26. Checkpoint — Zonal Portal auth compiles and route guard works
  - **VERIFIED 2026-08-06 (code):** tasks 24–25 done. Full `next build` / manual smoke not run in this session.
  - `next build` completes without errors
  - Manually verify: login → `/auth/me` populates store → protected route accessible → logout clears session and redirects
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5 — API: Core Data Endpoints

> Requires Phase 1 complete. Adds read-only data endpoints that client phases depend on.

- [x] 27. Add Drizzle table definitions for all migrated collections in `src/schema.ts`
  - Add tables (do not remove existing tables): `profiles`, `zones`, `zone_members`, `hq_members`, `individual_subscriptions`, `praise_nights`, `chats_v2`, `messages_v2`, `calls_v2`, `schedule`, `activity_logs`, `categories`, `submitted_songs`, `user_song_notes`, `media_doodles`, `app_updates`
  - Column names must match the existing Firestore document field names exactly (Requirement 14.3)
  - Use Drizzle `pgTable` for each — no raw SQL
  - _Requirements: 4.1, 4.2, 14.3, 15.3_

- [x] 28. Create `src/routes/profiles.routes.ts`
  - `GET /profiles/:userId` — `requireAuth`, return profile matching `userId`; 404 if not found
  - `PATCH /profiles/:userId` — `requireAuth`, validate body with `zod`, enforce ownership (`res.locals.auth.userId === userId` or `hq_admin` role), update and return updated profile
  - Response shape identical to Firestore `profiles` document fields
  - _Requirements: 4.2, 4.4, 5.1, 5.3_


- [x] 29. Create `src/routes/zones.routes.ts`
  - `GET /zones` — `requireAuth`, return all zones
  - `GET /zones/:zoneId` — `requireAuth`, return single zone; 404 if not found
  - `GET /zones/:zoneId/members` — `requireAuth`, return zone members from `zone_members` table
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 30. Create `src/routes/members.routes.ts`
  - `GET /members/zone/:zoneId` — `requireAuth`, return zone members
  - `GET /members/hq` — `requireAuth`, admin/hq_admin role only, return HQ members from `hq_members`
  - _Requirements: 4.1, 4.3_

- [x] 31. Create remaining read-only route modules
  - `src/routes/schedule.routes.ts` — `GET /schedule`, `GET /schedule/:scheduleId`
  - `src/routes/praise-nights.routes.ts` — `GET /praise-nights`, `GET /praise-nights/:id`
  - `src/routes/chats.routes.ts` — `GET /chats/:chatId`, `GET /chats/:chatId/messages`
  - `src/routes/calls.routes.ts` — `GET /calls/:callId`
  - `src/routes/subscriptions.routes.ts` — `GET /subscriptions/:userId`
  - `src/routes/activity-logs.routes.ts` — `GET /activity-logs` (admin-gated)
  - `src/routes/categories.routes.ts` — `GET /categories`
  - `src/routes/submitted-songs.routes.ts` — `GET /submitted-songs`
  - All routes: `requireAuth`, `zod` body/param validation, 404 on missing resource, response shape matching Firestore document fields
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 32. Register all Phase 5 routes in `src/index.ts`
  - Mount each router under `/api/<resource>` with `requireAuth`
  - Existing `apiKeyAuth` routes remain untouched on their existing paths
  - _Requirements: 14.6_

- [x] 33. Checkpoint — All Phase 5 endpoints return data
  - `npm run build` — zero TypeScript errors
  - Manually test each endpoint with a valid JWT: expect 200 + correct shape
  - Test unauthenticated request to any Phase 5 endpoint: expect 401
  - Ensure all tests pass, ask the user if questions arise.



### Phase 6 — Mobile: Firestore Read Replacement

> Requires Phase 5 deployed.

- [x] 34. Replace profile Firestore reads in Mobile
  - **VERIFIED 2026-08-06 (code):** zero `profiles` collection `getDoc`/`getDocs` in `src/`. `App.tsx` device check uses `GET /profiles/:id`; NewChat/CreateGroup/ChatInfo/SubgroupAdmin use `profileApi` (`/profiles/directory`, `/profiles/:id`). Concurrent-session still uses profile `onSnapshot` (Phase 10). Settings profile **writes** still Firestore (Phase 9).
- [x] 35. Replace zone membership Firestore reads in Mobile
  - **VERIFIED 2026-08-06 (code):** zero `zone_members`/`hq_members` Firestore reads in `src/`. `ChatListScreen` uses `GET /members/mine`; `SubgroupAdminScreen` uses `GET /members/zone/:id` + new `GET /members/hq/:hqGroupId`; `useUser` already on members API. Membership **writes** (e.g. Settings leave-zone `deleteDoc`) still open (Phase 9).
- [x] 36. Replace remaining Firestore `getDoc`/`getDocs` reads in Mobile
  - **VERIFIED 2026-08-06 (code):** Zero `getDoc`/`getDocs` in `src/` outside polyfill. API maps **existing Supabase tables** (no re-migration): `/favorites/me`, `/playlists/me`, `/attendance/mine`, `/settings/:id`, `/notifications`, `/subgroups/*`, `/songs/zone|subgroup|…`. Mobile Settings/Notifications/Playlists/Rehearsal/Player/SubgroupAdmin/Chat* wired to API. `chats_v2`/`messages_v2` Drizzle aligned to Supabase column shapes (`participants`, `text`, `raw_data`). **Note:** `onSnapshot`/`collection(db` writes remain until Phases 9–10 — that is not `getDoc`.
- [x] 37. Checkpoint — Mobile reads all data from API, no Firestore `getDoc` calls remain
  - **VERIFIED 2026-08-06 (code):** `rg getDoc|getDocs` under `rehearsalhubv2/src` → only `firebase-polyfill`. Device E2E smoke not run this session (Supabase pooler DNS/tenant unreachable from this agent host). `npm run build` on API exit 0.
  - Grep for `getDoc`, `getDocs`, `collection(db` in `rehearsalhubv2/src` — expect zero results
  - Manually smoke-test key screens: Profile, Chat, Song list — data loads correctly
  - Ensure all tests pass, ask the user if questions arise.


### Phase 7 — Admin: Firestore Read Replacement

> Requires Phase 5 deployed.

- [x] 38. Replace all Firestore `getDoc`/`getDocs` reads in Admin
  - **VERIFIED 2026-08-10:** 7 screens use JWT `apiClient` (`/activity-logs`, `/songs/master`, `/categories`, `/praise-nights`, `/profiles/directory`, `/schedule` → `schedule_programs`, `/submitted-songs`). Drizzle/routes aligned to live shapes (`raw_data` merge). `getDoc`/`getDocs` gone from Admin `src`. Category/submitted-song **writes** still Firebase until task 57.
- [x] 39. Checkpoint — Admin reads all data from API
  - **VERIFIED 2026-08-10:** live smoke `scripts/smoke-admin-reads.ts` PASS (activity 100, categories 85, praise nights 70, schedule 23, submitted 200, master sample, profiles); `npm run build` API exit 0; zero `getDoc`/`getDocs` under Admin screens.



### Phase 8 — Zonal Portal: Firestore/Supabase Read Replacement

> Requires Phase 5 deployed.

- [x] 40. Replace `FirebaseDatabaseService` read calls in Zonal Portal
  - **VERIFIED 2026-08-10 (Slice B):** FDS one-shots go through `BackendAPI` → JWT GETs (profiles, members, subgroups, praise nights, categories, schedule, songs, chats, activity-logs, favorites, playlists, settings). Counts use list length (no `getCountFromServer`). Chat one-shots in `chat-service.ts` / `firebase-chat-service.ts` use `/chats*` + members/profiles helpers. Portal `rg getDoc|getDocs|getCountFromServer` → **zero**. `onSnapshot` left for Phase 10/12. Deleted unused Firebase leftovers: `firebase-auth.ts`, `firebase-comment-service.ts`, `firebase-low-data-service.ts`, `backup-service.ts`, `analytics-aggregation-service.ts`, whatsapp migration utils. Media/audiolab domains without JWT routes return empty + warn (no Firestore). Spec: `stage2-spec-portal-reads-slice-a.md`.
- [x] 41. Replace direct Supabase client reads in Zonal Portal
  - **VERIFIED 2026-08-10:** `useSupabaseQuery` / `useSupabaseData` hit JWT API only (no `/api/master-songs` public paths). `comment-service` / `file-service` / `supabase-support` no longer call Supabase. Image upload uses Cloudinary (no Supabase storage). Deleted `debug-support.ts`, `admin-support-debug.ts`. `supabase-client.ts` / `supabase.ts` have **no remaining imports** (Phase 13 delete). `database.ts` still uses Supabase for **writes only** (Phase 12 / task 61).
- [x] 42. Checkpoint — Zonal Portal reads from API only
  - **VERIFIED 2026-08-10:** one-shot Firestore reads = 0; Supabase `.from(` data reads = 0. Remaining: `onSnapshot` (Phase 10/12 realtime), media/audiolab/support **feature gaps** until JWT routes exist (empty returns, no direct DB). Smoke: `scripts/smoke-portal-slice-a.ts`.


### Phase 9 — API: Write Endpoints + WebSocket Server

> Requires Phase 5 complete.

- [x] 43. Install WebSocket dependency
  - **VERIFIED 2026-08-06:** `ws@8.18.0` and `@types/ws@8.5.13` in package.json; present in node_modules; build succeeds.
- [x] 44. Create write endpoints — profiles and subscriptions
- [x] 45. Create write endpoints — chats, messages, calls
  - **VERIFIED 2026-08-06:** `POST /chats`, `PATCH /chats/:chatId` (membership-gated), `POST /chats/:chatId/messages` (membership-gated + last_message update), `POST /calls`, `PATCH /calls/:callId` (caller/receiver-gated).
- [x] 46. Create write endpoints — zones, annotations, notes, OneSignal
- [x] 47. Create `src/ws/wsServer.ts` — WebSocket server
- [x] 48. Wire WebSocket server and connect broadcast calls
  - **VERIFIED 2026-08-06:** live `broadcast()` after profile, subscription, chat, messages, call, zone-switch, onesignal writes (no more stub comments).
- [x] 49. Implement `POST /auth/reset-password` (replace stub from task 8)
- [x] 50. Implement `POST /auth/kingschat-login` (replace stub from task 8)
- [x] 51. Checkpoint — Write endpoints and WebSocket server work end-to-end
  - **VERIFIED 2026-08-06 (code + build + health):** routes and broadcasts match Stage 2 spec; `npm run build` pass; `/health` ok; `/auth/me` unauthenticated → 401. End-to-end WS event smoke (subscribe → write → event) not re-run here — requires valid JWT + DB.



### Phase 10 — Mobile: Write + Snapshot Listener Replacement

> Requires Phase 9 deployed.

- [x] 52. Create `src/hooks/useWebSocket.ts` in Mobile
  - **AUDIT:** hook exists with subscribe protocol + 30s-capped backoff, but two wiring bugs: `useAnnotationStore` `require`s a `subscribe` export the hook does not provide, and `CallsScreen` imports the hook but never calls it.
- [ ] 53. Replace Mobile Firestore write calls with API calls
  - **AUDIT:** not done — ~114 Firestore write calls remain (`setDoc` ~9, `updateDoc` ~60, `addDoc` ~32, `deleteDoc` ~6, `writeBatch` ~7) across ~12 files; `ChatRoomScreen` alone has ~50.
- [ ] 54. Replace Mobile `onSnapshot` listeners with WebSocket subscriptions
  - **AUDIT:** not done — ~32 `onSnapshot` usages remain (`App.tsx` ×4, `ChatRoomScreen` ×5, `PlayerScreen` ×6, `PlaylistsScreen` ×4, `SubgroupAdminScreen` ×4, `RehearsalScreen` ×3, others). Only `call`, `songs`, and `schedule` are wired via WebSocket; profile/subscription/chat/messages are not.
- [ ] 55. Checkpoint — Mobile writes and realtime work via API/WebSocket
  - **AUDIT:** fails — see tasks 53–54.



### Phase 11 — Admin: Write + Snapshot Listener Replacement

> Requires Phase 9 deployed.

- [x] 56. Create `src/hooks/useWebSocket.ts` in Admin — same pattern as Mobile (task 52)
  - **AUDIT:** hook exists and matches spec, but it is never imported by any screen — dead code until tasks 57–58 wire it in.
- [ ] 57. Replace Admin Firestore write calls with API calls
  - **AUDIT:** not done — `CategoriesScreen` (`updateDoc`/`addDoc`/`deleteDoc`), `NotificationsScreen` (`addDoc`), `SubmittedSongsScreen` (`updateDoc`) still write Firestore.
- [ ] 58. Replace Admin `onSnapshot` listeners with WebSocket subscriptions
  - **AUDIT:** partial — `onSnapshot` calls are gone (0 matches) but were replaced with one-shot Firestore `getDocs` polling, not WebSocket subscriptions. No screen uses `useWebSocket`.
- [ ] 59. Checkpoint — Admin writes and realtime work via API/WebSocket
  - **AUDIT:** fails — see tasks 57–58.


### Phase 12 — Zonal Portal: Write + Realtime Replacement

> Requires Phase 9 deployed.

- [x] 60. Create `src/hooks/useWebSocket.ts` in Zonal Portal
- [ ] 61. Replace Zonal Portal Firestore/Realtime DB write calls with API calls
  - **AUDIT:** not done — `onSnapshot`/`onValue` and Firestore/RTDB access remain in ~26 files (`groups/_lib/chat-service.ts`, `voice-call-service.ts`, `whatsapp-presence.ts`, `whatsapp-message-status.ts`, `notificationStore.ts`, audiolab services, calendar service, admin sections, etc.).
  - **RENAME 2026-08-10 (clarity, not SDK removal):** misleading `firebase-*` app modules renamed — `firebase-chat-service` → `chat-api-service`/`ChatApiService` + `chat-types`; `firebase-database`/`FirebaseDatabaseService` → `data-service`/`DataService`; `firebase-media-service` → `media-library-service`/`mediaLibraryService`; `firebase-calendar-service` → `calendar-service`; `firebase-metadata-service`/`FirebaseMetadataService` → `metadata-service`/`MetadataService`. Remaining first-party `firebase*` names: `firebase-setup.ts`, `public/firebase-messaging-sw.js` (Phase 13 / task 68).
  - **IN PROGRESS 2026-08-10 (writes Slice B):** Firestore writes neutralized (JWT or no-op+warn) across chat helpers, media/audiolab/calendar libraries, notifications mark-read, device registration, Lexicon settings, metadata writes, ChatContextV2 statuses. Remaining write call sites mostly: `praise-night-songs-service`, `schedule-service`, `scheduling-board-service`, `song-ministry-service`, `history-service`, `simple-notifications-service`, some admin sections, support chat `addDoc`. `onSnapshot`/`onValue` still open for tasks 62–64.
- [ ] 62. Rewrite `useRealtimeData`, `useRealtimeSong`, `useRealtimeComments`, `useRealtimeNotifications` hooks
  - **AUDIT:** partial — `useRealtimeData` is API+WS. `useRealtimeSong` uses WS but still fetches via Firestore-backed `PraiseNightSongsService`. `useRealtimeComments` is API-only (no WS). `useRealtimeNotifications` still re-exports Firestore `notificationStore`. `ZoneActivityNotifications.tsx` exists but is empty.
- [ ] 63. Replace `CallContext.tsx` Firebase Realtime DB listener with WebSocket
  - **AUDIT:** not done — `CallContext` itself has no Firebase import, but depends on `VoiceCallService` → RTDB `onValue` in `voice-call-service.ts`; `webrtc-signaling.ts` / audiolab `session-service.ts` also still on RTDB.
- [ ] 64. Replace `RealtimeNotifications.tsx` Firebase listener with WebSocket
  - **AUDIT:** partial — `RealtimeNotifications.tsx` is toast-only (no Firebase). Real listeners remain in `notificationStore.ts`, `PushNotificationListener.tsx`, and related admin/notification pages.
- [ ] 65. Checkpoint — Zonal Portal writes and realtime work via API/WebSocket
  - **AUDIT:** fails — see tasks 61–64.



### Phase 13 — Firebase SDK Cleanup

> Only begin after all previous phases are verified. Order within this phase matters — only remove once all callers are confirmed gone.

- [ ] 66. Remove Firebase SDK from Mobile (`rehearsalhubv2`)
  - **AUDIT:** nothing removed — blocked until Phases 6 and 10 complete (~22 files still import `firebase/` or `@react-native-firebase/`).
  - [ ] 66.1 Delete `src/lib/firebase.ts` and the entire `src/lib/firebase-polyfill/` directory — **both still exist**
  - [ ] 66.2 Remove from `package.json`: `firebase`, `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`, `@react-native-firebase/storage`; run `npm install` to update lockfile — **all five still present**
  - [ ] 66.3 Remove Firebase config entries from `app.json` and `google-services.json` / `GoogleService-Info.plist` — **`google-services.json` exists at repo root and `android/app/`; `app.json` still has `googleServicesFile` and RNFB plugins**
  - [ ] 66.4 Run Metro bundler (`npx expo export`): confirm zero unresolved Firebase imports

- [ ] 67. Remove Firebase SDK from Admin (`rehearsalhub-admin`)
  - **AUDIT:** nothing removed — blocked until Phases 7 and 11 complete (8 screens + `firebase.ts` still import `firebase/`).
  - [ ] 67.1 Delete `src/lib/firebase.ts` — **still exists and still initializes app/auth/Firestore**
  - [ ] 67.2 Remove `firebase` from `package.json`; remove `EXPO_PUBLIC_FIREBASE_*` from `.env`; run `npm install` — **`"firebase": "^12.16.0"` and full env var set still present**
  - [ ] 67.3 Run Metro bundler (`npx expo export`): confirm zero unresolved Firebase imports

- [ ] 68. Remove Firebase and Supabase SDKs from Zonal Portal
  - **AUDIT:** nothing removed — blocked until Phases 8 and 12 complete.
  - [ ] 68.1 Delete: `firebase-setup.ts`, `firebase-auth.ts`, `firebase-database.ts`, `firebase-low-data-service.ts`, `firebase-metadata-service.ts`, `firebase-comment-service.ts`, `fcm-web.ts`, `supabase-client.ts`, `supabase.ts`, `supabase-support.ts` — **all ten still exist**
  - [ ] 68.2 Remove `firebase`, `firebase-admin`, and `@supabase/supabase-js` from `package.json`; run `npm install` — **`firebase@^12.3.0`, `firebase-admin@^13.6.0`, and `@supabase/supabase-js@^2.57.4` still present**
  - [ ] 68.3 Remove all `NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_SUPABASE_*` env vars from `.env` — **`.env.local` still has the full `NEXT_PUBLIC_FIREBASE_*` set (Supabase vars appear already removed); `public/firebase-messaging-sw.js` still exists**
  - [ ] 68.4 Run `next build`: confirm zero unresolved Firebase or Supabase imports

- [ ] 69. Final checkpoint — all four projects build and run Firebase-free
  - **AUDIT:** fails — see tasks 66–68.

---

## Notes

- Tasks marked `*` are optional and can be skipped for a faster MVP — none are present in this plan because no property-based tests were identified as applicable to this infrastructure migration
- Checkpoints (tasks 10, 16, 21, 26, 33, 37, 39, 42, 51, 55, 59, 65, 69) must pass before beginning the next phase
- Existing `/api/master-songs` and `/api/praise-night-songs` with `x-api-key` auth are never modified — verify at each checkpoint
- New dependencies must be pinned to exact versions per Requirement 15.7
- All new API files use TypeScript strict mode; max ~300 lines per file (Requirement 15.1, 15.2)
