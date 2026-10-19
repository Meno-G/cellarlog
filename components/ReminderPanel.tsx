import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/useLanguage';
import { useReminder } from '@/hooks/useReminders';
import { REMINDER_HOURS } from '@/lib/reminders';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { ChoiceChips } from './ChoiceChips';

/** Measurement reminder for a vessel with a running ferment. Shown only where notifications exist (the phone app). */
export function ReminderPanel({ tankId }: { tankId: string }) {
  const { colors } = useTheme();
  const t = useT();
  const { available, hours, change } = useReminder(tankId);
  const [blocked, setBlocked] = useState(false);
  if (!available) return null;

  const choices = [
    { value: 'off', label: t.reminders.off },
    ...REMINDER_HOURS.map((h) => ({ value: String(h), label: t.reminders.every(h) })),
  ];

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading" style={{ color: colors.heading }}>
        {t.reminders.title}
      </AppText>
      <AppText muted variant="caption">
        {t.reminders.hint}
      </AppText>
      <ChoiceChips
        label={t.reminders.title}
        choices={choices}
        selected={hours === null ? 'off' : String(hours)}
        onSelect={async (value) => {
          setBlocked(false);
          const ok = await change(value === 'off' ? null : Number(value));
          if (!ok) setBlocked(true);
        }}
      />
      {blocked ? <Banner message={t.reminders.blocked} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
