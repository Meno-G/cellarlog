import { Text, type TextProps } from 'react-native';

import { fonts, fontSize, useTheme } from '@/theme';

/**
 * heading/title/display: Cormorant Garamond (names, titles).
 * body/label/caption: Source Sans 3. quote: serif italic for what was said.
 */
type Variant = 'display' | 'heading' | 'title' | 'body' | 'label' | 'caption' | 'quote';

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
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

export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  const { colors } = useTheme();
  const size = sizes[variant];
  const serif = variant === 'display' || variant === 'heading' || variant === 'title';
  return (
    <Text
      style={[
        {
          color: muted ? colors.textMuted : colors.text,
          fontFamily: families[variant],
          fontSize: size,
          lineHeight: Math.round(size * (serif ? 1.15 : 1.3)),
        },
        style,
      ]}
      {...rest}
    />
  );
}
