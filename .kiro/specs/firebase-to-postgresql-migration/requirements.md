# Requirements Document

## Introduction

This spec covers the incremental migration of four projects — **rehearsalhub-api** (Node.js/Express backend), **rehearsalhub-admin** (Expo/React Native admin app), **rehearsalhubv2** (Expo/React Native mobile app), and **Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode** (Next.js Zonal Web Portal) — away from all Firebase services (Authentication, Firestore, Realtime Database, SDK) toward a self-owned stack: custom JWT authentication on the backend, PostgreSQL via Drizzle ORM as the single source of truth, and a custom WebSocket server replacing all Firestore `onSnapshot` listeners.

The `rehearsalhub-api` is the new backend already connected to the Supabase-managed PostgreSQL database. It currently serves only the public songs endpoints. All new auth, data, and WebSocket routes will be added to this API incrementally. The `Loveworld-Singers-Backend` and `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode` repositories serve as reference implementations to understand existing data shapes and Firebase usage patterns — they are not directly modified unless explicitly scoped.

The migration is strictly incremental. No existing functionality is broken. No large rewrites. No renames unless required by the new system. Each step leaves the app in a shippable state.

---

## Glossary

- **API**: The `rehearsalhub-api` Node.js/Express backend.
- **Admin**: The `rehearsalhub-admin` Expo React Native admin application.
- **Mobile**: The `rehearsalhubv2` Expo React Native mobile application.
- **Zonal_Portal**: The `Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode` Next.js web application used by zone-level administrators and members.
- **Legacy_Backend**: The `Loveworld-Singers-Backend` Next.js application — reference only, not directly modified in this migration.
- **JWT**: JSON Web Token — a signed, stateless access credential issued by the API.
- **Refresh_Token**: A long-lived, opaque token stored securely on the client, used to obtain a new JWT without re-authenticating.
- **Auth_Service**: The API module responsible for issuing, validating, rotating, and revoking JWTs and Refresh_Tokens.
- **WebSocket_Server**: The API module that maintains persistent client connections and pushes real-time events to replace Firestore `onSnapshot` listeners.
- **Drizzle**: The ORM used by the API to interact with the PostgreSQL database.
- **Firebase**: The legacy backend being removed (Auth, Firestore, and the Firebase JS SDK).
- **RNFB**: `@react-native-firebase/*` native modules used in Mobile.
- **Snapshot_Listener**: A Firestore `onSnapshot` subscription that receives real-time document/collection updates.
- **Session**: An authenticated period consisting of a valid JWT and its associated Refresh_Token.
- **CSRF**: Cross-Site Request Forgery — attack mitigated by requiring a custom header or token on state-changing requests.
- **Rate_Limiter**: Middleware that rejects requests exceeding a threshold within a time window.
- **Token_Revocation_List**: A server-side store of invalidated JWTs or Refresh_Tokens whose expiry has not yet elapsed.

---

## Requirements

### Requirement 1: Custom JWT Authentication — API

**User Story:** As a backend engineer, I want the API to issue and validate JWTs so that clients can authenticate without relying on Firebase Auth.

#### Acceptance Criteria

1. WHEN a client submits valid email and password credentials, THE Auth_Service SHALL issue a signed JWT with a configurable expiry (default 15 minutes) and a Refresh_Token with a configurable expiry (default 30 days).
2. WHEN a client submits invalid credentials, THE Auth_Service SHALL return an HTTP 401 response with a generic error message that does not distinguish between unknown email and wrong password.
3. WHEN a client presents an expired or malformed JWT to a protected route, THE Auth_Service SHALL return HTTP 401 and SHALL NOT execute the route handler.
4. WHEN a client submits a valid Refresh_Token, THE Auth_Service SHALL issue a new JWT and a new Refresh_Token and SHALL invalidate the previous Refresh_Token.
5. WHEN a client submits a revoked or previously-used Refresh_Token, THE Auth_Service SHALL return HTTP 401 and SHALL add the associated session to the Token_Revocation_List.
6. WHEN a client calls the logout endpoint, THE Auth_Service SHALL add the current JWT and Refresh_Token to the Token_Revocation_List and SHALL return HTTP 200.
7. THE Auth_Service SHALL store Refresh_Tokens as hashed values in PostgreSQL, never as plain text.
8. WHEN more than 10 failed login attempts originate from the same IP within 15 minutes, THE Rate_Limiter SHALL return HTTP 429 and SHALL block further login attempts from that IP for 15 minutes.
9. WHEN a JWT is presented that appears in the Token_Revocation_List, THE Auth_Service SHALL return HTTP 401 regardless of the token's expiry timestamp.
10. THE Auth_Service SHALL sign JWTs using RS256 (asymmetric) or HS256 (symmetric HMAC) with a secret of at least 256 bits, configurable via environment variable.
11. WHEN a client sends a request with a Refresh_Token, THE Auth_Service SHALL validate that the token belongs to the user identified in the request and SHALL reject tokens belonging to other users.

