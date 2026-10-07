import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Turn off for screens that own a FlatList. */
  scroll?: boolean;
  /** Pinned to the bottom, outside the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  /** Full-width band under the header (see HeroBand), outside the padding. */
  hero?: ReactNode;
  /** Screens under a Stack header only need the bottom inset. */
  edges?: Edge[];
};

export function Screen({ children, scroll = true, footer, hero, edges = ['bottom'] }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {hero}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, styles.content]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

type HeroProps = {
  /** Large serif line (e.g. the tank name). Optional: the header may already show it. */
  title?: string;
  /** Smaller line(s) under it. */
  subtitle?: string;
  children?: ReactNode;
};

/** Continues the burgundy header band down the screen with a title and details. */
export function HeroBand({ title, subtitle, children }: HeroProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.header }]}>
      {title ? (
        <AppText variant="display" style={{ color: colors.onHeader }} numberOfLines={2}>
          {title}
        </AppText>
      ) : null}
      {subtitle ? <AppText style={{ color: colors.onHeaderMuted, fontSize: 17 }}>{subtitle}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: 2,
  },
});
