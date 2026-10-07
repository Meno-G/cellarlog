import { View } from 'react-native';

import { fonts, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** The CellarLog mark: a gold wine glass and the name, for the burgundy header. */
export function BrandMark({ size = 30 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="CellarLog"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      <Icon name="glass-wine" size={Math.round(size * 0.95)} color={colors.accent} />
      <AppText style={{ color: colors.onHeader, fontFamily: fonts.display, fontSize: size, lineHeight: size + 4 }}>
        CellarLog
      </AppText>
    </View>
  );
}
