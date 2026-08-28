# Bugfix Requirements Document

## Introduction

`rehearsalhubv2` (Expo React Native) ships a broken parallel HTTP path alongside the correct `apiClient`. Seven screens call `lowDataOptimizer.fetchJSON()`, which constructs full URLs from per-screen `BACKEND_URL` constants and sends an `x-internal-api-key` header that `rehearsalhub-api` does not accept on any JWT-protected route. Every such call silently 401s and the screen receives `null` data — songs lists are empty and users see loading spinners or error states that never recover. Additionally, `App.tsx` fires `prewarmCache()` on boot (same broken path), and `useUser.tsx` calls `clearResponseCache()` on sign-out and zone switch (purging the wrong cache object). The reference implementation — the Zonal Portal (`clones/Loveworld-Singers-Rehearsal-Hub-Portal-Zonal-Mode`) — uses a single `apiClient` with JWT `Authorization` headers exclusively and has no `x-internal-api-key` anywhere.

**Scope:** All changes are confined to `rehearsalhubv2`. `rehearsalhub-api` and the Zonal Portal are untouched.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `AllMinisteredSongsScreen` mounts and calls `fetchJSON(BACKEND_URL + '/songs/master', ...)` and `fetchJSON(BACKEND_URL + '/programs', ...)`, THEN the system sends `x-internal-api-key` instead of `Authorization: Bearer <jwt>` and the API returns 401, so both calls return `null` and the screen renders an empty song list.

1.2 WHEN `SearchScreen` mounts and calls `fetchJSON(BACKEND_URL + '/songs/master', ...)`, `fetchJSON(BACKEND_URL + '/songs/zone?zoneId=...', ...)`, and `fetchJSON(BACKEND_URL + '/songs/subgroup?zoneId=...', ...)`, THEN the system sends `x-internal-api-key` and all three calls silently 401, so the search index is empty and no results are returned for any query.

1.3 WHEN `RehearsalScreen` triggers its `loadData` path and calls `fetchJSON` for song data, THEN the system sends `x-internal-api-key` and the call silently 401s, so the rehearsal screen shows no songs for the active program.

1.4 WHEN `SubgroupScreen` triggers its `loadData` path and calls `fetchJSON` for song data, THEN the system sends `x-internal-api-key` and the call silently 401s, so the subgroup screen shows no songs.

1.5 WHEN `App.tsx` completes its `prepare()` routine after a successful `/auth/me` check, THEN the system calls `prewarmCache([BACKEND_URL + '/api/generic?collection=praise_nights'])` which issues a `fetchJSON` request with `x-internal-api-key` to a legacy Firebase-era URL that does not exist on the current API, producing a silent failure.

1.6 WHEN `useUser.tsx` `_initialize()` runs before a valid JWT is found, THEN the system calls `clearResponseCache()` from `lowDataOptimizer`, which clears only the `lowDataOptimizer` in-memory `responseCache` map — not the `apiGetCache` inside `apiClient` — so the correct offline fallback cache is unaffected but the call itself is dead code tied to the broken path.

1.7 WHEN `useUser.tsx` `switchZone()` runs after a successful zone PATCH, THEN the system calls `clearResponseCache()` from `lowDataOptimizer`, clearing only the now-irrelevant `responseCache` map and leaving the correct `apiGetCache` untouched.

1.8 WHEN `RehearsalScreen` calls `handleRefresh()`, THEN the system calls `clearResponseCache()` from `lowDataOptimizer`, which does not clear the `apiClient` GET cache that the screen will use after migration.

1.9 WHEN `SubgroupScreen` initialises, THEN the system calls `clearResponseCache()` inside the `loadData` closure, which similarly clears only the irrelevant `lowDataOptimizer` cache.

1.10 WHEN any of `ArchiveScreen`, `PlayerScreen`, or `MediaScreen` imports `optimizeImage` or `optimizeAudio` from `lowDataOptimizer`, THEN the system couples those screens to a module that will be deleted, causing build failures after the broken HTTP path is removed.

