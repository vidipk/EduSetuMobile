import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { learningApi } from '@/api/academics/learning';
import { normalizeApiError } from '@/api/client/error';
import type { StudentNotice } from '@/api/contracts/learning';
import { AppButton, AppCard, AppScreen, AppText, EmptyState, ErrorState, LoadingState } from '@/design-system/components';
import { colors, spacing } from '@/design-system/tokens';

const label = (type: string) => type.replace(/_/g, ' ').toLowerCase();
const when = (value: string | null) => (value ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '');

/** Published notices delivered to this learner, from the existing /notices/me contract. */
export function StudentNoticesScreen() {
  const [items, setItems] = useState<StudentNotice[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<{ loading: boolean; more: boolean; refreshing: boolean; error: string | null }>({ loading: true, more: false, refreshing: false, error: null });
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (target: number, mode: 'replace' | 'more' | 'refresh') => {
    setState((current) => ({ ...current, loading: mode === 'replace', more: mode === 'more', refreshing: mode === 'refresh', error: null }));
    try {
      const result = await learningApi.notices(target, 15);
      setItems((current) => (mode === 'more' ? [...current, ...result.items] : result.items));
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setState({ loading: false, more: false, refreshing: false, error: null });
    } catch (error) {
      setState({ loading: false, more: false, refreshing: false, error: normalizeApiError(error).message });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(1, 'replace'), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <AppText style={styles.eyebrow}>From your school</AppText>
        <AppText style={styles.title}>Notices</AppText>
      </View>
      {state.loading ? <LoadingState label="Loading notices..." /> : null}
      {!state.loading && state.error ? <View style={styles.gap}><ErrorState message={state.error} /><AppButton title="Try again" onPress={() => void load(1, 'replace')} /></View> : null}
      {!state.loading && !state.error && items.length === 0 ? <EmptyState title="No notices" detail="Published notices for you will appear here." /> : null}
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void load(1, 'refresh')} tintColor={colors.primary} />}>
        {items.map((notice) => (
          <Pressable key={notice.id} accessibilityRole="button" accessibilityState={{ expanded: expanded === notice.id }} onPress={() => setExpanded(expanded === notice.id ? null : notice.id)}>
            <AppCard style={styles.card}>
              <View style={styles.row}>
                <AppText style={styles.tag}>{label(notice.type)}</AppText>
                {notice.status === 'ARCHIVED' ? <AppText style={styles.muted}>Archived</AppText> : null}
              </View>
              <AppText style={styles.cardTitle}>{notice.title}</AppText>
              <AppText style={styles.muted}>{notice.createdBy.fullName} · {when(notice.publishedAt ?? notice.createdAt)}</AppText>
              <AppText numberOfLines={expanded === notice.id ? undefined : 3} style={styles.body}>{notice.body}</AppText>
            </AppCard>
          </Pressable>
        ))}
        {page < totalPages ? <AppButton title="Load more notices" loading={state.more} onPress={() => void load(page + 1, 'more')} /> : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  header: { gap: spacing.xs },
  eyebrow: { color: colors.student, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  gap: { gap: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13 },
  body: { lineHeight: 22 },
});
