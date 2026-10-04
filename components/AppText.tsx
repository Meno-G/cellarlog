import { Text, type TextProps } from 'react-native';

import { fontSize, useTheme } from '@/theme';

type Variant = 'heading' | 'title' | 'body' | 'label' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
};

const weights: Record<Variant, '400' | '600' | '700'> = {
  heading: '700',
  title: '700',
  body: '400',
  label: '600',
  caption: '400',
};

export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? colors.textMuted : colors.text,
          fontSize: fontSize[variant],
          fontWeight: weights[variant],
          lineHeight: Math.round(fontSize[variant] * 1.3),
        },
        style,
      ]}
      {...rest}
    />
  );
}
