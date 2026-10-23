/**
 * Scoped visual tokens for the Veralayam student experience. They are estimated from the Figma
 * screenshots (scaled exports, ~0.83x of the 412px frame), NOT extracted from Figma, and are
 * intentionally kept out of the shared `design-system` so other institutions are unaffected.
 */
export const vColors = {
  page: '#F5F9F7',
  surface: '#FFFFFF',
  ink: '#0F2D2B',
  body: '#4B5E5C',
  muted: '#7A8A88',
  border: '#DDE5E3',
  primary: '#035352',
  primaryDeep: '#064847',
  mint: '#E3F1EC',
  mintSoft: '#EEF6F2',
  amber: '#B4631F',
  amberSoft: '#FCEBDD',
  blue: '#2A4C91',
  blueSoft: '#E4EBF9',
  violet: '#6B4FA0',
  violetSoft: '#EDE7F7',
  danger: '#B42318',
  dot: '#035352',
} as const;

export const vRadius = { card: 20, tile: 16, pill: 999, chip: 12 } as const;
export const vSpace = { gutter: 20, section: 24, gap: 12 } as const;

export const vFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const vShadow = {
  shadowColor: '#0F2D2B',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

/** Pastel subject-card palettes, cycled by position (the Figma shows blue then peach). */
export const subjectPalettes = [
  { bg: vColors.blueSoft, accent: vColors.blue },
  { bg: vColors.amberSoft, accent: vColors.amber },
  { bg: vColors.mint, accent: vColors.primary },
  { bg: vColors.violetSoft, accent: vColors.violet },
] as const;
