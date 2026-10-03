# Requirements Document

## Introduction

This feature redesigns the existing `MediaScreen` in the RehearsalHub v2 mobile app (React Native / Expo / TypeScript) to match a Netflix-style home screen layout. The redesign elevates the visual hierarchy with a taller full-bleed hero banner, overlaid floating category navigation tabs, a "Continue Watching" row with per-video watch-progress persistence, a "My List" bookmarking feature, and polished 16:9 horizontal content rows — all on the existing dark `#0B0B10` background. The existing in-app video player modal, search flow, and API data layer are preserved; this spec focuses exclusively on UI/UX layout, interaction, and the two new data concerns: watch progress and the user's personal list.

## Glossary

- **MediaScreen**: The top-level React Native screen component (`src/screens/MediaScreen.tsx`) that renders the video browsing experience.
- **Hero_Banner**: The large full-bleed image panel at the top of the home layout that showcases the featured video.
- **Category_Tab_Bar**: The horizontal row of pill-shaped navigation tabs (e.g. "All", "Praise Night", "Rehearsals") that floats visually over the bottom edge of the Hero_Banner.
- **Continue_Watching_Row**: A horizontal scrollable section that shows recently-played videos with a circular play overlay, a watch-progress bar, and optional status badges.
- **Content_Row**: A labelled horizontal scrollable list of 16:9 video cards (e.g. "Praise Night Highlights", "Choir Rehearsals").
- **Video_Card**: A 16:9 thumbnail tile with title text, a play-circle overlay, and optional badges, used inside a Content_Row.
- **My_List**: A user-specific collection of bookmarked videos, persisted locally on-device.
- **Watch_Progress**: A per-video record of the playback position (in seconds) and total duration, used to render the progress bar on Continue_Watching cards and to resume playback.
- **Hero_Action_Row**: The three-button row inside the Hero_Banner containing "My List", "Play", and "Info" buttons.
- **Top_App_Bar**: The fixed, semi-transparent bar at the very top of the screen that holds the app logo and the search/profile icon buttons. It does NOT contain the Category_Tab_Bar.
- **Video_Player_Modal**: The existing fullscreen in-app video player that opens when a video is played.
- **MediaAsset**: The TypeScript interface representing a single video item fetched from the API.

---

## Requirements

### Requirement 1: Taller Full-Bleed Hero Banner

**User Story:** As a choir member browsing the media library, I want to see a large, immersive hero banner when I open the screen, so that the featured video is immediately visually prominent and inviting.

#### Acceptance Criteria

1. THE Hero_Banner SHALL occupy at least 48% of the device screen height (i.e. `height >= SCREEN_HEIGHT * 0.48`).
2. THE Hero_Banner SHALL render the featured video's thumbnail image as a full-bleed background using `contentFit="cover"`, with no visible letterboxing or padding on any side.
3. THE Hero_Banner SHALL apply a vertical `LinearGradient` overlay that begins as fully transparent at the top of the banner (location 0.0), transitions to 50% opacity at the midpoint (location 0.55), and reaches fully opaque `#0B0B10` at the bottom (location 1.0), so text overlaid near the bottom remains readable.
4. WHEN no thumbnail URL is available for the featured video, THE Hero_Banner SHALL render the local fallback asset `../../assets/image/home4.png` as the full-bleed background.
5. THE Hero_Banner SHALL display the featured video's title as white bold text at a font size of at least 22pt, overlaid on the gradient near the bottom of the banner, capped to a maximum of 2 lines with ellipsis overflow.
6. THE Hero_Banner SHALL display a single line of metadata text below the title showing at minimum the video's category and channel name, rendered in white at an opacity of at least 0.65, capped to 1 line with ellipsis overflow.
7. THE Hero_Banner SHALL render the Hero_Action_Row below the metadata text, ensuring the Hero_Action_Row is fully visible and not clipped at the bottom edge of the banner.
8. WHEN no featured video is available (e.g. the media list is empty), THE Hero_Banner SHALL NOT be rendered; the screen SHALL proceed directly to the Content_Rows or empty-state view.

---

