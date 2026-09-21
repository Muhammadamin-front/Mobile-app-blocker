export interface Theme {
  background: string;
  backgroundAccent: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  shadow: string;
  overlay: string;
  inverseText: string;
  glassHighlight: string;
  glassShadow: string;
  /** Chart series hue, picked per surface so marks stay inside the readable band. */
  chartSeries: string;
}

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const lightTheme: Theme = {
  background: '#031225',
  backgroundAccent: '#123A68',
  surface: '#0B213AD9',
  surfaceRaised: '#102B49F2',
  surfaceMuted: '#183A5AB8',
  text: '#F9FBFF',
  textMuted: '#B6C6D9',
  textSubtle: '#7890AA',
  primary: '#FFD447',
  primaryStrong: '#F6C72E',
  primarySoft: '#FFD4471D',
  border: '#B8D9F61F',
  borderStrong: '#FFD4474D',
  danger: '#FF8293',
  dangerSoft: '#FF53631C',
  success: '#63E0B1',
  successSoft: '#52DCA41A',
  warning: '#FFD45C',
  warningSoft: '#FFD45C1B',
  shadow: '#000611',
  overlay: '#01060DD9',
  inverseText: '#111009',
  glassHighlight: '#FFFFFF24',
  glassShadow: '#000814C7',
  chartSeries: '#FFD447',
};

export const darkTheme: Theme = {
  background: '#010915',
  backgroundAccent: '#08284B',
  surface: '#07182BD9',
  surfaceRaised: '#0B2038F2',
  surfaceMuted: '#12304CA8',
  text: '#FAFBFD',
  textMuted: '#AAB8C9',
  textSubtle: '#71859C',
  primary: '#FFD447',
  primaryStrong: '#F6C72E',
  primarySoft: '#FFD4471C',
  border: '#DCEEFF1A',
  borderStrong: '#FFD44747',
  danger: '#FF8797',
  dangerSoft: '#FF53631A',
  success: '#66E3B4',
  successSoft: '#52DCA417',
  warning: '#FFD96A',
  warningSoft: '#FFD45C18',
  shadow: '#000000',
  overlay: '#010307E5',
  inverseText: '#0D0E0A',
  glassHighlight: '#FFFFFF20',
  glassShadow: '#000000B8',
  chartSeries: '#FFD447',
};
