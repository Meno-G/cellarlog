import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const fontSize = {
  caption: 15,
  body: 18,
  label: 18,
  title: 24,
  heading: 30,
} as const;

// Minimum sizes for wet or gloved hands.
export const touch = {
  minHeight: 56,
  recordButton: 144,
} as const;

export type Theme = {
  dark: boolean;
  colors: ColorTokens;
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { dark, colors: dark ? darkColors : lightColors };
}

export type { ColorTokens };
