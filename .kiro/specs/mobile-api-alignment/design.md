# Design: Mobile App API Alignment

## Overview

This change eliminates the broken secondary HTTP path (`lowDataOptimizer.fetchJSON` / `fetchWithRetry`) from the `rehearsalhubv2` mobile app, replacing every call with `apiClient.get()` — the same authorized client that already works correctly for auth, profile, notifications, settings, and attendance. The pure URL-transformation utilities are extracted into a standalone `mediaUtils.ts` module so nothing is lost.

The reference architecture is the Zonal Portal web app, which has exactly one HTTP path: `apiClient`. Every screen fetches from the API using `apiClient.get('/path')` and never constructs a `BACKEND_URL + '/path'` string itself.

---

## Components and Interfaces

### `src/lib/mediaUtils.ts` (new)

```typescript
export function optimizeImage(url: string | null | undefined, opts?: { width?: number; quality?: number }): string
export function thumbnailImage(url: string | null | undefined): string
export function bannerImage(url: string | null | undefined): string
export function optimizeAudio(url: string | null | undefined): string
```

### `src/lib/apiClient.ts` (modified)

New named export added to existing module:
```typescript
export function clearCache(): void
```

All other exports remain unchanged: `apiClient`, `storeTokens`, `clearTokens`, `SessionExpiredError`, `BASE_URL`.

---

## Data Models

No new data models are introduced. This refactor does not change any API request or response shapes. All endpoints remain the same. The only change is which HTTP utility makes the call.

---

## Error Handling

- `apiClient.get()` already handles 401 → token refresh → retry internally
- Network failures fall back to the in-memory `apiGetCache` (stale-while-offline)
- `clearCache()` is a synchronous no-op if the cache is already empty — no error can be thrown

---

## Testing Strategy

1. Manually verify each affected screen loads data after the change (songs, programs, archive categories)
2. Confirm no `x-internal-api-key` header appears in network traffic after `lowDataOptimizer.ts` is deleted
3. TypeScript build must pass with zero errors after all migrations and deletion of `lowDataOptimizer.ts`

---

## Correctness Properties

### Property 1: Single Authorized HTTP Path

GIVEN the mobile app is running and a user is authenticated, WHEN any screen fetches data from the API, THEN the HTTP request SHALL include `Authorization: Bearer <jwt>` header via `apiClient`.

### Property 2: No Hardcoded Base URLs in Screens

GIVEN any screen file under `src/screens/`, WHEN the file is statically analyzed, THEN it SHALL NOT contain a `const BACKEND_URL` or `const BASE_URL` variable declaration.

### Property 3: No `lowDataOptimizer` References After Migration

GIVEN all migration tasks are complete, WHEN a search for `lowDataOptimizer` is run across `src/` and `App.tsx`, THEN zero matches SHALL be found.

---

## Architecture

This change eliminates the broken secondary HTTP path (`lowDataOptimizer.fetchJSON` / `fetchWithRetry`) from the `rehearsalhubv2` mobile app, replacing every call with `apiClient.get()` — the same authorized client that already works correctly for auth, profile, notifications, settings, and attendance. The pure URL-transformation utilities are extracted into a standalone `mediaUtils.ts` module so nothing is lost.

The reference architecture is the Zonal Portal web app, which has exactly one HTTP path: `apiClient`. Every screen fetches from the API using `apiClient.get('/path')` and never constructs a `BACKEND_URL + '/path'` string itself.

---

## Architecture

### Before (broken)

```
Screen ──────────────► fetchJSON(BACKEND_URL + '/songs/master')
                            │
                            ▼
                       fetchWithRetry()
                            │
                            ▼ sends x-internal-api-key (unrecognized)
                       rehearsalhub-api ── 401 silently → null
```

### After (correct — mirrors web)

```
Screen ──────────────► apiClient.get('/songs/master')
                            │
                            ▼ sends Authorization: Bearer <jwt>
                            ▼ sends x-zone-id / x-zone-code headers
                       rehearsalhub-api ── 200 OK → data
```

---

## File Changes

### New: `src/lib/mediaUtils.ts`

Pure functions extracted from `lowDataOptimizer.ts`. No imports from HTTP libraries, `SecureStore`, or Sentry.

```typescript
export function optimizeImage(url: string | null | undefined, opts?: { width?: number; quality?: number }): string
export function thumbnailImage(url: string | null | undefined): string
export function bannerImage(url: string | null | undefined): string
export function optimizeAudio(url: string | null | undefined): string
```

Logic is identical to the existing implementations in `lowDataOptimizer.ts`.

---

### Modified: `src/lib/apiClient.ts`

Add one new named export:

```typescript
export function clearCache(): void {
  apiGetCache.clear();
}
```

This replaces all usages of `clearResponseCache()` from `lowDataOptimizer`.

---

### Modified: `src/hooks/useUser.tsx`

- Remove: `import { clearResponseCache } from '../lib/lowDataOptimizer'`
- Add: `import { clearCache } from '../lib/apiClient'`
- Replace all `clearResponseCache()` → `clearCache()`

---

### Modified: `App.tsx`

- Remove: `import { prewarmCache } from './src/lib/lowDataOptimizer'`
- Remove: `prewarmCache([...])` call

---

### Modified: `src/screens/AllMinisteredSongsScreen.tsx`

