import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CachedNote } from '@/components/CachedNote';
import { HeroBand, Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useEntries } from '@/hooks/useEntries';
import { useFerments } from '@/hooks/useFerments';
import { useT } from '@/hooks/useLanguage';
import { useOutbox } from '@/hooks/useOutbox';
import { useTank } from '@/hooks/useTanks';
import { activeFerment, elapsedDays, entriesInFerment, fermentDay } from '@/lib/fermentCurves';
import type { Ferment } from '@/lib/ferments';
import { formatDate } from '@/lib/format';
import { applyEntryChanges } from '@/lib/entryOverlay';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** All of a vessel's ferments, newest first. Tap one to edit its dates (or delete it). */
export default function FermentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tank = useTank(id);
  const ferments = useFerments(id);
  const entries = useEntries(id);
  const outbox = useOutbox();
  const { colors } = useTheme();
  const t = useT();

  const hero = <HeroBand title={t.ferment.listTitle} subtitle={tank.data?.name} />;

  if (ferments.loading) {
    return (
      <Screen scroll={false} hero={hero}>
        <LoadingState label={t.ferment.loadingList} />
      </Screen>
    );
  }
  if (!ferments.data) {
    return (
      <Screen scroll={false} hero={hero}>
        <ErrorState
          message={ferments.error ?? t.messages.loadFermentsFailed}
          onRetry={ferments.refresh}
          retrying={ferments.refreshing}
        />
      </Screen>
    );
  }

  const timeline = applyEntryChanges(entries.data ?? [], outbox.items, id);
  const running = activeFerment(ferments.data);
  const now = new Date();

  function open(ferment: Ferment) {
    router.push({ pathname: '/tanks/[id]/ferment-form', params: { id, fermentId: ferment.id } });
  }

  return (
    <Screen
      scroll={false}
      hero={hero}
      footer={
        <Button
          title={t.ferment.start}
          icon="plus"
          onPress={() => router.push({ pathname: '/tanks/[id]/ferment-form', params: { id } })}
        />
      }
    >
      <FlatList
        data={ferments.data}
        keyExtractor={(ferment) => ferment.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={ferments.refreshing}
            onRefresh={ferments.refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={<CachedNote cachedAt={ferments.cachedAt} error={ferments.error} onRetry={ferments.refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="title">{t.ferment.listEmptyTitle}</AppText>
            <AppText muted style={styles.emptyText}>
              {t.ferment.listEmptyText}
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const isRunning = item.id === running?.id;
          const end = item.endedAt ?? now.toISOString();
          const days = Math.floor(elapsedDays(item.startedAt, end)) + 1;
          const count = entriesInFerment(timeline, item, now).length;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${isRunning ? t.ferment.running : t.ferment.endedOn(formatDate(item.endedAt ?? item.startedAt))}`}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: isRunning ? colors.primary : colors.border,
                  borderWidth: isRunning ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.titleRow}>
                <AppText variant="title" numberOfLines={1} style={styles.name}>
                  {item.name}
                </AppText>
                {isRunning ? (
                  <AppText style={{ fontFamily: fonts.bodyBold, color: colors.primary }}>
                    {t.ferment.runningLine('', fermentDay(item.startedAt, now)).replace(/^ · /, '')}
                  </AppText>
                ) : null}
              </View>
              <AppText muted>
                {t.ferment.startedOn(formatDate(item.startedAt))}
                {item.endedAt ? ` · ${t.ferment.endedOn(formatDate(item.endedAt))}` : ` · ${t.ferment.running}`}
              </AppText>
              <AppText muted variant="caption">
                {t.ferment.dayCount(days)} · {t.ferment.entryCount(count)}
              </AppText>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.md, flexGrow: 1 },
  card: { minHeight: 88, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  name: { flexShrink: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { textAlign: 'center' },
});
