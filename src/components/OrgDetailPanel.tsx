/**
 * OrgDetailPanel — Right-anchored slide-in panel that opens when a user
 * clicks a side-node (or the ecosystem cluster node) in NetworkMap2D.
 *
 * Side model (post-fix):
 *   • A side-node represents an org's *structural-hole relationship* on
 *     one side — e.g. `org:maybank:client` shows Maybank's client contacts
 *     only; `org:maybank:capital` shows its capital-provider contacts only.
 *   • A dual-role firm appears in both arcs; the panel pivots between
 *     sides via the inline "Also: N capital-provider contacts →" link.
 *   • Unclassified colleagues at the firm surface as a footnote count,
 *     not as visible rows (they aren't part of either relationship until
 *     tagged via the register's bulk-edit toolbar).
 *
 * Cluster mode:
 *   • Searchable list of ecosystem-only orgs. Clicking a row re-targets
 *     the panel to the appropriate side-node.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../types';
import {
  deriveGraph,
  ECOSYSTEM_CLUSTER_KEY,
  sideNodeId,
  type SideOrgNode,
  type StructuralHoleSide,
} from '../lib/network';
import { TypeTag, HeatDot } from './ui';
import { ChevronRight, X, ExternalLink } from './ui/icons';

interface Props {
  contacts: Contact[];
  /**
   * Compound side-node id (`org:{key}:{side}`), the ecosystem cluster
   * sentinel, or null. null = panel hidden.
   */
  nodeId: string | null;
  onClose: () => void;
  /** Re-target the panel — used by the pivot link and cluster rows. */
  onSelectNode: (nodeId: string) => void;
  /** Open the underlying register row for this firm (org-level scroll). */
  onJumpToRegister?: (orgKey: string) => void;
  /** Jump to a specific person row in the register. */
  onJumpToContact?: (contactId: string, orgKey: string) => void;
}

const SIDE_LABEL: Record<StructuralHoleSide, string> = {
  client:  'Client',
  capital: 'Capital provider',
};

const SIDE_LABEL_PLURAL: Record<StructuralHoleSide, string> = {
  client:  'client contacts',
  capital: 'capital-provider contacts',
};

function otherSide(s: StructuralHoleSide): StructuralHoleSide {
  return s === 'client' ? 'capital' : 'client';
}

