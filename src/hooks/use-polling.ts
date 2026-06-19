"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UsePollingOptions<T> {
  /** Function that fetches the latest state. Should return null on auth errors. */
  fetcher: () => Promise<T>;
  /** Interval in ms. Default 1500. */
  intervalMs?: number;
  /** Whether polling is active. Default true. */
  enabled?: boolean;
  /** Skip the first immediate fetch (useful if parent already fetched). */
  skipInitial?: boolean;
}

/**
 * Simple polling hook — fetches data on a fixed interval.
 * Used instead of socket.io for realtime updates because the sandbox
 * proxy has issues with WebSocket upgrades.
 *
 * In production with Supabase, swap this for `supabase.channel(...).on(...)`.
 */
export function usePolling<T>({
  fetcher,
  intervalMs = 1500,
  enabled = true,
  skipInitial = false,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  const mountedRef = useRef(true);

  // Keep fetcher ref fresh without re-triggering the effect
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!skipInitial) refresh();
    const id = setInterval(refresh, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [enabled, intervalMs, skipInitial, refresh]);

  return { data, error, loading, refresh, setData };
}