### Requirement 2: Hero Action Row with My List, Play, and Info

**User Story:** As a choir member viewing the hero banner, I want three clear action buttons — My List, Play, and Info — so that I can bookmark, play, or get more details about the featured video without leaving the home layout.

#### Acceptance Criteria

1. THE Hero_Action_Row SHALL contain exactly three buttons rendered in the horizontal order: "My List" (left), "Play" (centre), "Info" (right).
2. THE Hero_Action_Row "Play" button SHALL be styled as a solid white pill/rectangle button with dark text and a filled play icon, and its width SHALL be at least 120% of the width of each secondary button ("My List" and "Info"), making it visually dominant.
3. THE Hero_Action_Row "My List" button SHALL reflect the current My_List membership on every render: it SHALL display a `+` icon when the featured video is NOT in My_List, and a `✓` icon when it IS in My_List.
4. WHEN the "My List" button is pressed, THE MediaScreen SHALL toggle the featured video's presence in My_List and update the displayed icon within 300 ms without a full screen reload.
5. WHEN the "Play" button is pressed, THE MediaScreen SHALL open the Video_Player_Modal for the featured video.
6. WHEN the "Info" button is pressed, THE MediaScreen SHALL open an in-screen modal overlay displaying the featured video's title, description, category, channel name, and duration; fields not present on the MediaAsset SHALL be omitted rather than shown as empty or placeholder text.
7. WHEN a My_List toggle operation fails (e.g. storage write error), THE MediaScreen SHALL display a brief error message and revert the button icon to its pre-press state within 300 ms.
8. THE Hero_Action_Row "My List" and "Info" buttons SHALL use a background with an opacity of at least 0.6 over the hero thumbnail so they remain visually distinct against any background image.

---

### Requirement 3: Category Tabs Floating Over the Hero Banner

**User Story:** As a choir member browsing categories, I want the category navigation tabs to visually float over the hero image (not sit in a separate header bar below the logo), so the layout matches a modern streaming-app feel.

#### Acceptance Criteria

1. THE Category_Tab_Bar SHALL be rendered visually inside the Hero_Banner area, overlaid on the thumbnail image, so that the tabs appear on top of the hero content rather than below it.
2. THE Category_Tab_Bar SHALL be positioned so that its top edge respects the device safe-area inset, ensuring tabs are not obscured by the status bar or notch on any supported device.
3. THE Category_Tab_Bar SHALL NOT be a child of, or rendered inside, the Top_App_Bar component.
4. THE Top_App_Bar (app logo + search/profile icons) SHALL share the same top-of-screen origin as the Category_Tab_Bar but SHALL have a higher visual stacking order (rendered in front of the Category_Tab_Bar).
5. WHEN a category tab is selected, THE Category_Tab_Bar SHALL visually highlight the active tab with a solid filled background and dark-coloured label text; inactive tabs SHALL have no filled background and SHALL display light-coloured label text.
6. WHEN the "All" tab is active, THE MediaScreen SHALL display the Hero_Banner, the Continue_Watching_Row (if applicable), and all labelled Content_Rows in the home layout.
7. WHEN a non-"All" tab is active, THE MediaScreen SHALL display only the Content_Row(s) whose category matches the selected tab; the Hero_Banner and Continue_Watching_Row SHALL be hidden.

---

### Requirement 4: Continue Watching Row

**User Story:** As a choir member who has started watching videos, I want to see a "Continue Watching" section at the top of the home layout, so that I can easily resume videos I haven't finished.

#### Acceptance Criteria