---

### Requirement 2: Custom JWT Authentication — Mobile (rehearsalhubv2)

**User Story:** As a mobile engineer, I want the Mobile app to authenticate via the custom JWT API so that Firebase Auth can be removed from the mobile build.

#### Acceptance Criteria

1. WHEN a user submits valid login credentials, THE Mobile SHALL call the API `/auth/login` endpoint and SHALL store the returned JWT in `expo-secure-store` and the Refresh_Token in `expo-secure-store`.
2. WHEN the stored JWT is expired and a valid Refresh_Token is available, THE Mobile SHALL automatically call `/auth/refresh` and SHALL update the stored JWT before retrying the original request.
3. WHEN both the JWT and Refresh_Token are expired or absent, THE Mobile SHALL redirect the user to the Login screen and SHALL clear all stored credentials from `expo-secure-store`.
4. WHEN a user logs out, THE Mobile SHALL call the API `/auth/logout` endpoint, SHALL remove the JWT and Refresh_Token from `expo-secure-store`, and SHALL clear the local user cache.
5. WHEN the app starts, THE Mobile SHALL check for a stored JWT and, if valid, SHALL restore the authenticated session without re-prompting for credentials.
6. THE Mobile SHALL pass the JWT as a `Bearer` token in the `Authorization` header on all authenticated API requests.
7. WHEN the API returns HTTP 401 on a non-refresh request, THE Mobile SHALL attempt one silent token refresh and, if the refresh also fails, SHALL redirect to Login.
8. WHEN biometric authentication is enabled by the user, THE Mobile SHALL use stored credentials from `expo-secure-store` to silently reauthenticate via the API without prompting for the full login form.
9. IF `@react-native-firebase/auth` and the `firebase/auth` imports are no longer called by any code path, THEN THE Mobile SHALL compile and run without the Firebase Auth SDK initialised.

---

### Requirement 3: Custom JWT Authentication — Admin (rehearsalhub-admin)

**User Story:** As an admin engineer, I want the Admin app to authenticate via the custom JWT API so that Firebase Auth can be removed from the admin build.

#### Acceptance Criteria

1. WHEN an admin submits valid credentials, THE Admin SHALL call the API `/auth/login` endpoint and SHALL store the returned JWT and Refresh_Token in `expo-secure-store`.
2. WHEN the stored JWT is expired, THE Admin SHALL automatically call `/auth/refresh` before presenting protected screens.
3. WHEN both tokens are expired or absent, THE Admin SHALL redirect to the Login screen and SHALL clear stored credentials.
4. WHEN an admin logs out, THE Admin SHALL call `/auth/logout`, SHALL remove tokens from `expo-secure-store`, and SHALL navigate to Login.
5. THE Admin SHALL verify admin role (`admin`, `hq_admin`, `zone_admin`) from the JWT claims or a `/auth/me` profile response before granting access to the `MainTabs` navigator.
6. IF the `firebase/auth` import is no longer called by any Admin code path, THEN THE Admin SHALL compile and run without the Firebase Auth SDK initialised.

---

### Requirement 4: Firestore Reads Replacement — API Layer

**User Story:** As a backend engineer, I want all data reads that currently go to Firestore to be served by the API from PostgreSQL so that Firestore can be decommissioned.