### Expected Behavior (Correct)

2.1 WHEN `AllMinisteredSongsScreen` fetches song and program data, THEN the system SHALL call `apiClient.get('/songs/master')` and `apiClient.get('/programs')` with relative paths, receive `Authorization: Bearer <jwt>` headers automatically injected by `apiClient`, and render the returned song list.

2.2 WHEN `SearchScreen` fetches song data, THEN the system SHALL call `apiClient.get('/songs/master')`, `apiClient.get('/songs/zone?zoneId=<id>')`, and `apiClient.get('/songs/subgroup?zoneId=<id>')`, receive JWT-authenticated responses, and populate the search index so that queries return matching results.

2.3 WHEN `RehearsalScreen` fetches program song data, THEN the system SHALL call the same `apiClient.get(...)` paths already used by other parts of that screen (e.g. `/programs`, `/songs/praise-night`, `/songs/subgroup`) with JWT authentication, and render the returned songs.

2.4 WHEN `SubgroupScreen` fetches program song data, THEN the system SHALL call the same `apiClient.get(...)` paths already used by other parts of that screen with JWT authentication, and render the returned songs.

2.5 WHEN `App.tsx` completes its `prepare()` routine after a successful `/auth/me` check, THEN the system SHALL NOT call `prewarmCache` or issue any fetch with `x-internal-api-key`, and SHALL contain no import of `prewarmCache`.

2.6 WHEN `useUser.tsx` `_initialize()` runs before a valid JWT is found, THEN the system SHALL NOT call `clearResponseCache` and SHALL contain no import of `clearResponseCache` from `lowDataOptimizer`.

2.7 WHEN `useUser.tsx` `switchZone()` runs after a successful zone PATCH, THEN the system SHALL NOT call `clearResponseCache` from `lowDataOptimizer`.

2.8 WHEN `RehearsalScreen` calls `handleRefresh()`, THEN the system SHALL NOT call `clearResponseCache` from `lowDataOptimizer`; refresh SHALL be driven by clearing the screen's `_memCache` entry and triggering a re-fetch via `apiClient`.

2.9 WHEN `SubgroupScreen` initialises its `loadData` closure, THEN the system SHALL NOT call `clearResponseCache` from `lowDataOptimizer`.

2.10 WHEN any of `ArchiveScreen`, `PlayerScreen`, or `MediaScreen` needs `optimizeImage` or `optimizeAudio`, THEN the system SHALL import those functions from `src/lib/mediaUtils.ts`, a new file that contains only the four pure Cloudinary URL-transformer functions (`optimizeImage`, `thumbnailImage`, `bannerImage`, `optimizeAudio`) with no HTTP fetch logic, no `SecureStore` import, and no side effects.

2.11 WHEN `src/lib/lowDataOptimizer.ts` is deleted, THEN the TypeScript compiler SHALL report zero errors across all files in `rehearsalhubv2`, because all consumers have been migrated to `apiClient` (for HTTP) and `mediaUtils.ts` (for URL transforms).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `apiClient.get(path)` is called and the network is available and the JWT is valid, THEN the system SHALL CONTINUE TO return the parsed JSON response, cache the result in `apiGetCache`, and resolve the returned promise with the typed data.

3.2 WHEN `apiClient.get(path)` is called and the server returns a 401, THEN the system SHALL CONTINUE TO attempt a token refresh via `POST /auth/refresh` and retry the original request exactly once before throwing `SessionExpiredError`.

3.3 WHEN `apiClient.get(path)` is called and the network request throws a network error (device offline), THEN the system SHALL CONTINUE TO serve the most recent `apiGetCache` entry for that path as the offline fallback.

3.4 WHEN an Affected Screen mounts with a valid `ScreenCache` entry (`readCache`), THEN the screen SHALL CONTINUE TO display cached data immediately without waiting for the network response, preserving the stale-while-revalidate pattern.

