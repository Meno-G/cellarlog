import { Pressable, StyleSheet, View } from 'react-native';

import type { Entry } from '@/lib/entries';
import type { EntryUpload } from '@/lib/entryOverlay';
import { ENTRY_TYPE_LABELS } from '@/lib/entryTypes';
import { formatEntryTime, formatItemValue } from '@/lib/format';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { EntryTypeIcon } from './EntryTypeIcon';

type Props = {
  entry: Entry;
  /** Tapping opens the entry's actions (e.g. delete). */
  onPress?: () => void;
  /** Dimmed while an action on this entry is running. */
  busy?: boolean;
  /** A change made on this phone (new entry, edit, deletion) that hasn't uploaded yet. */
  upload?: Pick<EntryUpload, 'status' | 'error' | 'action'>;
};

function uploadText(upload: NonNullable<Props['upload']>): string {
  const error = upload.error ?? 'unknown error';
  if (upload.action === 'delete') return `Couldn't delete: ${error}`;
  if (upload.status === 'failed') {
    return upload.action === 'edit' ? `Couldn't upload this edit: ${error}` : `Couldn't upload: ${error}`;
  }
  return upload.action === 'edit' ? 'Edited on this phone · waiting to upload' : 'Saved on this phone · waiting to upload';
}

export function EntryCard({ entry, onPress, busy = false, upload }: Props) {
  const { colors } = useTheme();
  const { items, note } = entry.parsed;
  const failed = upload?.status === 'failed' || upload?.action === 'delete';
  // Show the original wording only when it adds something beyond the note.
  const showRaw = entry.rawText.trim() !== '' && entry.rawText.trim() !== note?.trim();
  // Lab readings read best as tiles (pH | Brix | TA); other values as name–value rows.
  const asTiles = entry.type === 'lab_analysis' && items.length > 1;

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
          borderColor: failed ? colors.danger : upload ? colors.warningBorder : colors.border,
          borderStyle: upload ? 'dashed' : 'solid',
          borderWidth: upload ? 1.5 : 1,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <EntryTypeIcon type={entry.type} waiting={Boolean(upload)} />
      <View style={styles.body}>
        <View style={styles.header}>
          <AppText variant="label">{ENTRY_TYPE_LABELS[entry.type]}</AppText>
          <AppText muted variant="caption">
            {formatEntryTime(entry.createdAt)}
          </AppText>
        </View>

        {asTiles ? (
          <View style={styles.tiles}>
            {items.map((item, index) => (
              <View key={`${item.name}-${index}`} style={[styles.tile, { backgroundColor: colors.background }]}>
                <AppText muted style={styles.tileName} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText style={styles.tileValue} numberOfLines={1}>
                  {formatItemValue(item)}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          items.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.item}>
              <AppText style={styles.itemName}>{item.name}</AppText>
              <AppText style={{ fontFamily: fonts.bodyBold }}>{formatItemValue(item)}</AppText>
            </View>
          ))
        )}

        {note ? <AppText>{note}</AppText> : null}

        {showRaw ? (
          <AppText variant="quote" muted style={styles.raw}>
            “{entry.rawText}”
          </AppText>
        ) : null}

        {upload ? (
          <AppText style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: failed ? colors.danger : colors.warningText }}>
            {uploadText(upload)}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  body: { flex: 1, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemName: { flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '30%', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  tileName: { fontSize: 14, lineHeight: 18 },
  tileValue: { fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 24 },
  raw: { fontSize: 19, lineHeight: 24 },
});
