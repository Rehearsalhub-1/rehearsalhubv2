# Design Document: MediaScreen Netflix Redesign

## Overview

This document describes the technical design for upgrading `src/screens/MediaScreen.tsx` to a Netflix-style layout. The work is purely additive and refactoring within a single screen file and its co-located sub-components; no new screens, routes, or back-end changes are required. The existing API call, video player modal, search flow, and dark theme are preserved. Four new capabilities are added:

1. **Taller hero banner** (≥48 % of screen height) with Category_Tab_Bar absolutely positioned on top of it.
2. **Hero Action Row** with three buttons: My List, Play, Info — plus a standalone Info modal.
3. **Continue Watching row** driven by persisted, automatically-tracked watch-progress data.
4. **My List row** driven by persisted bookmarks, toggleable from both the hero and each card.

The target runtime is React Native / Expo with TypeScript. All persistence uses `@react-native-async-storage/async-storage`.

---

## Architecture

### Component Tree (after redesign)

```
MediaScreen                           ← top-level screen
├── LinearGradient (background)
├── DoodleBackground
├── SafeAreaView (flex:1)
│   ├── StatusBar
│   │   
│   │   [Absolutely positioned over hero]
│   ├── Top_App_Bar                   ← z-index: 30 (logo + search/profile)
│   │   └── SearchBar (when searching)
│   │
│   └── ScrollView (main)
│       │
│       ├── HeroBannerContainer       ← position: relative, height ≥ 48%
│       │   ├── Image (thumbnail, full-bleed)
│       │   ├── LinearGradient (overlay)
│       │   ├── Category_Tab_Bar      ← absolutelyPositioned bottom of hero
│       │   │                           (z-index: 20)
│       │   └── HeroContent
│       │       ├── HeroTagBadge
│       │       ├── HeroTitle
│       │       ├── HeroMetaText
│       │       └── HeroActionRow
│       │           ├── MyListButton
│       │           ├── PlayButton
│       │           └── InfoButton
│       │
│       ├── ContinueWatchingRow?      ← conditional
│       ├── MyListRow?                ← conditional
│       ├── NetflixSectionRow (Praise Night)
│       ├── NetflixSectionRow (Rehearsals)
│       └── NetflixSectionRow (Specials)
│
├── VideoPlayerModal                  ← fullscreen modal with progress tracking
├── InfoModal                         ← in-screen overlay modal (new)
└── Toast (ephemeral, new)
```

### Rendering modes

| `isSearching` | `selectedCategory` | Layout rendered |
|---|---|---|
| `true` | any | Top_App_Bar (search input) + results grid |
| `false` | `"All"` | Hero + ContinueWatching? + MyList? + all rows |
| `false` | non-"All" | Filtered content rows only (no Hero, no CW) |

---

## Components and Interfaces

### Modified: `MediaScreen` (main export)

**New props**: none (navigation prop unchanged).

**New state** (see State Management section for full detail):
- `myList: string[]`
- `watchProgress: Record<string, WatchProgressRecord>`
- `infoModalVideo: MediaAsset | null`
- `toastMessage: string | null`

**New behaviour**:
- Mounts `loadMyList()` and `loadWatchProgress()` on mount via `useEffect`.
- Passes `watchProgress` and `myList` down to `ContinueWatchingRow` and `MyListRow`.
- Passes `onMyListToggle`, `onVideoSelect`, `onInfoPress` callbacks to `HeroBannerContainer` and all card rows.

---

### New: `HeroBannerContainer`

```tsx
interface HeroBannerContainerProps {
  heroVideo: MediaAsset;
  myList: string[];
  onMyListToggle: (videoId: string) => void;
  onPlay: (video: MediaAsset) => void;
  onInfo: (video: MediaAsset) => void;
  categoryTabs: string[];
  selectedCategory: string;
  onSelectCategory: (tab: string) => void;
}
```

