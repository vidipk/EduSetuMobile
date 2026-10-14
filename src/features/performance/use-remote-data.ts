import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, type ErrorPresentation } from './format';

interface Snapshot<T> {
  key: string;
  data: T | null;
  error: ErrorPresentation | null;
}

/**
 * Loads data for `key` (null = do not load). Results are tied to the key they
 * were requested for: when the key changes, the previous data is hidden at once
 * and any late response for an old key is discarded. This prevents one child's
 * or filter's data from appearing under another.
 */
export function useRemoteData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;
  const tokenRef = useRef(0);

  const run = useCallback(async (requestKey: string) => {
    const token = ++tokenRef.current;
    try {
      const data = await fetcherRef.current();
      if (token !== tokenRef.current || keyRef.current !== requestKey) return;
      setSnapshot({ key: requestKey, data, error: null });
    } catch (error) {
      if (token !== tokenRef.current || keyRef.current !== requestKey) return;
      setSnapshot((current) => ({ key: requestKey, data: current?.key === requestKey ? current.data : null, error: describeError(error) }));
    }
  }, []);

  useEffect(() => {
    if (key === null) {
      tokenRef.current += 1;
      return;
    }
    void run(key);
    return () => {
      tokenRef.current += 1;
    };
  }, [key, run]);

  const current = key !== null && snapshot?.key === key ? snapshot : null;

  const reload = useCallback(() => {
    if (keyRef.current === null) return;
    setSnapshot(null);
    void run(keyRef.current);
  }, [run]);

  const refresh = useCallback(async () => {
    if (keyRef.current === null) return;
    setRefreshing(true);
    await run(keyRef.current);
    setRefreshing(false);
  }, [run]);

  return {
    data: current?.error ? current.data : (current?.data ?? null),
    error: current?.error ?? null,
    loading: key !== null && current === null,
    refreshing,
    reload,
    refresh,
  };
}