#### Acceptance Criteria

1. THE API SHALL expose authenticated REST endpoints for every Firestore collection currently read by Mobile or Admin, including but not limited to: `profiles`, `zone_members`, `hq_members`, `zones`, `individual_subscriptions`, `master_songs`, `praise_night_songs`, `praise_nights`, `chats_v2`, `messages_v2`, `calls_v2`, `media_doodles`, `user_song_notes`, `app_updates`, `activity_logs`, `categories`, `submitted_songs`, `schedule`.
2. WHEN a client requests a profile by user ID, THE API SHALL return the same fields currently stored in Firestore `profiles` documents, mapped from the PostgreSQL schema.
3. WHEN a client requests zone membership data, THE API SHALL return membership records equivalent to those in `zone_members` and `hq_members` Firestore collections.
4. THE API SHALL return data in the same shape currently expected by Mobile and Admin screens to avoid requiring simultaneous client changes.
5. WHEN a Firestore collection document does not yet exist in PostgreSQL (due to in-flight writes during migration), THE API SHALL return an appropriate 404 or empty response, and the client SHALL handle this gracefully without crashing.

---

### Requirement 5: Firestore Writes Replacement — API Layer

**User Story:** As a backend engineer, I want all data writes that currently go to Firestore to be routed to the API and persisted in PostgreSQL so that Firebase is no longer the source of truth.

#### Acceptance Criteria

1. THE API SHALL expose authenticated REST endpoints for every Firestore write operation currently performed by Mobile or Admin, including profile updates, zone switches, zone joins, annotation saves, note saves, chat message sends, call status updates, subscription updates, and OneSignal subscription ID saves.
2. WHEN a client submits a write request, THE API SHALL validate the request body against the expected schema and SHALL return HTTP 400 with descriptive errors for invalid input.
3. WHEN a client submits a write request for a resource they do not own, THE API SHALL return HTTP 403 and SHALL NOT modify any data.
4. WHEN a write is persisted, THE API SHALL broadcast the change to all connected WebSocket clients subscribed to the affected resource (see Requirement 7).
5. THE API SHALL prevent SQL injection by using parameterised queries through Drizzle ORM at all times.

---

### Requirement 6: Firestore Reads Replacement — Client Migration (Mobile and Admin)

**User Story:** As a mobile and admin engineer, I want all `getDoc`, `getDocs`, and `query`/`getDocs` Firestore calls in the clients replaced with calls to the new API endpoints so that Firestore is no longer read directly by any client.

#### Acceptance Criteria

1. WHEN Mobile or Admin screens need profile data, THE Mobile or Admin SHALL call the API `/profiles/:userId` endpoint instead of `getDoc(doc(db, 'profiles', uid))`.
2. WHEN Mobile needs zone membership lists, THE Mobile SHALL call the API zone membership endpoint instead of querying `zone_members` and `hq_members` Firestore collections.
3. WHEN Admin screens need data (members, songs, schedules, activity logs, praise nights, categories), THE Admin SHALL call the corresponding API endpoints instead of Firestore `getDocs` calls.
4. WHEN a screen previously used Firestore offline persistence (local cache), THE Mobile SHALL use the existing `AsyncStorage`-based cache layer (`screenCache`, `lowDataOptimizer`) populated from API responses.
5. IF a Firestore `db` reference is no longer imported by any Mobile or Admin file, THEN THE Mobile and Admin SHALL compile without the Firestore SDK initialised.

---

### Requirement 7: Snapshot Listener Replacement — WebSocket Server

**User Story:** As a backend engineer, I want a WebSocket server integrated into the API so that real-time updates currently delivered by Firestore `onSnapshot` can be delivered over persistent connections.

#### Acceptance Criteria

