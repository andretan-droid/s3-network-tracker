import type { Contact } from '../types';

interface Props {
  contacts: Contact[];
}

const heatColors = { hot: 'var(--hot)', warm: 'var(--warm)', cold: 'var(--cold)' };

function Chips({ items, emptyText }: { items: Contact[]; emptyText: string }) {
  if (!items.length) {
    return <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{emptyText}</span>;
  }
  return (
    <>
      {items.map(c => (
        <div key={c.id} className="chip">
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: heatColors[c.heat],
            }}
          />
          {c.name}
        </div>
      ))}
    </>
  );
}

export default function StructuralHoleMap({ contacts }: Props) {
  const clients = contacts.filter(c => c.type === 'client');
  const capital = contacts.filter(c => c.type === 'capital_provider');
  const partners = contacts.filter(c => c.type === 'partner');
  const unclassified = contacts.filter(c => c.type === 'unclassified');

  const ratio = clients.length && capital.length
    ? (clients.length / capital.length).toFixed(1)
    : 'N/A';

  const imbalanced =
    clients.length > 0 &&
    capital.length > 0 &&
    (clients.length / capital.length > 3 || capital.length / clients.length > 3);

  const heavySide = clients.length > capital.length ? 'client' : 'capital provider';
  const lightSide = clients.length > capital.length ? 'capital provider' : 'client';

  return (
    <div className="hole-wrap">
      <p className="hole-intro">
        Your firm sits in a <strong>structural hole</strong> — bridging clients who need capital
        or advisory with banks and investors who need deal flow. The gap between those two groups
        is your strategic advantage. This map shows the shape of your network.
      </p>

      <div className="hole-metrics">
        <div className="hole-metric">
          <div className="hole-metric-value" style={{ color: 'var(--client)' }}>
            {clients.length}
          </div>
          <div className="hole-metric-label">Clients</div>
        </div>
        <div className="hole-metric">
          <div className="hole-metric-value" style={{ color: 'var(--capital)' }}>
            {capital.length}
          </div>
          <div className="hole-metric-label">Capital Providers</div>
        </div>
        <div className="hole-metric">
          <div className="hole-metric-value">{ratio}</div>
          <div className="hole-metric-label">Client : Capital Ratio</div>
        </div>
      </div>

      {imbalanced && (
        <div className="imbalance-warning">
          <strong>Imbalance detected:</strong> You have significantly more {heavySide} contacts
          than {lightSide} contacts. Consider focusing BD efforts on building {lightSide}{' '}
          relationships to strengthen your structural hole position.
        </div>
      )}

      {unclassified.length > 0 && (
        <div className="imbalance-warning">
          <strong>{unclassified.length} unclassified contacts</strong> — these contacts haven't
          been tagged as Client, Capital, or Partner yet. Classify them to get an accurate
          structural hole picture.
        </div>
      )}

      {/* Client side */}
      <div className="tier">
        <div className="tier-header">
          <div className="tier-line" />
          <span className="tier-label" style={{ background: 'var(--client-bg)', color: 'var(--client)' }}>
            Clients ({clients.length})
          </span>
          <div className="tier-line" />
        </div>
        <div className="tier-chips">
          <Chips items={clients} emptyText="No client contacts yet" />
        </div>
      </div>

      {/* Firm node */}
      <div className="firm-circle">
        <div className="firm-node">Sage3 Capital</div>
        <div className="bridge-count">
          Bridging {clients.length} clients ↔ {capital.length} capital providers
        </div>
      </div>

      {/* Capital side */}
      <div className="tier">
        <div className="tier-header">
          <div className="tier-line" />
          <span className="tier-label" style={{ background: 'var(--capital-bg)', color: 'var(--capital)' }}>
            Capital Providers ({capital.length})
          </span>
          <div className="tier-line" />
        </div>
        <div className="tier-chips">
          <Chips items={capital} emptyText="No capital provider contacts yet" />
        </div>
      </div>

      {/* Partners */}
      <div className="tier" style={{ marginTop: 16 }}>
        <div className="tier-header">
          <div className="tier-line" />
          <span className="tier-label" style={{ background: 'var(--partner-bg)', color: 'var(--partner)' }}>
            Partners / Referrers ({partners.length})
          </span>
          <div className="tier-line" />
        </div>
        <div className="tier-chips">
          <Chips items={partners} emptyText="No partner contacts yet" />
        </div>
      </div>
    </div>
  );
}
