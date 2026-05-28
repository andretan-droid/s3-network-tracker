import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';
import type { ReactNode } from 'react';

interface SyncState {
  /** Number of writes currently in flight to Excel. */
  pending: number;
  /** Timestamp of the most recently completed successful write. */
  lastWrite: Date | null;
  /** Most recent write error, if the latest write failed. Cleared on next success. */
  lastWriteError: string | null;
  /**
   * Wraps a mutation promise so the provider can track in-flight count and
   * record the last successful/failed write. Re-throws any error so callers
   * can still toast or surface it.
   */
  track: <T>(promise: Promise<T>) => Promise<T>;
}

const SyncStateContext = createContext<SyncState | null>(null);

export function useSyncState(): SyncState {
  const ctx = useContext(SyncStateContext);
  if (!ctx) throw new Error('useSyncState must be used within SyncStateProvider');
  return ctx;
}

export function SyncStateProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const [lastWrite, setLastWrite] = useState<Date | null>(null);
  const [lastWriteError, setLastWriteError] = useState<string | null>(null);

  // Ref-based counter avoids stale closures when many writes overlap.
  const counterRef = useRef(0);

  const track = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    counterRef.current += 1;
    setPending(counterRef.current);

    return promise
      .then(result => {
        setLastWrite(new Date());
        setLastWriteError(null);
        return result;
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        setLastWriteError(msg);
        throw err;
      })
      .finally(() => {
        counterRef.current = Math.max(0, counterRef.current - 1);
        setPending(counterRef.current);
      });
  }, []);

  return (
    <SyncStateContext.Provider value={{ pending, lastWrite, lastWriteError, track }}>
      {children}
    </SyncStateContext.Provider>
  );
}
