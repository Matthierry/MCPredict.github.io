import { useCallback, useEffect, useState } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  retry: () => void;
}

function readCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function useCachedApi<T>(url: string, cacheKey: string): ApiState<T> {
  const [data, setData] = useState<T | null>(() => readCached<T>(cacheKey));
  const [loading, setLoading] = useState(() => data === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setError(null);
      if (data !== null) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
        const payload = (await response.json()) as T;
        if (cancelled) return;
        setData(payload);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch {
          // Cache is an enhancement, not a requirement.
        }
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Request failed.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, cacheKey, requestVersion]);

  return { data, loading, refreshing, error, retry };
}
