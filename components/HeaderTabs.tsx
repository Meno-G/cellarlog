import { Pressable, StyleSheet, View } from 'react-native';

import { fonts, radius, spacing, touch, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type HeaderTab<T extends string> = { value: T; label: string; icon: IconName };

type Props<T extends string> = {
  tabs: readonly HeaderTab<T>[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
};

/** Two or three big tabs on the burgundy band (inside a HeroBand). */
export function HeaderTabs<T extends string>({ tabs, selected, onSelect, disabled = false }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.onHeaderMuted }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.value === selected;
        const foreground = active ? colors.header : colors.onHeader;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onSelect(tab.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active, disabled }}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: active ? colors.onHeader : 'transparent',
                opacity: disabled && !active ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Icon name={tab.icon} size={22} color={foreground} />
            <AppText
              numberOfLines={1}
              style={{ color: foreground, fontFamily: active ? fonts.bodyBold : fonts.bodySemi }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
    marginTop: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: touch.minHeight - 4,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
});
