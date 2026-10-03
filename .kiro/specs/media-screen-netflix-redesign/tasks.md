# Implementation Plan: MediaScreen Netflix Redesign

## Overview

Incrementally upgrade `src/screens/MediaScreen.tsx` to the Netflix-style layout described in the design document. The work is organised in eight stages that build on each other: pure helpers and storage → video player changes → new UI components → main screen wiring → tests. Each stage is independently compilable so the screen remains usable between steps.

---

## Tasks

- [x] 1. Create `mediaStorage.ts` — persistence helpers and pure functions
  - Create `src/screens/mediaStorage.ts` with the four pure functions and four async helpers defined in the design
  - Export `toggleMyList`, `watchProgressPercent`, `isVideoCompleted`, `isNewVideo` as named exports (pure, no I/O)
  - Export `loadWatchProgress`, `saveWatchProgress`, `loadMyList`, `saveMyList` as named async exports using `@react-native-async-storage/async-storage` with keys `@rh:watch_progress` and `@rh:my_list`
  - Export the `WatchProgressRecord` TypeScript interface
  - Add `try/catch` in `loadWatchProgress` and `loadMyList` so they return empty defaults on failure
  - `saveWatchProgress` must clamp `positionSeconds` to `Math.max(0, Math.round(...))` and `durationSeconds` to `Math.max(1, Math.round(...))`
  - _Requirements: 5.3, 5.7, 6.3_

  - [ ]* 1.1 Write property test for `watchProgressPercent` (Property 1)
    - **Property 1: watchProgressPercent is always in [0, 100] — for any non-negative positionSeconds and positive durationSeconds**
    - **Validates: Requirements 4.3, 5.4**
    - Create `src/screens/__tests__/MediaScreen.pbt.test.ts`; use `fc.assert(fc.property(fc.nat(), fc.integer({min:1,max:100_000}), ...), {numRuns:100})`
    - Tag comment: `// Feature: media-screen-netflix-redesign, Property 1`

  - [ ]* 1.2 Write property test for `isVideoCompleted` (Property 2)
    - **Property 2: isVideoCompleted returns true iff positionSeconds / durationSeconds >= 0.95**
    - **Validates: Requirements 4.2, 5.4**
    - Use `fc.integer({min:1})` for durationSeconds, `fc.nat()` for positionSeconds
    - Tag comment: `// Feature: media-screen-netflix-redesign, Property 2`

  - [ ]* 1.3 Write property tests for `toggleMyList` (Properties 3 & 4)
    - **Property 3: toggleMyList applied twice returns the original list (involution)**
    - **Property 4: single toggle correctly adds or removes videoId and preserves all other IDs**
    - **Validates: Requirements 2.4, 6.2**
    - Use `fc.array(fc.string())` for list, `fc.string()` for videoId
    - Tag comment: `// Feature: media-screen-netflix-redesign, Property 3` and `Property 4`

  - [ ]* 1.4 Write property test for `isNewVideo` (Property 8)
    - **Property 8: isNewVideo returns true iff 0 <= now - createdAt < 7 days; undefined/invalid returns false**
    - **Validates: Requirements 4.5**
    - Generate ISO timestamps with `fc.date()` and compare to a fixed reference `now`
    - Tag comment: `// Feature: media-screen-netflix-redesign, Property 8`

- [-] 2. Update `VideoPlayerInner` — progress tracking and resume
  - Add `initialPosition?: number` and `onProgressUpdate: (videoId: string, positionSeconds: number, durationSeconds: number) => void` to the `VideoPlayerModal` and `VideoPlayerInner` prop interfaces in `MediaScreen.tsx`
  - Inside `VideoPlayerInner`, after the player is constructed, set `player.currentTime = initialPosition` when `initialPosition > 0`
  - Add a `useEffect` that starts a `setInterval` at 5 000 ms, reads `player.currentTime` and `player.duration`, and calls `onProgressUpdate(video.id, pos, dur)` when `dur > 0`; clear the interval on cleanup
  - Add a `handleClose` callback that fires `onProgressUpdate` once with the final position before calling `onClose`, so the save-on-close path executes regardless of dismiss method
  - Replace both `onPress={onClose}` buttons with `onPress={handleClose}`
  - _Requirements: 5.1, 5.2, 5.5_

