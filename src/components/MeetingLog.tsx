import { useMemo, useState } from 'react';
import type { Interaction, MeetingCategory } from '../types';
import { STAFF_ROSTER } from '../types';

interface Props {
  interactions: Interaction[];
}

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

const ALL_STAFF = 'all';
const ALL_CATEGORY = 'all';

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function MeetingLog({ interactions }: Props) {
  const [staffFilter, setStaffFilter] = useState(ALL_STAFF);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const all = useMemo(
    () => interactions.filter(i =>
      i.type === 'meeting' || i.type === 'event' || i.type === 'call'
    ),
    [interactions]
  );

  const filtered = useMemo(() => {
    return all.filter(i => {
      if (staffFilter !== ALL_STAFF && i.loggedBy !== staffFilter) return false;
      if (categoryFilter !== ALL_CATEGORY && i.category !== categoryFilter) return false;
      if (dateFrom && i.date < dateFrom) return false;
      if (dateTo && i.date > dateTo) return false;
      return true;
    });
  }, [all, staffFilter, categoryFilter, dateFrom, dateTo]);

  // Aggregate totals across filtered set
  const totals = useMemo(() => {
    const t: Record<MeetingCategory, number> = { client_side: 0, capital_side: 0, neither: 0, internal: 0 };
    filtered.forEach(i => { t[i.category] = (t[i.category] || 0) + 1; });
    return t;
  }, [filtered]);

  const strategic = totals.client_side + totals.capital_side;
  const strategicPct = filtered.length > 0 ? Math.round((strategic / filtered.length) * 100) : 0;

  // Group by month, sorted newest first
  const byMonth = useMemo(() => {
    const map = new Map<string, Interaction[]>();
    const sorted = [...filtered].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    for (const i of sorted) {
      const key = i.date ? i.date.slice(0, 7) : 'Unknown';
      const bucket = map.get(key) ?? [];
      bucket.push(i);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const staffOptions = useMemo(() => {
    const names = new Set(all.map(i => i.loggedBy).filter(Boolean));
    return [...names].sort();
  }, [all]);

  return (
    <div className="meeting-log-wrap">
      <div className="meeting-log-header">
        <div>
          <h2>Meeting log</h2>
          <p className="meeting-log-desc">
            Full chronological record of all logged interactions. Use the filters below to drill into a specific
            staff member, category, or date range.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="meeting-log-filters">
        <div className="meeting-log-filter-group">
          <label>Staff</label>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value={ALL_STAFF}>All staff</option>
            {staffOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="meeting-log-filter-group">
          <label>Category</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value={ALL_CATEGORY}>All categories</option>
            <option value="client_side">Client-side</option>
            <option value="capital_side">Capital-side</option>
            <option value="internal">Internal</option>
            <option value="neither">Neither</option>
          </select>
        </div>
        <div className="meeting-log-filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="meeting-log-filter-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(staffFilter !== ALL_STAFF || categoryFilter !== ALL_CATEGORY || dateFrom || dateTo) && (
          <button
            className="link-btn"
            onClick={() => { setStaffFilter(ALL_STAFF); setCategoryFilter(ALL_CATEGORY); setDateFrom(''); setDateTo(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary stats bar */}
      <div className="meeting-log-stats">
        <div className="meeting-log-stat">
          <span className="meeting-log-stat-value">{filtered.length}</span>
          <span className="meeting-log-stat-label">Total</span>
        </div>
        <div className="meeting-log-stat">
          <span className="meeting-log-stat-value" style={{ color: 'var(--client)' }}>{totals.client_side}</span>
          <span className="meeting-log-stat-label">Client-side</span>
        </div>
        <div className="meeting-log-stat">
          <span className="meeting-log-stat-value" style={{ color: 'var(--capital)' }}>{totals.capital_side}</span>
          <span className="meeting-log-stat-label">Capital-side</span>
        </div>
        <div className="meeting-log-stat">
          <span className="meeting-log-stat-value" style={{ color: 'var(--sage-forest)' }}>{totals.internal}</span>
          <span className="meeting-log-stat-label">Internal</span>
        </div>
        <div className="meeting-log-stat">
          <span className="meeting-log-stat-value">{totals.neither}</span>
          <span className="meeting-log-stat-label">Neither</span>
        </div>
        <div className="meeting-log-stat meeting-log-stat--highlight">
          <span className="meeting-log-stat-value">{strategicPct}%</span>
          <span className="meeting-log-stat-label">Strategic focus</span>
        </div>
      </div>

      {/* Per-staff totals (only shown when all staff selected) */}
      {staffFilter === ALL_STAFF && filtered.length > 0 && (
        <div className="meeting-log-staff-section">
          <h3 className="audit-section-title">By staff member</h3>
          <div className="meeting-log-staff-grid">
            {STAFF_ROSTER.map(s => {
              const rows = filtered.filter(i => i.loggedBy === s.name);
              if (rows.length === 0) return null;
              const sh = rows.filter(i => i.category === 'client_side' || i.category === 'capital_side').length;
              const shPct = Math.round((sh / rows.length) * 100);
              return (
                <div key={s.id} className="meeting-log-staff-card">
                  <div className="meeting-log-staff-name">{s.name}</div>
                  <div className="meeting-log-staff-role">{s.role}</div>
                  <div className="meeting-log-staff-count">{rows.length} meetings</div>
                  <div className="meeting-log-staff-sh">{shPct}% strategic</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly groups */}
      {filtered.length === 0 ? (
        <div className="empty">No interactions match the selected filters.</div>
      ) : (
        <div className="meeting-log-months">
          {byMonth.map(([monthKey, rows]) => (
            <div key={monthKey} className="meeting-log-month">
              <div className="meeting-log-month-header">
                <span className="meeting-log-month-label">{monthLabel(monthKey)}</span>
                <span className="meeting-log-month-count">{rows.length} interaction{rows.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="meeting-log-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Logged by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(i => (
                    <tr key={i.id} className="meeting-log-row">
                      <td className="meeting-log-date">{i.date}</td>
                      <td>
                        <span className={`badge ${categoryBadge[i.category]}`}>
                          {categoryLabels[i.category]}
                        </span>
                      </td>
                      <td className="meeting-log-type">{i.type}</td>
                      <td className="meeting-log-notes">{i.notes || 'Touch logged'}</td>
                      <td className="meeting-log-by">{i.loggedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
