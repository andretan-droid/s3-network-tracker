import { useNavigate } from 'react-router-dom';
import type { Contact, Interaction, RelationshipTier, ContactType } from '../types';
import { computeTier, isDue, TIER_LABELS, TIER_DESCRIPTIONS } from '../types';
import { Card, Disclosure } from './ui';
import { Clock, Flag, Users, ChevronRight } from './ui/icons';

interface Props {
  contacts: Contact[];
  interactions: Interaction[];
  staffView: string;
}

/* ────────────────────────────────────────────────────────────
   "This week" hero — three high-leverage actions
   ──────────────────────────────────────────────────────────── */

interface HeroCardProps {
  value: number;
  label: string;
  cta: string;
  tone: 'alert' | 'warn' | 'ok';
  icon: React.ReactNode;
  onClick?: () => void;
}

function HeroCard({ value, label, cta, tone, icon, onClick }: HeroCardProps) {
  return (
    <button
      type="button"
      className={`this-week-card this-week-card--${tone}`}
      onClick={onClick}
      disabled={!onClick || value === 0}
    >
      <span className="this-week-card__value">{value}</span>
      <span className="this-week-card__label">{label}</span>
      <span className="this-week-card__cta">
        {value === 0 ? 'All caught up' : cta} {value > 0 && <ChevronRight />}
      </span>
      <span aria-hidden style={{
        position: 'absolute', top: 14, right: 14,
        color: 'var(--text-faint)', opacity: 0.4,
        display: 'inline-flex',
      }}>
        {icon}
      </span>
    </button>
  );
}

function ThisWeekHero({
  due, recentTouches, unclassified,
}: {
  due: number;
  recentTouches: number;
  unclassified: number;
}) {
  const navigate = useNavigate();
  return (
    <section className="this-week-hero">
      <div>
        <div className="this-week-hero__title">This week</div>
        <div className="this-week-hero__sub">
          The highest-leverage actions on your network right now.
        </div>
      </div>
      <div className="this-week-grid">
        <HeroCard
          value={due}
          label={`Contact${due === 1 ? '' : 's'} due for touch`}
          cta="Open follow-up queue"
          tone="alert"
          icon={<Clock size={20} />}
          onClick={() => navigate('/follow-ups')}
        />
        <HeroCard
          value={recentTouches}
          label="Meetings logged in the last 7 days"
          cta="Log another"
          tone="ok"
          icon={<Flag size={20} />}
          onClick={() => navigate('/audit')}
        />
        <HeroCard
          value={unclassified}
          label="Contacts need classification"
          cta="Classify in Contacts"
          tone={unclassified > 5 ? 'warn' : 'ok'}
          icon={<Users size={20} />}
          onClick={() => navigate('/contacts')}
        />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Composite health gauge — one big ring + 3 sub-bars
   ──────────────────────────────────────────────────────────── */

function PrimaryGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? 'var(--accent)' : score >= 50 ? 'var(--warm)' : 'var(--hot)';
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="health-gauge">
      <div className="gauge-ring">
        <svg viewBox="0 0 120 120" className="gauge-svg">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-alt)" strokeWidth="9" />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
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

function HealthSub({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="health-sub">
      <div className="health-sub__row">
        <span className="health-sub__label">{label}</span>
        <span className="health-sub__value">{value}</span>
      </div>
      <div className="health-sub__track">
        <div className="health-sub__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="health-sub__hint">{hint}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Donut + balance meter (unchanged from previous migration)
   ──────────────────────────────────────────────────────────── */

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
              opacity={0.92}
            />
          );
        })}
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
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
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

/* ────────────────────────────────────────────────────────────
   Dashboard
   ──────────────────────────────────────────────────────────── */

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

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const recentInteractions = interactions.filter(i => new Date(i.date).getTime() > sevenDaysAgo);

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
          <h2 className="dash-title">{viewLabel} Dashboard</h2>
          <p className="dash-subtitle">
            Live view of relationship coverage, network balance, and meeting discipline,
            sourced from the shared NetworkTracker workbook.
          </p>
        </div>
      </div>

      {/* "This week" hero */}
      <ThisWeekHero
        due={due.length}
        recentTouches={recentInteractions.length}
        unclassified={unclassified.length}
      />

      {/* Health + Network Composition Row */}
      <div className="dash-grid-2">
        <Card>
          <h3 className="dash-card-title">Network health</h3>
          <p className="dash-card-desc">
            Composite read on balance between client and capital sides, depth of strategic ties,
            and how much of recent meeting time advances the structural hole.
          </p>
          <div className="health-composite">
            <div className="health-composite__primary">
              <PrimaryGauge score={healthScore} label="Overall" />
            </div>
            <div className="health-composite__breakdown">
              <HealthSub
                label="Balance"
                value={balanceScore}
                hint="Closer to 50/50 between clients and capital providers is stronger."
                color="var(--client)"
              />
              <HealthSub
                label="Tier depth"
                value={tierScore}
                hint="Share of contacts in Tier 2 (Strategic) — the most valuable per network science."
                color="var(--capital)"
              />
              <HealthSub
                label="Meeting focus"
                value={shPct}
                hint="Share of recent meetings spent on the client or capital side, not internal admin."
                color="var(--accent)"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="dash-card-title">Network composition</h3>
          <p className="dash-card-desc">
            How your contact base splits across the two sides of the structural hole and supporting roles.
          </p>
          <DonutChart
            data={typeBreakdown.map(t => ({ label: t.label, count: t.count, color: t.color }))}
          />
          <BalanceMeter clients={clients.length} capital={capital.length} />
          {unclassified.length > 0 && (
            <div className="dash-alert">
              {unclassified.length} contact{unclassified.length > 1 ? 's' : ''} unclassified. Tag them as
              Client, Capital, or Partner for an accurate structural hole picture.
            </div>
          )}
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <h3 className="dash-card-title">Relationship tiers</h3>
        <p className="dash-card-desc">
          Tiers are computed from days since last touch. Strategic (Tier 2) ties — touched roughly twice
          per year — are the most valuable per network science: deep enough to call on, broad enough to bridge.
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
            ({tiers.tier_2_strategic.length}). Many relationships may be decaying. Check
            the Follow-up Queue to re-engage the most valuable ones.
          </div>
        )}
        {tiers.tier_2_strategic.length > 0 && (
          <div className="tier-2-spotlight-disclosure">
            <Disclosure
              label="Strategic relationships"
              hint={`The ${tiers.tier_2_strategic.length} Tier 2 contact${tiers.tier_2_strategic.length === 1 ? '' : 's'} most worth defending.`}
              badge={tiers.tier_2_strategic.length}
            >
              <div className="tier-2-chips">
                {tiers.tier_2_strategic.map(c => (
                  <span key={c.id} className={`chip chip-${c.type}`}>
                    {c.name}
                    <span className="chip-sub">{c.company}</span>
                  </span>
                ))}
              </div>
            </Disclosure>
          </div>
        )}
      </Card>
    </div>
  );
}
