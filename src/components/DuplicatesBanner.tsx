import type { Contact } from '../types';
import { findDuplicates } from '../types';

interface Props {
  contacts: Contact[];
  onEdit: (id: string) => void;
}

export default function DuplicatesBanner({ contacts, onEdit }: Props) {
  const dupes = findDuplicates(contacts);
  if (dupes.size === 0) return null;

  const totalDupes = [...dupes.values()].reduce((sum, group) => sum + group.length, 0);

  return (
    <div className="dupes-banner">
      <div className="dupes-header">
        <strong>{dupes.size} potential duplicate{dupes.size > 1 ? 's' : ''} detected</strong>
        <span className="dupes-sub">
          {totalDupes} contacts may be the same person across different owners.
          Merge them by editing one and combining the owners field (e.g. "Ravi, Philip").
        </span>
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
