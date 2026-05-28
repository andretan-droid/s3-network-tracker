import type { Contact } from '../types';
import { FREQUENCY_DAYS } from '../types';
import { Check, Mail } from './ui/icons';

interface Props {
  contacts: Contact[];
  onMarkTouched: (id: string) => void;
}

function isDue(c: Contact): boolean {
  if (!c.lastTouched) return true;
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  return days >= FREQUENCY_DAYS[c.frequency];
}

function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export default function FollowUpQueue({ contacts, onMarkTouched }: Props) {
  const due = contacts.filter(isDue);

  if (!due.length) {
    return <div className="empty">No follow-ups due. You're all caught up.</div>;
  }

  // Group by company, alphabetically
  const grouped = due.reduce<Record<string, Contact[]>>((acc, c) => {
    const org = c.company?.trim() || 'Unspecified';
    if (!acc[org]) acc[org] = [];
    acc[org].push(c);
    return acc;
  }, {});

  const sortedOrgs = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="followup-list">
      {sortedOrgs.map(org => (
        <div key={org} className="followup-group">
          <div className="followup-group-header">
            {org}
            <span className="followup-group-count">{grouped[org].length}</span>
          </div>
          {grouped[org].map(c => {
            const days = daysSince(c.lastTouched);
            return (
              <div key={c.id} className="followup-item">
                <div className="urgency-bar urgency-cold" />
                <div className="followup-text">
                  <div className="followup-name">{c.name}</div>
                  <div className="followup-sub">
                    {c.position || 'Routine check-in'}
                    {c.notes ? ` · ${c.notes.substring(0, 50)}${c.notes.length > 50 ? '…' : ''}` : ''}
                  </div>
                </div>
                <div className="followup-right">
                  <span className="followup-days">
                    {days === null ? 'Never contacted' : `${days}d since last touch`}
                  </span>
                  <button className="touch-btn" onClick={() => onMarkTouched(c.id)}>
                    <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Mark touched
                  </button>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="followup-email">
                      <Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Send email
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
