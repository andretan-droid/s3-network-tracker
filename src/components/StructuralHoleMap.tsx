import { useState, useMemo } from 'react';
import type { Contact, ContactType, RelationshipTier } from '../types';
import { computeTier, TIER_LABELS } from '../types';

interface Props {
  contacts: Contact[];
}

const MAX_PER_TYPE = 16;
const W = 600, H = 520, CX = W / 2, CY = H / 2;

const TYPE_CFG: Record<ContactType, {
  hex: string;
  label: string;
  angle: number;
  spread: number;
}> = {
  client: { hex: '#548235', label: 'Clients', angle: 180, spread: 60 },
  capital_provider: { hex: '#4A6B8A', label: 'Capital Providers', angle: 0, spread: 60 },
  partner: { hex: '#8B6914', label: 'Partners', angle: 90, spread: 50 },
  educational: { hex: '#6B5B95', label: 'Educational', angle: 245, spread: 30 },
  unclassified: { hex: '#8A8A86', label: 'Unclassified', angle: 310, spread: 25 },
};

const HEAT_CLR: Record<string, string> = {
  hot: '#C4533A', warm: '#D4922A', cold: '#8A8A86',
};

const TIER_DIST: Record<RelationshipTier, [number, number]> = {
  tier_1_inner_circle: [85, 125],
  tier_2_strategic: [135, 180],
  tier_3_dormant: [190, 240],
};

const TIER_R: Record<RelationshipTier, number> = {
  tier_1_inner_circle: 7,
  tier_2_strategic: 5,
  tier_3_dormant: 3.5,
};

interface Node {
  c: Contact;
  x: number;
  y: number;
  r: number;
  hex: string;
  tier: RelationshipTier;
}

function srand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function layout(contacts: Contact[], cx: number, cy: number): Node[] {
  const groups: Partial<Record<ContactType, Contact[]>> = {};
  contacts.forEach(c => (groups[c.type] ??= []).push(c));

  const nodes: Node[] = [];

  for (const [type, grp] of Object.entries(groups) as [ContactType, Contact[]][]) {
    const cfg = TYPE_CFG[type];
    if (!cfg) continue;

    const sorted = [...grp].sort((a, b) => {
      const tO: Record<string, number> = { tier_1_inner_circle: 0, tier_2_strategic: 1, tier_3_dormant: 2 };
      const hO: Record<string, number> = { hot: 0, warm: 1, cold: 2, '': 3 };
      const ta = tO[computeTier(a)] ?? 2, tb = tO[computeTier(b)] ?? 2;
      return ta !== tb ? ta - tb : (hO[a.heat] ?? 3) - (hO[b.heat] ?? 3);
    });

    const shown = sorted.slice(0, MAX_PER_TYPE);
    const half = cfg.spread / 2;

    shown.forEach((c, i) => {
      const tier = computeTier(c);
      const [dMin, dMax] = TIER_DIST[tier];
      const r = TIER_R[tier];

      const base = shown.length === 1
        ? cfg.angle
        : cfg.angle - half + (cfg.spread / (shown.length - 1)) * i;

      const s1 = i * 17 + type.charCodeAt(0) * 31;
      const s2 = i * 23 + (type.charCodeAt(1) ?? 0) * 37;
      const angle = base + (srand(s1) - 0.5) * 14;
      const dist = dMin + (dMax - dMin) * srand(s2);

      const rad = (angle * Math.PI) / 180;
      nodes.push({
        c,
        x: cx + dist * Math.cos(rad),
        y: cy + dist * Math.sin(rad),
        r,
        hex: cfg.hex,
        tier,
      });
    });
  }
  return nodes;
}