1. THE Continue_Watching_Row SHALL appear directly below the Hero_Banner in the home layout when at least one video has Watch_Progress recorded.
2. THE Continue_Watching_Row SHALL only display videos that have been partially watched (Watch_Progress > 0 seconds) and are not fully completed (Watch_Progress < 95% of total duration), sorted by `lastWatchedAt` descending so the most recently watched video appears first.
3. EACH card in the Continue_Watching_Row SHALL display: the video thumbnail, the video title (capped to 2 lines), a circular play-overlay icon centred on the card, and a thin horizontal progress bar at the bottom of the card image whose filled width equals `(positionSeconds / durationSeconds) * 100%`.
4. WHEN a card in the Continue_Watching_Row is pressed, THE Video_Player_Modal SHALL open and begin playback within ±2 seconds of the stored `positionSeconds` value.
5. THE Continue_Watching_Row SHALL display a "NEW" badge on cards where the video's `createdAt` timestamp is within 7 days of the current device date; cards older than 7 days SHALL NOT show the badge.
6. WHEN no videos have Watch_Progress recorded, THE Continue_Watching_Row SHALL NOT be rendered and no empty placeholder section SHALL be shown in its place.
7. THE Watch_Progress data SHALL be persisted to on-device storage and SHALL be readable after the app is terminated and cold-restarted.
8. THE Continue_Watching_Row SHALL display a maximum of 10 cards; if more than 10 eligible videos exist, only the 10 most recently watched SHALL be shown.

---

### Requirement 5: Watch Progress Tracking

**User Story:** As a choir member, I want my watch progress to be automatically saved when I watch a video, so that the Continue Watching row stays accurate without any manual action on my part.

#### Acceptance Criteria

1. WHILE a video is playing in the Video_Player_Modal, THE MediaScreen SHALL write the current playback position to Watch_Progress storage at an interval of no greater than 5 seconds.
2. WHEN the Video_Player_Modal is dismissed (closed by the user or navigated away from), THE MediaScreen SHALL write the final playback position to Watch_Progress storage before the modal unmounts.
3. THE Watch_Progress record for a video SHALL contain at minimum: `videoId` (string), `positionSeconds` (non-negative integer), `durationSeconds` (positive integer), and `lastWatchedAt` (ISO 8601 UTC timestamp).
4. WHEN a video's playback position reaches ≥ 95% of its `durationSeconds`, THE MediaScreen SHALL mark that video as fully watched; on the next render the video SHALL be absent from the Continue_Watching_Row.
5. IF a Watch_Progress storage write fails, THEN THE MediaScreen SHALL log the error to the console and SHALL continue video playback without interruption or visible error to the user.

---

### Requirement 6: My List Bookmarking

**User Story:** As a choir member, I want to save videos to My List so that I can find them quickly without searching through all the rows.

#### Acceptance Criteria

1. THE MediaScreen SHALL display a "My List" horizontal Content_Row when My_List contains at least one video; it SHALL NOT render the row when My_List is empty.
2. WHEN the "My List" button on any Video_Card is pressed, THE MediaScreen SHALL toggle the video's presence in My_List and update the button icon to its new state within 300 ms.
3. THE My_List data SHALL be persisted to on-device storage and SHALL be readable after app termination and cold restart.
4. WHEN a video is added to My_List, THE MediaScreen SHALL display a toast notification for between 1500 ms and 3000 ms; IF the device supports haptic feedback, THE MediaScreen SHALL also trigger a light haptic pulse.
5. IF My_List storage is unavailable or a write fails, THEN THE MediaScreen SHALL log the error, display a brief error message to the user, and remain fully navigable without crashing.
6. IF the Continue_Watching_Row is currently rendered, THEN THE "My List" Content_Row SHALL appear directly below it and above all other categorised Content_Rows.
7. IF the Continue_Watching_Row is NOT rendered, THEN THE "My List" Content_Row SHALL appear as the first Content_Row in the home layout, above all categorised rows.

---

### Requirement 7: 16:9 Content Rows with Play Overlay

**User Story:** As a choir member browsing the home screen, I want to see labelled horizontal rows of video cards with 16:9 thumbnails and a visible play-circle overlay, so that each card clearly communicates it is a playable video.

#### Acceptance Criteria

