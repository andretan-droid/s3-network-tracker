import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from './ui/icons';
import { useSyncState } from './ui';

interface Props {
  /** Timestamp of the last successful READ from Excel (polling-driven). */
  lastSync: Date | null;
  /** Error from the read side (Graph fetch failures). */
  error: string | null;
  onRefresh: () => void;
}

/**
 * Top-of-main status strip. Three signals merged into one persistent indicator:
 *
 *   READ side  → lastSync (when did we last pull from NetworkTracker.xlsx?)
 *   WRITE side → pending count + lastWrite (from SyncStateProvider)
 *   ERROR     → either side's error surfaces inline (no truncation)
 *
 * Visual states (in priority order):
 *   1. WRITE in flight   → "Writing N changes to NetworkTracker.xlsx..."
 *   2. WRITE just done   → "Saved to NetworkTracker.xlsx just now"  (5s green pulse)
 *   3. WRITE failed      → "Save failed: {full message}"             (red)
 *   4. READ error        → "Sync error: {full message}"              (red)
 *   5. READ stale (>5m)  → "Last synced X ago — try refreshing"      (warn)
 *   6. Idle              → "Synced X ago with NetworkTracker.xlsx"   (ok)
 */
export default function SyncStatus({ lastSync, error, onRefresh }: Props) {
  const { pending, lastWrite, lastWriteError } = useSyncState();

  // Tick every 5s so "X seconds ago" stays current and the "just saved" pulse
  // is reliably cleared.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  // ── Pick the dominant state ─────────────────────────────────────
  let tone: 'ok' | 'warn' | 'error' | 'writing' | 'saved';
  let label: string;
  let Icon: typeof CheckCircle2;

  const writeElapsed = lastWrite ? Date.now() - lastWrite.getTime() : null;
  const readElapsed = lastSync ? Date.now() - lastSync.getTime() : null;
  const justSaved = writeElapsed !== null && writeElapsed < 5_000;
  const readStale = readElapsed !== null && readElapsed > 5 * 60_000;

  if (pending > 0) {
    tone = 'writing';
    Icon = Loader2;
    label = pending === 1
      ? 'Writing 1 change to NetworkTracker.xlsx...'
      : `Writing ${pending} changes to NetworkTracker.xlsx...`;
  } else if (lastWriteError) {
    tone = 'error';
    Icon = AlertTriangle;
    label = `Save failed: ${lastWriteError}`;
  } else if (justSaved) {
    tone = 'saved';
    Icon = CheckCircle2;
    label = 'Saved to NetworkTracker.xlsx · just now';
  } else if (error) {
    tone = 'error';
    Icon = AlertTriangle;
    label = `Sync error: ${error}`;
  } else if (readElapsed === null) {
    tone = 'ok';
    Icon = Loader2;
    label = 'Connecting to the shared NetworkTracker workbook...';
  } else if (readStale) {
    tone = 'warn';
    Icon = AlertTriangle;
    const mins = Math.round(readElapsed / 60_000);
    label = `Last synced ${mins} minute${mins === 1 ? '' : 's'} ago — try refreshing`;
  } else {
    tone = 'ok';
    Icon = CheckCircle2;
    if (readElapsed < 60_000) {
      label = 'Synced just now with NetworkTracker.xlsx';
    } else {
      const mins = Math.round(readElapsed / 60_000);
      label = `Synced ${mins} minute${mins === 1 ? '' : 's'} ago with NetworkTracker.xlsx`;
    }
  }

  // Show the pending-count suffix when there are extra writes queued behind
  // the dominant one (rare but useful during bulk operations).
  const showSuffix = pending > 0 && tone === 'writing';

  return (
    <div
      className={`sync-strip sync-strip--${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className={`sync-strip__icon ${tone === 'writing' ? 'sync-strip__icon--spin' : ''}`} aria-hidden>
        <Icon />
      </span>
      <span className="sync-strip__label" title={label}>
        {label}
      </span>
      {showSuffix && (
        <span className="sync-strip__suffix">
          {pending} pending write{pending === 1 ? '' : 's'}
        </span>
      )}
      <button
        className="sync-strip__btn"
        onClick={onRefresh}
        aria-label="Refresh from Excel"
        disabled={pending > 0}
      >
        <RefreshCw />
        <span>Refresh</span>
      </button>
    </div>
  );
}
