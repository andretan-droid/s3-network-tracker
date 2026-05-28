import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Contact, ContactType, HeatLevel, Frequency } from '../types';
import ContactCard from './ContactCard';
import DuplicatesBanner from './DuplicatesBanner';
import { Button, useDialog } from './ui';
import { ChevronRight, X, Check } from './ui/icons';

type FilterType = 'all' | ContactType | 'hot';

interface Props {
  contacts: Contact[];
  onMarkTouched: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMergeAll: () => Promise<void>;
  onBulkUpdate: (
    updates: Contact[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<void>;
}

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'client', label: 'Clients' },
  { key: 'capital_provider', label: 'Capital providers' },
  { key: 'partner', label: 'Partners' },
  { key: 'educational', label: 'Educational' },
  { key: 'regulatory', label: 'Regulatory' },
  { key: 'government', label: 'Government' },
  { key: 'institute', label: 'Institute' },
  { key: 'unclassified', label: 'Unclassified' },
  { key: 'hot', label: 'Hot leads' },
];

/* ────────────────────────────────────────────────────────────
   Bulk-edit field definitions
   ──────────────────────────────────────────────────────────── */

type BulkField = 'type' | 'heat' | 'frequency';

const BULK_FIELDS: { key: BulkField; label: string }[] = [
  { key: 'type',      label: 'Contact type'    },
  { key: 'heat',      label: 'Lead heat'       },
  { key: 'frequency', label: 'Touch frequency' },
];

const BULK_VALUES: Record<BulkField, { value: string; label: string }[]> = {
  type: [
    { value: 'client',           label: 'Client'           },
    { value: 'capital_provider', label: 'Capital provider' },
    { value: 'partner',          label: 'Partner'          },
    { value: 'educational',      label: 'Educational'      },
    { value: 'regulatory',       label: 'Regulatory body'  },
    { value: 'government',       label: 'Government'       },
    { value: 'institute',        label: 'Institute'        },
    { value: 'unclassified',     label: 'Unclassified'     },
  ],
  heat: [
    { value: 'hot',  label: 'Hot'  },
    { value: 'warm', label: 'Warm' },
    { value: 'cold', label: 'Cold' },
    { value: '',     label: 'Clear (not set)' },
  ],
  frequency: [
    { value: 'biannual',  label: '2x per year (Biannual)' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'monthly',   label: 'Monthly' },
    { value: 'asneeded',  label: 'As needed' },
    { value: '',          label: 'Clear (not set)' },
  ],
};

/* ────────────────────────────────────────────────────────────
   Tri-state checkbox (supports indeterminate)
   ──────────────────────────────────────────────────────────── */

function TriCheck({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="bulk-check"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      onClick={e => e.stopPropagation()}
      aria-label={ariaLabel}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   Grouping helpers
   ──────────────────────────────────────────────────────────── */

function normaliseOrgKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, ' ');
}

