export type ColorTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  warningBg: string;
  warningText: string;
};

// High-contrast palettes: the app is read in bright cellars and dim ones.
export const lightColors: ColorTokens = {
  background: '#F6F3EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EDE7E1',
  border: '#CFC6BD',
  text: '#1B1714',
  textMuted: '#5A514A',
  primary: '#7A1E3A',
  onPrimary: '#FFFFFF',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  warningBg: '#FEF0C7',
  warningText: '#7A2E0E',
};

export const darkColors: ColorTokens = {
  background: '#121010',
  surface: '#1E1A1A',
  surfaceAlt: '#2A2424',
  border: '#433A3A',
  text: '#F4EFEC',
  textMuted: '#B5ABA5',
  primary: '#E58FA8',
  onPrimary: '#2A0A14',
  danger: '#F97066',
  onDanger: '#2A0A0A',
  warningBg: '#4E1D09',
  warningText: '#FEDF89',
};
