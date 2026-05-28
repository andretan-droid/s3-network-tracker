/**
 * DirectorBrief — Text-first action surface above the network map.
 *
 * Single-column layout (post-SPOF removal):
 *   • Cold hubs list  — orgs with all-dormant contacts, sorted most-stale-first
 *                       with one-click "Open in register" actions
 *   • Network balance — clients vs capital horizontal bar with interpretation
 *
 * SPOF / "key-person risks" used to live here as a second column. It was
 * removed at the director's request — the concept was more academic than
 * operational. Cold hubs are kept because they map directly to "where do
 * we have a dead relationship we should resurrect or archive".
 *
 * Data is computed once in `computeBrief()` (src/lib/network.ts). The brief
 * doesn't duplicate any derivation logic.
 */

import { useMemo } from 'react';
import type { Contact } from '../types';
import { ECOSYSTEM_TYPES, TYPE_LABELS } from '../types';
import { computeBrief } from '../lib/network';
import { Button } from './ui';
import { AlertCircle, ExternalLink, CheckCircle2 } from './ui/icons';

/** Human-readable list of ecosystem subtype labels, derived once from the
 *  ECOSYSTEM_TYPES array. Keeps the brief's prose in lockstep with the
 *  schema — adding a new ecosystem type to types/index.ts auto-updates the
 *  text below without further edits. */
const ECOSYSTEM_LABEL_LIST = ECOSYSTEM_TYPES
  .map(t => TYPE_LABELS[t].toLowerCase().replace(/ \/.*$/, '').replace(/ body$/, ''))
  .join(', ');

interface Props {
  contacts: Contact[];
  /** Lifted from StructuralHoleMap — same channel the network map's click handler uses. */
  onOrgClick: (orgKey: string) => void;
}

export default function DirectorBrief({ contacts, onOrgClick }: Props) {
  const brief = useMemo(() => computeBrief(contacts), [contacts]);

  const total = brief.clientCount + brief.capitalCount;
  const clientPct = total > 0 ? (brief.clientCount / total) * 100 : 50;
  const balanced = Math.abs(clientPct - 50) <= 20;

  let interpretation: string;
  if (total === 0) {
    interpretation = 'No clients or capital providers in scope yet. Add contacts to see the balance.';
  } else if (balanced) {
    interpretation =
      `Healthy balance — ${brief.clientCount} client${brief.clientCount === 1 ? '' : 's'} and ` +
      `${brief.capitalCount} capital provider${brief.capitalCount === 1 ? '' : 's'}. ` +
      `The broker position is well placed.`;
  } else if (clientPct > 50) {
    const ratio = (brief.clientCount / Math.max(1, brief.capitalCount)).toFixed(1);
    interpretation =
      `Client-heavy (${ratio}× more clients than capital providers). ` +
      `Bias outreach toward capital providers to strengthen the broker position.`;
  } else {
    const ratio = (brief.capitalCount / Math.max(1, brief.clientCount)).toFixed(1);
    interpretation =
      `Capital-heavy (${ratio}× more capital providers than clients). ` +
      `Bias outreach toward clients to strengthen the broker position.`;
  }

  const isEmptyBrief = brief.colds.length === 0 && total === 0;

  return (
    <section className="director-brief">
      <header className="director-brief__head">
        <h2 className="director-brief__title">Director brief</h2>
        <p className="director-brief__sub">
          The actions and signals that need your attention this week, derived from
          NetworkTracker.xlsx.
        </p>
      </header>

      {isEmptyBrief ? (
        <div className="director-brief__empty director-brief__empty--big">
          <CheckCircle2 size={18} />
          <span>
            No contacts in scope yet. The brief will populate as you add contacts to
            NetworkTracker.xlsx.
          </span>
        </div>
      ) : (
        <div className="director-brief__rows">

          {/* ─── Cold hubs ────────────────────────────────────────────── */}
          <div className="director-brief__col director-brief__col--full">
            <div className="director-brief__col-head">
              <span className="director-brief__col-icon director-brief__col-icon--danger" aria-hidden>
                <AlertCircle />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="director-brief__col-title">
                  Cold hubs
                  <span className="director-brief__col-count">{brief.colds.length}</span>
                </h3>
                <p className="director-brief__col-sub">
                  Organisations with contacts on paper but everyone is dormant. The
                  relationship has gone cold and needs deliberate re-engagement or archiving.
                  Sorted most-stale first.
                </p>
              </div>
            </div>

            {brief.colds.length === 0 ? (
              <div className="director-brief__empty">
                <CheckCircle2 size={14} />
                <span>No cold hubs. Every organisation has at least one active contact.</span>
              </div>
            ) : (
              <ul className="director-brief__list director-brief__list--grid">
                {brief.colds.map(c => (
                  <li key={c.orgKey} className="director-brief__item director-brief__item--danger">
                    <div className="director-brief__item-main">
                      <div className="director-brief__item-org">{c.org}</div>
                      <div className="director-brief__item-detail">
                        {c.contactCount} dormant contact{c.contactCount === 1 ? '' : 's'} ·
                        no active relationships
                      </div>
                      <div className="director-brief__item-sub">
                        {c.daysSinceMostRecent === null
                          ? 'Never touched'
                          : `${c.daysSinceMostRecent} day${c.daysSinceMostRecent === 1 ? '' : 's'} since the most recent touch`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOrgClick(c.orgKey)}
                    >
                      <ExternalLink /> Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ─── Network balance ──────────────────────────────────────── */}
          <div className="director-brief__balance">
            <div className="director-brief__balance-labels">
              <span style={{ color: 'var(--client)' }}>
                <strong>{brief.clientCount}</strong> client{brief.clientCount === 1 ? '' : 's'}
              </span>
              <span style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                Network balance
              </span>
              <span style={{ color: 'var(--capital)' }}>
                <strong>{brief.capitalCount}</strong> capital
              </span>
            </div>
            <div className="director-brief__balance-track">
              <div
                className="director-brief__balance-fill director-brief__balance-fill--client"
                style={{ width: `${clientPct}%` }}
              />
              <div
                className="director-brief__balance-fill director-brief__balance-fill--capital"
                style={{ width: `${100 - clientPct}%` }}
              />
              <div className="director-brief__balance-mark" />
            </div>
            <p className="director-brief__balance-interp">{interpretation}</p>
            {brief.ecosystemCount > 0 && (
              <p className="director-brief__balance-aux">
                Plus {brief.ecosystemCount} ecosystem contact{brief.ecosystemCount === 1 ? '' : 's'} —
                {' '}{ECOSYSTEM_LABEL_LIST} — supporting the structural hole without being
                part of it.
              </p>
            )}
          </div>

        </div>
      )}
    </section>
  );
}
