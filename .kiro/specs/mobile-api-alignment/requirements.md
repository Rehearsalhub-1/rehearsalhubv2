# Requirements Document

# Mobile App API Alignment

## Introduction

The `rehearsalhubv2` React Native app must be refactored so that **all API communication goes exclusively through `apiClient`**, mirroring how the Zonal Portal web app (`Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode`) communicates with `rehearsalhub-api`. Currently, several screens bypass `apiClient` entirely by using a secondary HTTP utility (`lowDataOptimizer.fetchJSON`/`fetchWithRetry`) that sends an unrecognized `x-internal-api-key` header, causing silent 401 failures and inconsistent data loading.

The goal is one HTTP path, one auth layer, one source of truth — matching the web exactly.

---

## Glossary

| Term | Definition |
|---|---|
| `apiClient` | The authorized HTTP client in `src/lib/apiClient.ts` that sends JWT Bearer tokens, handles token refresh, and includes zone headers on every request |
| `lowDataOptimizer` | Legacy utility file (`src/lib/lowDataOptimizer.ts`) containing both API-calling functions (`fetchJSON`, `fetchWithRetry`) and pure media utility functions (`optimizeImage`, `optimizeAudio`) |
| `mediaUtils` | New pure-function file (`src/lib/mediaUtils.ts`) that will contain only the image/audio URL transformation helpers, with no API calls |
| `clearCache()` | New method to be added to `apiClient` that clears its in-memory GET response cache |
| Zonal Portal | The reference Next.js web app whose `apiClient` + `authStore` + `zoneStore` pattern is the gold standard |

---

## Requirements

### Requirement 1: Create `src/lib/mediaUtils.ts`

**User Story:** As a developer, I want all Cloudinary image and audio URL transformation functions to live in a single, purpose-built utility module so they can be imported without pulling in API-calling code.

#### Acceptance Criteria

1. WHEN `src/lib/mediaUtils.ts` is created, THEN it SHALL export `optimizeImage(url, opts?)`, `thumbnailImage(url)`, `bannerImage(url)`, and `optimizeAudio(url)` with the same signatures and logic currently in `lowDataOptimizer.ts`.
2. WHEN `mediaUtils.ts` is imported, THEN it SHALL NOT import from `expo-secure-store`, `@sentry/react-native`, or any HTTP library — it is pure functions only.
3. WHEN `optimizeImage` is called with a non-Cloudinary URL, THEN it SHALL return the URL unchanged.
4. WHEN `optimizeImage` is called with a null or undefined URL, THEN it SHALL return an empty string `''`.

---

### Requirement 2: Add `clearCache()` to `src/lib/apiClient.ts`

**User Story:** As a developer, I want a single way to invalidate the in-memory API response cache so that screens refreshing after a zone switch or sign-out don't need to import from `lowDataOptimizer`.

#### Acceptance Criteria

1. WHEN `clearCache()` is exported from `apiClient`, THEN it SHALL clear all entries from the internal `apiGetCache` Map.
2. WHEN `clearCache()` is called, THEN subsequent `apiClient.get()` calls for previously cached paths SHALL re-fetch from the network.
3. WHEN `apiClient` is imported, THEN `clearCache` SHALL be available as a named export alongside the existing `apiClient` object, `storeTokens`, and `clearTokens`.

---

### Requirement 3: Delete `src/lib/lowDataOptimizer.ts`

**User Story:** As a developer, I want the broken secondary HTTP path removed so that there is no possibility of API calls bypassing the authorized `apiClient`.

#### Acceptance Criteria

1. WHEN all consumers have been migrated to `apiClient` and `mediaUtils`, THEN `src/lib/lowDataOptimizer.ts` SHALL be deleted from the repository.
2. WHEN the TypeScript compiler is run after deletion, THEN there SHALL be zero import errors referencing `lowDataOptimizer`.
3. WHEN the app is built after deletion, THEN no runtime calls SHALL use the `x-internal-api-key` header on any protected API endpoint.

---

### Requirement 4: Fix `AllMinisteredSongsScreen.tsx`

**User Story:** As a singer using the app, I want the All Ministered Songs screen to load songs correctly using the same authorized API call pattern as the web portal so I always see up-to-date data.

#### Acceptance Criteria

1. WHEN `AllMinisteredSongsScreen` loads songs, THEN it SHALL call `apiClient.get('/songs/master')` instead of `fetchJSON(BACKEND_URL + '/songs/master')`.
2. WHEN `AllMinisteredSongsScreen` loads programs, THEN it SHALL call `apiClient.get('/programs')` instead of `fetchJSON(BACKEND_URL + '/programs')`.
3. WHEN `AllMinisteredSongsScreen` is refactored, THEN it SHALL NOT contain any `const BACKEND_URL` declaration.
4. WHEN `AllMinisteredSongsScreen` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
5. WHEN audio URLs need optimization, THEN `AllMinisteredSongsScreen` SHALL import `optimizeAudio` from `'../lib/mediaUtils'`.

---

### Requirement 5: Fix `RehearsalScreen.tsx`

**User Story:** As a singer using the app, I want the Rehearsal screen to load programs and songs using the authorized API client so that my JWT is always sent and data loads reliably.

#### Acceptance Criteria

