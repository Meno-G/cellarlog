import { StyleSheet, Text, type TextProps } from 'react-native';

import { useLanguage } from '@/hooks/useLanguage';
import type { Lang } from '@/lib/i18n';
import { fonts, fontSize, georgianFamily, useTheme } from '@/theme';

/**
 * heading/title/display: Cormorant Garamond (names, titles).
 * body/label/caption: Source Sans 3. quote: serif italic for what was said.
 * In Georgian the same roles use Noto Serif / Noto Sans Georgian.
 */
type Variant = 'display' | 'heading' | 'title' | 'body' | 'label' | 'caption' | 'quote';

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
  /** Force the script's fonts, e.g. 'en' for a Latin-only label like "EN" or "EnoLog". */
  lang?: Lang;
};

const families: Record<Variant, string> = {
  display: fonts.display,
  heading: fonts.display,
  title: fonts.display,
  body: fonts.body,
  label: fonts.bodyBold,
  caption: fonts.body,
  quote: fonts.quote,
};

const sizes: Record<Variant, number> = {
  display: fontSize.display,
  heading: fontSize.heading,
  title: fontSize.title,
  body: fontSize.body,
  label: fontSize.label,
  caption: fontSize.caption,
  quote: 21,
};

/** Cormorant runs small, so its sizes are large; Noto Serif Georgian needs about 80% of them. */
const GEORGIAN_SERIF_SCALE = 0.8;

export function AppText({ variant = 'body', muted = false, lang, style, ...rest }: Props) {
  const { colors } = useTheme();
  const current = useLanguage().lang;
  const georgian = (lang ?? current) === 'ka';
  const serif = variant === 'display' || variant === 'heading' || variant === 'title';
  const size = georgian && serif ? Math.round(sizes[variant] * GEORGIAN_SERIF_SCALE) : sizes[variant];
  const base = {
    color: muted ? colors.textMuted : colors.text,
    fontFamily: families[variant],
    fontSize: size,
    lineHeight: Math.round(size * (serif && !georgian ? 1.15 : 1.3)),
  };

  if (!georgian) return <Text style={[base, style]} {...rest} />;

  // Georgian letters are taller: keep at least 1.35 × the size so nothing is clipped.
  const flat = StyleSheet.flatten([base, style]);
  const finalSize = flat.fontSize ?? size;
  return (
    <Text
      style={[
        flat,
        {
          fontFamily: georgianFamily(flat.fontFamily),
          lineHeight: Math.max(flat.lineHeight ?? 0, Math.round(finalSize * 1.35)),
        },
      ]}
      {...rest}
    />
  );
}