function groupByCompany(contacts: Contact[]): { org: string; key: string; rows: Contact[] }[] {
  const map = new Map<string, { display: string; rows: Contact[] }>();
  for (const c of contacts) {
    const display = c.company?.trim() || 'Unspecified';
    const key = normaliseOrgKey(display);
    const bucket = map.get(key);
    if (bucket) {
      bucket.rows.push(c);
    } else {
      map.set(key, { display, rows: [c] });
    }
  }
  // Sort companies alphabetically (case-insensitive, locale-aware)
  const orgs = [...map.entries()]
    .map(([key, { display, rows }]) => ({
      key,
      org: display,
      rows: rows.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.org.localeCompare(b.org, undefined, { numeric: true, sensitivity: 'base' }));
  return orgs;
}

/* ────────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────────── */

export default function ContactsList({
  contacts,
  onMarkTouched,
  onEdit,
  onDelete,
  onMergeAll,
  onBulkUpdate,
}: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<BulkField>('type');
  const [bulkValue, setBulkValue] = useState<string>('client');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const dialog = useDialog();

  // ── Filter contacts (filter + search) ───────────────────────────
  const filtered = useMemo(() => {
    return contacts
      .filter(c => {
        if (filter === 'hot') return c.heat === 'hot';
        if (filter !== 'all') return c.type === filter;
        return true;
      })
      .filter(c => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.owners.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q)
        );
      });
  }, [contacts, filter, query]);

  const grouped = useMemo(() => groupByCompany(filtered), [filtered]);

  // ── Auto-expand groups when a search query is typed ─────────────
  useEffect(() => {
    if (query.trim()) {
      setExpandedOrgs(new Set(grouped.map(g => g.key)));
    }
  }, [query, grouped]);

  // ── Expand / collapse helpers ───────────────────────────────────
  const expandAll = () => setExpandedOrgs(new Set(grouped.map(g => g.key)));
  const collapseAll = () => setExpandedOrgs(new Set());
  const toggleOrg = useCallback((key: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ── Selection helpers ───────────────────────────────────────────
  const toggleContact = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleOrgSelect = useCallback((orgRows: Contact[], select: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (select) {
        orgRows.forEach(c => next.add(c.id));
      } else {
        orgRows.forEach(c => next.delete(c.id));
      }
      return next;
    });
  }, []);

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map(c => c.id)));
    setExpandedOrgs(new Set(grouped.map(g => g.key)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Reset bulkValue to a sensible default whenever the field changes
  const onBulkFieldChange = (f: BulkField) => {
    setBulkField(f);
    setBulkValue(BULK_VALUES[f][0].value);
  };

  // ── Apply bulk edit ────────────────────────────────────────────
  const handleBulkApply = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const fieldLabel = BULK_FIELDS.find(f => f.key === bulkField)!.label.toLowerCase();
    const valueLabel = BULK_VALUES[bulkField].find(v => v.value === bulkValue)?.label ?? '(blank)';

    const ok = await dialog.confirm({
      title: `Update ${ids.length} contact${ids.length === 1 ? '' : 's'}?`,
      body: (
        <>
          Set <strong>{fieldLabel}</strong> to <strong>{valueLabel}</strong> for{' '}
          {ids.length} selected contact{ids.length === 1 ? '' : 's'}. Existing values for this
          field will be overwritten, and the change writes directly to the shared
          NetworkTracker Excel workbook.
        </>
      ),
      confirmLabel: `Update ${ids.length}`,
      cancelLabel: 'Cancel',
      tone: 'warn',
    });
    if (!ok) return;

    // Build the patched contact list. We only mutate the one field — every
    // other column round-trips unchanged so the Excel row keeps its full shape.
    const updates: Contact[] = ids
      .map(id => contacts.find(c => c.id === id))
      .filter((c): c is Contact => !!c)
      .map(c => {
        const next: Contact = { ...c };
        if (bulkField === 'type') next.type = bulkValue as ContactType;
        else if (bulkField === 'heat') next.heat = bulkValue as HeatLevel;
        else if (bulkField === 'frequency') next.frequency = bulkValue as Frequency;
        return next;
      });

    setBulkProgress({ done: 0, total: updates.length });
    try {
      await onBulkUpdate(updates, (done, total) => setBulkProgress({ done, total }));
      setSelectedIds(new Set());
    } finally {
      setBulkProgress(null);
    }
  };

  const visibleIds = useMemo(() => new Set(filtered.map(c => c.id)), [filtered]);
  const selectedVisible = useMemo(
    () => [...selectedIds].filter(id => visibleIds.has(id)).length,
    [selectedIds, visibleIds]
  );

  return (
    <>
      <DuplicatesBanner contacts={contacts} onEdit={onEdit} onMergeAll={onMergeAll} />

      {/* Filters + search */}
      <div className="filters">
        {filters.map(f => (
          <button
            key={f.key}
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== 'all' && f.key !== 'hot' && (
              <span className="filter-count">
                {contacts.filter(c => c.type === f.key).length}
              </span>
            )}
          </button>
        ))}
        <input
          className="search-input"
          type="text"
          placeholder="Search name, company, owner, or role..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Meta row */}
      <div className="contacts-meta">
        <span className="contacts-count">
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' || query ? ' (filtered)' : ''} · {grouped.length} organisation{grouped.length !== 1 ? 's' : ''}
        </span>
        <div className="contacts-meta__actions">
          <button className="link-btn" onClick={expandAll}>Expand all</button>
          <span className="link-sep">·</span>
          <button className="link-btn" onClick={collapseAll}>Collapse all</button>
          {selectedVisible === 0 && filtered.length > 0 && (
            <>
              <span className="link-sep">·</span>
              <button className="link-btn" onClick={selectAllVisible}>
                Select all {filtered.length}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk-edit toolbar — visible when contacts are selected */}
      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <span className="bulk-toolbar__count">
            {selectedIds.size} selected
          </span>
          <span className="bulk-toolbar__sep" />

          <label className="bulk-toolbar__label">Set</label>
          <select
            className="bulk-toolbar__select"
            value={bulkField}
            onChange={e => onBulkFieldChange(e.target.value as BulkField)}
            disabled={bulkProgress !== null}
          >
            {BULK_FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>

          <label className="bulk-toolbar__label">to</label>
          <select
            className="bulk-toolbar__select"
            value={bulkValue}
            onChange={e => setBulkValue(e.target.value)}
            disabled={bulkProgress !== null}
          >
            {BULK_VALUES[bulkField].map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>

          {bulkProgress !== null ? (
            <div className="bulk-toolbar__progress">
              <div className="bulk-toolbar__progress-track">
                <div
                  className="bulk-toolbar__progress-fill"
                  style={{ width: `${(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100}%` }}
                />
              </div>
              <span className="bulk-toolbar__progress-label">
                Writing {bulkProgress.done} / {bulkProgress.total} to Excel...
              </span>
            </div>
          ) : (
            <>
              <Button variant="primary" size="sm" onClick={handleBulkApply}>
                <Check /> Apply to {selectedIds.size}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X /> Clear
              </Button>
            </>
          )}
        </div>
      )}

      {/* Grouped list — alphabetical by company, then alphabetical by name */}
      <div className="org-groups">
        {grouped.length === 0 ? (
          <div className="empty">No contacts match this filter.</div>
        ) : (
          grouped.map(({ org, key, rows }) => {
            const isExpanded = expandedOrgs.has(key);
            const allSel = rows.every(c => selectedIds.has(c.id));
            const someSel = !allSel && rows.some(c => selectedIds.has(c.id));
            const orgInitial = org.charAt(0).toUpperCase();
            return (
              <section key={key} className={`org-group ${isExpanded ? 'org-group--open' : ''}`}>
                <header className="org-group__head" onClick={() => toggleOrg(key)}>
                  <TriCheck
                    checked={allSel}
                    indeterminate={someSel}
                    onChange={() => toggleOrgSelect(rows, !allSel)}
                    ariaLabel={`Select all contacts at ${org}`}
                  />
                  <span className={`org-group__chev ${isExpanded ? 'org-group__chev--open' : ''}`} aria-hidden>
                    <ChevronRight />
                  </span>
                  <span className="org-group__initial" aria-hidden>{orgInitial}</span>
                  <span className="org-group__name">{org}</span>
                  <span className="org-group__count">{rows.length}</span>
                </header>

                {isExpanded && (
                  <div className="org-group__rows">
                    {rows.map(c => {
                      const isSel = selectedIds.has(c.id);
                      return (
                        <div key={c.id} className={`org-row ${isSel ? 'org-row--selected' : ''}`}>
                          <div className="org-row__check">
                            <TriCheck
                              checked={isSel}
                              onChange={() => toggleContact(c.id)}
                              ariaLabel={`Select ${c.name}`}
                            />
                          </div>
                          <div className="org-row__card">
                            <ContactCard
                              contact={c}
                              onMarkTouched={onMarkTouched}
                              onEdit={onEdit}
                              onDelete={onDelete}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
