/**
 * StructuralHoleMap — Director-grade network dashboard (light theme).
 *
 * Layout (vertical stack, director-friendly):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Imbalance alert (if applicable)                        │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ 6-metric bar — all derived, no hardcoded values        │
 *   ├─────────────────────────────────────────────────────────┤
 *   │                                                         │
 *   │   Network hero panel (3D map) — full width × 70vh      │
 *   │                                                         │
 *   ├─────────────────────────────────────────────────────────┤
 *   │   Contact Register accordion (full width, scrollable)   │
 *   └─────────────────────────────────────────────────────────┘
 *
 * The 3D map and the Contact Register are linked: clicking an org node in the
 * 3D viz lifts the `selectedNodeId` state, which auto-expands and scrolls to
 * that org's row in the register below.
 *
 * The 6-metric bar replaces two abstract academic concepts (Betweenness
 * Centrality, Brokerage Ratio — which were hardcoded literal strings in the
 * old code) with two operational concepts directors can act on:
 *
 *   • Key-person risks (SPOF count, amber when > 0)
 *   • Cold hubs        (count, crimson when > 0)
 *
 * SPOF/Cold-Hub counts are computed via the same `deriveGraph` helper that
 * NetworkMap2D uses — single source of truth (src/lib/network.ts).
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Contact } from '../types';
import { computeTier } from '../types';
import { normaliseOrgKey, deriveGraph, ECOSYSTEM_CLUSTER_KEY } from '../lib/network';
import NetworkMap2D from './NetworkMap2D';
import DirectorBrief from './DirectorBrief';
import OrgDetailPanel from './OrgDetailPanel';
import { TypeTag, HeatDot } from './ui';
import { ChevronRight } from './ui/icons';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contacts: Contact[];
  onBulkUpdate: (updates: Contact[], onProgress?: (done: number, total: number) => void) => Promise<void>;
}

// ── Bulk-edit field definitions (simulated; real bulk edit is in App.tsx) ────
//
// `type` is grouped to mirror AddEditContact.tsx — Structural-hole types
// (Client, Capital Provider) sit in their own optgroup; ecosystem types
// (Partner, Educational, Regulatory, Government, Institute) sit in another.
// The previous version of this file silently dropped 4 of the 8 ContactType
// values, so bulk-tagging an ecosystem contact was impossible from here.

type BulkField = 'heat' | 'type' | 'frequency';

interface BulkOption { value: string; label: string; group?: string; }

const BULK_OPTIONS: Record<BulkField, BulkOption[]> = {
  heat: [
    { value: 'cold',  label: 'Cold' },
    { value: 'warm',  label: 'Warm' },
    { value: 'hot',   label: 'Hot'  },
  ],
  type: [
    { value: 'unclassified',     label: 'Unclassified'     },
    { value: 'client',           label: 'Client',           group: 'Structural hole' },
    { value: 'capital_provider', label: 'Capital Provider', group: 'Structural hole' },
    { value: 'partner',          label: 'Partner',          group: 'Ecosystem' },
    { value: 'educational',      label: 'Educational',      group: 'Ecosystem' },
    { value: 'regulatory',       label: 'Regulatory',       group: 'Ecosystem' },
    { value: 'government',       label: 'Government',       group: 'Ecosystem' },
    { value: 'institute',        label: 'Institute',        group: 'Ecosystem' },
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

/**
 * Render options for a bulk-edit field. If any option has a `group`, render
 * an <optgroup> per group (ungrouped options sit at the top of the list,
 * matching native browser behaviour). If no option has a group, render a
 * flat list.
 */
