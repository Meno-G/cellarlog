import { View } from 'react-native';

import type { EntryType } from '@/lib/entryTypes';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export const ENTRY_TYPE_ICONS: Record<EntryType, IconName> = {
  addition: 'water-plus-outline',
  temperature: 'thermometer',
  lab_analysis: 'flask-outline',
  tasting: 'glass-wine',
  transfer: 'swap-horizontal',
  note: 'note-text-outline',
  decision: 'check-decagram-outline',
};

type Props = {
  type: EntryType;
  /** Circle diameter. */
  size?: number;
  /** Waiting to upload: amber instead of wine. */
  waiting?: boolean;
};

/** The entry type's icon on a soft wine circle. */
export function EntryTypeIcon({ type, size = 44, waiting = false }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: waiting ? colors.warningBg : colors.iconBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={ENTRY_TYPE_ICONS[type]}
        size={Math.round(size * 0.55)}
        color={waiting ? colors.warningText : colors.iconFg}
      />
    </View>
  );
}
