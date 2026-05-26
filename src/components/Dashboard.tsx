import type { Contact, Interaction, RelationshipTier, ContactType } from '../types';
import { computeTier, isDue, TIER_LABELS, TIER_DESCRIPTIONS } from '../types';

interface Props {
  contacts: Contact[];
  interactions: Interaction[];
  staffView: string;
}

function HealthGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? 'var(--client)' : score >= 50 ? 'var(--warm)' : 'var(--hot)';
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="health-gauge">
      <div className="gauge-ring">
        <svg viewBox="0 0 120 120" className="gauge-svg">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-alt)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="gauge-value" style={{ color }}>{score}</div>
      </div>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 60;
  const innerR = 38;
  let cumulative = 0;

  const slices = data
    .filter(d => d.count > 0)
    .map(d => {
      const startAngle = (cumulative / total) * 360;
      cumulative += d.count;
      const endAngle = (cumulative / total) * 360;
      return { ...d, startAngle, endAngle };
    });

  function describeArc(startDeg: number, endDeg: number, rOuter: number, rInner: number): string {
    const startRad = ((startDeg - 90) * Math.PI) / 180;
    const endRad = ((endDeg - 90) * Math.PI) / 180;
    const x1o = cx + rOuter * Math.cos(startRad);
    const y1o = cy + rOuter * Math.sin(startRad);
    const x2o = cx + rOuter * Math.cos(endRad);
    const y2o = cy + rOuter * Math.sin(endRad);
    const x1i = cx + rInner * Math.cos(endRad);
    const y1i = cy + rInner * Math.sin(endRad);
    const x2i = cx + rInner * Math.cos(startRad);
    const y2i = cy + rInner * Math.sin(startRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${x1o} ${y1o}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      'Z',
    ].join(' ');
  }

  return (
    <div className="donut-chart-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {slices.map((s, i) => {
          // For a single slice spanning 360, render a full circle
          if (s.endAngle - s.startAngle >= 359.99) {
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={outerR} fill={s.color} />
                <circle cx={cx} cy={cy} r={innerR} fill="var(--surface)" />
              </g>
            );
          }
          return (
            <path
              key={i}
              d={describeArc(s.startAngle, s.endAngle, outerR, innerR)}
              fill={s.color}
              opacity={0.85}
            />
          );
        })}
        {/* center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10" letterSpacing="0.04em" style={{ textTransform: 'uppercase' }}>
          total
        </text>
      </svg>
      <div className="donut-legend">
        {data.map(d => (
          <div key={d.label} className="donut-legend-row">
            <div className="donut-legend-dot" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-count" style={{ color: d.color }}>{d.count}</span>
          </div>
        ))}
      </div>
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
      </div>

      {/* Quick Stats Cards */}
      <div className="dash-quick-stats">
        <div className="quick-stat">
          <span className="quick-stat-value">{contacts.length}</span>
          <span className="quick-stat-label">Contacts</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value alert">{due.length}</span>
          <span className="quick-stat-label">Due for touch</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value">{recentInteractions.length}</span>
          <span className="quick-stat-label">Touches this week</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value">{newThisMonth.length}</span>
          <span className="quick-stat-label">Added this month</span>
        </div>
      </div>

      {/* Health + Network Balance Row */}
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
          <h3 className="dash-card-title">Network Composition</h3>
          <p className="dash-card-desc">
            The structural hole exists between clients who need capital/advisory and
            providers who need deal flow. An imbalanced network weakens your brokerage position.
          </p>
          <DonutChart
            data={typeBreakdown.map(t => ({ label: t.label, count: t.count, color: t.color }))}
          />
          <BalanceMeter clients={clients.length} capital={capital.length} />
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
