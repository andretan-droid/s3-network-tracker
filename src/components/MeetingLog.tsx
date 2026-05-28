import { useMemo, useState } from 'react';
import type { Contact, Interaction, MeetingCategory, InteractionType } from '../types';
import { STAFF_ROSTER, TYPE_LABELS } from '../types';
import { Button, useDialog } from './ui';
import { Plus, X, Pencil, Trash2, Check } from './ui/icons';

interface Props {
  interactions: Interaction[];
  contacts: Contact[];
  currentUser: string;
  onLogMeeting: (data: Omit<Interaction, 'id'>) => Promise<void>;
  onEditInteraction: (i: Interaction) => Promise<void>;
  onDeleteInteraction: (id: string) => Promise<void>;
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

const categoryAccent: Record<MeetingCategory, string> = {
  client_side: 'var(--client)',
  capital_side: 'var(--capital)',
  neither: 'var(--border-strong)',
  internal: 'var(--sage-forest)',
};

const ALL_STAFF = 'all';
const ALL_CATEGORY = 'all';

function formatDateDisplay(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatDateLong(iso: string): string {
  if (!iso || iso === 'Unknown') return 'Unknown date';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function resolveContacts(contactId: string, contacts: Contact[]): Contact[] {
  if (!contactId.trim()) return [];
  return contactId
    .split(',')
    .map(id => contacts.find(c => c.id === id.trim()))
    .filter(Boolean) as Contact[];
}

function autoCategoryFromContacts(selectedContacts: Contact[]): MeetingCategory {
  if (selectedContacts.some(c => c.type === 'client')) return 'client_side';
  if (selectedContacts.some(c => c.type === 'capital_provider')) return 'capital_side';
  return 'neither';
}

/* ── Contact search select ─────────────────────────────── */

function ContactSearchSelect({
  contacts,
  selectedIds,
  onChange,
}: {
  contacts: Contact[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return contacts
      .filter(c => !selectedIds.includes(c.id) &&
        (c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [contacts, search, selectedIds]);

  const selected = selectedIds
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean) as Contact[];

  return (
    <div className="ml-contact-search">
      {selected.length > 0 && (
        <div className="ml-contact-chips">
          {selected.map(c => (
            <div key={c.id} className="ml-contact-chip">
              <span className="ml-chip-name">{c.name}</span>
              {c.company && <span className="ml-chip-company">{c.company}</span>}
              <button
                type="button"
                className="ml-chip-remove"
                onClick={() => onChange(selectedIds.filter(id => id !== c.id))}
              >×</button>
            </div>
          ))}
        </div>
      )}
      <div className="ml-contact-input-wrap">
        <input
          type="text"
          className="ml-contact-input"
          placeholder={selected.length === 0 ? 'Search by name or company…' : 'Add another contact…'}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && suggestions.length > 0 && (
          <div className="ml-contact-dropdown">
            {suggestions.map(c => (
              <div
                key={c.id}
                className="ml-contact-option"
                onMouseDown={() => {
                  onChange([...selectedIds, c.id]);
                  setSearch('');
                }}
              >
                <span className="ml-option-name">{c.name}</span>
                {c.company && <span className="ml-option-company">{c.company}</span>}
                <span className="ml-option-type">{TYPE_LABELS[c.type]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Staff multi-select ────────────────────────────────── */

function StaffMultiSelect({
  selected,
  exclude,
  onChange,
}: {
  selected: string[];
  exclude?: string;   // don't show the loggedBy person (they're implied)
  onChange: (names: string[]) => void;
}) {
  const roster = STAFF_ROSTER.filter(s => s.name !== exclude);
  return (
    <div className="ml-staff-toggle-group">
      {roster.map(s => {
        const active = selected.includes(s.name);
        return (
          <button
            key={s.id}
            type="button"
            className={`ml-staff-toggle ${active ? 'active' : ''}`}
            onClick={() =>
              onChange(active ? selected.filter(n => n !== s.name) : [...selected, s.name])
            }
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/* ── Log meeting form ──────────────────────────────────── */

function LogMeetingForm({
  contacts,
  currentUser,
  onSubmit,
  onCancel,
}: {
  contacts: Contact[];
  currentUser: string;
  onSubmit: (data: Omit<Interaction, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<InteractionType>('meeting');
  const [category, setCategory] = useState<MeetingCategory>('client_side');
  const [categoryManual, setCategoryManual] = useState(false);
  const [notes, setNotes] = useState('');
  const [loggedBy, setLoggedBy] = useState(currentUser);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const dialog = useDialog();

  const handleContactChange = (ids: string[]) => {
    setSelectedContactIds(ids);
    if (!categoryManual) {
      const selected = ids.map(id => contacts.find(c => c.id === id)).filter(Boolean) as Contact[];
      if (selected.length > 0) setCategory(autoCategoryFromContacts(selected));
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      await dialog.alert({
        title: 'Description required',
        body: 'Please add a brief description of the meeting purpose and what was discussed.',
        tone: 'warn',
      });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        contactId: selectedContactIds.join(','),
        date,
        type,
        category,
        notes: notes.trim(),
        loggedBy,
        attendees: attendees.join(','),
      });
      setNotes('');
      setSelectedContactIds([]);
      setAttendees([]);
      setDate(new Date().toISOString().slice(0, 10));
      setCategoryManual(false);
      onCancel();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await dialog.alert({ title: 'Could not log meeting', body: msg, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ml-form">
      <h3 className="ml-form-title">Log a meeting</h3>
      <div className="ml-form-grid">
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
          <select
            value={category}
            onChange={e => { setCategory(e.target.value as MeetingCategory); setCategoryManual(true); }}
          >
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
          <label>Contacts / counterparties</label>
          <ContactSearchSelect
            contacts={contacts}
            selectedIds={selectedContactIds}
            onChange={handleContactChange}
          />
          <span className="form-hint">Search and add one or more contacts from this meeting</span>
        </div>
        <div className="form-group full">
          <label>Sage3 attendees <span className="form-hint-inline">(other than {loggedBy})</span></label>
          <StaffMultiSelect selected={attendees} exclude={loggedBy} onChange={setAttendees} />
        </div>
        <div className="form-group full">
          <label>Purpose &amp; notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Why this meeting was held, what was discussed, and next steps."
            rows={4}
          />
        </div>
      </div>
      <div className="form-actions">
        <Button variant="primary" onClick={handleSubmit} loading={saving}>
          {saving ? 'Logging…' : 'Log meeting'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* ── Inline edit row ───────────────────────────────────── */

function EditMeetingRow({
  interaction,
  contacts,
  onSave,
  onCancel,
}: {
  interaction: Interaction;
  contacts: Contact[];
  onSave: (updated: Interaction) => Promise<void>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(interaction.date);
  const [type, setType] = useState<InteractionType>(interaction.type);
  const [category, setCategory] = useState<MeetingCategory>(interaction.category);
  const [notes, setNotes] = useState(interaction.notes);
  const [loggedBy, setLoggedBy] = useState(interaction.loggedBy);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    interaction.contactId ? interaction.contactId.split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const [attendees, setAttendees] = useState<string[]>(
    interaction.attendees ? interaction.attendees.split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...interaction,
        date,
        type,
        category,
        notes: notes.trim(),
        loggedBy,
        contactId: selectedContactIds.join(','),
        attendees: attendees.join(','),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ml-edit-card">
      <div className="ml-edit-grid">
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
            <option value="event">Event</option>
          </select>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as MeetingCategory)}>
            <option value="client_side">Client-side</option>
            <option value="capital_side">Capital-side</option>
            <option value="internal">Internal</option>
            <option value="neither">Neither</option>
          </select>
        </div>
        <div className="form-group">
          <label>Logged by</label>
          <select value={loggedBy} onChange={e => setLoggedBy(e.target.value)}>
            {STAFF_ROSTER.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group full">
          <label>Contacts</label>
          <ContactSearchSelect
            contacts={contacts}
            selectedIds={selectedContactIds}
            onChange={setSelectedContactIds}
          />
        </div>
        <div className="form-group full">
          <label>Sage3 attendees <span className="form-hint-inline">(other than {loggedBy})</span></label>
          <StaffMultiSelect selected={attendees} exclude={loggedBy} onChange={setAttendees} />
        </div>
        <div className="form-group full">
          <label>Purpose &amp; notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <div className="form-actions">
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          <Check size={12} /> Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={12} /> Cancel
        </Button>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────── */

export default function MeetingLog({
  interactions,
  contacts,
  currentUser,
  onLogMeeting,
  onEditInteraction,
  onDeleteInteraction,
}: Props) {
  const [staffFilter, setStaffFilter] = useState(ALL_STAFF);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dialog = useDialog();

  const all = useMemo(
    () => interactions.filter(i => i.type === 'meeting' || i.type === 'event' || i.type === 'call'),
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

  const totals = useMemo(() => {
    const t: Record<MeetingCategory, number> = { client_side: 0, capital_side: 0, neither: 0, internal: 0 };
    filtered.forEach(i => { t[i.category] = (t[i.category] || 0) + 1; });
    return t;
  }, [filtered]);

  const strategic = totals.client_side + totals.capital_side;
  const strategicPct = filtered.length > 0 ? Math.round((strategic / filtered.length) * 100) : 0;

  // Group by exact date, sorted newest first
  const byDate = useMemo(() => {
    const map = new Map<string, Interaction[]>();
    const sorted = [...filtered].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
    for (const i of sorted) {
      const key = i.date || 'Unknown';
      const bucket = map.get(key) ?? [];
      bucket.push(i);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [filtered]);

  const staffOptions = useMemo(() => {
    const names = new Set(all.map(i => i.loggedBy).filter(Boolean));
    return [...names].sort();
  }, [all]);

  const handleDelete = async (i: Interaction) => {
    const resolved = resolveContacts(i.contactId, contacts);
    const contactLabel = resolved.length > 0 ? resolved.map(c => c.name).join(', ') : 'this entry';
    const ok = await dialog.confirm({
      title: 'Delete this meeting?',
      body: (
        <>
          Remove meeting with <strong>{contactLabel}</strong> logged by {i.loggedBy} on {formatDateDisplay(i.date)}?
          This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await onDeleteInteraction(i.id);
    } catch (e: unknown) {
      await dialog.alert({ title: 'Delete failed', body: e instanceof Error ? e.message : String(e), tone: 'danger' });
    }
  };

  return (
    <div className="ml-wrap">
      {/* Header */}
      <div className="ml-header">
        <div>
          <h2 className="ml-title">Meeting Log</h2>
          <p className="ml-desc">
            Chronological record of all client, capital, and internal meetings.
            Directors can review who was met, for what purpose, and by whom.
          </p>
        </div>
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          onClick={() => { setShowForm(s => !s); setEditingId(null); }}
        >
          {showForm ? <><X /> Cancel</> : <><Plus /> Log meeting</>}
        </Button>
      </div>

      {/* Log meeting form */}
      {showForm && (
        <LogMeetingForm
          contacts={contacts}
          currentUser={currentUser}
          onSubmit={onLogMeeting}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <div className="ml-filters">
        <div className="ml-filter-group">
          <label>Staff</label>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value={ALL_STAFF}>All staff</option>
            {staffOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="ml-filter-group">
          <label>Category</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value={ALL_CATEGORY}>All categories</option>
            <option value="client_side">Client-side</option>
            <option value="capital_side">Capital-side</option>
            <option value="internal">Internal</option>
            <option value="neither">Neither</option>
          </select>
        </div>
        <div className="ml-filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="ml-filter-group">
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

      {/* Stats bar */}
      <div className="ml-stats">
        <div className="ml-stat">
          <span className="ml-stat-value">{filtered.length}</span>
          <span className="ml-stat-label">Total</span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-value" style={{ color: 'var(--client)' }}>{totals.client_side}</span>
          <span className="ml-stat-label">Client-side</span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-value" style={{ color: 'var(--capital)' }}>{totals.capital_side}</span>
          <span className="ml-stat-label">Capital-side</span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-value" style={{ color: 'var(--sage-forest)' }}>{totals.internal}</span>
          <span className="ml-stat-label">Internal</span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-value">{totals.neither}</span>
          <span className="ml-stat-label">Neither</span>
        </div>
        <div className="ml-stat ml-stat--highlight">
          <span className="ml-stat-value">{strategicPct}%</span>
          <span className="ml-stat-label">Strategic focus</span>
        </div>
      </div>

      {/* Staff breakdown */}
      {staffFilter === ALL_STAFF && filtered.length > 0 && (
        <div className="ml-staff-section">
          <h3 className="audit-section-title">By staff member</h3>
          <div className="ml-staff-grid">
            {STAFF_ROSTER.map(s => {
              const rows = filtered.filter(i => i.loggedBy === s.name);
              if (rows.length === 0) return null;
              const sh = rows.filter(i => i.category === 'client_side' || i.category === 'capital_side').length;
              return (
                <div key={s.id} className="ml-staff-card">
                  <div className="ml-staff-name">{s.name}</div>
                  <div className="ml-staff-role">{s.role}</div>
                  <div className="ml-staff-count">{rows.length} meetings</div>
                  <div className="ml-staff-sh">{Math.round((sh / rows.length) * 100)}% strategic</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="empty">No meetings match the selected filters.</div>
      ) : (
        <div className="ml-timeline">
          {byDate.map(([dateKey, rows]) => (
            <div key={dateKey} className="ml-day">
              <div className="ml-day-header">
                <span className="ml-day-label">{formatDateLong(dateKey)}</span>
                <span className="ml-day-count">{rows.length} {rows.length === 1 ? 'meeting' : 'meetings'}</span>
              </div>
              <div className="ml-day-entries">
                {rows.map(i => {
                  const resolvedContacts = resolveContacts(i.contactId, contacts);
                  if (editingId === i.id) {
                    return (
                      <EditMeetingRow
                        key={i.id}
                        interaction={i}
                        contacts={contacts}
                        onSave={async updated => { await onEditInteraction(updated); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}
                      />
                    );
                  }
                  return (
                    <div
                      key={i.id}
                      className="ml-entry"
                      style={{ borderLeftColor: categoryAccent[i.category] }}
                    >
                      <div className="ml-entry-header">
                        <div className="ml-entry-header-left">
                          <span className={`badge ${categoryBadge[i.category]}`}>
                            {categoryLabels[i.category]}
                          </span>
                          <span className="ml-entry-type">{i.type}</span>
                        </div>
                        <div className="ml-entry-actions">
                          <button
                            className="audit-action-btn"
                            title="Edit"
                            onClick={() => { setEditingId(i.id); setShowForm(false); }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="audit-action-btn audit-action-btn--danger"
                            title="Delete"
                            onClick={() => handleDelete(i)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Contacts */}
                      <div className="ml-entry-contacts">
                        {resolvedContacts.length > 0 ? (
                          resolvedContacts.map(c => (
                            <div key={c.id} className="ml-entry-contact">
                              <span className="ml-contact-name">{c.name}</span>
                              {c.company && (
                                <span className="ml-contact-company"> · {c.company}</span>
                              )}
                              <span className="ml-contact-type">{TYPE_LABELS[c.type]}</span>
                            </div>
                          ))
                        ) : (
                          <span className="ml-no-contact">No contact linked</span>
                        )}
                      </div>

                      {/* Notes */}
                      <div className="ml-entry-notes">
                        {i.notes || <span className="ml-no-notes">No description recorded</span>}
                      </div>

                      {/* Footer */}
                      <div className="ml-entry-footer">
                        <div className="ml-entry-footer-left">
                          <span className="ml-logged-by">
                            Logged by <strong>{i.loggedBy || '—'}</strong>
                          </span>
                          {i.attendees && (
                            <span className="ml-attendees">
                              · Sage3 team: <strong>{i.attendees}</strong>
                            </span>
                          )}
                        </div>
                        <span className="ml-entry-date-badge">{formatDateDisplay(i.date)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