1. THE MediaScreen SHALL render the following labelled Content_Rows on the home layout when their respective data sets are non-empty: "Continue Watching" (conditional), "My List" (conditional), "Praise Night Highlights", "Choir Rehearsals & Training", and "Specials & Deep Worship".
2. EACH Video_Card SHALL render a thumbnail image at a 16:9 aspect ratio using `expo-image` with `contentFit="cover"`, with no visible letterboxing or padding.
3. EACH Video_Card SHALL display a semi-transparent circular icon centred over the thumbnail that contains a filled play arrow, so the card is recognisable as a playable item without reading the title.
4. EACH Video_Card SHALL display the video title below the thumbnail image, capped to a maximum of 2 lines with ellipsis overflow.
5. WHEN a Video_Card is pressed, THE MediaScreen SHALL open the Video_Player_Modal for the corresponding video.
6. WHEN a Video_Card's thumbnail URL is unavailable or fails to load, THE Video_Card SHALL render the local fallback image instead of a blank or broken image.
7. WHERE a video has a known duration or quality label, EACH Video_Card MAY display that value as a small badge in the bottom-right corner of the thumbnail image.

---

### Requirement 8: Dark Background and Visual Theme Consistency

**User Story:** As a choir member, I want the redesigned screen to maintain the existing dark theme with the `#0B0B10` background colour, so that the app feels cohesive and is comfortable to use in low-light environments.

#### Acceptance Criteria

1. THE MediaScreen SHALL use `#0B0B10` (or a value within 5% relative luminance of it) as the root background colour for all areas not covered by the Hero_Banner image.
2. THE MediaScreen SHALL NOT introduce any white or light-coloured full-width background panels in the scrollable content area below the Hero_Banner.
3. THE MediaScreen SHALL use the existing `useTheme()` hook to source accent colours so the screen adapts to app theme changes without hardcoding non-background colour values.
4. WHILE the device is in dark mode, THE MediaScreen SHALL maintain its `#0B0B10` background regardless of the system colour scheme setting.

---

### Requirement 9: Search Flow Preservation

**User Story:** As a choir member, I want the existing search functionality to continue working in the redesigned screen, so that I can still quickly find specific videos by name or category.

#### Acceptance Criteria

1. WHEN the search icon in the Top_App_Bar is pressed, THE Top_App_Bar SHALL replace its logo and icon buttons with a back-arrow button and an auto-focused text input field.
2. WHILE search mode is active, THE MediaScreen SHALL hide the Hero_Banner and all horizontal section rows and SHALL display a results grid below the Top_App_Bar showing only videos that match the current query.
3. WHEN the back-arrow button in search mode is pressed, THE MediaScreen SHALL exit search mode, clear the search query, and restore the full home layout including the Hero_Banner.
4. WHEN the search input is cleared (all characters deleted), THE MediaScreen SHALL exit search mode and restore the full home layout including the Hero_Banner.
5. THE search filter SHALL match videos case-insensitively by substring against the video title, category, and channel name fields; a video is included in results if any of these three fields contains the query string.

---

### Requirement 10: Performance and Loading States

**User Story:** As a choir member, I want the screen to load smoothly and show clear feedback while content is fetching, so that I never see a broken or blank layout.

#### Acceptance Criteria

1. WHILE media data is loading on initial mount, THE MediaScreen SHALL display a centred `ActivityIndicator` spinner and the label "Loading curated videos…" in place of the home layout.
2. WHEN the user performs a pull-to-refresh gesture on the main `ScrollView`, THE MediaScreen SHALL trigger a data refetch and SHALL display the `RefreshControl` progress indicator for the duration of the fetch.
3. WHEN all categorised Content_Rows (Praise Night, Rehearsals, Specials) have zero videos after a successful fetch, THE MediaScreen SHALL render a "Latest Videos" Content_Row containing all fetched videos as a fallback.
4. WHEN the media fetch returns zero results, THE MediaScreen SHALL display an empty-state view containing an icon, a heading of "No videos available", and a sub-message instructing the user to check their connection or pull to refresh; no blank screen SHALL be shown.
5. WHEN the Hero_Banner thumbnail image loads, THE Hero_Banner image SHALL use a fade-in transition of no more than 300 ms to avoid jarring layout shifts.
6. WHEN a pull-to-refresh fetch fails (network error or API error), THE MediaScreen SHALL dismiss the `RefreshControl` indicator and display a brief error message to the user without crashing or leaving the screen in an indeterminate loading state.
