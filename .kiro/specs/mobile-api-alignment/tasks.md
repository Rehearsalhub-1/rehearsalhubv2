# Implementation Plan: Mobile App API Alignment

## Overview

12-task plan to eliminate `lowDataOptimizer` from the mobile app. Tasks proceed in dependency order: create the new `mediaUtils.ts` first, add `clearCache()` to `apiClient`, migrate all consumers, then delete the old file.

## Tasks

- [ ] 1. Create `src/lib/mediaUtils.ts` with pure image/audio utility functions
  - [ ] 1.1 Create the file and export `optimizeImage(url, opts?)`, `thumbnailImage(url)`, `bannerImage(url)`, `optimizeAudio(url)`
  - [x] 1.2 Copy the exact implementation from `lowDataOptimizer.ts` for each function
  - [x] 1.3 Verify the file has zero imports from HTTP libraries, SecureStore, or Sentry

- [x] 2. Add `clearCache()` export to `src/lib/apiClient.ts`
  - [x] 2.1 Add `export function clearCache(): void { apiGetCache.clear(); }` after the `apiGetCache` Map declaration
  - [x] 2.2 Verify TypeScript compilation passes after the change

- [x] 3. Fix `src/hooks/useUser.tsx`
  - [x] 3.1 Remove the `import { clearResponseCache } from '../lib/lowDataOptimizer'` line
  - [x] 3.2 Add `import { clearCache } from '../lib/apiClient'` (or add `clearCache` to the existing import)
  - [x] 3.3 Replace every `clearResponseCache()` call with `clearCache()`
  - [x] 3.4 Verify TypeScript compilation passes

- [x] 4. Fix `App.tsx`
  - [x] 4.1 Remove `import { prewarmCache } from './src/lib/lowDataOptimizer'`
  - [x] 4.2 Remove the `prewarmCache([...])` call in the `prepare()` function
  - [x] 4.3 Verify TypeScript compilation passes

- [ ] 5. Fix `src/screens/AllMinisteredSongsScreen.tsx`
  - [x] 5.1 Remove `import { optimizeImage, optimizeAudio, fetchJSON } from '../lib/lowDataOptimizer'`
  - [x] 5.2 Add `import { optimizeAudio } from '../lib/mediaUtils'`
  - [x] 5.3 Remove `const BACKEND_URL = ...` declaration
  - [x] 5.4 Replace `fetchJSON<any>(url, null, 15000)` for songs with `apiClient.get<any>('/songs/master')`
  - [x] 5.5 Replace `fetchJSON<any>(BACKEND_URL + '/programs', null, 15000)` with `apiClient.get<any>('/programs')`
  - [x] 5.6 Verify the `songsResult` and `programsResult` parsing handles the `{ success, data }` envelope correctly
  - [x] 5.7 Verify TypeScript compilation passes

- [ ] 6. Fix `src/screens/RehearsalScreen.tsx`
  - [x] 6.1 Remove `import { fetchJSON, optimizeImage, optimizeAudio, clearResponseCache } from '../lib/lowDataOptimizer'`
  - [x] 6.2 Add `import { optimizeImage, optimizeAudio } from '../lib/mediaUtils'`
  - [ ] 6.3 Add `import { clearCache } from '../lib/apiClient'` (or add to existing import)
  - [x] 6.4 Remove `const BACKEND_URL = ...` declaration
  - [x] 6.5 Replace all `fetchJSON(BACKEND_URL + '/...')` calls with `apiClient.get('/...')` using the same relative path
  - [x] 6.6 Replace `clearResponseCache()` with `clearCache()`
  - [x] 6.7 Verify TypeScript compilation passes

- [ ] 7. Fix `src/screens/SearchScreen.tsx`
  - [x] 7.1 Remove `import { optimizeAudio, fetchJSON } from '../lib/lowDataOptimizer'`
  - [ ] 7.2 Add `import { optimizeAudio } from '../lib/mediaUtils'`
  - [ ] 7.3 Remove `const BACKEND_URL = ...` declaration
  - [ ] 7.4 Replace `fetchJSON<any>(url, null)` for master songs with `apiClient.get<any>('/songs/master')`
  - [ ] 7.5 Replace `fetchJSON<any>(zoneUrl, null)` with `apiClient.get<any>('/songs/zone?zoneId=...')`
  - [ ] 7.6 Replace `fetchJSON<any>(subgroupUrl, null)` with `apiClient.get<any>('/songs/subgroup?zoneId=...')`
  - [ ] 7.7 Update the response parsing to handle `{ success, data }` envelope where needed
  - [ ] 7.8 Verify TypeScript compilation passes

- [ ] 8. Fix `src/screens/SubgroupScreen.tsx`
  - [ ] 8.1 Remove `import { fetchJSON, optimizeImage, optimizeAudio, clearResponseCache } from '../lib/lowDataOptimizer'`
  - [ ] 8.2 Add `import { optimizeImage, optimizeAudio } from '../lib/mediaUtils'`
  - [ ] 8.3 Add `import { clearCache } from '../lib/apiClient'` (or add to existing import)
  - [ ] 8.4 Remove `const BACKEND_URL = ...` declaration (if present — SubgroupScreen may already be mostly migrated)
  - [ ] 8.5 Replace `clearResponseCache()` with `clearCache()`
  - [ ] 8.6 Verify TypeScript compilation passes

- [ ] 9. Fix `src/screens/ArchiveScreen.tsx`
  - [ ] 9.1 Remove `import { optimizeImage, clearResponseCache } from '../lib/lowDataOptimizer'`
  - [ ] 9.2 Add `import { optimizeImage } from '../lib/mediaUtils'`
  - [ ] 9.3 Add `import { clearCache } from '../lib/apiClient'` (or add to existing import)
  - [ ] 9.4 Replace `clearResponseCache()` with `clearCache()`
  - [ ] 9.5 Verify TypeScript compilation passes

- [ ] 10. Fix `src/screens/PlayerScreen.tsx`
  - [ ] 10.1 Replace `import { optimizeAudio } from '../lib/lowDataOptimizer'` with `import { optimizeAudio } from '../lib/mediaUtils'`
  - [ ] 10.2 Verify TypeScript compilation passes

- [ ] 11. Fix `src/screens/MediaScreen.tsx`
  - [ ] 11.1 Replace `import { optimizeImage, optimizeAudio } from '@/lib/lowDataOptimizer'` with `import { optimizeImage, optimizeAudio } from '@/lib/mediaUtils'`
  - [ ] 11.2 Verify TypeScript compilation passes

- [ ] 12. Delete `src/lib/lowDataOptimizer.ts`
  - [ ] 12.1 Confirm zero remaining imports of `lowDataOptimizer` across the entire codebase (search `rehearsalhubv2/src` and `App.tsx`)
  - [ ] 12.2 Delete the file
  - [ ] 12.3 Run TypeScript build and confirm zero errors
