import { Pressable, StyleSheet, View } from 'react-native';

import { useLanguage } from '@/hooks/useLanguage';
import type { Lang } from '@/lib/i18n';
import { fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

const OPTIONS: readonly { lang: Lang; short: string }[] = [
  { lang: 'en', short: 'EN' },
  { lang: 'ka', short: 'KA' },
];

/** EN | KA in the burgundy header: one tap switches every screen. */
export function LanguageSwitch() {
  const { colors } = useTheme();
  const { lang, t, setLang } = useLanguage();
  const names: Record<Lang, string> = { en: t.language.english, ka: t.language.georgian };

  return (
    <View
      style={[styles.row, { borderColor: colors.onHeaderMuted }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.language.switchLabel}
    >
      {OPTIONS.map((option) => {
        const active = option.lang === lang;
        return (
          <Pressable
            key={option.lang}
            onPress={() => setLang(option.lang)}
            accessibilityRole="radio"
            accessibilityLabel={names[option.lang]}
            accessibilityState={{ checked: active }}
            hitSlop={6}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: active ? colors.onHeader : 'transparent', opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <AppText
              // Latin letters: keep the Latin font in both languages.
              lang="en"
              style={{
                color: active ? colors.header : colors.onHeader,
                fontFamily: active ? fonts.bodyBold : fonts.bodySemi,
                fontSize: 15,
                lineHeight: 19,
              }}
            >
              {option.short}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 24, padding: 3, gap: 2 },
  option: { minWidth: 44, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
