import { useState } from 'react';
import type { Contact } from '../types';
import { computeTier, TIER_LABELS } from '../types';

interface Props {
  contacts: Contact[];
}

const heatColors = { hot: 'var(--hot)', warm: 'var(--warm)', cold: 'var(--cold)' };

function ContactChip({ contact: c }: { contact: Contact }) {
  const tier = computeTier(c);
  return (
    <div className={`hole-chip hole-chip-${c.type}`}>
      <div className="hole-chip-heat" style={{ background: heatColors[c.heat] }} />
      <div className="hole-chip-info">
        <span className="hole-chip-name">{c.name}</span>
        <span className="hole-chip-co">{c.company}</span>
      </div>
      {c.owners && <span className="hole-chip-owner">{c.owners}</span>}
      <span className={`hole-chip-tier hole-chip-tier-${tier}`}>{TIER_LABELS[tier]}</span>
    </div>
  );
}

function SidePanel({ title, contacts, color, bgColor, emptyText }: {
  title: string; contacts: Contact[]; color: string; bgColor: string; emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? contacts : contacts.slice(0, 8);
  return (
    <div className="hole-side" style={{ borderColor: color }}>
      <div className="hole-side-header" style={{ background: bgColor, color }}>
        <span className="hole-side-title">{title}</span>
        <span className="hole-side-count">{contacts.length}</span>
      </div>
      <div className="hole-side-list">
        {contacts.length === 0 ? (
          <span className="hole-side-empty">{emptyText}</span>
        ) : (
          <>
            {shown.map(c => <ContactChip key={c.id} contact={c} />)}
            {contacts.length > 8 && (
              <button className="hole-show-more" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : `Show all ${contacts.length}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function StructuralHoleMap({ contacts }: Props) {
  const clients = contacts.filter(c => c.type === 'client');
  const capital = contacts.filter(c => c.type === 'capital_provider');
  const partners = contacts.filter(c => c.type === 'partner');
  const unclassified = contacts.filter(c => c.type === 'unclassified');

  const total = clients.length + capital.length;
  const ratio = clients.length && capital.length
    ? (clients.length / capital.length).toFixed(1)
    : 'N/A';

  const imbalanced = clients.length > 0 && capital.length > 0 &&
    (clients.length / capital.length > 3 || capital.length / clients.length > 3);
  const heavySide = clients.length > capital.length ? 'client' : 'capital provider';
  const lightSide = clients.length > capital.length ? 'capital provider' : 'client';

  return (
    <div className="hole-wrap">
      {/* Explanation */}
      <div className="hole-header-section">
        <h2 className="hole-title">Structural Hole Map</h2>
        <p className="hole-intro">
          Your firm sits in a <strong>structural hole</strong> — the gap between two
          otherwise-disconnected populations. On one side: <strong>clients</strong> who
          need capital, M&A advisory, or strategic guidance. On the other:
          <strong> capital providers</strong> (banks, funds, institutional investors) who
          need deal flow. Sage3 Capital creates value by <strong>bridging</strong> this gap.
          Every contact, meeting, and introduction should be evaluated against this model.
        </p>
      </div>

      {/* Metrics bar */}
      <div className="hole-metrics-bar">
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: 'var(--client)' }}>{clients.length}</span>
          <span className="hole-metric-label">Clients</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value">{ratio}</span>
          <span className="hole-metric-label">Ratio</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: 'var(--capital)' }}>{capital.length}</span>
          <span className="hole-metric-label">Capital Providers</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: 'var(--partner)' }}>{partners.length}</span>
          <span className="hole-metric-label">Partners</span>
        </div>
      </div>

      {imbalanced && (
        <div className="dash-alert" style={{ marginBottom: 20 }}>
          <strong>Imbalance detected:</strong> You have significantly more {heavySide} contacts
          than {lightSide} contacts ({ratio} ratio). Focus BD efforts on building {lightSide}{' '}
          relationships to strengthen your brokerage position.
        </div>
      )}

      {unclassified.length > 0 && (
        <div className="dash-alert" style={{ marginBottom: 20 }}>
          <strong>{unclassified.length} unclassified contacts</strong> — tag them as Client,
          Capital, or Partner to get an accurate structural hole picture.
        </div>
      )}

      {/* Two-sided bridge visualization */}
      <div className="hole-bridge">
        <SidePanel
          title="Clients"
          contacts={clients}
          color="var(--client)"
          bgColor="var(--client-bg)"
          emptyText="No client contacts yet"
        />

        {/* Center bridge node */}
        <div className="hole-center">
          <div className="hole-bridge-lines hole-bridge-lines-left">
            {[...Array(Math.min(clients.length, 6))].map((_, i) => (
              <div key={i} className="bridge-line bridge-line-client" />
            ))}
          </div>
          <div className="hole-firm-node">
            <div className="hole-firm-inner">
              <span className="hole-firm-name">Sage3</span>
              <span className="hole-firm-sub">Capital</span>
            </div>
            <div className="hole-firm-stat">
              Bridging {total} contacts
            </div>
          </div>
          <div className="hole-bridge-lines hole-bridge-lines-right">
            {[...Array(Math.min(capital.length, 6))].map((_, i) => (
              <div key={i} className="bridge-line bridge-line-capital" />
            ))}
          </div>
        </div>

        <SidePanel
          title="Capital Providers"
          contacts={capital}
          color="var(--capital)"
          bgColor="var(--capital-bg)"
          emptyText="No capital provider contacts yet"
        />
      </div>

      {/* Partners section below */}
      {partners.length > 0 && (
        <div className="hole-partners-section">
          <div className="hole-partners-header">
            <div className="tier-line" />
            <span className="hole-partners-label">Partners & Referrers ({partners.length})</span>
            <div className="tier-line" />
          </div>
          <p className="hole-partners-desc">
            Partners and referrers amplify your brokerage — they introduce you to contacts
            on both sides of the hole.
          </p>
          <div className="hole-partners-grid">
            {partners.slice(0, 16).map(c => (
              <ContactChip key={c.id} contact={c} />
            ))}
            {partners.length > 16 && (
              <span style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 12px' }}>
                +{partners.length - 16} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