Contains:
- Full-bleed `Image` at `heroHeight` (computed from `Dimensions`, ≥48 % screen height).
- `LinearGradient` overlay (`['transparent', 'rgba(11,11,16,0.5)', '#0B0B10']`, locations `[0, 0.55, 1]`).
- `HeroContent` (title, meta, `HeroActionRow`) — positioned at the bottom via `justifyContent: 'flex-end'`.
- `CategoryTabBar` — absolutely positioned, bottom offset = `heroActionRowHeight + heroContentPaddingBottom`, so tabs sit just above the action row.

The container itself uses `position: 'relative'` so child absolute elements are bounded within it.

---

### New: `HeroActionRow`

```tsx
interface HeroActionRowProps {
  video: MediaAsset;
  isInMyList: boolean;
  onMyListToggle: () => void;
  onPlay: () => void;
  onInfo: () => void;
}
```

Renders three buttons left-to-right: My List → Play → Info.

- **My List button**: `{ width: 80 }`, icon `checkmark-done` (in list) or `add` (not in list), label "My List". Background `rgba(255,255,255,0.15)`, opacity ensures contrast ≥ 0.6.
- **Play button**: `{ flex: 1, minWidth: 120 }` — wider than siblings. Solid white background, dark text + play icon.
- **Info button**: `{ width: 80 }`, icon `information-circle-outline`, label "Info". Same semi-transparent style as My List.

---

### Modified: `VideoPlayerModal` / `VideoPlayerInner`

**New props added to `VideoPlayerModal`**:
```tsx
interface VideoPlayerModalProps {
  video: MediaAsset | null;
  initialPosition?: number;            // new — seek to this position on open
  onClose: () => void;
  onProgressUpdate: (videoId: string, positionSeconds: number, durationSeconds: number) => void;  // new
}
```

Inside `VideoPlayerInner`:
- `useEffect` sets up a `setInterval` (5 s) that calls `player.currentTime` and invokes `onProgressUpdate`.
- On unmount cleanup: clears interval and fires `onProgressUpdate` once more with the final position.
- On open: calls `player.seekBy` (or equivalent seek API) to `initialPosition` after the player is ready.

---

### New: `ContinueWatchingRow`

```tsx
interface ContinueWatchingRowProps {
  videos: MediaAsset[];
  watchProgress: Record<string, WatchProgressRecord>;
  onPress: (video: MediaAsset, startPosition: number) => void;
}
```

Renders a `NetflixSectionRow`-style container with the title "Continue Watching". Each card is a `ContinueWatchingCard`:

```tsx
interface ContinueWatchingCardProps {
  video: MediaAsset;
  progress: WatchProgressRecord;
  onPress: () => void;
}
```

Card renders:
1. 16:9 thumbnail image.
2. Centred circular play overlay.
3. "NEW" badge (top-right) if `createdAt` is within 7 days.
4. Progress bar at the bottom of the thumbnail:
   ```tsx
   <View style={styles.progressTrack}>
     <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
   </View>
   ```
   where `progressPercent = Math.min(100, (progress.positionSeconds / progress.durationSeconds) * 100)`.
5. Title text (2 lines, ellipsis).

---

### New: `MyListRow`

```tsx
interface MyListRowProps {
  videos: MediaAsset[];
  onPress: (video: MediaAsset) => void;
  onMyListToggle: (videoId: string) => void;
}
```

Wraps `NetflixSectionRow` with title "My List". Each card is a `NetflixVideoCard` variant with an additional bookmark icon button (top-right corner of the thumbnail).

---

### New: `InfoModal`

```tsx
interface InfoModalProps {
  video: MediaAsset | null;
  onClose: () => void;
}
```

Renders a bottom-sheet-style `Modal` (`animationType="slide"`) with a semi-transparent dark background. Displays: title, description (if present), category (if present), channelName (if present), duration (if present). Fields absent from the `MediaAsset` are omitted entirely — no placeholder text.

---

### New: `Toast`

Lightweight ephemeral notification. Rendered as an `Animated.View` that fades in over 150 ms and fades out after `displayDuration` ms (default 2000 ms). Positioned at the bottom of the screen above the safe area.

---

## State Management

All new state lives in `MediaScreen`. No external state library is introduced.

