import { useState } from 'react';
import type { Contact } from '../types';
import { findDuplicates } from '../types';

interface Props {
  contacts: Contact[];
  onEdit: (id: string) => void;
  onMergeAll: () => Promise<void>;
}

export default function DuplicatesBanner({ contacts, onEdit, onMergeAll }: Props) {
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState('');
  const dupes = findDuplicates(contacts);
  if (dupes.size === 0) return null;

  const totalDupes = [...dupes.values()].reduce((sum, group) => sum + group.length, 0);

  const handleMerge = async () => {
    if (!confirm(
      `This will merge ${dupes.size} duplicate groups (${totalDupes} contacts) into unique entries, ` +
      `combining their owners. This writes directly to the Excel file. Continue?`
    )) return;
    setMerging(true);
    try {
      await onMergeAll();
    } catch (e: any) {
      alert('Merge failed: ' + (e.message || e));
    } finally {
      setMerging(false);
      setProgress('');
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
        <button
          className="btn-primary"
          style={{ flexShrink: 0, background: '#8a5a00' }}
          onClick={handleMerge}
          disabled={merging}
        >
          {merging ? progress || 'Merging...' : `Merge all ${dupes.size} duplicates`}
        </button>
      </div>
      <div className="dupes-list">
        {[...dupes.entries()].slice(0, 10).map(([key, group]) => (
          <div key={key} className="dupes-group">
            <span className="dupes-name">{group[0].name}</span>
            <div className="dupes-owners">
              {group.map(c => (
                <button key={c.id} className="dupes-owner-btn" onClick={() => onEdit(c.id)}>
                  {c.owners || 'Unknown'} — {c.company}
                </button>
              ))}
            </div>
          </div>
        ))}
        {dupes.size > 10 && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            +{dupes.size - 10} more duplicates
          </span>
        )}
      </div>
    </div>
  );
}
