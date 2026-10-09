// One module per weight: importing the package root would bundle every weight (10+ MB).
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';
// Georgian script (Cormorant and Source Sans have no Georgian letters).
import { NotoSansGeorgian_400Regular } from '@expo-google-fonts/noto-sans-georgian/400Regular';
import { NotoSansGeorgian_600SemiBold } from '@expo-google-fonts/noto-sans-georgian/600SemiBold';
import { NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian/700Bold';
import { NotoSerifGeorgian_500Medium } from '@expo-google-fonts/noto-serif-georgian/500Medium';
import { NotoSerifGeorgian_700Bold } from '@expo-google-fonts/noto-serif-georgian/700Bold';

/** Loaded once in app/_layout.tsx with useFonts(fontAssets). */
export const fontAssets = {
  CormorantGaramond_700Bold,
  CormorantGaramond_500Medium_Italic,
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
  NotoSansGeorgian_400Regular,
  NotoSansGeorgian_600SemiBold,
  NotoSansGeorgian_700Bold,
  NotoSerifGeorgian_500Medium,
  NotoSerifGeorgian_700Bold,
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

/** Georgian counterpart of each family, used while the app is in Georgian (see AppText). */
const GEORGIAN: Record<string, string> = {
  [fonts.display]: 'NotoSerifGeorgian_700Bold',
  [fonts.quote]: 'NotoSerifGeorgian_500Medium',
  [fonts.body]: 'NotoSansGeorgian_400Regular',
  [fonts.bodySemi]: 'NotoSansGeorgian_600SemiBold',
  [fonts.bodyBold]: 'NotoSansGeorgian_700Bold',
};

/** The family to use for Georgian text; Latin letters and digits fall back to the system font. */
export function georgianFamily(family: string | undefined): string | undefined {
  return family === undefined ? undefined : (GEORGIAN[family] ?? family);
}
