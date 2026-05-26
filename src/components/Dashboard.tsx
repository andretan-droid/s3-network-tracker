import type { Contact, Interaction, RelationshipTier, ContactType } from '../types';
import { computeTier, isDue, TIER_LABELS, TIER_DESCRIPTIONS } from '../types';

interface Props {
  contacts: Contact[];
  interactions: Interaction[];
  staffView: string;
}

function HealthGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? 'var(--client)' : score >= 50 ? 'var(--warm)' : 'var(--hot)';
  return (
    <div className="health-gauge">
      <div className="gauge-ring">
        <svg viewBox="0 0 120 120" className="gauge-svg">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 327} 327`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="gauge-value" style={{ color }}>{score}</div>
      </div>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

function TierBar({ tier, count, total, color }: { tier: RelationshipTier; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="tier-bar-row">
      <div className="tier-bar-label">
        <span className="tier-bar-name">{TIER_LABELS[tier]}</span>
        <span className="tier-bar-count">{count}</span>
      </div>
      <div className="tier-bar-track">
        <div className="tier-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="tier-bar-desc">{TIER_DESCRIPTIONS[tier]}</span>
    </div>
  );
}

function BalanceMeter({ clients, capital }: { clients: number; capital: number }) {
  const total = clients + capital;
  if (total === 0) return null;
  const clientPct = (clients / total) * 100;
  const balanced = Math.abs(clientPct - 50) <= 20;
  return (
    <div className="balance-meter">
      <div className="balance-labels">
        <span style={{ color: 'var(--client)' }}>Clients ({clients})</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>
          {balanced ? 'Balanced' : clientPct > 50 ? 'Client-heavy' : 'Capital-heavy'}
        </span>
        <span style={{ color: 'var(--capital)' }}>Capital ({capital})</span>
      </div>
      <div className="balance-track">
        <div className="balance-fill-client" style={{ width: `${clientPct}%` }} />
        <div className="balance-fill-capital" style={{ width: `${100 - clientPct}%` }} />
        <div className="balance-center-mark" />
      </div>
    </div>
  );
}

export default function Dashboard({ contacts, interactions, staffView }: Props) {
  const clients = contacts.filter(c => c.type === 'client');
  const capital = contacts.filter(c => c.type === 'capital_provider');
  const partners = contacts.filter(c => c.type === 'partner');
  const educational = contacts.filter(c => c.type === 'educational');
  const unclassified = contacts.filter(c => c.type === 'unclassified');
  const due = contacts.filter(isDue);

  const tiers: Record<RelationshipTier, Contact[]> = {
    tier_1_inner_circle: [],
    tier_2_strategic: [],
    tier_3_dormant: [],
  };
  contacts.forEach(c => { tiers[computeTier(c)].push(c); });

  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const recentInteractions = interactions.filter(i => new Date(i.date).getTime() > sevenDaysAgo);
  const newThisMonth = contacts.filter(c => c.dateAdded && new Date(c.dateAdded).getTime() > thirtyDaysAgo);

  const meetingInteractions = interactions.filter(i => i.type === 'meeting' || i.type === 'event');
  const shMeetings = meetingInteractions.filter(i => i.category === 'client_side' || i.category === 'capital_side');
  const shPct = meetingInteractions.length > 0 ? Math.round((shMeetings.length / meetingInteractions.length) * 100) : 0;

  const balanceScore = (() => {
    if (clients.length === 0 && capital.length === 0) return 50;
    const ratio = clients.length / (clients.length + capital.length);
    return Math.round(100 - Math.abs(ratio - 0.5) * 200);
  })();

  const tierScore = (() => {
    if (contacts.length === 0) return 50;
    const t2Pct = tiers.tier_2_strategic.length / contacts.length;
    return Math.min(100, Math.round(t2Pct * 300));
  })();

  const healthScore = Math.round((balanceScore * 0.3 + tierScore * 0.3 + shPct * 0.4));

  const viewLabel = staffView === 'all' ? 'Firm-Wide' : staffView;

  const typeBreakdown: { type: ContactType; label: string; count: number; color: string }[] = [
    { type: 'client', label: 'Clients', count: clients.length, color: 'var(--client)' },
    { type: 'capital_provider', label: 'Capital Providers', count: capital.length, color: 'var(--capital)' },
    { type: 'partner', label: 'Partners / Referrers', count: partners.length, color: 'var(--partner)' },
    { type: 'educational', label: 'Educational', count: educational.length, color: 'var(--educational)' },
    { type: 'unclassified', label: 'Unclassified', count: unclassified.length, color: 'var(--text-muted)' },
  ];

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h2 className="dash-title">{viewLabel} Network Intelligence</h2>
          <p className="dash-subtitle">
            {staffView === 'all'
              ? 'Strategic overview of Sage3 Capital\'s relationship capital across the structural hole.'
              : `${staffView}'s network contribution and relationship portfolio.`}
          </p>
        </div>
        <div className="dash-quick-stats">
          <div className="quick-stat">
            <span className="quick-stat-value">{contacts.length}</span>
            <span className="quick-stat-label">contacts</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-value alert">{due.length}</span>
            <span className="quick-stat-label">due for touch</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-value">{recentInteractions.length}</span>
            <span className="quick-stat-label">touches this week</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-value">{newThisMonth.length}</span>
            <span className="quick-stat-label">added this month</span>
          </div>
        </div>
      </div>

      {/* Health + Balance Row */}
      <div className="dash-grid-2">
        <div className="dash-card">
          <h3 className="dash-card-title">Structural Hole Health</h3>
          <p className="dash-card-desc">
            Composite score measuring how effectively the firm brokers the gap between
            clients and capital providers.
          </p>
          <div className="health-row">
            <HealthGauge score={healthScore} label="Overall" />
            <HealthGauge score={balanceScore} label="Balance" />
            <HealthGauge score={tierScore} label="Tier depth" />
            <HealthGauge score={shPct} label="Meeting focus" />
          </div>
          <p className="health-insight">
            {healthScore >= 75 && 'Excellent strategic positioning — the firm is actively bridging both sides of the hole.'}
            {healthScore >= 50 && healthScore < 75 && 'Good foundation, but there\'s room to strengthen either your contact balance, relationship depth, or meeting allocation.'}
            {healthScore < 50 && 'Action needed — review your contact mix, follow-up cadence, and meeting focus to strengthen your structural hole position.'}
          </p>
        </div>

        <div className="dash-card">
          <h3 className="dash-card-title">Network Balance</h3>
          <p className="dash-card-desc">
            The structural hole exists between clients who need capital/advisory and
            providers who need deal flow. An imbalanced network weakens your brokerage
            position.
          </p>
          <BalanceMeter clients={clients.length} capital={capital.length} />
          <div className="type-breakdown">
            {typeBreakdown.map(t => (
              <div key={t.type} className="type-row">
                <div className="type-dot" style={{ background: t.color }} />
                <span className="type-label">{t.label}</span>
                <span className="type-count" style={{ color: t.color }}>{t.count}</span>
              </div>
            ))}
          </div>
          {unclassified.length > 0 && (
            <div className="dash-alert">
              {unclassified.length} contact{unclassified.length > 1 ? 's' : ''} unclassified — tag them as
              Client, Capital, or Partner for an accurate structural hole picture.
            </div>
          )}
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="dash-card">
        <h3 className="dash-card-title">Relationship Tiers</h3>
        <p className="dash-card-desc">
          Auto-calculated from interaction history. Tier 2 (Strategic) contacts — those
          you engage roughly twice a year — are the most valuable per network science.
          They sit at the edge of your network and broker the most novel information.
          Watch for Tier 2 contacts decaying into Tier 3.
        </p>
        <div className="tier-bars">
          <TierBar
            tier="tier_1_inner_circle"
            count={tiers.tier_1_inner_circle.length}
            total={contacts.length}
            color="var(--client)"
          />
          <TierBar
            tier="tier_2_strategic"
            count={tiers.tier_2_strategic.length}
            total={contacts.length}
            color="var(--capital)"
          />
          <TierBar
            tier="tier_3_dormant"
            count={tiers.tier_3_dormant.length}
            total={contacts.length}
            color="var(--text-muted)"
          />
        </div>
        {tiers.tier_3_dormant.length > tiers.tier_2_strategic.length && tiers.tier_3_dormant.length > 5 && (
          <div className="dash-alert">
            You have more dormant contacts ({tiers.tier_3_dormant.length}) than strategic ones
            ({tiers.tier_2_strategic.length}). Many relationships may be decaying — check
            the Follow-up Queue to re-engage the most valuable ones.
          </div>
        )}
        {tiers.tier_2_strategic.length > 0 && (
          <div className="tier-2-spotlight">
            <h4>Tier 2 Spotlight — The Strategic Core</h4>
            <div className="tier-2-chips">
              {tiers.tier_2_strategic.slice(0, 12).map(c => (
                <span key={c.id} className={`chip chip-${c.type}`}>
                  {c.name}
                  <span className="chip-sub">{c.company}</span>
                </span>
              ))}
              {tiers.tier_2_strategic.length > 12 && (
                <span className="chip chip-more">+{tiers.tier_2_strategic.length - 12} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
