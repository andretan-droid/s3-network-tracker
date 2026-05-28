import { useState } from 'react';
import type { Contact } from '../types';
import { findDuplicates } from '../types';
import { Button, useDialog } from './ui';

interface Props {
  contacts: Contact[];
  onEdit: (id: string) => void;
  onMergeAll: () => Promise<void>;
}

export default function DuplicatesBanner({ contacts, onEdit, onMergeAll }: Props) {
  const [merging, setMerging] = useState(false);
  const dialog = useDialog();
  const dupes = findDuplicates(contacts);
  if (dupes.size === 0) return null;

  const totalDupes = [...dupes.values()].reduce((sum, group) => sum + group.length, 0);

  const handleMerge = async () => {
    const ok = await dialog.confirm({
      title: `Merge ${dupes.size} duplicate group${dupes.size > 1 ? 's' : ''}?`,
      body: (
        <>
          This will merge <strong>{totalDupes}</strong> contacts into <strong>{dupes.size}</strong>{' '}
          unique entries, combining their owners. The change writes directly to the shared
          NetworkTracker Excel workbook and cannot be undone.
        </>
      ),
      confirmLabel: 'Merge duplicates',
      cancelLabel: 'Cancel',
      tone: 'warn',
    });
    if (!ok) return;
    setMerging(true);
    try {
      await onMergeAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await dialog.alert({
        title: 'Merge failed',
        body: `The Excel workbook did not accept the bulk write: ${msg}`,
        tone: 'danger',
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="dupes-banner">
      <div className="dupes-header">
        <div style={{ flex: 1 }}>
          <strong>{dupes.size} potential duplicate{dupes.size > 1 ? 's' : ''} detected</strong>
          <span className="dupes-sub">
            {totalDupes} contacts may be the same person across different owners.
            Merge them to combine owners into one record (e.g. "Ravi, Philip").
          </span>
        </div>
        <Button
          variant="primary"
          loading={merging}
          onClick={handleMerge}
        >
          {merging ? 'Merging' : `Merge all ${dupes.size}`}
        </Button>
      </div>
      <div className="dupes-list">
        {[...dupes.entries()].slice(0, 10).map(([key, group]) => (
          <div key={key} className="dupes-group">
            <span className="dupes-name">{group[0].name}</span>
            <div className="dupes-owners">
              {group.map(c => (
                <button key={c.id} className="dupes-owner-btn" onClick={() => onEdit(c.id)}>
                  {c.owners || 'Unknown'} · {c.company}
                </button>
              ))}
            </div>
          </div>
        ))}
        {dupes.size > 10 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            +{dupes.size - 10} more duplicates
          </span>
        )}
      </div>
    </div>
  );
}