export default function StructuralHoleMap({ contacts }: Props) {
  const [hov, setHov] = useState<number | null>(null);

  const nodes = useMemo(() => layout(contacts, CX, CY), [contacts]);

  const counts = useMemo(() => {
    const m: Partial<Record<ContactType, number>> = {};
    contacts.forEach(c => (m[c.type] = (m[c.type] ?? 0) + 1));
    return m;
  }, [contacts]);

  const nCli = counts.client ?? 0;
  const nCap = counts.capital_provider ?? 0;
  const ratio = nCli && nCap ? (nCli / nCap).toFixed(1) : 'N/A';

  if (contacts.length === 0) {
    return (
      <div className="hole-wrap">
        <h2 className="hole-title">Network Map</h2>
        <div className="empty">No contacts yet. Add contacts to see the network.</div>
      </div>
    );
  }

  const hovNode = hov !== null ? nodes[hov] : null;

  return (
    <div className="hole-wrap">
      <h2 className="hole-title">Network Map</h2>

      <div className="hole-metrics-bar">
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: '#548235' }}>{nCli}</span>
          <span className="hole-metric-label">Clients</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value">{ratio}</span>
          <span className="hole-metric-label">Ratio</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: '#4A6B8A' }}>{nCap}</span>
          <span className="hole-metric-label">Capital</span>
        </div>
        <div className="hole-metric-divider" />
        <div className="hole-metric">
          <span className="hole-metric-value" style={{ color: '#8B6914' }}>{counts.partner ?? 0}</span>
          <span className="hole-metric-label">Partners</span>
        </div>
        {(counts.educational ?? 0) > 0 && (
          <>
            <div className="hole-metric-divider" />
            <div className="hole-metric">
              <span className="hole-metric-value" style={{ color: '#6B5B95' }}>{counts.educational}</span>
              <span className="hole-metric-label">Educational</span>
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <circle cx={CX} cy={CY} r={125} fill="none" stroke="#DCE8D4" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />
          <circle cx={CX} cy={CY} r={180} fill="none" stroke="#DCE8D4" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
          <circle cx={CX} cy={CY} r={240} fill="none" stroke="#DCE8D4" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.2" />

          {nodes.map((n, i) => (
            <line
              key={`e${i}`}
              x1={CX} y1={CY} x2={n.x} y2={n.y}
              stroke={n.hex}
              strokeWidth={hov === i ? 1.5 : 0.4}
              opacity={hov === i ? 0.5 : 0.12}
            />
          ))}

          <circle cx={CX} cy={CY} r={28} fill="#3D6027" />
          <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">S3</text>
          <text x={CX} y={CY + 9} textAnchor="middle" fill="white" fontSize="8" opacity="0.8">Capital</text>

          {nodes.map((n, i) => {
            const hot = n.c.heat === 'hot';
            const warm = n.c.heat === 'warm';
            const isH = hov === i;
            const dim = hov !== null && !isH;
            return (
              <g
                key={i}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                style={{ cursor: 'pointer' }}
              >
                {hot && (
                  <circle cx={n.x} cy={n.y} r={n.r + 4} fill="none"
                    stroke="#C4533A" strokeWidth="1.5" opacity={dim ? 0.15 : 0.4} />
                )}
                {warm && (
                  <circle cx={n.x} cy={n.y} r={n.r + 3} fill="none"
                    stroke="#D4922A" strokeWidth="1" opacity={dim ? 0.1 : 0.3} />
                )}
                <circle
                  cx={n.x} cy={n.y}
                  r={isH ? n.r + 2 : n.r}
                  fill={n.hex}
                  stroke={isH ? '#1a1a18' : 'white'}
                  strokeWidth={isH ? 2 : 1}
                  opacity={dim ? 0.3 : 0.9}
                />
                {(isH || n.tier === 'tier_1_inner_circle') && (
                  <text
                    x={n.x} y={n.y - n.r - 6}
                    textAnchor="middle"
                    fill={dim ? '#a8a8a4' : '#1a1a18'}
                    fontSize="9"
                    fontWeight={isH ? '600' : '400'}
                  >
                    {n.c.name.length > 18 ? n.c.name.slice(0, 16) + '…' : n.c.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovNode && (
          <div style={{
            position: 'absolute',
            left: `${(hovNode.x / W) * 100}%`,
            top: `${(hovNode.y / H) * 100}%`,
            transform: 'translate(-50%, -100%) translateY(-20px)',
            background: 'white',
            border: '1px solid #DCE8D4',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            pointerEvents: 'none' as const,
            zIndex: 10,
            whiteSpace: 'nowrap' as const,
          }}>
            <div style={{ fontWeight: 600 }}>{hovNode.c.name}</div>
            <div style={{ color: '#7a7a76', fontSize: 11 }}>{hovNode.c.company}</div>
            {hovNode.c.position && (
              <div style={{ color: '#a8a8a4', fontSize: 10 }}>{hovNode.c.position}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11 }}>
              <span style={{ color: hovNode.hex, fontWeight: 500 }}>
                {TYPE_CFG[hovNode.c.type]?.label}
              </span>
              <span style={{ color: '#a8a8a4' }}>{TIER_LABELS[hovNode.tier]}</span>
              {hovNode.c.heat && (
                <span style={{ color: HEAT_CLR[hovNode.c.heat] ?? '#a8a8a4', fontWeight: 500 }}>
                  {hovNode.c.heat}
                </span>
              )}
            </div>
            {hovNode.c.owners && (
              <div style={{ color: '#a8a8a4', fontSize: 10, marginTop: 2 }}>
                Owner: {hovNode.c.owners}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20,
        marginTop: 16, flexWrap: 'wrap' as const,
      }}>
        {(Object.entries(TYPE_CFG) as [ContactType, typeof TYPE_CFG[ContactType]][]).map(([type, cfg]) => {
          const ct = counts[type] ?? 0;
          if (ct === 0) return null;
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.hex }} />
              <span style={{ color: '#4a4a46' }}>{cfg.label}</span>
              <span style={{ fontWeight: 600 }}>{ct}</span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#a8a8a4' }}>
        Showing top {nodes.length} of {contacts.length} contacts by tier and heat
      </div>
    </div>
  );
}