```tsx
// Persistence state
const [myList, setMyList] = useState<string[]>([]);
const [watchProgress, setWatchProgress] = useState<Record<string, WatchProgressRecord>>({});

// UI state
const [infoModalVideo, setInfoModalVideo] = useState<MediaAsset | null>(null);
const [toastMessage, setToastMessage] = useState<string | null>(null);
```

### New derived values (useMemo)

```tsx
// Videos eligible for Continue Watching (partially watched, not complete)
const continueWatchingVideos = useMemo<MediaAsset[]>(() => {
  return mediaList
    .filter((v) => {
      const p = watchProgress[v.id];
      if (!p) return false;
      const ratio = p.positionSeconds / p.durationSeconds;
      return ratio > 0 && ratio < 0.95;
    })
    .sort((a, b) => {
      const tA = new Date(watchProgress[a.id].lastWatchedAt).getTime();
      const tB = new Date(watchProgress[b.id].lastWatchedAt).getTime();
      return tB - tA;
    })
    .slice(0, 10);
}, [mediaList, watchProgress]);

// Videos in My List (preserving list order)
const myListVideos = useMemo<MediaAsset[]>(() => {
  return myList
    .map((id) => mediaList.find((v) => v.id === id))
    .filter((v): v is MediaAsset => Boolean(v));
}, [mediaList, myList]);

// Hero height constant
const HERO_HEIGHT = useMemo(() => {
  const { height } = Dimensions.get('window');
  return Math.max(height * 0.48, height * 0.48); // always >= 48%
}, []);
```

---

## Data Models

### AsyncStorage keys

| Key | Value type | Description |
|---|---|---|
| `@rh:watch_progress` | `JSON string` of `Record<string, WatchProgressRecord>` | Map from videoId → progress record |
| `@rh:my_list` | `JSON string` of `string[]` | Ordered list of videoIds |

### WatchProgressRecord

```ts
interface WatchProgressRecord {
  videoId: string;           // matches MediaAsset.id
  positionSeconds: number;   // non-negative integer, last known playback position
  durationSeconds: number;   // positive integer, total video duration
  lastWatchedAt: string;     // ISO 8601 UTC, e.g. "2024-03-15T10:32:00.000Z"
}
```

### Persistence helpers (co-located in MediaScreen or a sibling `mediaStorage.ts`)

```ts
async function loadWatchProgress(): Promise<Record<string, WatchProgressRecord>> {
  try {
    const raw = await AsyncStorage.getItem('@rh:watch_progress');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveWatchProgress(
  existing: Record<string, WatchProgressRecord>,
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<Record<string, WatchProgressRecord>> {
  const updated = {
    ...existing,
    [videoId]: {
      videoId,
      positionSeconds: Math.max(0, Math.round(positionSeconds)),
      durationSeconds: Math.max(1, Math.round(durationSeconds)),
      lastWatchedAt: new Date().toISOString(),
    },
  };
  await AsyncStorage.setItem('@rh:watch_progress', JSON.stringify(updated));
  return updated;
}

async function loadMyList(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem('@rh:my_list');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveMyList(list: string[]): Promise<void> {
  await AsyncStorage.setItem('@rh:my_list', JSON.stringify(list));
}
```

### My List toggle (pure function — testable)

```ts
function toggleMyList(currentList: string[], videoId: string): string[] {
  return currentList.includes(videoId)
    ? currentList.filter((id) => id !== videoId)
    : [...currentList, videoId];
}
```

### Watch progress percentage (pure function — testable)

```ts
function watchProgressPercent(positionSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100));
}

function isVideoCompleted(positionSeconds: number, durationSeconds: number): boolean {
  if (durationSeconds <= 0) return false;
  return positionSeconds / durationSeconds >= 0.95;
}
```

### "New" badge helper (pure function — testable)

```ts
function isNewVideo(createdAt: string | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return false;
  const diffMs = now.getTime() - created.getTime();
  return diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
}
```

---

## Layout Structure

### Hero Banner as a full-screen-height container

The current layout puts `Category_Tab_Bar` inside the `headerBar` View (above the scroll view). The redesign moves the hero into a single container that owns both the image and the overlaid controls:

