import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const getStyles = (theme: any, insets: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  safeArea: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center'
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center'
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackgroundLight,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500'
  },
  sortButton: {
    backgroundColor: theme.colors.cardBackgroundLight,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sortText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_WIDTH * 0.52,
    borderRadius: 12
  },
  countdownBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    gap: 6
  },
  countdownText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  detailsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  authorLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: theme.colors.background
  },
  authorText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  aboutText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 6,
    lineHeight: 18
  },
  durationText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  downloadIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  downloadIcon: {
    width: '100%',
    height: '100%'
  },
  iconButton: {
    marginRight: 20
  },
  tabIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20
  },
  tabIconText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginLeft: 20,
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 12
  },
  trackList: {
    paddingHorizontal: 16
  },
  categoriesListContainer: {
    paddingHorizontal: 16
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    marginBottom: 12
  },
  categoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16
  },
  categoryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  categoryTextInfo: {
    justifyContent: 'center',
    flex: 1
  },
  categoryListTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  categoryListSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 16
  },
  backToCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20
  },
  backToCategoriesText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4
  },
  currentCategoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 8
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  trackImage: {
    width: 44,
    height: 44,
    borderRadius: 8
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  trackSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400'
  },
  trackMoreButton: {
    padding: 8
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 20
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center'
  },
  activeTabButton: {
    backgroundColor: 'rgba(255,255,255,0.0)', // Transparent so we rely on text color
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  activeTabText: {
    color: theme.colors.accent,
    fontWeight: '700'
  },
  tabContentContainer: {
    flex: 1
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between'
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: 110,
    justifyContent: 'flex-end',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  categoryIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
    opacity: 0.3
  },
  categoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  categorySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500'
  },
  nowPlayingBar: {
    position: 'absolute',
    bottom: 66,
    left: 12,
    right: 12,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nowPlayingImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 12
  },
  nowPlayingInfo: {
    flex: 1
  },
  nowPlayingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  nowPlayingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  nowPlayingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  nowPlayingBtn: {
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: theme.colors.bottomTabBackground,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  activeBottomTabButton: {
    opacity: 1
  },
  bottomTabText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4
  },
  activeBottomTabText: {
    color: theme.colors.accent,
    fontWeight: '700'
  },
  dropdownMenuContainer: {
    backgroundColor: theme.colors.background,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 8,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    marginBottom: 4
  },
  dropdownTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold'
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  activeDropdownItem: {
    backgroundColor: theme.colors.cardBackgroundLight
  },
  dropdownItemText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500'
  },
  activeDropdownItemText: {
    color: theme.colors.textPrimary,
    fontWeight: '700'
  },

  playerModalContainer: {
    flex: 1
  },
  playerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  playerModalHeaderBtn: {
    padding: 4
  },
  playerModalHeaderText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  playerModalArtContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 24,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20
  },
  playerModalArt: {
    width: '100%',
    height: '100%'
  },
  playerModalLyricsSnippet: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 32
  },
  playerModalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  playerModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: -0.5
  },
  playerModalArtist: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '500'
  },
  playerModalProgressContainer: {
    marginBottom: 32
  },
  playerModalProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  playerModalProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.textPrimary,
    borderRadius: 2
  },
  playerModalProgressThumb: {
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.textPrimary,
    marginLeft: -6
  },
  playerModalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  playerModalTimeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  playerModalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 36
  },
  playerModalPlayPauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12
  },
  playerModalBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  playerModalLyricsCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  playerModalLyricsCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12
  },
  playerModalLyricsCardText: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26
  },

  heardPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  heardPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  heardPillTextActive: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800'
  },
  heardPillTextInactive: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  unheardPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    borderWidth: 1,
    borderColor: '#fb923c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  unheardPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  unheardPillTextActive: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: '800'
  },
  unheardPillTextInactive: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  statusFilterCenterText: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  floatingLiveWidget: {
    position: 'absolute',
    bottom: 136,
    right: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999
  },
  liveWidgetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  liveIndicatorRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e'
  },
  liveWidgetInfo: {
    marginRight: 10,
    maxWidth: 150
  },
  liveTextSmall: {
    color: '#22c55e',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 1
  },
  liveTextTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800'
  },
  livePulseIcon: {
    marginLeft: 'auto'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,10,20,0.85)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Math.max(24, insets.bottom + 16),
    maxHeight: '70%',
    borderTopWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.3)'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    marginBottom: 16
  },
  modalTitle: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  closeModalBtn: {
    padding: 4
  },
  modalList: {
    width: '100%'
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackgroundLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  modalItemBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  modalItemBadgeText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800'
  },
  modalItemInfo: {
    flex: 1,
    marginRight: 10
  },
  modalItemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1
  },
  modalItemSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '500'
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalDismissArea: {
    flex: 1
  },
  modalContainer: {
    backgroundColor: theme.colors.bottomSheetBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Math.max(24, insets.bottom + 16),
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  modalTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  }
});
};
