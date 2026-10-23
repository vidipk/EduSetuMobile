import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { BellOff, BellRing, ClipboardCheck, Megaphone, Info } from 'lucide-react-native';

import { learningApi } from '@/api/academics/learning';
import { normalizeApiError } from '@/api/client/error';
import type { NotificationRecord } from '@/api/contracts/learning';

import { VSegment, VStrip } from './blocks';
import { VEmpty, VError, VHeader, VLoading, VPill, VScreen, VSectionHeader, VText } from './components';
import { useUnreadNotices } from './unread-store';
import { vColors, vRadius, vShadow } from './tokens';

type Filter = 'all' | 'unread';

export const CATEGORY: Record<NotificationRecord['type'], { label: string; tone: 'mint' | 'amber' | 'blue' | 'danger'; Icon: typeof Info }> = {
  NOTICE: { label: 'Official notice', tone: 'mint', Icon: Megaphone },
  ACADEMIC: { label: 'Academic update', tone: 'blue', Icon: ClipboardCheck },
  REMINDER: { label: 'Reminder', tone: 'amber', Icon: BellRing },
  ALERT: { label: 'Alert', tone: 'danger', Icon: Info },
  SYSTEM: { label: 'System', tone: 'blue', Icon: Info },
  BILLING: { label: 'Account', tone: 'blue', Icon: Info },
};

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Splits into "Recent" (last 7 days) and "Earlier" purely by the server's createdAt. */
export function groupByRecency(items: NotificationRecord[], now = Date.now()) {
  const recent: NotificationRecord[] = [];
  const earlier: NotificationRecord[] = [];
  for (const item of items) (now - new Date(item.createdAt).getTime() <= WEEK ? recent : earlier).push(item);
  return { recent, earlier };
}

/** Figma "Notifications": real /notifications feed with server-side read state. Official notices are labelled separately. */
export function VeralayamNotifications() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [state, setState] = useState<{ loading: boolean; more: boolean; refreshing: boolean; error: string | null }>({ loading: true, more: false, refreshing: false, error: null });
  const [actionError, setActionError] = useState<string | null>(null);
  const unread = useUnreadNotices((s) => s.count);
  const setUnread = useUnreadNotices((s) => s.setCount);
  const loadUnread = useUnreadNotices((s) => s.load);

  const load = useCallback(async (page: number, mode: 'replace' | 'more' | 'refresh') => {
    setState((current) => ({ ...current, loading: mode === 'replace', more: mode === 'more', refreshing: mode === 'refresh', error: null }));
    try {
      const result = await learningApi.notifications(page, 20, filter === 'unread' ? false : undefined);
      setItems((current) => (mode === 'more' ? [...current, ...result.items] : result.items));
      setMeta({ page: result.meta.page, totalPages: result.meta.totalPages, total: result.meta.total });
      setState({ loading: false, more: false, refreshing: false, error: null });
    } catch (error) {
      setState({ loading: false, more: false, refreshing: false, error: normalizeApiError(error).message });
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(1, 'replace'); void loadUnread(); }, 0);
    return () => clearTimeout(timer);
  }, [load, loadUnread]);

  const markRead = async (item: NotificationRecord) => {
    if (item.isRead) return;
    setActionError(null);
    try {
      await learningApi.markNotificationRead(item.id);
      setItems((current) => (filter === 'unread' ? current.filter((entry) => entry.id !== item.id) : current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))));
      setUnread(unread - 1);
    } catch (error) {
      setActionError(normalizeApiError(error).message);
    }
  };

  const markAll = async () => {
    setActionError(null);
    try {
      await learningApi.markAllNotificationsRead();
      setItems((current) => (filter === 'unread' ? [] : current.map((entry) => ({ ...entry, isRead: true }))));
      setUnread(0);
    } catch (error) {
      setActionError(normalizeApiError(error).message);
    }
  };

  const groups = useMemo(() => groupByRecency(items), [items]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(student)/(tabs)' as Href));

  return (
    <VScreen onRefresh={() => void load(1, 'refresh')} refreshing={state.refreshing}>
      <VHeader bell={false} onBack={back} eyebrow="Your activity" title="Notifications" subtitle="Updates from your learning space." />
      <VSegment<Filter>
        value={filter}
        onChange={setFilter}
        options={[{ id: 'all', label: 'All updates', count: filter === 'all' ? meta.total : undefined }, { id: 'unread', label: 'Unread', count: unread }]}
      />
      {state.loading ? <VLoading label="Loading notifications" /> : null}
      {!state.loading && state.error ? <VError message={state.error} onRetry={() => void load(1, 'replace')} /> : null}
      {actionError ? <VStrip Icon={Info} tone="amber" text={actionError} /> : null}
      {!state.loading && !state.error && items.length === 0 ? <VEmpty Icon={BellOff} title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'} detail={filter === 'unread' ? 'There is nothing unread.' : 'Notices and updates from your school appear here.'} /> : null}
      {!state.loading && items.length > 0 ? (
        <>
          <Section title="Recent" items={groups.recent} onOpen={(item) => void markRead(item)} trailing={unread > 0 ? 'Mark all as read' : undefined} onTrailing={() => void markAll()} />
          <Section title="Earlier" items={groups.earlier} onOpen={(item) => void markRead(item)} />
          {meta.page < meta.totalPages ? (
            <Pressable accessibilityRole="button" onPress={() => void load(meta.page + 1, 'more')} style={styles.more}>
              <VText weight="bold" style={{ color: vColors.primary }}>{state.more ? 'Loading…' : 'Load more'}</VText>
            </Pressable>
          ) : null}
        </>
      ) : null}
      <VStrip Icon={Info} text="Alerts appear in the app only. Phone push alerts are not enabled yet." />
    </VScreen>
  );
}

function Section({ title, items, onOpen, trailing, onTrailing }: { title: string; items: NotificationRecord[]; onOpen: (item: NotificationRecord) => void; trailing?: string; onTrailing?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <VSectionHeader title={title} />
        {trailing ? <Pressable accessibilityRole="button" onPress={onTrailing} hitSlop={8}><VText weight="bold" style={styles.markAll}>{trailing}</VText></Pressable> : null}
      </View>
      {items.map((item) => {
        const category = CATEGORY[item.type] ?? CATEGORY.SYSTEM;
        const open = expanded === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${category.label}: ${item.title}${item.isRead ? '' : ', unread'}`}
            onPress={() => { setExpanded(open ? null : item.id); onOpen(item); }}
            style={styles.card}
          >
            <View style={[styles.accent, { backgroundColor: item.isRead ? vColors.border : vColors.primary }]} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.top}>
                <VPill label={category.label} tone={category.tone} />
                {!item.isRead ? <View style={styles.dot} /> : null}
              </View>
              <VText weight="bold" style={{ fontSize: 16, lineHeight: 22 }}>{item.title}</VText>
              <VText numberOfLines={open ? undefined : 2} style={{ color: vColors.muted, fontSize: 13, lineHeight: 19 }}>{item.message}</VText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  markAll: { color: vColors.primary, fontSize: 12 },
  card: { backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: vRadius.card, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', padding: 14, paddingLeft: 18, ...vShadow },
  accent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  dot: { backgroundColor: vColors.primary, borderRadius: 4, height: 8, width: 8 },
  more: { alignItems: 'center', backgroundColor: vColors.surface, borderColor: vColors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 44 },
});
