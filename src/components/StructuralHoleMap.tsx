/**
 * StructuralHoleMap — Premium Network Dashboard
 *
 * Layout: 6-metric bar + side-by-side 3D canvas and CRM contact register.
 *
 * CRM panel: contacts grouped alphabetically by organisation, then by name
 * within each group. Collapsible groups cap live DOM nodes to whatever the
 * user expands. Multi-select with group-level indeterminate state drives a
 * bulk-edit toolbar (heat, type, frequency). Bulk processing is simulated
 * with a progress bar; swap `runBulkSim` for real Graph API calls in production.
 */

import { useState, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Contact, ContactType, HeatLevel, Frequency } from '../types';
import NetworkMap3D from './NetworkMap3D';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contacts: Contact[];
}

// ── Bulk-edit field definitions ───────────────────────────────────────────────

type BulkField = 'heat' | 'type' | 'frequency';

const BULK_OPTIONS: Record<BulkField, { value: string; label: string }[]> = {
  heat: [
    { value: 'cold',  label: 'Cold'           },
    { value: 'warm',  label: 'Warm'           },
    { value: 'hot',   label: 'Hot'            },
  ],
  type: [
    { value: 'client',           label: 'Client'           },
    { value: 'capital_provider', label: 'Capital Provider' },
    { value: 'partner',          label: 'Partner'          },
    { value: 'unclassified',     label: 'Unclassified'     },
  ],
  frequency: [
    { value: 'biannual',  label: '2x per year (Biannual)' },
    { value: 'quarterly', label: 'Quarterly'               },
    { value: 'monthly',   label: 'Monthly'                 },
    { value: 'asneeded',  label: 'As needed'               },
  ],
};

const BULK_FIELDS: { key: BulkField; label: string }[] = [
  { key: 'heat',      label: 'Lead Heat'       },
  { key: 'type',      label: 'Contact Type'    },
  { key: 'frequency', label: 'Touch Frequency' },
];

// ── Type / heat display maps ──────────────────────────────────────────────────

const TYPE_DISPLAY: Record<ContactType, { label: string; color: string; bg: string; border: string }> = {
  client:           { label: 'Client',       color: '#22D3EE', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.22)'  },
  capital_provider: { label: 'Capital',      color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.22)' },
  partner:          { label: 'Partner',      color: '#6EE7B7', bg: 'rgba(110,231,183,0.10)', border: 'rgba(110,231,183,0.22)' },
  unclassified:     { label: 'Unclassified', color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.20)' },
};

const HEAT_COLOR: Record<HeatLevel, string> = {
  hot:  '#F87171',
  warm: '#FBBF24',
  cold: '#475569',
};

// ── Reusable styled helpers ───────────────────────────────────────────────────

function TypeTag({ type }: { type: ContactType }) {
  const d = TYPE_DISPLAY[type] ?? TYPE_DISPLAY.unclassified;
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: d.color,
      background: d.bg, border: `1px solid ${d.border}`,
      borderRadius: 4, padding: '1px 5px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {d.label}
    </span>
  );
}

function HeatDot({ heat }: { heat: HeatLevel }) {
  return (
    <div
      title={heat}
      style={{ width: 7, height: 7, borderRadius: '50%', background: HEAT_COLOR[heat], flexShrink: 0 }}
    />
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}

// ── Shared inline style constants ─────────────────────────────────────────────

const miniBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 5, padding: '3px 8px',
  fontSize: 10, cursor: 'pointer',
  color: 'var(--text-muted)', fontFamily: 'inherit',
  transition: 'all 0.15s',
};

const selectEl: CSSProperties = {
  background: 'var(--surface-alt)',
  border: '1px solid var(--border-strong)',
  borderRadius: 5, padding: '3px 8px',
  fontSize: 10, color: 'var(--text)', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none',
};

