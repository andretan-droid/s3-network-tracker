/**
 * Small visual primitives shared by the Structural Hole register and the
 * OrgDetailPanel. Single source of truth for type/heat chip styling so the
 * map's side panel and the register table never drift out of sync.
 */

import type { ContactType, HeatLevel } from '../../types';

const TYPE_DISPLAY: Record<ContactType, { label: string; color: string; bg: string; border: string }> = {
  client:           { label: 'Client',       color: 'var(--client)',       bg: 'var(--client-bg)',       border: 'var(--client-border)'  },
  capital_provider: { label: 'Capital',      color: 'var(--capital)',      bg: 'var(--capital-bg)',      border: 'var(--capital-border)' },
  partner:          { label: 'Partner',      color: 'var(--partner)',      bg: 'var(--partner-bg)',      border: 'var(--border)'         },
  educational:      { label: 'Educational',  color: 'var(--educational)',  bg: 'var(--educational-bg)',  border: 'var(--border)'         },
  // Ecosystem subtypes share the partner / educational palette in chip form;
  // the network map differentiates them by zone, not by chip colour.
  regulatory:       { label: 'Regulatory',   color: 'var(--partner)',      bg: 'var(--partner-bg)',      border: 'var(--border)'         },
  government:       { label: 'Government',   color: 'var(--partner)',      bg: 'var(--partner-bg)',      border: 'var(--border)'         },
  institute:        { label: 'Institute',    color: 'var(--educational)',  bg: 'var(--educational-bg)',  border: 'var(--border)'         },
  unclassified:     { label: 'Unclassified', color: 'var(--text-muted)',   bg: 'var(--surface-alt)',     border: 'var(--border)'         },
};

const HEAT_COLOR: Record<HeatLevel, string> = {
  hot:  'var(--hot)',
  warm: 'var(--warm)',
  cold: 'var(--cold)',
  '':   'var(--border-strong)',
};

export function TypeTag({ type }: { type: ContactType }) {
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

export function HeatDot({ heat }: { heat: HeatLevel }) {
  return (
    <div
      title={heat || 'unset'}
      style={{ width: 7, height: 7, borderRadius: '50%', background: HEAT_COLOR[heat], flexShrink: 0 }}
    />
  );
}