- [-] 3. Implement `HeroBannerContainer` component
  - Add `HeroBannerContainerProps` interface and `HeroBannerContainer` function component inside `MediaScreen.tsx` (or a co-located file imported there)
  - Compute `HERO_HEIGHT = Math.max(Dimensions.get('window').height * 0.48, 340)` (≥ 48 % of screen height per Requirement 1.1)
  - Render a `<View style={{ width: '100%', height: HERO_HEIGHT, position: 'relative' }}>` container
  - Render full-bleed `<Image>` with `contentFit="cover"`, `style={StyleSheet.absoluteFill}`, `transition={300}` (≤ 300 ms fade per Requirement 10.5), and `defaultSource` pointing to the local fallback asset
  - Render `<LinearGradient colors={['transparent','rgba(11,11,16,0.5)','#0B0B10']} locations={[0,0.55,1]} style={StyleSheet.absoluteFill} />` as the overlay
  - Render `CategoryTabBar` absolutely positioned inside the hero (bottom offset above the action row, `zIndex: 20`) — NOT inside `Top_App_Bar`
  - Render hero content (`HeroTagBadge`, title `fontSize≥22` bold white max 2 lines, metadata `opacity≥0.65` max 1 line, `HeroActionRow`) pinned to the bottom via `position:'absolute', bottom:0`
  - When `heroVideo` is null, return `null` without rendering the container
  - _Requirements: 1.1–1.8, 3.1–3.4_

- [-] 4. Implement `HeroActionRow` component
  - Add `HeroActionRowProps` interface and `HeroActionRow` function component
  - Render three buttons left-to-right: **My List** (`width:80`, icon `checkmark-done` when in list / `add` when not, label "My List", `backgroundColor:'rgba(255,255,255,0.15)'`) → **Play** (`flex:1, minWidth:120`, solid white background, dark text + filled play icon) → **Info** (`width:80`, icon `information-circle-outline`, label "Info", same semi-transparent style)
  - My List and Info button backgrounds must have opacity ≥ 0.6 to meet Requirement 2.8
  - The Play button width must be visually dominant (≥ 120 % of each secondary button width) per Requirement 2.2
  - Wire `onMyListToggle`, `onPlay`, `onInfo` callbacks to the respective `onPress` handlers
  - Display the correct icon based on `isInMyList` prop on every render; update within 300 ms per Requirement 2.4
  - _Requirements: 2.1–2.8_

- [ ] 5. Implement `ContinueWatchingRow` and `ContinueWatchingCard`
  - Add `ContinueWatchingCardProps` and `ContinueWatchingCard` component
  - Card renders: 16:9 thumbnail (`expo-image`, `contentFit="cover"`, fallback to local asset per Requirement 7.6), centred circular play overlay, title (2 lines, ellipsis), "NEW" badge (top-right, shown when `isNewVideo(video.createdAt)` is true), and a progress bar at the bottom of the thumbnail (`<View progressTrack><View progressFill width=\`${progressPercent}%\`/></View>`)
  - `progressPercent` = `watchProgressPercent(progress.positionSeconds, progress.durationSeconds)`
  - `onPress` opens the video player at `progress.positionSeconds` (resume within ±2 s per Requirement 4.4)
  - Add `ContinueWatchingRowProps` and `ContinueWatchingRow` component that wraps a `NetflixSectionRow`-style container titled "Continue Watching"
  - Return `null` when `videos` array is empty (Requirement 4.6)
  - _Requirements: 4.1–4.8, 7.2–7.4_

  - [ ]* 5.1 Write property test for `continueWatchingVideos` derivation (Property 7)
    - **Property 7: derived continueWatchingList always has positionSeconds>0, ratio<0.95, is sorted by lastWatchedAt desc, and has ≤10 entries**
    - **Validates: Requirements 4.2, 4.8**
    - Generate arbitrary `watchProgress` maps and `mediaList` arrays using `fc.array` and `fc.record`
    - Tag comment: `// Feature: media-screen-netflix-redesign, Property 7`

- [-] 6. Implement `MyListRow` component
  - Add `MyListRowProps` and `MyListRow` component that wraps `NetflixSectionRow` titled "My List"
  - Each card is a `NetflixVideoCard` variant extended with a bookmark icon button in the top-right corner of the thumbnail (`Ionicons` `bookmark` when in list / `bookmark-outline` when not)
  - The bookmark button calls `onMyListToggle(video.id)` on press and updates its icon within 300 ms per Requirement 6.2
  - Return `null` when `videos` array is empty (Requirement 6.1)
  - _Requirements: 6.1–6.7, 7.1–7.6_

