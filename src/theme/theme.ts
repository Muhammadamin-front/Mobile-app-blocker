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
  background: '#071426',
  backgroundAccent: '#173A63',
  surface: '#152B47C9',
  surfaceRaised: '#1B3554E8',
  surfaceMuted: '#29435F9E',
  text: '#F8FAFC',
  textMuted: '#B7C4D5',
  textSubtle: '#7F94AB',
  primary: '#FFCA0A',
  primaryStrong: '#F5B900',
  primarySoft: '#FFCA0A20',
  border: '#D9EDFF1F',
  borderStrong: '#FFCF3F52',
  danger: '#FF8293',
  dangerSoft: '#FF53631C',
  success: '#63E0B1',
  successSoft: '#52DCA41A',
  warning: '#FFD45C',
  warningSoft: '#FFD45C1B',
  shadow: '#00050C',
  overlay: '#01060DD9',
  inverseText: '#111009',
  glassHighlight: '#FFFFFF29',
  glassShadow: '#00071499',
  chartSeries: '#FFCA0A',
};

export const darkTheme: Theme = {
  background: '#03070E',
  backgroundAccent: '#0C2340',
  surface: '#0D1A2BD9',
  surfaceRaised: '#12243AEF',
  surfaceMuted: '#1A3049A8',
  text: '#FAFBFD',
  textMuted: '#AAB8C9',
  textSubtle: '#71859C',
  primary: '#FFD21A',
  primaryStrong: '#FFC400',
  primarySoft: '#FFD21A1F',
  border: '#DCEEFF1A',
  borderStrong: '#FFD83D4A',
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
  chartSeries: '#FFD21A',
};