1. THE WebSocket_Server SHALL accept authenticated connections by validating a JWT presented during the WebSocket handshake (via query parameter or `Authorization` header upgrade).
2. THE WebSocket_Server SHALL implement a subscription model where clients send a `subscribe` message specifying a resource type and resource ID (e.g., `{ type: "profile", id: "uid123" }`), and THE WebSocket_Server SHALL thereafter push change events to that client whenever the resource changes.
3. WHEN a subscribed resource changes in PostgreSQL, THE WebSocket_Server SHALL push an event with the same payload shape currently delivered by the corresponding Firestore `onSnapshot` callback.
4. THE WebSocket_Server SHALL guarantee event ordering per subscription by sequencing events for the same resource ID in the order they are written.
5. IF a client sends duplicate `subscribe` messages for the same resource, THEN THE WebSocket_Server SHALL acknowledge the second message without creating a duplicate subscription.
6. WHEN a client disconnects, THE WebSocket_Server SHALL clean up all subscriptions for that connection and SHALL release associated resources.
7. WHEN a client reconnects after a disconnect, THE WebSocket_Server SHALL allow the client to resubscribe and SHALL optionally send the latest state of each subscribed resource immediately.
8. THE WebSocket_Server SHALL not send duplicate events for the same change to the same subscriber under any reconnection or race condition scenario.

---

### Requirement 8: Snapshot Listener Replacement — Client Migration (Mobile and Admin)

**User Story:** As a mobile and admin engineer, I want all Firestore `onSnapshot` listeners in the clients replaced with WebSocket event handlers so that Firebase Firestore is no longer required for real-time updates.

#### Acceptance Criteria

1. WHEN the Mobile app connects after authentication, THE Mobile SHALL open a single authenticated WebSocket connection to the API and SHALL reuse it for all real-time subscriptions.
2. WHEN the Mobile was previously subscribing to `profiles/{uid}` via `onSnapshot`, THE Mobile SHALL subscribe to the `profile` resource over WebSocket and SHALL update the Zustand store on receiving change events.
3. WHEN the Mobile was previously subscribing to `individual_subscriptions/{uid}` via `onSnapshot`, THE Mobile SHALL subscribe to the `subscription` resource over WebSocket and SHALL update the Zustand store on receiving change events.
4. WHEN ChatRoomScreen was previously subscribing to `chats_v2/{chatId}` and `messages_v2` via `onSnapshot`, THE Mobile SHALL subscribe to the `chat` and `messages` resources over WebSocket and SHALL update local state on receiving change events.
5. WHEN CallScreen was previously subscribing to `calls_v2/{callId}` via `onSnapshot`, THE Mobile SHALL subscribe to the `call` resource over WebSocket and SHALL process call status changes identically to the previous Firestore listener behaviour.
6. WHEN App.tsx was previously subscribing to `calls_v2` (incoming call detection) via `onSnapshot`, THE Mobile SHALL receive incoming call events over the authenticated WebSocket and SHALL trigger the same navigation and notification behaviour.
7. WHEN App.tsx was previously subscribing to `profiles/{uid}` (concurrent session detection) via `onSnapshot`, THE Mobile SHALL detect concurrent session events over WebSocket and SHALL sign the user out identically to the previous behaviour.
8. WHEN the WebSocket connection is lost, THE Mobile SHALL attempt reconnection with exponential backoff (maximum 30 seconds between attempts) and SHALL resubscribe to all active subscriptions upon reconnect.
9. IF all `onSnapshot` imports and calls have been removed, THEN THE Mobile SHALL compile without the Firestore real-time listener API imported.

---

### Requirement 9: KingsChat OAuth Migration

**User Story:** As a mobile engineer, I want the KingsChat OAuth login flow to use the custom JWT system instead of Firebase custom tokens so that Firebase Auth is fully removed.

#### Acceptance Criteria

1. WHEN a user completes the KingsChat OAuth flow, THE Mobile SHALL send the KingsChat `accessToken` to the API `/auth/kingschat-login` endpoint.
2. THE API `/auth/kingschat-login` endpoint SHALL validate the KingsChat token with the KingsChat OAuth provider, resolve the matching user profile in PostgreSQL, and SHALL return a JWT and Refresh_Token (not a Firebase custom token).
3. IF no matching user is found in PostgreSQL for the KingsChat identity, THEN THE API SHALL return a `NO_ACCOUNT` response and THE Mobile SHALL prompt registration as it currently does.
4. WHEN multiple accounts are linked to the same KingsChat identity, THE API SHALL return a `MULTIPLE_ACCOUNTS` response with the same account list shape currently expected by the Mobile account-selection modal.
5. THE API SHALL NOT call Firebase Admin SDK or issue Firebase custom tokens as part of the KingsChat OAuth flow.