function renderBulkOptions(options: BulkOption[]) {
  const hasGroups = options.some(o => o.group);
  if (!hasGroups) {
    return options.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
  }
  const ungrouped = options.filter(o => !o.group);
  const groupNames: string[] = [];
  const byGroup: Record<string, BulkOption[]> = {};
  for (const o of options) {
    if (!o.group) continue;
    if (!byGroup[o.group]) { byGroup[o.group] = []; groupNames.push(o.group); }
    byGroup[o.group].push(o);
  }
  return (
    <>
      {ungrouped.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {groupNames.map(g => (
        <optgroup key={g} label={g}>
          {byGroup[g].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </>
  );
}

// ── Reusable card helper (TypeTag / HeatDot now live in ./ui/Chips) ─────────

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  sub?: string;
  /** Optional pulsing accent (used for SPOF / Cold Hub when count > 0) */
  pulse?: boolean;
}

function MetricCard({ label, value, color, sub, pulse }: MetricCardProps) {
  return (
    <div style={{ background: 'var(--surface)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
      {pulse && (
        <span style={{
          position: 'absolute', top: 10, right: 12,
          width: 8, height: 8, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: 'spof-pulse 1.6s ease-in-out infinite',
        }} />
      )}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  );
}

// ── Shared inline style constants ────────────────────────────────────────────

const miniBtn: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 5, padding: '3px 8px',
  fontSize: 10, cursor: 'pointer',
  color: 'var(--text-secondary)', fontFamily: 'inherit',
  transition: 'all 0.15s',
};

const selectEl: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 5, padding: '3px 8px',
  fontSize: 10, color: 'var(--text)', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none',
};

const applyBtn: CSSProperties = {
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#fff', borderRadius: 5,
  padding: '3px 11px', fontSize: 10,
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
};

// ── Main component ───────────────────────────────────────────────────────────

export default function StructuralHoleMap({ contacts, onBulkUpdate }: Props) {

  // ── Filter + grouping state ─────────────────────────────────────────────────
  const [query, setQuery]               = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // ── Bulk-edit state ─────────────────────────────────────────────────────────
  const [bulkField, setBulkField] = useState<BulkField>('heat');
  const [bulkValue, setBulkValue] = useState('cold');
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);

  // ── Map ↔ side panel ↔ register link ──────────────────────────────────────
  // selectedNodeId is null when no panel is open. Setting it from the map
  // opens the side panel; the register row is only scrolled-to when the user
  // explicitly clicks "Jump to register row" (or a specific person row
  // inside the panel).
  //
  // Node ids are compound (`org:{key}:{side}`) so dual-role firms can be
  // selected per side; the ecosystem cluster uses its own sentinel.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const registerRef = useRef<HTMLDivElement>(null);

  // ── Derived network metrics (single source of truth: deriveGraph) ──────────
  const network = useMemo(() => deriveGraph(contacts), [contacts]);
  const networkMetrics = useMemo(() => {
    const orgs = network.nodes.filter(n => n.kind === 'org');
    const activeContacts = contacts.filter(c => computeTier(c) !== 'tier_3_dormant').length;
    return {
      contactCount: contacts.length,
      clients:      contacts.filter(c => c.type === 'client').length,
      capital:      contacts.filter(c => c.type === 'capital_provider').length,
      hot:          contacts.filter(c => c.heat === 'hot').length,
      orgCount:     orgs.length,
      activeCount:  activeContacts,
    };
  }, [network, contacts]);

  const clientCount = networkMetrics.clients;
  const capitalCount = networkMetrics.capital;

  // ── Alphabetically grouped contacts (Contact Register) ─────────────────────
  const grouped = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = q
      ? contacts.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q)
        )
      : contacts;

    const map: Record<string, { display: string; key: string; rows: Contact[] }> = {};
    for (const c of filtered) {
      const display = c.company?.trim() || 'Unspecified';
      const key = normaliseOrgKey(display);
      if (!map[key]) map[key] = { display, key, rows: [] };
      map[key].rows.push(c);
    }
    for (const k of Object.keys(map)) {
      map[k].rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.keys(map)
      .sort((a, b) => map[a].display.localeCompare(map[b].display, undefined, { numeric: true }))
      .map(k => map[k]);
  }, [contacts, query]);

  const totalFiltered = useMemo(() => grouped.reduce((s, g) => s + g.rows.length, 0), [grouped]);

  // ── Expand / collapse helpers ──────────────────────────────────────────────
  const expandAll   = () => setExpandedOrgs(new Set(grouped.map(g => g.key)));
  const collapseAll = () => setExpandedOrgs(new Set());
  const toggleOrg   = useCallback((key: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Explicit "Jump to register row" — fired by the side panel's footer
  // button. Expands the matching org row and scrolls it into view with a
  // brief highlight.
  const jumpToRegisterRow = useCallback((orgKey: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      next.add(orgKey);
      return next;
    });
    setTimeout(() => {
      const el = registerRef.current?.querySelector(
        `[data-org-key="${CSS.escape(orgKey)}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('org-row-highlight');
        setTimeout(() => el.classList.remove('org-row-highlight'), 1600);
      }
    }, 60);
  }, []);

  // Person-precise jump — fired when the user clicks a person row inside
  // the side panel. Expands the parent org, scrolls to the specific person
  // row, pulses just that row with the same highlight animation.
  const jumpToContactRow = useCallback((contactId: string, orgKey: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      next.add(orgKey);
      return next;
    });
    setTimeout(() => {
      const el = registerRef.current?.querySelector(
        `[data-contact-id="${CSS.escape(contactId)}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('org-row-highlight');
        setTimeout(() => el.classList.remove('org-row-highlight'), 1600);
      }
    }, 80);
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const selectAll   = () => setSelectedIds(new Set(grouped.flatMap(g => g.rows.map(c => c.id))));
  const deselectAll = () => setSelectedIds(new Set());

  const toggleOrgSelect = useCallback((orgContacts: Contact[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSel = orgContacts.every(c => next.has(c.id));
      if (allSel) {
        orgContacts.forEach(c => next.delete(c.id));
      } else {
        orgContacts.forEach(c => next.add(c.id));
      }
      return next;
    });
  }, []);

  const toggleContact = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const onBulkFieldChange = (f: BulkField) => {
    setBulkField(f);
    setBulkValue(BULK_OPTIONS[f][0].value);
  };

  const runBulkUpdate = useCallback(async () => {
    if (!selectedIds.size) return;
    setBulkProgress(0);
    const toUpdate = contacts
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ ...c, [bulkField]: bulkValue }));
    await onBulkUpdate(toUpdate, (done, total) => {
      setBulkProgress(Math.round((done / total) * 100));
    });
    setBulkProgress(100);
    await new Promise<void>(r => setTimeout(r, 1000));
    setBulkProgress(null);
    setSelectedIds(new Set());
  }, [selectedIds, contacts, bulkField, bulkValue, onBulkUpdate]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Director Brief — text-first action surface (primary) ──
           The brief passes a raw orgKey (one-per-firm), not a compound
           side-node id, so we route its clicks to the register-jump flow
           rather than the side panel. The register is where action lives
           for cold-hub follow-up. */}
      <DirectorBrief contacts={contacts} onOrgClick={jumpToRegisterRow} />

      {/* ── 6-metric bar — glance counts; SPOF/Cold-Hub detail lives in the brief above ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6,1fr)',
        gap: 1, background: 'var(--border)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <MetricCard label="CRM Contacts"      value={networkMetrics.contactCount.toLocaleString()} color="var(--text)"     sub="Total register" />
        <MetricCard label="Active Contacts"   value={networkMetrics.activeCount.toLocaleString()}  color="var(--accent)"   sub="Touched within Tier 1/2" />
        <MetricCard label="Organisations"     value={networkMetrics.orgCount.toLocaleString()}     color="var(--text)"     sub="Unique companies" />
        <MetricCard label="Clients"           value={clientCount.toLocaleString()}                  color="var(--client)"   sub="Demand-side people" />
        <MetricCard label="Capital Providers" value={capitalCount.toLocaleString()}                 color="var(--capital)"  sub="Supply-side people" />
        <MetricCard label="Hot Leads"         value={networkMetrics.hot.toLocaleString()}           color="var(--hot)"      sub="Active outreach" />
      </div>

      {/* ── 2D network — semantic structural-hole map ── */}
      <section className="network-hero-panel">
        <header className="network-hero-panel__head">
          <div>
            <h3 className="network-hero-panel__title">Structural hole map</h3>
            <p className="network-hero-panel__sub">
              Sage 3 in the centre. Clients on the left, capital providers on the right,
              ecosystem (partners, regulators, government, educational, institutes) above.
              Drag to pan · scroll to zoom · click an organisation to reveal its people.
            </p>
          </div>
        </header>
        <div className="network-hero-panel__canvas">
          <NetworkMap2D
            contacts={contacts}
            selectedNodeId={selectedNodeId}
            onOrgClick={setSelectedNodeId}
          />
        </div>
      </section>

      {/* Side panel — opens when a side-node or the ecosystem cluster is
          clicked. `nodeId` is either a compound side-node id or the
          cluster sentinel. */}
      <OrgDetailPanel
        contacts={contacts}
        nodeId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onSelectNode={setSelectedNodeId}
        onJumpToRegister={jumpToRegisterRow}
        onJumpToContact={jumpToContactRow}
      />

      {/* ── Contact Register (full width, below) ── */}
      <section className="contact-register-panel" ref={registerRef}>

        <header className="contact-register-panel__head">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 className="network-hero-panel__title">Contact register</h3>
              <p className="network-hero-panel__sub">
                {grouped.length.toLocaleString()} organisation{grouped.length === 1 ? '' : 's'} ·{' '}
                {totalFiltered.toLocaleString()} contact{totalFiltered === 1 ? '' : 's'}
                {(() => {
                  if (!selectedNodeId) return null;
                  if (selectedNodeId === ECOSYSTEM_CLUSTER_KEY) {
                    return <> · viewing <strong style={{ color: 'var(--accent)' }}>ecosystem cluster</strong></>;
                  }
                  // Compound id format: `org:{key}:{side}` — strip both ends.
                  const parts = selectedNodeId.split(':');
                  const orgKey = parts.slice(1, -1).join(':');
                  const side = parts[parts.length - 1];
                  const display = grouped.find(g => g.key === orgKey)?.display ?? orgKey;
                  return (
                    <> · clicked in network: <strong style={{ color: 'var(--accent)' }}>{display}</strong>
                      <span style={{ color: 'var(--text-muted)' }}> ({side})</span>
                    </>
                  );
                })()}
              </p>
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
              border: '1px solid var(--border)',
              borderRadius: 6, padding: '7px 12px',
              fontSize: 12, color: 'var(--text)',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </header>

        {/* Bulk-edit toolbar — visible when contacts are selected */}
        {selectedIds.size > 0 && (
          <div style={{
            padding: '8px 16px', flexShrink: 0,
            background: 'var(--sage-panel)',
            borderBottom: '1px solid var(--sage-border)',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage-forest)' }}>
              {selectedIds.size.toLocaleString()} selected
            </span>
            <span style={{ color: 'var(--border-strong)', fontSize: 14 }}>|</span>

            <select
              value={bulkField}
              onChange={e => onBulkFieldChange(e.target.value as BulkField)}
              style={{ ...selectEl, width: 140 }}
            >
              {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>

            <select
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
              style={{ ...selectEl, width: 180 }}
            >
              {renderBulkOptions(BULK_OPTIONS[bulkField])}
            </select>

            {bulkProgress !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div style={{ flex: 1, height: 4, background: 'var(--surface-alt)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{
                    width: `${bulkProgress}%`, height: '100%',
                    background: bulkProgress === 100 ? 'var(--accent)' : 'var(--accent-light)',
                    transition: 'width 0.08s linear, background 0.4s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {bulkProgress === 100 ? 'Complete' : `${bulkProgress}%`}
                </span>
              </div>
            ) : (
              <>
                <button onClick={runBulkUpdate} style={applyBtn}>
                  Apply to {selectedIds.size.toLocaleString()}
                </button>
                <button onClick={deselectAll} style={{ ...miniBtn, color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
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
        <div className="contact-register-panel__list">
          {grouped.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No contacts match this search.
            </div>
          ) : (
            grouped.map(({ display, key, rows }) => {
              const isExpanded = expandedOrgs.has(key);
              const allSel     = rows.every(c => selectedIds.has(c.id));
              const someSel    = !allSel && rows.some(c => selectedIds.has(c.id));

              return (
                <div key={key} data-org-key={key}>
                  <div
                    onClick={() => toggleOrg(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: isExpanded ? 'var(--surface-alt)' : 'var(--surface)',
                      userSelect: 'none',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div
                      onClick={e => { e.stopPropagation(); toggleOrgSelect(rows); }}
                      style={{
                        width: 13, height: 13, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                        border: `1.5px solid ${allSel || someSel ? 'var(--accent)' : 'var(--text-muted)'}`,
                        background: allSel ? 'var(--accent)' : someSel ? 'var(--accent-bg)' : 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {allSel && <div style={{ width: 5, height: 5, background: '#fff', borderRadius: 1 }} />}
                      {someSel && <div style={{ width: 6, height: 2, background: 'var(--accent)' }} />}
                    </div>

                    <span style={{
                      color: 'var(--text-muted)', flexShrink: 0,
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s', display: 'inline-flex',
                    }}>
                      <ChevronRight size={10} />
                    </span>

                    <span style={{
                      flex: 1, fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: isExpanded ? 'var(--text)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {display}
                    </span>

                    <span style={{
                      fontSize: 10, color: 'var(--text-muted)',
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      padding: '1px 7px', borderRadius: 10, flexShrink: 0,
                      fontWeight: 600,
                    }}>
                      {rows.length}
                    </span>
                  </div>

                  {isExpanded && rows.map(c => {
                    const isSel = selectedIds.has(c.id);
                    return (
                      <div
                        key={c.id}
                        data-contact-id={c.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 16px 5px 38px',
                          borderBottom: '1px solid var(--border)',
                          background: isSel ? 'var(--sage-panel)' : 'var(--surface)',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div
                          onClick={() => toggleContact(c.id)}
                          style={{
                            width: 12, height: 12, borderRadius: 2, flexShrink: 0, cursor: 'pointer',
                            border: `1.5px solid ${isSel ? 'var(--accent)' : 'var(--text-muted)'}`,
                            background: isSel ? 'var(--accent)' : 'var(--surface)',
                            transition: 'all 0.12s',
                          }}
                        />
                        <span style={{
                          flex: 1, fontSize: 11, fontWeight: 500,
                          color: 'var(--text)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {c.name}
                        </span>
                        {c.position && (
                          <span style={{
                            fontSize: 10, color: 'var(--text-muted)',
                            maxWidth: 130, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {c.position}
                          </span>
                        )}
                        <HeatDot heat={c.heat} />
                        <TypeTag type={c.type} />
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          <div style={{ height: 16 }} />
        </div>
      </section>
    </div>
  );
}
