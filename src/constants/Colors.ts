

export const darkTheme = {
  colors: {
    background:           '#0b0514',   // deep midnight purple
    backgroundSecondary:  '#0a0513ff',   // secondary surface
    backgroundDark:       '#07020fff',   // deepest sunken surfaces
    bottomSheetBackground:'#1a0d2d',   // modals, bottom sheets
    bottomTabBackground:  '#130a21',
    bottomTabBorder:      'rgba(255,255,255,0.05)',
    bottomTabIconInactive:'rgba(255,255,255,0.35)',
    bottomTabIconActive:  '#a855f7',
    cardBackground:       'rgba(26,13,45,0.92)',
    cardBackgroundLight:  'rgba(255,255,255,0.08)',
    surface:              '#1a0d2d',   // raised panel bg
    surfaceBorder:        'rgba(255,255,255,0.07)',
    textPrimary:          '#ffffff',
    textSecondary:        'rgba(255,255,255,0.70)',
    textMuted:            'rgba(255, 255, 255, 0.45)',
    textDisabled:         'rgba(255,255,255,0.22)',
    textOnAccent:         '#ffffff',   // text sitting ON a colored button/badge
    iconPrimary:          '#ffffff',
    iconSecondary:        'rgba(255,255,255,0.55)',
    iconMuted:            'rgba(255,255,255,0.30)',
    buttonPrimary:        '#a855f7',   // filled CTA
    buttonPrimaryText:    '#ffffff',
    buttonSecondary:      'rgba(255,255,255,0.08)',
    buttonSecondaryText:  '#ffffff',
    buttonDestructive:    '#ef4444',
    buttonDestructiveText:'#ffffff',
    inputBackground:      'rgba(255,255,255,0.07)',
    inputBorder:          'rgba(255,255,255,0.10)',
    inputText:            '#ffffff',
    inputPlaceholder:     'rgba(255,255,255,0.35)',
    inputFocusBorder:     '#a855f7',
    divider:              'rgba(255,255,255,0.06)',
    overlay:              'rgba(0,0,0,0.72)',
    overlayLight:         'rgba(0,0,0,0.35)',
    scrim:                'rgba(0,0,0,0.60)',   // modal backdrop
    bubbleOutgoing:       '#a855f7',
    bubbleIncoming:       '#1f1038',
    bubbleOutgoingText:   '#ffffff',
    bubbleIncomingText:   '#ffffff',
    tickSent:             'rgba(255,255,255,0.45)',
    tickRead:             '#a855f7',
    chatInputBg:          'rgba(255,255,255,0.09)',
    reactionPill:         'rgba(31,16,56,0.95)',
    datePillBg:           'rgba(18,9,33,0.75)',
    accent:       '#a855f7',
    accentBright: '#c084fc',
    accentDim:    '#581c87',
    accentSubtle: 'rgba(168,85,247,0.15)',
    danger:  '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info:    '#3b82f6',
    playerBackground: '#0b0514',
    thumbTint:        '#a855f7',
    trackMin:         '#a855f7',
    trackMax:         'rgba(255,255,255,0.20)',
  },

  gradients: {
    bgBase:          ['#0b0514', '#0e061a', '#110820', '#0e061a', '#0b0514'] as const,
    bgBaseLocations: [0, 0.25, 0.5, 0.75, 1] as const,
    bgGlow:          ['transparent', 'rgba(168,85,247,0.10)', 'rgba(192,132,252,0.12)', 'rgba(168,85,247,0.10)', 'transparent'] as const,
    bgGlowLocations: [0, 0.25, 0.5, 0.75, 1] as const,
    glassPurple:     ['rgba(31,16,56,0.92)', 'rgba(21,11,40,0.97)'] as const,
    header:          ['transparent', 'transparent'] as const,
    headerLocations: [0, 1] as const,
    headerTextColor: '#ffffff',
  },

  typography: {
    htmlBase: { color: '#ffffff', fontSize: 15, fontWeight: '400' as any, lineHeight: 24, letterSpacing: -0.2 },
    bodyText: { color: '#ffffff', fontSize: 15, fontWeight: '500' as any, lineHeight: 24, letterSpacing: -0.2 },
  },
};
export const lightTheme = {
  colors: {
    background:           '#f8f7fa',   // crisp light off-white
    backgroundSecondary:  '#f3f1f6',
    backgroundDark:       '#eae8ef',
    bottomSheetBackground:'#ffffff',
    bottomTabBackground:  '#ffffff',
    bottomTabBorder:      'rgba(0,0,0,0.06)',
    bottomTabIconInactive:'#7a7a94',
    bottomTabIconActive:  '#6d28d9',
    cardBackground:       '#ffffff', // pure white for contrast
    cardBackgroundLight:  'rgba(109,40,217,0.05)',
    surface:              '#ffffff',
    surfaceBorder:        'rgba(0,0,0,0.06)',
    textPrimary:          '#14141f',
    textSecondary:        '#3c3c52',
    textMuted:            '#7a7a94',
    textDisabled:         '#b0b0c4',
    textOnAccent:         '#ffffff',
    iconPrimary:          '#14141f',
    iconSecondary:        '#4a4a62',
    iconMuted:            '#9090a8',
    buttonPrimary:        '#6d28d9',
    buttonPrimaryText:    '#ffffff',
    buttonSecondary:      'rgba(109,40,217,0.10)',
    buttonSecondaryText:  '#14141f',
    buttonDestructive:    '#ef4444',
    buttonDestructiveText:'#ffffff',
    inputBackground:      'rgba(0,0,0,0.05)',
    inputBorder:          'rgba(0,0,0,0.10)',
    inputText:            '#14141f',
    inputPlaceholder:     '#9090a8',
    inputFocusBorder:     '#6d28d9',
    divider:              'rgba(0,0,0,0.07)',
    overlay:              'rgba(0,0,0,0.40)',
    overlayLight:         'rgba(0,0,0,0.18)',
    scrim:                'rgba(0,0,0,0.45)',
    bubbleOutgoing:       '#6d28d9',
    bubbleIncoming:       '#ffffff', // crisp white for premium contrast
    bubbleOutgoingText:   '#ffffff',
    bubbleIncomingText:   '#14141f',
    tickSent:             'rgba(20,20,31,0.40)',
    tickRead:             '#6d28d9',
    chatInputBg:          '#ffffff', // white input bar
    reactionPill:         '#ffffff', // white reaction pill
    datePillBg:           'rgba(200,196,224,0.80)',
    accent:       '#6d28d9',
    accentBright: '#7c3aed',
    accentDim:    '#ede9fe',
    accentSubtle: 'rgba(109,40,217,0.12)',
    danger:  '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info:    '#3b82f6',
    playerBackground: '#f7f6fb',
    thumbTint:        '#6d28d9',
    trackMin:         '#6d28d9',
    trackMax:         'rgba(0,0,0,0.12)',
  },

  gradients: {
    bgBase:          ['#fdfcfec0', '#f8f7fac0', '#fdfcfec0', '#f8f7fac0', '#fdfcfec0'] as const,
    bgBaseLocations: [0, 0.25, 0.5, 0.75, 1] as const,
    bgGlow:          ['transparent', 'rgba(109,40,217,0.03)', 'rgba(109,40,217,0.05)', 'rgba(109,40,217,0.03)', 'transparent'] as const,
    bgGlowLocations: [0, 0.25, 0.5, 0.75, 1] as const,
    glassPurple:     ['rgba(255,255,255,0.95)', 'rgba(250,249,252,0.98)'] as const,
    header:          ['#5b21b6', '#a855f7'] as const,
    headerLocations: [0, 1] as const,
    headerTextColor: '#ffffff',
  },

  typography: {
    htmlBase: { color: '#14141f', fontSize: 15, fontWeight: '400' as any, lineHeight: 24, letterSpacing: -0.2 },
    bodyText: { color: '#14141f', fontSize: 15, fontWeight: '500' as any, lineHeight: 24, letterSpacing: -0.2 },
  },
};
let currentActiveTheme: any = darkTheme;

export function setGlobalTheme(themeName: 'light' | 'dark') {
  currentActiveTheme = themeName === 'light' ? lightTheme : darkTheme;
}

const createThemeProxy = (key: 'colors' | 'gradients' | 'typography') => {
  return new Proxy({}, {
    get(_target, prop) {
      return currentActiveTheme[key][prop];
    },
    ownKeys(_target) {
      return Reflect.ownKeys(currentActiveTheme[key]);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(currentActiveTheme[key], prop);
    },
  });
};

export const theme = {
  colors:     createThemeProxy('colors'),
  gradients:  createThemeProxy('gradients'),
  typography: createThemeProxy('typography'),
} as unknown as typeof darkTheme;
const appTheme = {
  get text()           { return theme.colors.textPrimary; },
  get background()     { return theme.colors.background; },
  get tint()           { return theme.colors.accent; },
  get tabIconDefault() {
    return currentActiveTheme !== darkTheme ? '#7a7a94' : 'rgba(255,255,255,0.35)';
  },
  get tabIconSelected() { return theme.colors.accent; },
};

export default { light: appTheme, dark: appTheme };