| Before | After |
|---|---|
| `import { optimizeImage, optimizeAudio, fetchJSON } from '../lib/lowDataOptimizer'` | `import { optimizeAudio } from '../lib/mediaUtils'` |
| `const BACKEND_URL = ...` | *(deleted)* |
| `fetchJSON<any>(BACKEND_URL + '/songs/master', ...)` | `apiClient.get<any>('/songs/master')` |
| `fetchJSON<any>(BACKEND_URL + '/programs', ...)` | `apiClient.get<any>('/programs')` |

The response shape from `apiClient.get` returns `{ success, data }` — the existing response parsing (`songsResult?.success ? songsResult.data : []`) already handles this correctly.

---

### Modified: `src/screens/RehearsalScreen.tsx`

| Before | After |
|---|---|
| `import { fetchJSON, optimizeImage, optimizeAudio, clearResponseCache } from '../lib/lowDataOptimizer'` | `import { optimizeImage, optimizeAudio } from '../lib/mediaUtils'` + `import { clearCache } from '../lib/apiClient'` |
| `const BACKEND_URL = ...` | *(deleted)* |
| `fetchJSON<any>(BACKEND_URL + '/programs', ...)` | `apiClient.get<any>('/programs')` |
| `fetchJSON<any>(BACKEND_URL + '/programs?zoneId=...')` | `apiClient.get<any>('/programs?zoneId=...')` |
| `clearResponseCache()` | `clearCache()` |

---

### Modified: `src/screens/SearchScreen.tsx`

| Before | After |
|---|---|
| `import { optimizeAudio, fetchJSON } from '../lib/lowDataOptimizer'` | `import { optimizeAudio } from '../lib/mediaUtils'` |
| `const BACKEND_URL = ...` | *(deleted)* |
| `fetchJSON<any>(BACKEND_URL + '/songs/master', ...)` | `apiClient.get<any>('/songs/master')` |
| `fetchJSON<any>(zoneUrl, ...)` | `apiClient.get<any>('/songs/zone?zoneId=...')` |
| `fetchJSON<any>(subgroupUrl, ...)` | `apiClient.get<any>('/songs/subgroup?zoneId=...')` |

---

### Modified: `src/screens/SubgroupScreen.tsx`

| Before | After |
|---|---|
| `import { fetchJSON, optimizeImage, optimizeAudio, clearResponseCache } from '../lib/lowDataOptimizer'` | `import { optimizeImage, optimizeAudio } from '../lib/mediaUtils'` |
| `const BACKEND_URL = ...` | *(deleted)* |
| `clearResponseCache()` | `clearCache()` from `apiClient` |

---

### Modified: `src/screens/ArchiveScreen.tsx`

| Before | After |
|---|---|
| `import { optimizeImage, clearResponseCache } from '../lib/lowDataOptimizer'` | `import { optimizeImage } from '../lib/mediaUtils'` |
| `clearResponseCache()` | `clearCache()` from `apiClient` |

---

### Modified: `src/screens/PlayerScreen.tsx`

| Before | After |
|---|---|
| `import { optimizeAudio } from '../lib/lowDataOptimizer'` | `import { optimizeAudio } from '../lib/mediaUtils'` |

---

### Modified: `src/screens/MediaScreen.tsx`

| Before | After |
|---|---|
| `import { optimizeImage, optimizeAudio } from '@/lib/lowDataOptimizer'` | `import { optimizeImage, optimizeAudio } from '@/lib/mediaUtils'` |

---

### Deleted: `src/lib/lowDataOptimizer.ts`

Removed entirely after all consumers are migrated.

---

## Response Shape Handling

`apiClient.get()` returns the raw JSON response from the API, which follows the shape:
```json
{ "success": true, "data": [...] }
```

The existing code in `AllMinisteredSongsScreen` and `SearchScreen` already handles this correctly with:
```typescript
const rawSongs = Array.isArray(songsResult) ? songsResult : (songsResult?.success ? songsResult.data : []);
```

This guard handles both the old `fetchJSON` (which returned the raw array) and the new `apiClient.get` (which returns `{ success, data }`), so no additional parsing changes are needed.

---

## What Is NOT Changed

- `src/lib/apiClient.ts` core logic (BASE_URL, token storage, zone headers, refresh flow) — already correct
- `src/hooks/useUser.tsx` core logic (profile fetch, zone membership from `/members/mine`) — already correct
- `src/hooks/useWebSocket.ts` — already correct
- `src/lib/cloudinary.ts` (media upload) — uses its own `BASE_URL` for multipart uploads, which is intentional and correct
- The `ZONES` config array in `src/config/zones.ts` — hardcoded zone list is intentional and matches the web exactly
- All other screens that already use `apiClient.get()` directly

---

## Correctness Properties

1. **Single auth path**: After this change, every HTTP call to `rehearsalhub-api` from the mobile app goes through `apiClient`, which always attaches `Authorization: Bearer <jwt>`.

2. **Token refresh consistency**: Any API call that receives a 401 will trigger the same refresh flow, regardless of which screen made the call.

3. **Zone context propagation**: Every API call includes `x-zone-id` and `x-zone-code` headers automatically via `apiClient`'s `getActiveZoneHeaders()`, scoping responses to the user's active zone.

4. **No hardcoded URLs in screens**: No screen file constructs its own `BACKEND_URL`. All path fragments are relative (e.g., `/songs/master`), making the base URL a single configuration point in `apiClient`.
