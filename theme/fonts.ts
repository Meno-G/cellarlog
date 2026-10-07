// One module per weight: importing the package root would bundle every weight (10+ MB).
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';

/** Loaded once in app/_layout.tsx with useFonts(fontAssets). */
export const fontAssets = {
  CormorantGaramond_700Bold,
  CormorantGaramond_500Medium_Italic,
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
};

/**
 * Font family names. Each weight is its own family on Android, so pick the
 * family instead of setting fontWeight on custom fonts.
 */
export const fonts = {
  /** Cormorant Garamond: tank names and titles. */
  display: 'CormorantGaramond_700Bold',
  /** Quoting what the user said. */
  quote: 'CormorantGaramond_500Medium_Italic',
  /** Source Sans 3: everything read and tapped while working. */
  body: 'SourceSans3_400Regular',
  bodySemi: 'SourceSans3_600SemiBold',
  bodyBold: 'SourceSans3_700Bold',
} as const;