3.5 WHEN a user triggers pull-to-refresh on an Affected Screen, THEN the screen SHALL CONTINUE TO re-fetch data and update the displayed list, with the loading spinner shown during the fetch.

3.6 WHEN an Affected Screen receives a network or API error with no cached fallback, THEN the screen SHALL CONTINUE TO display the error state with a Retry button.

3.7 WHEN `optimizeImage(url, opts)` is called with a valid Cloudinary URL, THEN the system SHALL CONTINUE TO return a URL with the Cloudinary transformation segments (`w_<width>,q_<quality>,f_auto,fl_progressive`) injected at the `/upload/` boundary, producing the same output as the current `lowDataOptimizer.optimizeImage` implementation.

3.8 WHEN `optimizeAudio(url)` is called with a valid Cloudinary URL, THEN the system SHALL CONTINUE TO return a URL with `af_44100,br_128k,q_auto` injected at the `/upload/` boundary, producing the same output as the current `lowDataOptimizer.optimizeAudio` implementation.

3.9 WHEN `optimizeImage` or `optimizeAudio` is called with a non-Cloudinary URL, THEN the system SHALL CONTINUE TO return the original URL unchanged.

3.10 WHEN `optimizeImage` or `optimizeAudio` is called with `null` or `undefined`, THEN the system SHALL CONTINUE TO return an empty string `''`.

3.11 WHEN `src/lib/apiClient.ts` is examined after all changes, THEN it SHALL CONTINUE TO be identical to the pre-change version — no modifications are made to `apiClient.ts`.

3.12 WHEN `src/hooks/useWebSocket.ts` is examined after all changes, THEN it SHALL CONTINUE TO be identical to the pre-change version — no modifications are made to `useWebSocket.ts`.

3.13 WHEN `src/lib/cloudinary.ts` is examined after all changes, THEN it SHALL CONTINUE TO be identical to the pre-change version — no modifications are made to `cloudinary.ts`.

3.14 WHEN `src/screens/LoginScreen.tsx` is examined after all changes, THEN it SHALL CONTINUE TO be identical to the pre-change version — no modifications are made to `LoginScreen.tsx`.

3.15 WHEN `src/config/zones.ts` is examined after all changes, THEN it SHALL CONTINUE TO exist and SHALL NOT be deleted; it serves as the offline fallback for zone resolution.

3.16 WHEN a screen that previously imported `optimizeImage` from `lowDataOptimizer` (e.g. `ArchiveScreen`, `MediaScreen`) is viewed after migration, THEN the Cloudinary URL transformation output SHALL be byte-for-byte identical to the output before migration, because the logic has moved to `mediaUtils.ts` unchanged.

---

## Bug Condition Pseudocode

**Bug Condition Function** — identifies the broken HTTP path:

```pascal
FUNCTION isBugCondition(call)
  INPUT: call — any HTTP request made by the App
  OUTPUT: boolean

  RETURN call.originatesFrom IN {fetchJSON, fetchWithRetry, prewarmCache}
      OR call.header['x-internal-api-key'] IS PRESENT
END FUNCTION
```

**Fix Checking Property:**

```pascal
// Property: No x-internal-api-key header on any request
FOR ALL call WHERE isBugCondition(call) DO
  result ← executeRequest(call)            // after fix: call goes through apiClient
  ASSERT call.header['x-internal-api-key'] DOES NOT EXIST
  ASSERT call.header['Authorization'] = 'Bearer <valid_jwt>'
  ASSERT result ≠ null
  ASSERT result.success = true
END FOR
```

**Preservation Checking Property:**

```pascal
// Property: All non-buggy calls are unchanged
FOR ALL call WHERE NOT isBugCondition(call) DO
  ASSERT behaviour(call, before_fix) = behaviour(call, after_fix)
END FOR
```

This ensures that `apiClient.get/post/patch/delete` calls already present in screens untouched by this fix (e.g. `LoginScreen`, `CommentsScreen`, `CallScreen`) continue to behave identically.