1. WHEN `RehearsalScreen` fetches programs, THEN it SHALL use `apiClient.get('/programs?zoneId=...')` or `apiClient.get('/programs')` — no `fetchJSON` or `BACKEND_URL` usage.
2. WHEN `RehearsalScreen` fetches songs, THEN it SHALL use `apiClient.get('/songs/...')` — no `fetchJSON` calls.
3. WHEN `RehearsalScreen` needs to clear the API cache on refresh, THEN it SHALL call `clearCache()` imported from `'../lib/apiClient'` instead of `clearResponseCache()` from `lowDataOptimizer`.
4. WHEN `RehearsalScreen` is refactored, THEN it SHALL NOT contain any `const BACKEND_URL` declaration.
5. WHEN `RehearsalScreen` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
6. WHEN image or audio URLs need optimization, THEN `RehearsalScreen` SHALL import `optimizeImage` and `optimizeAudio` from `'../lib/mediaUtils'`.

---

### Requirement 6: Fix `SearchScreen.tsx`

**User Story:** As a singer using the app, I want the Search screen to fetch all song data through the authorized API client so searches return correct, complete results.

#### Acceptance Criteria

1. WHEN `SearchScreen` loads master songs, THEN it SHALL call `apiClient.get('/songs/master')`.
2. WHEN `SearchScreen` loads zone-specific songs, THEN it SHALL call `apiClient.get('/songs/zone?zoneId=...')`.
3. WHEN `SearchScreen` loads subgroup songs, THEN it SHALL call `apiClient.get('/songs/subgroup?zoneId=...')`.
4. WHEN `SearchScreen` is refactored, THEN it SHALL NOT contain any `const BACKEND_URL` declaration.
5. WHEN `SearchScreen` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
6. WHEN audio URLs need optimization, THEN `SearchScreen` SHALL import `optimizeAudio` from `'../lib/mediaUtils'`.

---

### Requirement 7: Fix `SubgroupScreen.tsx`

**User Story:** As a singer in a choir subgroup, I want the Subgroup screen to load rehearsal songs using the authorized API client.

#### Acceptance Criteria

1. WHEN `SubgroupScreen` needs to clear cache after zone change, THEN it SHALL call `clearCache()` from `'../lib/apiClient'` instead of `clearResponseCache()`.
2. WHEN `SubgroupScreen` is refactored, THEN it SHALL NOT contain any `const BACKEND_URL` declaration.
3. WHEN `SubgroupScreen` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
4. WHEN image or audio URLs need optimization in `SubgroupScreen`, THEN it SHALL import `optimizeImage` and `optimizeAudio` from `'../lib/mediaUtils'`.

---

### Requirement 8: Fix `ArchiveScreen.tsx`

**User Story:** As a singer with archive access, I want the Archive screen to refresh correctly without stale cached data.

#### Acceptance Criteria

1. WHEN `ArchiveScreen` clears its cache on pull-to-refresh, THEN it SHALL call `clearCache()` from `'../lib/apiClient'` instead of `clearResponseCache()`.
2. WHEN `ArchiveScreen` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
3. WHEN image URLs need optimization in `ArchiveScreen`, THEN it SHALL import `optimizeImage` from `'../lib/mediaUtils'`.

---

### Requirement 9: Fix `useUser.tsx`

**User Story:** As a developer, I want the user store to use the authorized API client's cache clearing instead of a broken legacy utility, so sign-out and zone switching always produce a clean state.

#### Acceptance Criteria

1. WHEN `useUser.tsx` needs to clear the API response cache (on `switchZone` and `signOut`), THEN it SHALL call `clearCache()` imported from `'../lib/apiClient'`.
2. WHEN `useUser.tsx` is refactored, THEN it SHALL NOT import from `'../lib/lowDataOptimizer'`.
3. WHEN `signOut` is called, THEN `clearCache()` SHALL be invoked to purge the in-memory GET cache.
4. WHEN `switchZone` is called, THEN `clearCache()` SHALL be invoked so subsequent screen fetches hit the network with the new zone context.

---

### Requirement 10: Fix `App.tsx`

**User Story:** As a developer, I want the app entry point to not call broken API warm-up functions that bypass the authorized client.

#### Acceptance Criteria

1. WHEN `App.tsx` is refactored, THEN it SHALL NOT import `prewarmCache` from `'./src/lib/lowDataOptimizer'`.
2. WHEN `App.tsx` is refactored, THEN any `prewarmCache([...])` call SHALL be removed entirely.
3. WHEN `App.tsx` is refactored, THEN it SHALL NOT import from `'./src/lib/lowDataOptimizer'` for any reason.

---

### Requirement 11: Fix `PlayerScreen.tsx` and `MediaScreen.tsx`

**User Story:** As a developer, I want all remaining consumers of `lowDataOptimizer` image/audio utilities to import from the new `mediaUtils` module.

#### Acceptance Criteria

1. WHEN `PlayerScreen.tsx` is refactored, THEN it SHALL import `optimizeAudio` from `'../lib/mediaUtils'` instead of `'../lib/lowDataOptimizer'`.
2. WHEN `MediaScreen.tsx` is refactored, THEN it SHALL import `optimizeImage` and `optimizeAudio` from `'@/lib/mediaUtils'` instead of `'@/lib/lowDataOptimizer'`.
3. WHEN `PlayerScreen.tsx` and `MediaScreen.tsx` are refactored, THEN neither SHALL import from `lowDataOptimizer`.

---

### Requirement 12: Zero remaining `lowDataOptimizer` imports

**User Story:** As a developer, I want a clean codebase with no references to the deleted utility, verified by build.

#### Acceptance Criteria

1. WHEN a project-wide search is performed for `lowDataOptimizer`, THEN zero results SHALL be found in any `.ts` or `.tsx` file under `src/` or in `App.tsx`.
2. WHEN the TypeScript build is run after all changes, THEN it SHALL complete with zero errors related to missing imports or deleted modules.
3. WHEN the app runs after refactoring, THEN all screens that previously used `fetchJSON` SHALL load data correctly via `apiClient`.
