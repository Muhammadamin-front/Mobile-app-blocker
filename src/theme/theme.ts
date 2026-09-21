export interface Theme {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  border: string;
  danger: string;
  success: string;
}

export const lightTheme: Theme = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F7',
  text: '#141927',
  textMuted: '#687086',
  primary: '#5B5CE2',
  primarySoft: '#E9E9FF',
  border: '#E2E5ED',
  danger: '#C43D4B',
  success: '#16805D',
};

export const darkTheme: Theme = {
  background: '#0C111D',
  surface: '#151C2B',
  surfaceMuted: '#202A3D',
  text: '#F4F6FA',
  textMuted: '#A4AEC2',
  primary: '#8B8CF5',
  primarySoft: '#27294D',
  border: '#29344A',
  danger: '#FF7B86',
  success: '#5DDBAD',
};
