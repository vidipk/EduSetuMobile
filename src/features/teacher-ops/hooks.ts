import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { teacherProfileApi } from '@/api/academics/teacher-ops';
import type { Paginated } from '@/api/contracts/teacher-ops';
import { useAuth } from '@/auth/AuthProvider';
import { describeError, type ErrorPresentation } from '@/features/performance/format';
import { useRemoteData } from '@/features/performance/use-remote-data';

/** The signed-in teacher's profile and real assignments (never a client-supplied teacher id). */
export function useTeacherProfile() {
  const { user } = useAuth();
  return useRemoteData(user ? `teacher-profile:${user.id}` : null, () => teacherProfileApi.get());
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: ErrorPresentation };

/**
 * Runs one mutation at a time. A second call while one is in flight is ignored
 * (returns null), so rapid taps can never submit twice.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorPresentation | null>(null);
  const lock = useRef(false);

  // `confirm` runs inside the lock, so a second tap while a dialog is open or a request is in flight is ignored.
  const run = useCallback(async <T,>(fn: () => Promise<T>, confirm?: () => Promise<boolean>): Promise<ActionResult<T> | null> => {
    if (lock.current) return null;
    lock.current = true;
    try {
      if (confirm && !(await confirm())) return null;
      setBusy(true);
      setError(null);
      return { ok: true, value: await fn() };
    } catch (caught) {
      const presented = describeError(caught);
      setError(presented);
      return { ok: false, error: presented };
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  return { busy, error, run, clearError };
}

export function confirmAction(title: string, message: string, confirmLabel: string, destructive = false) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Successive pages appended after page 1, de-duplicated by id. Extra pages are
 * bound to the exact page-1 response (and so the filter key) they belong to:
 * changing a filter or refreshing discards them, and a late page can never be
 * merged into a different list.
 */
export function useLoadMore<R extends Paginated<{ id: string }>>(first: R | null, fetchPage: (page: number) => Promise<R>) {
  type I = R['items'][number];
  const [extra, setExtra] = useState<{ first: R; items: I[]; page: number; loading: boolean; error: ErrorPresentation | null } | null>(null);
  const firstRef = useRef(first);
  const fetchRef = useRef(fetchPage);
  const busy = useRef<R | null>(null);
  useEffect(() => {
    firstRef.current = first;
    fetchRef.current = fetchPage;
  });

  const valid = extra && first && extra.first === first ? extra : null;
  const seen = new Set<string>();
  const items = ([...(first?.items ?? []), ...(valid?.items ?? [])] as I[]).filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  const page = valid?.page ?? first?.meta.page ?? 1;
  const totalPages = first?.meta.totalPages ?? 1;

  const loadMore = useCallback(async () => {
    const anchor = firstRef.current;
    if (!anchor || busy.current === anchor || page >= totalPages) return;
    busy.current = anchor;
    const requested = page + 1;
    const base = (current: typeof extra) => (current && current.first === anchor ? current : { first: anchor, items: [] as I[], page: anchor.meta.page, loading: false, error: null as ErrorPresentation | null });
    setExtra((current) => ({ ...base(current), loading: true, error: null }));
    try {
      const response = await fetchRef.current(requested);
      if (firstRef.current !== anchor) return;
      setExtra((current) => ({ ...base(current), items: [...base(current).items, ...response.items], page: requested, loading: false, error: null }));
    } catch (loadError) {
      if (firstRef.current === anchor) setExtra((current) => ({ ...base(current), loading: false, error: describeError(loadError) }));
    } finally {
      if (busy.current === anchor) busy.current = null;
    }
  }, [page, totalPages]);

  return { items, total: first?.meta.total ?? 0, hasMore: page < totalPages, loadingMore: valid?.loading ?? false, error: valid?.error ?? null, loadMore };
}