- [-] 7. Implement `InfoModal` component
  - Add `InfoModalProps` and `InfoModal` component
  - Use React Native `<Modal animationType="slide" transparent>` with a semi-transparent dark backdrop and a bottom-sheet-style content panel
  - Render fields in this order, **only when truthy** on the `MediaAsset`: title, description, category, channelName, duration — omit any absent field entirely (no placeholder text per Requirement 2.6)
  - Provide a close button (X icon or "Close" label) that calls `onClose`
  - When `video` prop is `null`, render `null`
  - _Requirements: 2.6_

- [ ] 8. Implement `Toast` component
  - Add a `Toast` component that accepts `message: string | null` and `onHide: () => void`
  - Use `Animated.Value` for opacity; fade in over 150 ms, hold for 2 000 ms, then fade out and call `onHide`
  - Position at the bottom of the screen above the safe-area inset using `position:'absolute'`
  - When `message` is `null` or empty, render `null` without starting the animation
  - _Requirements: 6.4_

- [~] 9. Checkpoint — compile and smoke-test core components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Wire new state, derived values, and layout into `MediaScreen`
  - [~] 10.1 Add new state and `useEffect` hooks
    - Add `myList`, `watchProgress`, `infoModalVideo`, `toastMessage` state variables
    - Add a `useEffect` on mount that calls `loadMyList()` and `loadWatchProgress()` and sets the respective state
    - _Requirements: 5.7, 6.3_

  - [~] 10.2 Add `useMemo` derived values
    - Add `continueWatchingVideos` memo: filter `mediaList` where `ratio > 0 && ratio < 0.95`, sort by `lastWatchedAt` desc, slice to 10
    - Add `myListVideos` memo: map `myList` IDs to `MediaAsset` objects via `mediaList.find`, filter out missing
    - Move `HERO_HEIGHT` to a module-level constant computed from `Dimensions.get('window').height * 0.48` (min 340)
    - _Requirements: 4.1–4.2, 4.8, 6.1_

  - [~] 10.3 Add `handleProgressUpdate`, `handleMyListToggle`, and `handleRefreshError` callbacks
    - `handleProgressUpdate(videoId, positionSeconds, durationSeconds)`: calls `saveWatchProgress`, updates state; on failure logs warning and does NOT interrupt playback (Requirement 5.5)
    - `handleMyListToggle(videoId)`: calls `toggleMyList`, calls `saveMyList`; on success sets `toastMessage` and triggers light haptic pulse via `expo-haptics` (Requirement 6.4); on failure logs error, shows toast with error text, reverts state (Requirement 2.7, 6.5)
    - Update `onRefresh` to catch errors, dismiss `RefreshControl`, and set `toastMessage` with the error message (Requirement 10.6)
    - _Requirements: 2.4, 2.7, 5.5, 6.4, 6.5, 10.6_

  - [~] 10.4 Restructure the JSX layout
    - Remove `Category_Tab_Bar` from inside `headerBar` — it moves inside `HeroBannerContainer`
    - Convert `Top_App_Bar` (the `headerBar` View) to `position:'absolute'`, `top:0`, `left:0`, `right:0`, `zIndex:30`, `paddingTop: insets.top` so it floats over the `ScrollView`
    - Remove `SafeAreaView` as the outer wrapper; replace with a plain `<View style={{flex:1, position:'relative'}}>` so the hero can bleed behind the transparent top bar
    - Set `ScrollView` `contentContainerStyle` `paddingTop: 0` so the hero starts at the very top of the screen
    - Replace the old `heroContainer` JSX block with `<HeroBannerContainer>` passing `heroVideo`, `myList`, `categoryTabs`, `selectedCategory`, `onSelectCategory`, `onMyListToggle`, `onPlay={openMedia}`, `onInfo={v => setInfoModalVideo(v)}`
    - Insert `<ContinueWatchingRow>` between the hero and the categorised rows; pass `continueWatchingVideos`, `watchProgress`, and `onPress={(v,pos)=>{ openMedia(v); /* pass initialPosition */ }}`
    - Insert `<MyListRow>` below `ContinueWatchingRow` (or as first row when no CW row) and above the categorised rows; pass `myListVideos`, `onPress={openMedia}`, `onMyListToggle`
    - Render empty-state view (icon + "No videos available" heading + sub-message) when `mediaList` is empty after a successful fetch (Requirement 10.4)
    - _Requirements: 1.1–1.8, 3.1–3.7, 4.1, 6.6–6.7, 10.3–10.4_

  - [~] 10.5 Wire `VideoPlayerModal`, `InfoModal`, and `Toast` into the render output
    - Update `VideoPlayerModal` call site to pass `initialPosition={watchProgress[activeVideo?.id]?.positionSeconds}` and `onProgressUpdate={handleProgressUpdate}`
    - Render `<InfoModal video={infoModalVideo} onClose={() => setInfoModalVideo(null)} />` below the player modal
    - Render `<Toast message={toastMessage} onHide={() => setToastMessage(null)} />` at the bottom of the root view
    - _Requirements: 2.5–2.6, 4.4, 5.1–5.2, 6.4_

