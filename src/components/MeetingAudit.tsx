import { useState } from 'react';
import type { Interaction, MeetingCategory, InteractionType } from '../types';
import { STAFF_ROSTER } from '../types';
import { Button, useDialog } from './ui';
import { Plus, X } from './ui/icons';

interface Props {
  interactions: Interaction[];
  onLogMeeting: (data: Omit<Interaction, 'id'>) => Promise<void>;
  currentUser: string;
}

const categoryColors: Record<MeetingCategory, string> = {
  client_side: 'var(--client)',
  capital_side: 'var(--capital)',
  neither: 'var(--text-muted)',
  internal: 'var(--sage-forest)',
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

function WeeklyReportForm({ onSubmit, currentUser }: {
  onSubmit: (data: Omit<Interaction, 'id'>) => Promise<void>;
  currentUser: string;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<InteractionType>('meeting');
  const [category, setCategory] = useState<MeetingCategory>('client_side');
  const [notes, setNotes] = useState('');
  const [loggedBy, setLoggedBy] = useState(currentUser);
  const [saving, setSaving] = useState(false);
  const dialog = useDialog();

  const handleSubmit = async () => {
    if (!notes.trim()) {
      await dialog.alert({
        title: 'Meeting description required',
        body: 'Please add a brief description so the meeting can be categorised in the audit log.',
        tone: 'warn',
      });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        contactId: '',
        date,
        type,
        category,
        notes: notes.trim(),
        loggedBy,
      });
      setNotes('');
      setDate(new Date().toISOString().slice(0, 10));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await dialog.alert({
        title: 'Could not log meeting',
        body: `The Excel workbook did not accept the write: ${msg}`,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="weekly-form">
      <h3 className="weekly-form-title">Log a meeting</h3>
      <div className="weekly-form-grid">
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value as InteractionType)}>
            <option value="meeting">Meeting</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="event">Event / Conference</option>
          </select>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as MeetingCategory)}>
            <option value="client_side">Client-side (advancing client relationships)</option>
            <option value="capital_side">Capital-side (banks, investors, fund managers)</option>
            <option value="internal">Internal (team, strategy, operations)</option>
            <option value="neither">Neither (regulatory, admin, other)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Logged by</label>
          <select value={loggedBy} onChange={e => setLoggedBy(e.target.value)}>
            {STAFF_ROSTER.map(s => (
              <option key={s.id} value={s.name}>{s.name}, {s.role}</option>
            ))}
          </select>
        </div>
        <div className="form-group full">
          <label>Meeting description</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Who you met, what you discussed, and the next step..."
            rows={3}
          />
        </div>
      </div>
      <div className="form-actions">
        <Button variant="primary" onClick={handleSubmit} loading={saving}>
          {saving ? 'Logging' : 'Log meeting'}
        </Button>
      </div>
    </div>
  );
}

export default function MeetingAudit({ interactions, onLogMeeting, currentUser }: Props) {
  const [showForm, setShowForm] = useState(false);
  const meetings = interactions.filter(i => i.type === 'meeting' || i.type === 'event' || i.type === 'call');

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

  const byStaff = new Map<string, { total: number; sh: number }>();
  meetings.forEach(m => {
    const entry = byStaff.get(m.loggedBy) || { total: 0, sh: 0 };
    entry.total++;
    if (m.category === 'client_side' || m.category === 'capital_side') entry.sh++;
    byStaff.set(m.loggedBy, entry);
  });

  return (
    <div className="audit-wrap">
      <div className="audit-header">
        <div>
          <h2>Meeting audit</h2>
          <p className="audit-desc">
            Track which meetings advance the structural hole — the boundary between clients
            and capital providers where Sage3 creates value — versus internal or non-strategic time.
          </p>
        </div>
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <><X /> Hide form</> : <><Plus /> Log meeting</>}
        </Button>
      </div>

      {showForm && (
        <WeeklyReportForm onSubmit={onLogMeeting} currentUser={currentUser} />
      )}

      {meetings.length === 0 ? (
        <div className="empty">
          <p style={{ marginBottom: 8 }}>No interactions logged yet.</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Use "Mark touched" on contacts or the "Log meeting" button above to start tracking.
            Directors can log meetings from their weekly reports here.
          </p>
        </div>
      ) : (
        <>
          {/* Stacked bar chart */}
          <div className="audit-chart">
            {(['client_side', 'capital_side', 'internal', 'neither'] as MeetingCategory[]).map(cat => {
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
            {(['client_side', 'capital_side', 'internal', 'neither'] as MeetingCategory[]).map(cat => (
              <div key={cat} className="legend-item">
                <div className="legend-dot" style={{ background: categoryColors[cat] }} />
                {categoryLabels[cat]}: {counts[cat]} ({Math.round((counts[cat] / total) * 100)}%)
              </div>
            ))}
          </div>

          {/* Strategic assessment */}
          <div
            className={`audit-assessment ${structuralHolePct >= 60 ? 'assessment-good' : 'assessment-warn'}`}
          >
            <div className="assessment-score">
              <span className="assessment-pct">{structuralHolePct}%</span>
              <span className="assessment-label">Structural hole focus</span>
            </div>
            <div className="assessment-text">
              {structuralHolePct}% of meetings advance the structural hole (client-side + capital-side).
              {structuralHolePct < 50 && (
                <> This is below the recommended 50% threshold. Too many meetings are spent on internal or non-strategic activities. Re-evaluate your meeting allocation. Every meeting costs opportunity.</>
              )}
              {structuralHolePct >= 50 && structuralHolePct < 75 && (
                <> Good progress. Keep pushing more meetings toward client and capital conversations. The firm creates value at the boundary, not in internal huddles.</>
              )}
              {structuralHolePct >= 75 && <> Excellent strategic focus. Your meeting time is overwhelmingly spent where the firm creates value, at the structural hole boundary.</>}
            </div>
          </div>

          {/* Per-staff breakdown */}
          {byStaff.size > 1 && (
            <div className="audit-staff-section">
              <h3 className="audit-section-title">By staff member</h3>
              <div className="audit-staff-grid">
                {[...byStaff.entries()]
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([name, stats]) => (
                    <div key={name} className="audit-staff-card">
                      <span className="audit-staff-name">{name}</span>
                      <span className="audit-staff-total">{stats.total} meetings</span>
                      <span className="audit-staff-sh">
                        {stats.total > 0 ? Math.round((stats.sh / stats.total) * 100) : 0}% strategic
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent interactions list */}
          <h3 className="audit-section-title">
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
