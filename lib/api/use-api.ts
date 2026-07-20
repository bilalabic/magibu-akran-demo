"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

type ApiState<T> = { data: T | null; error: string | null; loading: boolean };

// Basit veri çekme hook'u: { data, error, loading, refetch }.
// State güncellemeleri fetch tamamlandıktan sonra (async) yapılır; effect
// gövdesinde senkron setState yoktur (react-hooks/set-state-in-effect).
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: path !== null,
  });
  const requestSeq = useRef(0);
  const pathRef = useRef(path);

  const fetchData = useCallback(async (targetPath: string) => {
    const seq = ++requestSeq.current;
    try {
      const result = await apiFetch<T>(targetPath);
      if (seq === requestSeq.current) {
        setState({ data: result, error: null, loading: false });
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setState((prev) => ({
          ...prev,
          error: err instanceof ApiClientError ? err.message : "Bir hata oluştu.",
          loading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    pathRef.current = path;
    if (path === null) return;
    void fetchData(path);
  }, [path, fetchData]);

  const refetch = useCallback(async () => {
    const current = pathRef.current;
    if (current === null) return;
    setState((prev) => ({ ...prev, loading: true }));
    await fetchData(current);
  }, [fetchData]);

  return { data: state.data, error: state.error, loading: state.loading, refetch };
}