---

### Requirement 10: Password Reset Migration

**User Story:** As a mobile engineer, I want password reset to work without Firebase Auth so that users can recover access after Firebase removal.

#### Acceptance Criteria

1. WHEN a user submits a password reset request with email, first name, zone code, and new password, THE API `/auth/reset-password` endpoint SHALL verify the identity by matching the submitted fields against the PostgreSQL `profiles` record.
2. WHEN identity verification passes, THE API SHALL update the user's password hash in PostgreSQL and SHALL invalidate all existing Refresh_Tokens for that user.
3. WHEN identity verification fails, THE API SHALL return HTTP 400 with a generic verification-failed message and SHALL NOT update any credentials.
4. THE API SHALL NOT call `sendPasswordResetEmail` or any Firebase Auth method during password reset.

---

### Requirement 11: Firebase SDK Cleanup — Mobile (rehearsalhubv2)

**User Story:** As a mobile engineer, I want all Firebase SDK references removed from the mobile project once migration is complete so that the bundle size is reduced and Firebase is fully eliminated.

#### Acceptance Criteria

1. WHEN all Firebase Auth, Firestore read, Firestore write, and `onSnapshot` calls have been replaced, THE Mobile SHALL remove `src/lib/firebase.ts` and `src/lib/firebase-polyfill/` from the codebase.
2. WHEN Firebase SDK files are removed, THE Mobile SHALL remove the `firebase`, `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`, and `@react-native-firebase/storage` packages from `package.json`.
3. WHEN the Firebase native modules are removed, THE Mobile SHALL update `app.json` and `google-services.json` / `GoogleService-Info.plist` to remove Firebase configuration entries.
4. WHEN all Firebase SDK files including custom wrappers are removed, THE Mobile SHALL verify that Metro bundler resolves all remaining imports without Firebase-related modules.
5. THE Mobile SHALL NOT remove or alter any non-Firebase code as part of this cleanup step.

---

### Requirement 12: Firebase SDK Cleanup — Admin (rehearsalhub-admin)

**User Story:** As an admin engineer, I want all Firebase SDK references removed from the admin project once migration is complete so that Firebase is fully eliminated from the admin build.

#### Acceptance Criteria

1. WHEN all Firebase Auth and Firestore calls have been replaced and no other files import from `src/lib/firebase.ts`, THE Admin SHALL remove `src/lib/firebase.ts` from the codebase.
2. WHEN the Firebase SDK file is removed, THE Admin SHALL remove the `firebase` package from `package.json` and the associated `EXPO_PUBLIC_FIREBASE_*` environment variables from `.env`.
3. WHEN all Firebase SDK files including custom wrappers are removed, THE Admin SHALL verify that Metro bundler resolves all remaining imports without Firebase-related modules.
4. THE Admin SHALL NOT remove or alter any non-Firebase code as part of this cleanup step.

---

### Requirement 13: Security Hardening — Auth Service Design

**User Story:** As a security engineer, I want the custom auth service to implement defence-in-depth measures so that the system is not vulnerable to common authentication attacks.

#### Acceptance Criteria

1. THE Auth_Service SHALL implement CSRF protection on all cookie-based or session-based state-changing endpoints by requiring a `X-Requested-With` header or a per-request CSRF token where applicable.
2. THE Auth_Service SHALL set the `HttpOnly` flag on any cookies used to transport Refresh_Tokens, preventing client-side script access.
3. THE Auth_Service SHALL set the `Secure` flag on any cookies used in production, restricting transmission to HTTPS connections only.
4. THE Auth_Service SHALL set the `SameSite=Strict` attribute on Refresh_Token cookies to prevent cross-site request inclusion.
5. WHEN the same Refresh_Token is presented more than once (replay), THE Auth_Service SHALL treat this as a potential token theft, SHALL revoke the entire session family, and SHALL return HTTP 401.
6. THE API SHALL validate and sanitise all user-supplied input at the route handler boundary before passing it to the database layer.
7. THE API SHALL return generic error messages to clients and SHALL log detailed error context server-side only.
8. THE Auth_Service SHALL support token revocation via a short-lived in-memory or Redis-backed revocation list to handle logout and concurrent-session invalidation without requiring full database round-trips on every request.
9. THE Auth_Service SHALL enforce a minimum password length of 8 characters and SHALL hash passwords using bcrypt with a work factor of at least 12.
10. WHEN an admin role check fails, THE API SHALL return HTTP 403 and SHALL log the unauthorised access attempt.