```tsx
const HERO_HEIGHT = Math.max(Dimensions.get('window').height * 0.48, 340);

// Inside the ScrollView, replacing the old heroContainer:
<View style={{ width: '100%', height: HERO_HEIGHT, position: 'relative' }}>
  {/* 1. Full-bleed thumbnail */}
  <Image ... style={StyleSheet.absoluteFill} contentFit="cover" />

  {/* 2. Gradient overlay */}
  <LinearGradient
    colors={['transparent', 'rgba(11,11,16,0.5)', '#0B0B10']}
    locations={[0, 0.55, 1]}
    style={StyleSheet.absoluteFill}
  />

  {/* 3. Category Tab Bar — floats over hero at the bottom */}
  <View style={{
    position: 'absolute',
    bottom: HERO_ACTION_ROW_HEIGHT + HERO_CONTENT_PADDING + 56, // above action row
    left: 0, right: 0,
    zIndex: 20,
  }}>
    <CategoryTabBar ... />
  </View>

  {/* 4. Hero content (title + meta + action row) — pinned to bottom */}
  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
    <HeroContent ... />
  </View>
</View>
```

### Top_App_Bar stacking

`Top_App_Bar` is absolutely positioned over the `ScrollView` at `top: safeAreaInsets.top`, `zIndex: 30`. It uses a semi-transparent background (`rgba(11,11,16,0.6)`) so the hero image bleeds through when the scroll position is near zero.

```tsx
// Wraps the SafeAreaView children:
<View style={{ flex: 1, position: 'relative' }}>
  {/* Absolutely positioned top bar — always visible */}
  <View style={{
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 30,
    paddingTop: insets.top,
  }}>
    <TopAppBar ... />
  </View>

  {/* Scrollable content starts at 0 — hero fills top */}
  <ScrollView style={{ flex: 1 }}>
    <HeroBannerContainer ... />
    ...rows...
  </ScrollView>
</View>
```

The `ScrollView` content has `paddingTop: 0`; the hero image naturally starts at the top edge and bleeds behind the transparent `Top_App_Bar`.

---

## Watch Progress Tracking

The `VideoPlayerInner` component receives `onProgressUpdate` and `initialPosition` props.

### Interval-based saving (every 5 s)

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    const pos = Math.floor(player.currentTime ?? 0);
    const dur = Math.floor(player.duration ?? 0);
    if (dur > 0) {
      onProgressUpdate(video.id, pos, dur);
    }
  }, 5000);

  return () => clearInterval(interval);
}, [player, video.id, onProgressUpdate]);
```

### Save on close

```tsx
// Inside VideoPlayerInner, additional cleanup in onClose wrapper:
const handleClose = useCallback(() => {
  const pos = Math.floor(player.currentTime ?? 0);
  const dur = Math.floor(player.duration ?? 0);
  if (dur > 0) {
    onProgressUpdate(video.id, pos, dur);
  }
  onClose();
}, [player, video.id, onProgressUpdate, onClose]);
```

### Resume from stored position

```tsx
const player = useVideoPlayer(video.url, (p) => {
  p.loop = false;
  if (initialPosition && initialPosition > 0) {
    // expo-video v2: use seekBy from 0 or set currentTime
    p.currentTime = initialPosition;
  }
  p.play();
});
```

### MediaScreen handler

```tsx
const handleProgressUpdate = useCallback(async (
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
) => {
  try {
    const updated = await saveWatchProgress(watchProgress, videoId, positionSeconds, durationSeconds);
    setWatchProgress(updated);
  } catch (err) {
    console.warn('[MediaScreen] watchProgress save failed:', err);
    // playback is NOT interrupted
  }
}, [watchProgress]);
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `AsyncStorage.getItem` fails on mount | Silently defaults to empty `{}` / `[]`; screen renders normally |
| `AsyncStorage.setItem` fails on My List toggle | Log warning, show Toast with error text, revert `myList` state to pre-toggle value |
| `AsyncStorage.setItem` fails on progress save | Log warning, do NOT show UI error, do NOT interrupt playback |
| `player.currentTime` unavailable (player not ready) | Guard: `if (dur > 0)` prevents writing a zero/NaN record |
| Hero thumbnail URL fails to load | `expo-image` falls back to `defaultSource` prop pointing to local asset |
| API fetch fails on refresh | Dismiss `RefreshControl`, show Toast with error message, retain existing `mediaList` |
| Info modal opened for video with sparse metadata | Render only fields that are truthy; omit empty fields entirely |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Watch progress percentage is bounded and monotone-safe

