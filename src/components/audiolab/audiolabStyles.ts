import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const getStyles = (theme: any) => {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  headerButton: {
    padding: 4
  },
  headerIconBtn: {
    padding: 6
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3
  },

  transportTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  timecodeBlock: {
    minWidth: 90
  },
  timecodeText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1
  },
  tempoText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginTop: 2
  },
  transportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20
  },
  transportPlayBtn: {
    padding: 6
  },
  transportSmallBtn: {
    padding: 6
  },
  transportRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    justifyContent: 'flex-end'
  },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  mainContent: {
    flex: 1
  },
  tabContainer: {
    flex: 1
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100
  },
  toastBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    overflow: 'hidden'
  },
  toastText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },

  timelineWrapper: {
    flex: 1,
    flexDirection: 'row'
  },
  trackHeadersColumn: {
    width: 148,
    borderRightWidth: 1,
    borderRightColor: theme.colors.bottomTabBorder,
    backgroundColor: T.backgroundDark
  },
  trackHeaderRulerSpacer: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)'
  },
  trackHeaderCard: {
    height: 84,
    flexDirection: 'row',
    backgroundColor: theme.colors.bottomSheetBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  trackAccentStripe: {
    width: 4,
    backgroundColor: theme.colors.accent
  },
  trackHeaderInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between'
  },
  trackHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  trackIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  trackHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  trackHeaderControlBtn: {
    backgroundColor: theme.colors.cardBackgroundLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackHeaderControlBtnActive: {
    backgroundColor: '#ef4444'
  },
  trackHeaderControlBtnActiveSolo: {
    backgroundColor: '#eab308'
  },
  trackHeaderControlBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800'
  },
  addTrackHeaderCard: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  addTrackText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600'
  },
  timelineGridScroll: {
    flex: 1
  },
  timelineGridInner: {
    width: SCREEN_WIDTH * 2,
    height: '100%',
    position: 'relative',
    backgroundColor: theme.colors.backgroundDark
  },
  beatNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    paddingLeft: 16,
    gap: 118
  },
  beatNumber: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  waveformTrackRow: {
    height: 84,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  waveformBlock: {
    flex: 1,
    height: 60,
    borderRadius: 6,
    backgroundColor: theme.colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  waveVisualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 6
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 0.7
  },
  emptyTrackText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    paddingLeft: 12
  },
  scrubberLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.textPrimary,
    zIndex: 10
  },
  scrubberHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textPrimary,
    position: 'absolute',
    top: 24,
    left: -4
  },

  studioToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: 14,
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  studioToolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1
  },
  studioToolLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center'
  },
  bigRecordBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.colors.bottomTabBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12
  },
  bigRecordInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ef4444'
  },
  bigRecordInnerActive: {
    borderRadius: 8,
    width: 30,
    height: 30
  },

  tunerMeterPointer: {
    width: 4,
    height: 28,
    backgroundColor: '#ff3b30',
    position: 'absolute',
    zIndex: 10,
    borderRadius: 2
  },

  notepadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  notepadTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  clearText: {
    color: '#3b8(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '600'
  },
  notepadInput: {
    flex: 1,
    padding: 20,
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500'
  },

  settingsCard: {
    backgroundColor: theme.colors.bottomSheetBackground,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 16,
    overflow: 'hidden'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  settingsRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  settingsLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  settingsValueText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '500'
  },
  settingsTextCol: {
    flex: 1,
    marginRight: 16
  },
  settingsSubDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4
  },
  settingsSliderRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sliderTrack: {
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center'
  },
  sliderFill: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2
  },
  sliderThumb: {
    position: 'absolute',
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.textPrimary
  },
  sectionHeadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginHorizontal: 20,
    marginTop: 28
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
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  modalTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  closeModalBtn: {
    padding: 4
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingTop: 20
  },
  modalSection: {
    paddingBottom: 24
  },
  modalSubHeader: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16
  },
  modalCard: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24
  },
  modalRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  modalLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  pillSelection: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight
  },
  pillSelectionActive: {
    backgroundColor: theme.colors.accent
  },
  pillSelectionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  pillSelectionTextActive: {
    color: theme.colors.textPrimary
  },
  modalActionBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12
  },
  modalActionBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  gridCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    backgroundColor: theme.colors.cardBackgroundLight,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder
  },
  gridIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  gridCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },

  mixerTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder
  },
  mixerTrackRowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  mixerTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  mixerTrackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600'
  },
  mixerTrackControls: {
    flexDirection: 'row',
    gap: 12
  },
  mixerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mixerBtnMute: {
    backgroundColor: '#ef4444'
  },
  mixerBtnSolo: {
    backgroundColor: '#eab308'
  },
  mixerBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700'
  },
  mixerBtnTextActive: {
    color: theme.colors.textPrimary
  },

  bpmText: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  tapTempoBtn: {
    backgroundColor: theme.colors.cardBackgroundLight,
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  tapTempoText: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2
  },

  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18
  },
  exportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  exportTextCol: {
    flex: 1,
    marginRight: 16
  },
  exportTitleText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  exportDescText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  },

  tunerCard: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24
  },
  tunerNoteText: {
    color: '#10b981',
    fontSize: 72,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  tunerSubText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 24
  },
  tunerMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 40
  },
  tunerMeterLineLeft: {
    width: 80,
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2
  },
  tunerMeterCenter: {
    width: 12,
    height: 24,
    backgroundColor: '#10b981',
    borderRadius: 6,
    marginHorizontal: 12
  },
  tunerMeterLineRight: {
    width: 80,
    height: 4,
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 2
  },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.bottomTabBackground,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bottomTabBorder
  },
  bottomNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  bottomNavItemActive: {
    backgroundColor: 'rgba(124,58,237,0.3)'
  },
  bottomNavIconWrap: {},
  bottomNavIconActive: {},
  bottomNavLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: theme.colors.textPrimary
  }
});
};
