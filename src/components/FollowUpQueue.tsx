import type { Contact } from '../types';
import { FREQUENCY_DAYS } from '../types';

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
  const due = [...contacts]
    .filter(isDue)
    .sort((a, b) => {
      const order = { hot: 0, warm: 1, cold: 2 };
      return order[a.heat] - order[b.heat];
    });

  if (!due.length) {
    return <div className="empty">No follow-ups due. You're all caught up!</div>;
  }

  return (
    <div className="followup-list">
      {due.map(c => {
        const urgency = c.heat === 'hot' ? 'hot' : c.heat === 'warm' ? 'warm' : 'cold';
        const days = daysSince(c.lastTouched);
        const reason =
          c.heat === 'hot'
            ? 'Hot lead — reach out now'
            : c.heat === 'warm'
            ? 'Warm contact, keep momentum'
            : 'Routine check-in';

        return (
          <div key={c.id} className="followup-item">
            <div className={`urgency-bar urgency-${urgency}`} />
            <div className="followup-text">
              <div className="followup-name">
                {c.name}{' '}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                  · {c.company}
                </span>
              </div>
              <div className="followup-sub">
                {reason}
                {c.notes ? ` · ${c.notes.substring(0, 50)}${c.notes.length > 50 ? '…' : ''}` : ''}
              </div>
            </div>
            <div className="followup-right">
              <span className="followup-days">
                {days === null ? 'Never contacted' : `${days}d since last touch`}
              </span>
              <button className="touch-btn" onClick={() => onMarkTouched(c.id)}>
                Mark touched
              </button>
              {c.email && (
                <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: 'var(--capital)' }}>
                  Send email
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