const applyBtn: CSSProperties = {
  background: 'rgba(212,175,55,0.12)',
  border: '1px solid rgba(212,175,55,0.30)',
  color: '#D4AF37', borderRadius: 5,
  padding: '3px 11px', fontSize: 10,
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function StructuralHoleMap({ contacts }: Props) {

  // ── Filter + grouping state ─────────────────────────────────────────────────
  const [query, setQuery]             = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds]  = useState<Set<string>>(new Set());

  // ── Bulk-edit state ─────────────────────────────────────────────────────────
  const [bulkField, setBulkField] = useState<BulkField>('heat');
  const [bulkValue, setBulkValue] = useState('cold');
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);

  // ── Derived network metrics ─────────────────────────────────────────────────
  const clients     = contacts.filter(c => c.type === 'client').length;
  const capital     = contacts.filter(c => c.type === 'capital_provider').length;
  const hot         = contacts.filter(c => c.heat === 'hot').length;
  const ratio       = clients && capital ? (clients / capital).toFixed(1) : 'N/A';
  const imbalanced  = clients > 0 && capital > 0 &&
                      (clients / capital > 3 || capital / clients > 3);

  // ── Alphabetically grouped contacts ────────────────────────────────────────
  const grouped = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = q
      ? contacts.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q)
        )
      : contacts;

    const map: Record<string, Contact[]> = {};
    for (const c of filtered) {
      const org = c.company?.trim() || 'Unspecified';
      (map[org] ??= []).push(c);
    }
    // Sort names within each group
    for (const org of Object.keys(map)) {
      map[org].sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map(org => ({ org, contacts: map[org] }));
  }, [contacts, query]);

  const totalFiltered = useMemo(() => grouped.reduce((s, g) => s + g.contacts.length, 0), [grouped]);

  // ── Expand / collapse helpers ───────────────────────────────────────────────
  const expandAll   = () => setExpandedOrgs(new Set(grouped.map(g => g.org)));
  const collapseAll = () => setExpandedOrgs(new Set());
  const toggleOrg   = useCallback((org: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      next.has(org) ? next.delete(org) : next.add(org);
      return next;
    });
  }, []);

  // ── Selection helpers ───────────────────────────────────────────────────────
  const selectAll   = () => setSelectedIds(new Set(grouped.flatMap(g => g.contacts.map(c => c.id))));
  const deselectAll = () => setSelectedIds(new Set());

  const toggleOrgSelect = useCallback((orgContacts: Contact[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSel = orgContacts.every(c => next.has(c.id));
      allSel
        ? orgContacts.forEach(c => next.delete(c.id))
        : orgContacts.forEach(c => next.add(c.id));
      return next;
    });
  }, []);

  const toggleContact = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Bulk field change — reset value to first option ─────────────────────────
  const onBulkFieldChange = (f: BulkField) => {
    setBulkField(f);
    setBulkValue(BULK_OPTIONS[f][0].value);
  };

  // ── Bulk operation simulation ───────────────────────────────────────────────
  /**
   * Simulates processing N contacts with a smooth progress bar.
   * In production: replace this with batched updateContact() calls against
   * the SharePoint Excel workbook via the Microsoft Graph API.
   */
  const runBulkSim = useCallback(async () => {
    const total = selectedIds.size;
    if (!total) return;
    setBulkProgress(0);
    const steps = 60; // animation resolution
    const delay = Math.max(8, Math.round(1200 / steps));
    for (let i = 1; i <= steps; i++) {
      await new Promise<void>(r => setTimeout(r, delay));
      setBulkProgress(Math.round((i / steps) * 100));
    }
    setBulkProgress(100);
    await new Promise<void>(r => setTimeout(r, 1000));
    setBulkProgress(null);
    setSelectedIds(new Set());
  }, [selectedIds]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Imbalance alert ── */}
      {imbalanced && (
        <div style={{
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)',
          borderRadius: 'var(--radius)', padding: '10px 16px', fontSize: 12,
          color: '#FBBF24', lineHeight: 1.6,
        }}>
          <strong>Network imbalance:</strong> Client-to-capital ratio is {ratio}.
          Prioritise BD outreach toward {clients > capital ? 'capital providers' : 'clients'} to
          strengthen the structural hole position.
        </div>
      )}

      {/* ── 6-metric bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6,1fr)',
        gap: 1, background: 'var(--border)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <MetricCard label="CRM Contacts"           value={contacts.length.toLocaleString()} color="#F1F5F9"  sub="Total register"        />
        <MetricCard label="Clients"                value={clients.toLocaleString()}          color="#22D3EE"  sub="Demand-side nodes"      />
        <MetricCard label="Capital Providers"      value={capital.toLocaleString()}          color="#A78BFA"  sub="Supply-side nodes"      />
        <MetricCard label="Hot Leads"              value={hot.toLocaleString()}              color="#F87171"  sub="Active outreach"        />
        <MetricCard label="Betweenness Centrality" value="1.00"                              color="#4ADE80"  sub="Max brokerage position" />
        <MetricCard label="Brokerage Ratio"        value="100%"                              color="#D4AF37"  sub="Exclusive broker"       />
      </div>

      {/* ── Side-by-side panels ── */}
      <div style={{ display: 'flex', gap: 14, height: 582 }}>

        {/* ── Left: 3D map ── */}
        <div style={{
          flex: '0 0 46%', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '10px 16px', background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>3D Structural Hole Network</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                Sage 3 as sole broker · no direct client-capital edge · drag to orbit
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: 'Client : Capital', value: ratio },
                { label: 'Nodes', value: '13' },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'var(--surface-alt)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '4px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 8, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <NetworkMap3D />
          </div>
        </div>

        {/* ── Right: CRM contact register ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>

          {/* Panel header */}
          <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Contact Register</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                  {grouped.length.toLocaleString()} organisations &middot; {totalFiltered.toLocaleString()} contacts
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={expandAll}   style={miniBtn}>Expand all</button>
                <button onClick={collapseAll} style={miniBtn}>Collapse all</button>
              </div>
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or organisation..."
              style={{
                width: '100%', background: 'var(--surface-alt)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6, padding: '6px 11px',
                fontSize: 11, color: 'var(--text)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Bulk-edit toolbar — visible when contacts are selected */}
          {selectedIds.size > 0 && (
            <div style={{
              padding: '8px 16px', flexShrink: 0,
              background: 'rgba(212,175,55,0.05)',
              borderBottom: '1px solid rgba(212,175,55,0.15)',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37' }}>
                {selectedIds.size.toLocaleString()} selected
              </span>
              <span style={{ color: 'var(--border-strong)', fontSize: 14 }}>|</span>

              {/* Field selector */}
              <select
                value={bulkField}
                onChange={e => onBulkFieldChange(e.target.value as BulkField)}
                style={{ ...selectEl, width: 140 }}
              >
                {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              {/* Value selector */}
              <select
                value={bulkValue}
                onChange={e => setBulkValue(e.target.value)}
                style={{ ...selectEl, width: 160 }}
              >
                {BULK_OPTIONS[bulkField].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {bulkProgress !== null ? (
                /* Progress bar */
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${bulkProgress}%`, height: '100%',
                      background: bulkProgress === 100 ? '#4ADE80' : '#D4AF37',
                      transition: 'width 0.08s linear, background 0.4s',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: bulkProgress === 100 ? '#4ADE80' : '#D4AF37', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {bulkProgress === 100 ? 'Complete' : `${bulkProgress}%`}
                  </span>
                </div>
              ) : (
                <>
                  <button onClick={runBulkSim} style={applyBtn}>
                    Apply to {selectedIds.size.toLocaleString()}
                  </button>
                  <button onClick={deselectAll} style={{ ...miniBtn, color: '#F87171', borderColor: 'rgba(248,113,113,0.25)' }}>
                    Clear
                  </button>
                  <button onClick={selectAll} style={{ ...miniBtn, marginLeft: 'auto' }}>
                    Select all {totalFiltered.toLocaleString()}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Scrollable contact list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {grouped.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
                No contacts match this search.
              </div>
            ) : (
              grouped.map(({ org, contacts: orgContacts }) => {
                const isExpanded  = expandedOrgs.has(org);
                const allSel      = orgContacts.every(c => selectedIds.has(c.id));
                const someSel     = !allSel && orgContacts.some(c => selectedIds.has(c.id));

                return (
                  <div key={org}>
                    {/* ── Organisation group header ── */}
                    <div
                      onClick={() => toggleOrg(org)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 16px', cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isExpanded ? 'rgba(212,175,55,0.04)' : 'transparent',
                        userSelect: 'none',
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Group checkbox */}
                      <div
                        onClick={e => { e.stopPropagation(); toggleOrgSelect(orgContacts); }}
                        style={{
                          width: 13, height: 13, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${allSel || someSel ? '#D4AF37' : 'var(--text-faint)'}`,
                          background: allSel ? '#D4AF37' : someSel ? 'rgba(212,175,55,0.22)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {allSel && <div style={{ width: 5, height: 5, background: '#020617', borderRadius: 1 }} />}
                        {someSel && <div style={{ width: 6, height: 2, background: '#D4AF37' }} />}
                      </div>

                      {/* Expand arrow */}
                      <span style={{
                        fontSize: 8, color: 'var(--text-faint)', flexShrink: 0,
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s', display: 'inline-block',
                      }}>&#9658;</span>

                      {/* Org name */}
                      <span style={{
                        flex: 1, fontSize: 11, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: isExpanded ? 'var(--text-secondary)' : 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {org}
                      </span>

                      {/* Count pill */}
                      <span style={{
                        fontSize: 10, color: 'var(--text-faint)',
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--border)',
                        padding: '1px 7px', borderRadius: 10, flexShrink: 0,
                      }}>
                        {orgContacts.length}
                      </span>
                    </div>

                    {/* ── Contact rows (rendered only when expanded) ── */}
                    {isExpanded && orgContacts.map(c => {
                      const isSel = selectedIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 16px 5px 38px',
                            borderBottom: '1px solid var(--border)',
                            background: isSel ? 'rgba(212,175,55,0.04)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          {/* Contact checkbox */}
                          <div
                            onClick={() => toggleContact(c.id)}
                            style={{
                              width: 12, height: 12, borderRadius: 2, flexShrink: 0, cursor: 'pointer',
                              border: `1.5px solid ${isSel ? '#D4AF37' : 'var(--text-faint)'}`,
                              background: isSel ? '#D4AF37' : 'transparent',
                              transition: 'all 0.12s',
                            }}
                          />
                          {/* Name */}
                          <span style={{
                            flex: 1, fontSize: 11, fontWeight: 500,
                            color: 'var(--text)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {c.name}
                          </span>
                          {/* Position */}
                          {c.position && (
                            <span style={{
                              fontSize: 10, color: 'var(--text-faint)',
                              maxWidth: 130, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {c.position}
                            </span>
                          )}
                          {/* Heat dot */}
                          <HeatDot heat={c.heat} />
                          {/* Type tag */}
                          <TypeTag type={c.type} />
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {/* Bottom padding so last group isn't flush against edge */}
            <div style={{ height: 16 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