---

### Requirement 14: Incremental Migration Strategy

**User Story:** As a principal engineer, I want the migration executed incrementally so that the app remains in a shippable state at every step and no single change breaks existing functionality.

#### Acceptance Criteria

1. THE Migration SHALL proceed in this order: (a) Auth_Service implementation on API, (b) client auth migration, (c) Firestore read replacement on API, (d) client read migration, (e) Firestore write replacement on API, (f) client write migration, (g) WebSocket_Server implementation, (h) client snapshot listener migration, (i) Firebase SDK cleanup.
2. WHEN any single migration step is applied, THE system SHALL pass all existing automated tests and SHALL exhibit no regression in manual smoke testing before the next step is begun.
3. THE Migration SHALL NOT rename existing database columns, API route paths, or client-facing data shapes unless a rename is strictly required by the new system design, and all such renames SHALL be documented in the task list.
4. WHEN a migration step modifies a file, THE change SHALL be limited to only the code required by that step and SHALL NOT alter unrelated logic in the same file.
5. THE Migration SHALL NOT introduce any new third-party authentication providers (Supabase Auth, Clerk, Auth0, or equivalent).
6. THE API SHALL continue to serve the existing `x-api-key`-protected public song endpoints (`/api/master-songs`, `/api/praise-night-songs`) without modification throughout the migration.
7. WHEN migrating a Firestore write that also triggers a side effect (e.g., updating `currentDeviceId` on login), THE API equivalent endpoint SHALL preserve the same side effects.

---

### Requirement 15: Coding Style and Quality

**User Story:** As a principal engineer, I want all new code to follow the established project coding style so that the codebase remains clean, maintainable, and consistent.

#### Acceptance Criteria

1. THE API SHALL use TypeScript with strict mode enabled for all new source files.
2. WHEN adding new API source files, THE engineer SHALL keep each file focused on a single responsibility and SHALL NOT create files exceeding 300 lines without justification.
3. THE API SHALL use Drizzle ORM for all database interactions and SHALL NOT use raw SQL strings except where Drizzle does not support the required operation.
4. WHEN naming new functions, variables, and files, THE engineer SHALL use names that clearly describe their purpose and SHALL NOT use single-letter names outside loop counters.
5. THE engineer SHALL NOT introduce new abstractions, base classes, or utility layers unless they eliminate more than two instances of exact duplication.
6. THE engineer SHALL NOT add comments to code that is self-explanatory and SHALL reserve comments for non-obvious behaviour or intentional deviations from the norm.
7. WHEN adding new dependencies to any project, THE engineer SHALL pin the dependency to an exact version and SHALL document the reason for the addition.

---

### Requirement 16: Custom JWT Authentication — Zonal Portal

**User Story:** As a zonal portal engineer, I want the Zonal Portal to authenticate via the custom JWT API so that Firebase Auth and `firebase-setup.ts` can be removed from the portal.

#### Acceptance Criteria

