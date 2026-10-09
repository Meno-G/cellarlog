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
  warningBorder: string;
  /** The cellar-burgundy header band and its text. */
  header: string;
  /** Section headings on the page ("Your cellar", "Timeline"): cellar burgundy, light rosé in the dark. */
  heading: string;
  onHeader: string;
  onHeaderMuted: string;
  /** Barrel gold: rings, marks and small highlights, never body text. */
  accent: string;
  /** Soft circle behind entry-type icons, and the icon itself. */
  iconBg: string;
  iconFg: string;
};

// Wine-cellar premium. High contrast either way: the app is read in bright
// cellars and dim ones, often at arm's length.
export const lightColors: ColorTokens = {
  background: '#F6F0E6', // parchment
  surface: '#FFFDF9',
  surfaceAlt: '#EFE6DA',
  border: '#E3D8C9',
  text: '#241A17', // ink
  textMuted: '#6B5B53',
  primary: '#6B1F33', // Saperavi
  onPrimary: '#FFFDF9',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  warningBg: '#F3E3C3',
  warningText: '#6A3E0C',
  warningBorder: '#B9853F',
  header: '#4A1322', // cellar
  heading: '#4A1322',
  onHeader: '#F6F0E6',
  onHeaderMuted: '#E7D9C6',
  accent: '#C9A46A', // barrel gold
  iconBg: '#EFE1E4',
  iconFg: '#6B1F33',
};

export const darkColors: ColorTokens = {
  background: '#1A1214',
  surface: '#2A1C1F',
  surfaceAlt: '#33242A',
  border: '#43303A',
  text: '#F4EDE6',
  textMuted: '#C2B2AA',
  primary: '#E48DA5', // rosé
  onPrimary: '#2A0A14',
  danger: '#F97066',
  onDanger: '#2A0A0A',
  warningBg: '#4A2C08',
  warningText: '#F5D08A',
  warningBorder: '#B9853F',
  header: '#2A0E17',
  heading: '#EBC3CF',
  onHeader: '#F4EDE6',
  onHeaderMuted: '#C9B3AE',
  accent: '#D9B67A',
  iconBg: '#3A222B',
  iconFg: '#E48DA5',
};
