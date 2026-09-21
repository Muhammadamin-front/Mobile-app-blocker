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
  background: '#F5F6FA',
  backgroundAccent: '#EEEAFE',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EFF1F6',
  text: '#171825',
  textMuted: '#656B7C',
  textSubtle: '#9298A8',
  primary: '#6758E7',
  primaryStrong: '#5143C7',
  primarySoft: '#ECE9FF',
  border: '#E5E7EE',
  borderStrong: '#D7DAE4',
  danger: '#BC4051',
  dangerSoft: '#FCECEF',
  success: '#168462',
  successSoft: '#E5F6F0',
  warning: '#A86416',
  warningSoft: '#FFF4DE',
  shadow: '#29234D',
  overlay: '#11131CB3',
  inverseText: '#FFFFFF',
  chartSeries: '#6758E7',
};

export const darkTheme: Theme = {
  background: '#0C0E16',
  backgroundAccent: '#1C1935',
  surface: '#151823',
  surfaceRaised: '#1A1E2B',
  surfaceMuted: '#222635',
  text: '#F7F7FB',
  textMuted: '#A9AFC0',
  textSubtle: '#737B90',
  primary: '#998DFF',
  primaryStrong: '#7E70F4',
  primarySoft: '#292545',
  border: '#282D3C',
  borderStrong: '#363C4E',
  danger: '#FF8997',
  dangerSoft: '#3B2029',
  success: '#64DAB0',
  successSoft: '#19352F',
  warning: '#F0B665',
  warningSoft: '#392D1E',
  shadow: '#000000',
  overlay: '#05060ACC',
  inverseText: '#11121A',
  chartSeries: '#7E70F4',
};
