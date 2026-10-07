import { StyleSheet, View } from 'react-native';

import { newDraftItem, type DraftErrors, type DraftItem, type EntryDraft } from '@/lib/entryDraft';
import { ENTRY_TYPE_LABELS, ENTRY_TYPES } from '@/lib/entryTypes';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { ENTRY_TYPE_ICONS } from './EntryTypeIcon';
import { TextField } from './TextField';
import { ValueRowEditor } from './ValueRowEditor';

type TankChoice = { id: string; name: string };

type Props = {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  tanks: readonly TankChoice[];
  errors: DraftErrors;
  disabled?: boolean;
};

const TYPE_CHOICES = ENTRY_TYPES.map((value) => ({
  value,
  label: ENTRY_TYPE_LABELS[value],
  icon: ENTRY_TYPE_ICONS[value],
}));

/** The confirm/edit step: everything the parser produced, editable. */
export function EntryReview({ draft, onChange, tanks, errors, disabled = false }: Props) {
  const { colors } = useTheme();
  const tankChoices = tanks.map((tank) => ({ value: tank.id, label: tank.name }));

  function updateItem(key: string, fields: Partial<Omit<DraftItem, 'key'>>) {
    onChange({
      ...draft,
      items: draft.items.map((item) => (item.key === key ? { ...item, ...fields } : item)),
    });
  }

  function removeItem(key: string) {
    onChange({ ...draft, items: draft.items.filter((item) => item.key !== key) });
  }

  return (
    <View style={styles.wrapper}>
      {draft.unmatchedTankName ? (
        <Banner
          tone="info"
          message={`The note mentions "${draft.unmatchedTankName}", but you have no tank with that name. Choose the tank below.`}
        />
      ) : null}

      <ChoiceChips
        label="Tank"
        choices={tankChoices}
        selected={draft.tankId}
        onSelect={(tankId) => onChange({ ...draft, tankId })}
        error={errors.tank}
        disabled={disabled}
      />

      <ChoiceChips
        label="Entry type"
        choices={TYPE_CHOICES}
        selected={draft.type}
        onSelect={(type) => onChange({ ...draft, type })}
        disabled={disabled}
      />

      <View style={styles.section}>
        <AppText variant="label">Values</AppText>
        {draft.items.length === 0 ? <AppText muted>No values. Add one if needed.</AppText> : null}
        {draft.items.map((item, index) => (
          <ValueRowEditor
            key={item.key}
            item={item}
            title={`Value ${index + 1}`}
            onChange={(fields) => updateItem(item.key, fields)}
            onRemove={() => removeItem(item.key)}
            error={errors.items?.[item.key]}
            disabled={disabled}
          />
        ))}
        <Button
          variant="secondary"
          title="Add value"
          icon="plus"
          onPress={() => onChange({ ...draft, items: [...draft.items, newDraftItem()] })}
          disabled={disabled}
        />
      </View>

      <TextField
        label="Note (optional)"
        value={draft.note}
        onChangeText={(note) => onChange({ ...draft, note })}
        error={errors.note}
        multiline
        textAlignVertical="top"
        style={styles.note}
        editable={!disabled}
      />

      {draft.rawText ? (
        <View style={[styles.said, { backgroundColor: colors.surfaceAlt }]}>
          <AppText muted style={styles.saidLabel}>
            YOU SAID
          </AppText>
          <AppText variant="quote">“{draft.rawText}”</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  section: { gap: spacing.sm },
  note: { minHeight: 96, paddingTop: spacing.sm },
  said: { borderRadius: radius.sm + 2, padding: spacing.md, gap: 2 },
  saidLabel: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 1 },
});
