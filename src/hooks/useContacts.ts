import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchContacts } from '../services/excelService';
import type { Contact } from '../types';

export function useContacts(pollInterval = 60_000) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchContacts();
      if (mountedRef.current) {
        setContacts(data);
        setLastSync(new Date());
      }
    } catch (e: any) {
      if (mountedRef.current) setError(e.message || 'Failed to load contacts');
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

  const refresh = useCallback(() => load(), [load]);

  return { contacts, loading, error, lastSync, refresh, setContacts };
}