1. WHEN a user submits valid credentials on the Zonal Portal login page, THE Zonal_Portal SHALL call the API `/auth/login` endpoint and SHALL store the returned JWT in an `HttpOnly` cookie or `sessionStorage`, and the Refresh_Token in an `HttpOnly` cookie.
2. WHEN the stored JWT expires, THE Zonal_Portal middleware (`src/middleware.ts`) SHALL attempt a silent refresh via the API `/auth/refresh` endpoint before redirecting to the login page.
3. WHEN both tokens are expired or absent, THE Zonal_Portal SHALL redirect the user to `/auth` and SHALL clear all stored credentials.
4. WHEN a user logs out, THE Zonal_Portal SHALL call the API `/auth/logout` endpoint, SHALL clear `lwsrh_is_logged_in` and all session cookies, and SHALL redirect to `/auth`.
5. THE Zonal_Portal SHALL derive the user's role (`admin`, `hq_admin`, `zone_admin`, `member`) from JWT claims returned by the API and SHALL gate access to `/admin`, `/boss`, and `/subgroup-admin` routes accordingly.
6. WHEN a user completes the KingsChat OAuth flow on the Zonal Portal, THE portal SHALL call the API `/auth/kingschat-login` endpoint (as defined in Requirement 9) rather than using Firebase custom tokens.
7. IF `firebase-setup.ts`, `firebase-auth.ts`, and `firebase/auth` imports are no longer referenced by any Zonal Portal file, THEN THE Zonal_Portal SHALL compile and run without the Firebase Auth SDK initialised.
8. THE Zonal_Portal `authStore.ts` SHALL replace its `onAuthStateChanged(auth, ...)` Firebase listener with a call to the API `/auth/me` endpoint to rehydrate session state on page load.

---

### Requirement 17: Firestore Reads Replacement — Zonal Portal

**User Story:** As a zonal portal engineer, I want all Firestore and Firebase Realtime Database reads in the Zonal Portal replaced with calls to the API so that Firebase Firestore and Realtime Database are no longer read directly.

#### Acceptance Criteria

1. WHEN the Zonal Portal loads profile data via `FirebaseDatabaseService.getUserProfile` or `FirebaseDatabaseService.getDocument('profiles', uid)`, THE Zonal_Portal SHALL instead call the API `/profiles/:userId` endpoint.
2. WHEN the Zonal Portal reads zone membership data (`zone_members`, `hq_members`), THE Zonal_Portal SHALL call the corresponding API zone membership endpoints.
3. WHEN the Zonal Portal loads master songs, praise night songs, schedules, categories, activity logs, or submitted songs, THE Zonal_Portal SHALL call the corresponding API endpoints.
4. WHEN the Zonal Portal uses `firebase-database.ts` (`FirebaseDatabaseService`) for reads, THE Zonal_Portal SHALL replace those calls with the `api-client.ts` module that wraps the API endpoints.
5. WHEN the Zonal Portal uses Supabase client directly (`supabase-client.ts`, `supabase.ts`) for reads, THE Zonal_Portal SHALL replace those calls with API endpoints — direct Supabase client access from the frontend SHALL NOT remain in production code.
6. IF all Firestore `getDoc`, `getDocs`, `collection`, `query` imports from `firebase-database.ts` and `firebase-setup.ts` are no longer called, THEN THE Zonal_Portal SHALL compile without the Firestore SDK initialised.

---

### Requirement 18: Snapshot Listener Replacement — Zonal Portal

**User Story:** As a zonal portal engineer, I want all Firebase Realtime Database `onValue` listeners and Firestore `onSnapshot` listeners in the Zonal Portal replaced with WebSocket event subscriptions so that Firebase is no longer required for real-time updates.

#### Acceptance Criteria

1. WHEN the Zonal Portal currently uses `useRealtimeData`, `useRealtimeSong`, `useRealtimeComments`, or `useRealtimeNotifications` hooks backed by Firebase, THOSE hooks SHALL be rewritten to subscribe to the corresponding resources over the WebSocket_Server.
2. WHEN the Zonal Portal `CallContext.tsx` uses Firebase Realtime Database listeners to track call state, THE Zonal_Portal SHALL subscribe to the `call` resource over WebSocket and SHALL process call status changes identically to the previous listener behaviour.
3. WHEN the Zonal Portal `RealtimeNotifications.tsx` listens to Firebase for incoming notifications, THE component SHALL receive notification events over the authenticated WebSocket connection instead.
4. WHEN the Zonal Portal's `ZoneActivityNotifications.tsx` polls or listens to Firebase for zone-level activity, THE component SHALL subscribe to a `zone_activity` resource over WebSocket.
5. WHEN the WebSocket connection is lost in the Zonal Portal, THE portal SHALL attempt reconnection with exponential backoff (maximum 30 seconds between attempts) and SHALL resubscribe to all active resources upon reconnect.
6. IF all Firebase Realtime Database `onValue` and Firestore `onSnapshot` calls have been removed, THEN THE Zonal_Portal SHALL compile without the Firebase Realtime Database SDK or Firestore listener API imported.

