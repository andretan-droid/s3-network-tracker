import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchInteractions } from '../services/excelService';
import type { Interaction } from '../types';

export function useInteractions(pollInterval = 60_000) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchInteractions();
      if (mountedRef.current) setInteractions(data);
    } catch {
      // silent fail for interactions; contacts are primary
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const timer = setInterval(() => load(true), pollInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [load, pollInterval]);

  return { interactions, loading, refresh: load };
}
