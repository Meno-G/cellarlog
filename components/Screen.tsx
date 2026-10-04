import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Turn off for screens that own a FlatList. */
  scroll?: boolean;
  /** Pinned to the bottom, outside the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  /** Screens under a Stack header only need the bottom inset. */
  edges?: Edge[];
};

export function Screen({ children, scroll = true, footer, edges = ['bottom'] }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