*For any* non-negative `positionSeconds` and any positive `durationSeconds`, `watchProgressPercent(positionSeconds, durationSeconds)` shall return a value in the closed interval `[0, 100]`. Specifically, when `positionSeconds >= durationSeconds`, the result shall be exactly `100`; when `positionSeconds === 0`, the result shall be `0`.

**Validates: Requirements 4.3, 5.4**

---

### Property 2: isVideoCompleted threshold at 95%

*For any* positive `durationSeconds`, `isVideoCompleted` shall return `true` if and only if `positionSeconds / durationSeconds >= 0.95`. Videos below the threshold shall never be marked complete, and videos at or above it shall always be marked complete.

**Validates: Requirements 4.2, 5.4**

---

### Property 3: My List toggle is an involution (double-toggle idempotency)

*For any* list of video IDs `myList` and any `videoId`, applying `toggleMyList` twice in succession shall produce a list equal to the original: `toggleMyList(toggleMyList(myList, videoId), videoId)` deep-equals `myList`. The list length shall return to its original value after two toggles.

**Validates: Requirements 2.4, 6.2**

---

### Property 4: My List toggle correctness — membership after single toggle

*For any* `myList` and `videoId`, after a single call to `toggleMyList(myList, videoId)`:
- If `videoId` was NOT in `myList`, it SHALL be present in the result and the result length SHALL be `myList.length + 1`.
- If `videoId` WAS in `myList`, it SHALL be absent from the result and the result length SHALL be `myList.length - 1`.
- All other IDs in `myList` SHALL remain in the result unchanged.

**Validates: Requirements 2.4, 6.2**

*(Note: Properties 3 and 4 are complementary — Property 3 tests round-trip identity; Property 4 tests single-direction correctness. Together they fully specify the toggle contract.)*

---

### Property 5: Category filter correctness

*For any* non-empty `selectedCategory` (other than `"All"`) and any `mediaList`, every video in `filteredVideos` shall satisfy `video.category.toLowerCase().includes(selectedCategory.toLowerCase())`, and no video whose category does not match shall appear in the result. When `selectedCategory === "All"`, all videos that pass the search query shall appear in `filteredVideos`.

**Validates: Requirements 3.7, 9.5**

---

### Property 6: Search filter correctness

*For any* non-empty search query `q` and any `mediaList`, every video in `filteredVideos` shall satisfy at least one of:
- `video.title.toLowerCase().includes(q.toLowerCase())`
- `(video.category ?? '').toLowerCase().includes(q.toLowerCase())`
- `(video.channelName ?? '').toLowerCase().includes(q.toLowerCase())`

No video that fails all three conditions shall appear in `filteredVideos`.

**Validates: Requirements 9.5**

---

### Property 7: Continue Watching list is correctly filtered and sorted

*For any* `watchProgress` record map and `mediaList`, the derived `continueWatchingList` shall satisfy all three invariants simultaneously:
1. Every entry has `positionSeconds > 0` (has been partially watched).
2. Every entry has `positionSeconds / durationSeconds < 0.95` (not complete).
3. The entries are sorted in descending order by `lastWatchedAt` (most recently watched first).
4. The list contains at most 10 entries.

**Validates: Requirements 4.2, 4.8**

---

### Property 8: isNewVideo is determined solely by the 7-day window

*For any* `createdAt` ISO timestamp and reference `now` date, `isNewVideo(createdAt, now)` shall return `true` if and only if `0 <= now - createdAt < 7 * 24 * 60 * 60 * 1000` ms. An undefined or unparseable `createdAt` shall always return `false`.

