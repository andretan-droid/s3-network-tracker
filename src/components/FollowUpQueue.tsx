import type { Contact } from '../types';
import { FREQUENCY_DAYS, computeTier, TIER_LABELS } from '../types';

interface Props {
  contacts: Contact[];
  onMarkTouched: (id: string) => void;
}

function isDue(c: Contact): boolean {
  if (!c.frequency) return false;
  if (!c.lastTouched) return true;
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  return days >= FREQUENCY_DAYS[c.frequency];
}

function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

const tierColors: Record<string, string> = {
  tier_1_inner_circle: 'var(--client)',
  tier_2_strategic: 'var(--capital)',
  tier_3_dormant: 'var(--text-muted)',
};

export default function FollowUpQueue({ contacts, onMarkTouched }: Props) {
  const due = [...contacts]
    .filter(isDue)
    .sort((a, b) => {
      const order: Record<string, number> = { hot: 0, warm: 1, cold: 2, '': 3 };
      if ((order[a.heat] ?? 3) !== (order[b.heat] ?? 3)) return (order[a.heat] ?? 3) - (order[b.heat] ?? 3);
      const tierOrder = { tier_2_strategic: 0, tier_1_inner_circle: 1, tier_3_dormant: 2 };
      return tierOrder[computeTier(a)] - tierOrder[computeTier(b)];
    });

  const decayingTier2 = due.filter(c => computeTier(c) === 'tier_2_strategic' || computeTier(c) === 'tier_3_dormant');

  if (!due.length) {
    return (
      <div className="followup-empty">
        <div className="followup-empty-icon">&#10003;</div>
        <h3>All caught up</h3>
        <p>No follow-ups due. Your relationship maintenance is on track.</p>
      </div>
    );
  }

  return (
    <div className="followup-wrap">
      <div className="followup-header">
        <h2>Follow-up Queue</h2>
      </div>

      <div className="followup-stats">
        <span className="followup-stat">
          <span className="followup-stat-val" style={{ color: 'var(--hot)' }}>
            {due.filter(c => c.heat === 'hot').length}
          </span> hot
        </span>
        <span className="followup-stat">
          <span className="followup-stat-val" style={{ color: 'var(--warm)' }}>
            {due.filter(c => c.heat === 'warm').length}
          </span> warm
        </span>
        <span className="followup-stat">
          <span className="followup-stat-val" style={{ color: 'var(--cold)' }}>
            {due.filter(c => c.heat === 'cold').length}
          </span> cold
        </span>
        <span className="followup-stat-total">{due.length} total due</span>
      </div>

      <div className="followup-list">
        {due.map(c => {
          const urgency = c.heat === 'hot' ? 'hot' : c.heat === 'warm' ? 'warm' : 'cold';
          const days = daysSince(c.lastTouched);
          const tier = computeTier(c);

          return (
            <div key={c.id} className="followup-item">
              <div className={`urgency-bar urgency-${urgency}`} />
              <div className="followup-text">
                <div className="followup-name">
                  {c.name}
                  <span className="followup-company"> · {c.company}</span>
                </div>
                <div className="followup-sub">
                  <span className="followup-tier" style={{ color: tierColors[tier] }}>
                    {TIER_LABELS[tier]}
                  </span>
                  {c.type === 'client' && <span className="followup-type-tag client">Client</span>}
                  {c.type === 'capital_provider' && <span className="followup-type-tag capital">Capital</span>}
                  {c.owners && <span className="followup-owner">by {c.owners}</span>}
                  {c.notes ? ` · ${c.notes.substring(0, 40)}${c.notes.length > 40 ? '…' : ''}` : ''}
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
                  <a href={`mailto:${c.email}`} className="followup-email">Email</a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