- [~] 11. Checkpoint — full integration smoke-test
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Write unit tests
  - [ ]* 12.1 Write unit tests for `HeroBannerContainer` and `HeroActionRow`
    - Create `src/screens/__tests__/MediaScreen.unit.test.tsx` using React Native Testing Library
    - Test: renders `null` when `heroVideo` is null
    - Test: shows `add` icon when video not in list; shows `checkmark-done` icon when video is in list
    - Test: pressing "My List" button calls `onMyListToggle`
    - _Requirements: 1.8, 2.3–2.4_

  - [ ]* 12.2 Write unit tests for `InfoModal`
    - Test: fields present on `MediaAsset` are rendered; absent fields are not rendered and no placeholder text appears
    - Test: returns `null` when `video` prop is `null`
    - _Requirements: 2.6_

  - [ ]* 12.3 Write unit tests for `ContinueWatchingRow` and empty states
    - Test: row is not rendered when `videos` is empty
    - Test: progress bar fill width equals `(positionSeconds / durationSeconds) * 100%` for known values
    - Test: "Latest Videos" row shown when all three category rows have zero videos
    - _Requirements: 4.6, 7.1, 10.3_

  - [ ]* 12.4 Write unit tests for storage helpers and error branches
    - Create `src/screens/__tests__/mediaStorage.unit.test.ts`
    - Test `loadMyList` returns `[]` when `AsyncStorage.getItem` throws
    - Test `loadWatchProgress` returns `{}` when `AsyncStorage.getItem` throws
    - Test My List toggle reverts state when `AsyncStorage.setItem` throws (mock `saveMyList` to reject)
    - Test progress save failure does not interrupt playback (mock `saveWatchProgress` to reject; verify no toast is shown)
    - _Requirements: 5.5, 6.5_

  - [ ]* 12.5 Write unit tests for `VideoPlayerInner` timer and close behaviour
    - Use `jest.useFakeTimers()`; advance by 5 000 ms and verify `onProgressUpdate` is called once with correct args
    - Simulate the close action and verify `onProgressUpdate` is called before `onClose`
    - _Requirements: 5.1, 5.2_

  - [ ]* 12.6 Write property tests for filter functions (Properties 5 & 6)
    - **Property 5: every video in filteredVideos matches selectedCategory (non-"All"); "All" returns all search-matched videos**
    - **Property 6: every video in filteredVideos satisfies at least one of title/category/channelName substring match for query q**
    - **Validates: Requirements 3.7, 9.5**
    - Add to `src/screens/__tests__/MediaScreen.pbt.test.ts`
    - Tag comments: `// Feature: media-screen-netflix-redesign, Property 5` and `Property 6`

- [~] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- `fast-check` must be present in the project — add it with `npm install --save-dev fast-check` if absent
- `expo-haptics` is used for the light haptic pulse in `handleMyListToggle`; add `expo install expo-haptics` if absent
- The `HERO_HEIGHT` constant must be computed at render time using `Dimensions.get('window').height`, not `SCREEN_WIDTH`, to satisfy the ≥ 48 % screen height requirement
- Property tests all run with `{ numRuns: 100 }` minimum as specified in the design
- The `Top_App_Bar` shares the same top origin as the hero but sits at `zIndex: 30` (above the Category_Tab_Bar at `zIndex: 20` and hero content at `zIndex: 10`)
- The `insets.top` from `useSafeAreaInsets()` must be used as `paddingTop` on the absolutely-positioned `Top_App_Bar` so it clears the status bar on all devices
- All field rendering in `InfoModal` must be guarded by a truthiness check — never render an empty `<Text>` or placeholder

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4", "5", "6", "7", "8"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["10.1", "10.2"] },
    { "id": 5, "tasks": ["10.3"] },
    { "id": 6, "tasks": ["10.4"] },
    { "id": 7, "tasks": ["10.5"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5", "12.6"] }
  ]
}
```