**Validates: Requirements 4.5**

---

## Testing Strategy

### Technology choices

- **Unit / property tests**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native PBT library)
- **Test runner**: Jest (already present in Expo projects via `jest-expo`)
- **Component tests**: React Native Testing Library

### Dual testing approach

Unit tests cover specific scenarios and error branches; property tests cover the pure functions above with ≥ 100 random inputs per run. Together they provide comprehensive coverage.

### Property-based test configuration

Each property test runs a minimum of **100 iterations** via `fc.assert(fc.property(...), { numRuns: 100 })`.

Tag format for traceability:
```
// Feature: media-screen-netflix-redesign, Property <N>: <property_text>
```

### Test file layout

```
src/screens/__tests__/
  MediaScreen.pbt.test.ts        ← all 8 property-based tests
  MediaScreen.unit.test.tsx      ← example-based + edge case unit tests
  mediaStorage.unit.test.ts      ← AsyncStorage helpers
```

### Property test sketches

```ts
// Feature: media-screen-netflix-redesign, Property 1: watch progress percent is bounded
it('watchProgressPercent is always in [0, 100]', () => {
  fc.assert(fc.property(
    fc.nat(),            // positionSeconds ≥ 0
    fc.integer({ min: 1, max: 100_000 }), // durationSeconds > 0
    (pos, dur) => {
      const result = watchProgressPercent(pos, dur);
      return result >= 0 && result <= 100;
    }
  ), { numRuns: 100 });
});

// Feature: media-screen-netflix-redesign, Property 3: toggleMyList double-toggle is identity
it('toggleMyList applied twice returns original list', () => {
  fc.assert(fc.property(
    fc.array(fc.string()),  // any myList
    fc.string(),            // any videoId
    (list, id) => {
      const toggled = toggleMyList(toggleMyList(list, id), id);
      return JSON.stringify(toggled) === JSON.stringify(list);
    }
  ), { numRuns: 100 });
});

// Feature: media-screen-netflix-redesign, Property 5: category filter correctness
it('filteredVideos always matches selected category', () => {
  fc.assert(fc.property(
    fc.array(fc.record({
      id: fc.string(),
      title: fc.string(),
      category: fc.option(fc.string(), { nil: undefined }),
      channelName: fc.option(fc.string(), { nil: undefined }),
      url: fc.string(),
      type: fc.constant('video' as const),
    })),
    fc.string({ minLength: 1 }),  // non-empty, non-"All" category
    (list, category) => {
      const filtered = list.filter((v) =>
        v.category?.toLowerCase().includes(category.toLowerCase())
      );
      return filtered.every((v) =>
        v.category?.toLowerCase().includes(category.toLowerCase())
      );
    }
  ), { numRuns: 100 });
});
```

### Unit test coverage targets

| Concern | Tests |
|---|---|
| `HeroBannerContainer` renders without hero when `heroVideo` is null | Example |
| `HeroActionRow` shows correct icon for My List state | Example (in list) + Example (not in list) |
| `InfoModal` omits fields absent from `MediaAsset` | Example |
| `ContinueWatchingRow` hidden when no eligible videos | Example |
| Storage read failure defaults to empty state | Example with mocked `AsyncStorage.getItem` |
| Storage write failure on My List toggle reverts state | Example with mocked `AsyncStorage.setItem` |
| Progress bar fill width equals `(pos/dur)*100%` for known values | Example |
| Search results grid appears in search mode | Example |
| Pull-to-refresh triggers `fetchMediaData` | Example |
| "Latest Videos" row shown when all category rows are empty | Example |

### Integration tests (not PBT)

| Concern | Approach |
|---|---|
| Watch progress survives app restart | 1-2 examples with real `AsyncStorage` (or `@react-native-async-storage/async-storage/jest/async-storage-mock`) |
| My List survives app restart | Same |
| `VideoPlayerInner` calls `onProgressUpdate` after 5 s interval | Fake timers with `jest.useFakeTimers()` |
| `VideoPlayerInner` calls `onProgressUpdate` on close | Unit test with `onClose` spy |