---

### Requirement 19: Firebase SDK Cleanup — Zonal Portal

**User Story:** As a zonal portal engineer, I want all Firebase SDK references removed from the Zonal Portal once migration is complete so that Firebase is fully eliminated from the portal build.

#### Acceptance Criteria

1. WHEN all Firebase Auth, Firestore read, Firestore write, Realtime Database, and `onSnapshot` calls have been replaced, THE Zonal_Portal SHALL remove `src/lib/firebase-setup.ts`, `src/lib/firebase-auth.ts`, `src/lib/firebase-database.ts`, `src/lib/firebase-low-data-service.ts`, `src/lib/firebase-metadata-service.ts`, and `src/lib/firebase-comment-service.ts` from the codebase.
2. WHEN Firebase SDK files are removed, THE Zonal_Portal SHALL remove the `firebase` package from `package.json` and all `NEXT_PUBLIC_FIREBASE_*` environment variables from `.env.local`.
3. WHEN Firebase FCM web push is replaced (or deferred), THE Zonal_Portal SHALL remove or stub `src/lib/fcm-web.ts` and `public/firebase-messaging-sw.js` only after confirming push notifications are handled by the replacement service.
4. WHEN all Firebase SDK files are removed, THE Zonal_Portal SHALL verify that Next.js builds without any Firebase-related module resolution errors.
5. THE Zonal_Portal SHALL NOT remove or alter Cloudinary, KingsPay, or OneSignal integrations as part of this cleanup step.

---

### Requirement 20: Supabase Direct Client Removal — Zonal Portal and Legacy Backend

**User Story:** As a principal engineer, I want all direct Supabase client calls removed from frontend and portal code so that the API is the only layer that accesses the database.

#### Acceptance Criteria

1. WHEN the Zonal Portal uses `supabase-client.ts` or `supabase.ts` to query or mutate data, THOSE calls SHALL be replaced with authenticated API endpoint calls.
2. WHEN the Zonal Portal uses `useSupabaseData` or `useSupabaseQuery` hooks to read data, THOSE hooks SHALL be replaced with hooks that call the API.
3. THE Zonal_Portal `supabase-client.ts`, `supabase.ts`, and `supabase-support.ts` files SHALL be removed once all callers have been migrated to the API.
4. THE Supabase JS client SDK (`@supabase/supabase-js`) SHALL be removed from the Zonal Portal `package.json` once no file imports it.
5. The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables SHALL be removed from the Zonal Portal once the Supabase client is removed.
6. THE API (`rehearsalhub-api`) SHALL remain the ONLY system component that holds the `DATABASE_URL` connection string and communicates directly with PostgreSQL.

---

### Requirement 21: Migration Sequence — Zonal Portal

**User Story:** As a principal engineer, I want the Zonal Portal migration executed in the same incremental order as the other clients so that the portal remains deployable at every step.

#### Acceptance Criteria

1. THE Zonal_Portal migration SHALL proceed in this order: (a) auth migration (replace `onAuthStateChanged` + `firebase-auth.ts`), (b) Firestore/Supabase read replacement, (c) Firestore/Supabase write replacement, (d) Realtime Database + snapshot listener replacement via WebSocket, (e) Firebase SDK cleanup.
2. WHEN any Zonal Portal migration step is applied, THE portal SHALL build successfully with `next build` and SHALL exhibit no regression in manual smoke testing before the next step begins.
3. THE Zonal_Portal migration SHALL NOT modify the API contract or database schema unless doing so is also required by the Mobile or Admin migration steps and is explicitly coordinated.
4. WHEN a Zonal Portal migration step modifies a file, THE change SHALL be limited only to the code required by that step and SHALL NOT alter unrelated Cloudinary, analytics, or payment logic in the same file.
