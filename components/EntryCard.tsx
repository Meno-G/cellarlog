import { Pressable, StyleSheet, View } from 'react-native';

import type { Entry } from '@/lib/entries';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { formatEntryTime, formatItemValue } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  entry: Entry;
  /** Tapping opens the entry's actions (e.g. delete). */
  onPress?: () => void;
  /** Dimmed while an action on this entry is running. */
  busy?: boolean;
  /** Saved on this phone, not uploaded yet. */
  upload?: { status: 'pending' | 'failed'; error: string | null };
};

export function EntryCard({ entry, onPress, busy = false, upload }: Props) {
  const { colors } = useTheme();
  const failed = upload?.status === 'failed';
  const { items, note } = entry.parsed;
  // Show the original wording only when it adds something beyond the note.
  const showRaw = entry.rawText.trim() !== '' && entry.rawText.trim() !== note?.trim();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      accessibilityHint="Shows options for this entry"
      accessibilityState={{ busy }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: failed ? colors.danger : upload ? colors.warningText : colors.border,
          borderStyle: upload ? 'dashed' : 'solid',
          opacity: busy ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {upload ? (
        <View
          style={[
            styles.uploadBadge,
            { backgroundColor: failed ? colors.surfaceAlt : colors.warningBg },
          ]}
        >
          <AppText variant="label" style={{ color: failed ? colors.danger : colors.warningText }}>
            {failed ? `Couldn't upload: ${upload.error ?? 'unknown error'}` : 'Saved on this phone · waiting to upload'}
          </AppText>
        </View>
      ) : null}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
          <AppText variant="label">{ENTRY_TYPE_LABELS[entry.type]}</AppText>
        </View>
        <AppText muted variant="caption">
          {formatEntryTime(entry.createdAt)}
        </AppText>
      </View>

      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} style={styles.item}>
          <AppText style={styles.itemName}>{item.name}</AppText>
          <AppText variant="label">{formatItemValue(item)}</AppText>
        </View>
      ))}

      {note ? <AppText>{note}</AppText> : null}

      {showRaw ? (
        <AppText muted variant="caption" style={styles.raw}>
          “{entry.rawText}”
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  uploadBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemName: { flexShrink: 1 },
  raw: { fontStyle: 'italic' },
});
