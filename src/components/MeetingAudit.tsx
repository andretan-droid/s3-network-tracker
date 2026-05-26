import type { Interaction, MeetingCategory } from '../types';

interface Props {
  interactions: Interaction[];
}

const categoryColors: Record<MeetingCategory, string> = {
  client_side: 'var(--client)',
  capital_side: 'var(--capital)',
  neither: 'var(--text-faint)',
  internal: 'var(--partner)',
};

const categoryLabels: Record<MeetingCategory, string> = {
  client_side: 'Client-side',
  capital_side: 'Capital-side',
  neither: 'Neither',
  internal: 'Internal',
};

const categoryBadge: Record<MeetingCategory, string> = {
  client_side: 'badge-client',
  capital_side: 'badge-capital',
  neither: 'badge-unclassified',
  internal: 'badge-partner',
};

export default function MeetingAudit({ interactions }: Props) {
  const meetings = interactions.filter(i => i.type === 'meeting' || i.type === 'event');

  const counts: Record<MeetingCategory, number> = {
    client_side: 0,
    capital_side: 0,
    neither: 0,
    internal: 0,
  };
  meetings.forEach(m => { counts[m.category] = (counts[m.category] || 0) + 1; });

  const total = meetings.length || 1;

  const sorted = [...meetings].sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const clientPct = Math.round((counts.client_side / total) * 100);
  const capitalPct = Math.round((counts.capital_side / total) * 100);
  const structuralHolePct = clientPct + capitalPct;

  return (
    <div className="audit-wrap">
      <h2>Meeting Audit</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Every meeting should be evaluated against whether it advances the firm across the structural
        hole. This view shows how your interactions break down.
      </p>

      {meetings.length === 0 ? (
        <div className="empty">
          No interactions logged yet. Use "Mark touched" on contacts to start tracking.
        </div>
      ) : (
        <>
          {/* Stacked bar chart */}
          <div className="audit-chart">
            {(['client_side', 'capital_side', 'neither', 'internal'] as MeetingCategory[]).map(cat => {
              const pct = (counts[cat] / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={cat}
                  className={`audit-bar ${cat.replace('_', '-')}`}
                  style={{ width: `${pct}%` }}
                >
                  {pct >= 10 ? `${Math.round(pct)}%` : ''}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="audit-legend">
            {(['client_side', 'capital_side', 'neither', 'internal'] as MeetingCategory[]).map(cat => (
              <div key={cat} className="legend-item">
                <div className="legend-dot" style={{ background: categoryColors[cat] }} />
                {categoryLabels[cat]}: {counts[cat]} ({Math.round((counts[cat] / total) * 100)}%)
              </div>
            ))}
          </div>

          {/* Strategic assessment */}
          <div
            className="imbalance-warning"
            style={{
              marginBottom: 20,
              background: structuralHolePct >= 60 ? 'var(--client-bg)' : '#fff8f0',
              borderColor: structuralHolePct >= 60 ? '#b0dcc8' : '#f0d8b0',
              color: structuralHolePct >= 60 ? 'var(--client)' : '#8a5a00',
            }}
          >
            <strong>{structuralHolePct}% of meetings</strong> advance the structural hole
            (client-side + capital-side).
            {structuralHolePct < 50 && (
              <> This is below the recommended threshold. Re-evaluate your meeting allocation.</>
            )}
            {structuralHolePct >= 50 && structuralHolePct < 75 && (
              <> Good progress — keep pushing more meetings toward client and capital conversations.</>
            )}
            {structuralHolePct >= 75 && <> Excellent strategic focus.</>}
          </div>

          {/* Recent interactions list */}
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
            Recent interactions ({sorted.length})
          </h3>
          <div className="audit-list">
            {sorted.slice(0, 50).map(i => (
              <div key={i.id} className="audit-row">
                <span className={`badge ${categoryBadge[i.category]}`}>
                  {categoryLabels[i.category]}
                </span>
                <span className="audit-row-name">{i.notes || 'Touch logged'}</span>
                <span className="audit-row-by">{i.loggedBy}</span>
                <span className="audit-row-date">{i.date}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