export default function OrgDetailPanel({
  contacts, nodeId, onClose, onSelectNode, onJumpToRegister, onJumpToContact,
}: Props) {
  const [clusterQuery, setClusterQuery] = useState('');

  // Reset cluster search whenever the panel target changes.
  useEffect(() => { setClusterQuery(''); }, [nodeId]);

  // Esc to close.
  useEffect(() => {
    if (nodeId === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodeId, onClose]);

  const graph = useMemo(() => deriveGraph(contacts), [contacts]);

  const isCluster = nodeId === ECOSYSTEM_CLUSTER_KEY;

  // Resolve compound id → SideOrgNode (single source of truth in viewOrgs).
  const targetNode: SideOrgNode | null = useMemo(() => {
    if (!nodeId || isCluster) return null;
    return graph.viewOrgs.find(n => n.id === nodeId) ?? null;
  }, [nodeId, isCluster, graph]);

  if (nodeId === null) return null;

  // ─── Cluster mode ──────────────────────────────────────────────────────────
  if (isCluster) {
    const q = clusterQuery.trim().toLowerCase();
    const filtered = q
      ? graph.ecosystemCluster.orgs.filter(o => o.label.toLowerCase().includes(q))
      : graph.ecosystemCluster.orgs;

    return (
      <PanelShell onClose={onClose}>
        <header className="org-detail-panel__head">
          <div className="org-detail-panel__eyebrow">Ecosystem</div>
          <h2 className="org-detail-panel__title">
            {graph.ecosystemCluster.count.toLocaleString()} organisations
          </h2>
          <p className="org-detail-panel__sub">
            Partners, regulators, government, educational, institutes — supporting the
            structural hole without being part of it.
            {graph.ecosystemCluster.activeCount > 0 && (
              <> · <strong>{graph.ecosystemCluster.activeCount}</strong> active</>
            )}
          </p>
        </header>

        <div className="org-detail-panel__search">
          <input
            value={clusterQuery}
            onChange={e => setClusterQuery(e.target.value)}
            placeholder="Search ecosystem organisations..."
            autoFocus
          />
        </div>

        <div className="org-detail-panel__body">
          {filtered.length === 0 ? (
            <div className="org-detail-panel__empty">No matches.</div>
          ) : (
            <ul className="org-detail-panel__cluster-list">
              {filtered.slice(0, 200).map(o => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="org-detail-panel__cluster-row"
                    onClick={() => {
                      // Ecosystem-only orgs have no side-node. Jump to register
                      // row instead — same affordance, lighter weight.
                      onJumpToRegister?.(o.key);
                      onClose();
                    }}
                  >
                    <span className="org-detail-panel__cluster-name">{o.label}</span>
                    <span className="org-detail-panel__cluster-meta">
                      {o.contactCount} {o.contactCount === 1 ? 'contact' : 'contacts'}
                      {o.activeCount > 0 && ` · ${o.activeCount} active`}
                      {o.isColdHub && ' · cold'}
                    </span>
                    <ChevronRight size={12} />
                  </button>
                </li>
              ))}
              {filtered.length > 200 && (
                <li className="org-detail-panel__truncated">
                  Showing first 200 of {filtered.length.toLocaleString()}. Refine search to narrow.
                </li>
              )}
            </ul>
          )}
        </div>
      </PanelShell>
    );
  }

  // ─── Side-node mode ────────────────────────────────────────────────────────
  if (!targetNode) {
    return (
      <PanelShell onClose={onClose}>
        <header className="org-detail-panel__head">
          <div className="org-detail-panel__eyebrow">Not found</div>
          <p className="org-detail-panel__sub">
            This relationship is no longer in the dataset.
          </p>
        </header>
      </PanelShell>
    );
  }

  const pivotToOther = targetNode.otherSideCount > 0
    ? () => onSelectNode(sideNodeId(targetNode.key, otherSide(targetNode.side)))
    : null;

  return (
    <PanelShell onClose={onClose}>
      <header className="org-detail-panel__head">
        <div className={`org-detail-panel__eyebrow org-detail-panel__eyebrow--${targetNode.side}`}>
          {SIDE_LABEL[targetNode.side]}
        </div>
        <h2 className="org-detail-panel__title">{targetNode.label}</h2>
        <p className="org-detail-panel__sub">
          {targetNode.contactCount} {SIDE_LABEL_PLURAL[targetNode.side]}
          {targetNode.activeCount < targetNode.contactCount &&
            ` · ${targetNode.activeCount} active`}
          {targetNode.isColdHub && (
            <> · <span className="org-detail-panel__cold-flag">cold hub</span></>
          )}
          {pivotToOther && (
            <>
              {' · '}
              <button
                type="button"
                className="org-detail-panel__pivot-link"
                onClick={pivotToOther}
              >
                Also: {targetNode.otherSideCount} {SIDE_LABEL_PLURAL[otherSide(targetNode.side)]} →
              </button>
            </>
          )}
        </p>
      </header>

      <div className="org-detail-panel__body">
        <ul className="org-detail-panel__people">
          {targetNode.contacts.map(c => (
            <li key={c.id} className="org-detail-panel__person">
              <button
                type="button"
                className="org-detail-panel__person-row"
                onClick={() => {
                  onJumpToContact?.(c.id, targetNode.key);
                  onClose();
                }}
                title="Jump to this contact in the register"
              >
                <div className="org-detail-panel__person-main">
                  <div className="org-detail-panel__person-name">{c.name}</div>
                  {c.position && (
                    <div className="org-detail-panel__person-role">{c.position}</div>
                  )}
                </div>
                <div className="org-detail-panel__person-chips">
                  <HeatDot heat={c.heat} />
                  <TypeTag type={c.type} />
                </div>
              </button>
            </li>
          ))}
        </ul>

        {targetNode.unclassifiedCount > 0 && (
          <div className="org-detail-panel__unclassified-foot">
            + {targetNode.unclassifiedCount} unclassified colleague
            {targetNode.unclassifiedCount === 1 ? '' : 's'} at this firm — not part of the
            structural-hole relationship.{' '}
            <button
              type="button"
              className="org-detail-panel__pivot-link"
              onClick={() => {
                onJumpToRegister?.(targetNode.key);
                onClose();
              }}
            >
              Open in register to classify →
            </button>
          </div>
        )}
      </div>

      <footer className="org-detail-panel__foot">
        {onJumpToRegister && (
          <button
            type="button"
            className="org-detail-panel__foot-btn"
            onClick={() => {
              onJumpToRegister(targetNode.key);
              onClose();
            }}
          >
            <ExternalLink size={12} /> Jump to register row
          </button>
        )}
        <span className="org-detail-panel__foot-meta">
          {SIDE_LABEL[targetNode.side]}
        </span>
      </footer>
    </PanelShell>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

function PanelShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="org-detail-panel__backdrop" onClick={onClose} aria-hidden />
      <aside
        className="org-detail-panel"
        role="dialog"
        aria-label="Organisation detail"
      >
        <button
          type="button"
          className="org-detail-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
        {children}
      </aside>
    </>
  );
}
