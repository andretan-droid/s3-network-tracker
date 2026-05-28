/**
 * NetworkMap2D — 2D structural-hole map with SEMANTIC positions.
 *
 *      ECOSYSTEM cluster (top — single aggregate node)
 *                       │
 *      CLIENTS ────── Sage 3 ────── CAPITAL PROVIDERS
 *      (left arc)        ●         (5 sub-type sectors, right)
 *
 * Capital providers are grouped by sub-type into 5 angular sectors that fan
 * across the right semicircle (Banks → Inv. Banks → PE/VC → Family Office →
 * Other). Within each sector, nodes sit at one of three concentric radii
 * based on relationship tier:
 *
 *   r = 170  Tier 1 — Active    (≤ 45 days since last touch)
 *   r = 250  Tier 2 — Strategic (46 – 200 days)
 *   r = 320  Tier 3 — Dormant   (> 200 days)
 *
 * Client nodes fan across a 160° left arc at the same three radii.
 *
 * Visual encoding:
 *   Node size  18 / 14 / 10 px for tiers 1 / 2 / 3
 *   Opacity    100% / 75% / 30% for tiers 1 / 2 / 3
 *   Edges      drawn to tier 1 + 2 only; suppressed for tier 3 to cut clutter
 *   Labels     shown for tier 1 + 2; tier 3 name appears on hover tooltip only
 *
 * Hover a node to see its name, sub-type, contact count, and last-touch info.
 * Tier guide rings and sector dividers are rendered as faint SVG decorations.
 */

import { useMemo, useRef, useEffect, useState, memo } from 'react';
import type { Contact } from '../types';
import { daysSinceTouch } from '../types';
import type { RelationshipTier, CapitalSubType } from '../types';
import { CAPITAL_SUBTYPE_LABELS } from '../types';
import {
  deriveGraph,
  ECOSYSTEM_CLUSTER_KEY,
  type SideOrgNode,
  type ZoneKind,
} from '../lib/network';
import { ZoomIn, ZoomOut, Maximize2 } from './ui/icons';

interface Props {
  contacts: Contact[];
  /**
   * Fired when a side-node or the ecosystem cluster is clicked. The string
   * is either a compound side-node id (`org:{key}:{side}`) or the cluster
   * sentinel.
   */
  onOrgClick?: (nodeId: string) => void;
  /** Currently selected node id (compound or cluster sentinel). */
  selectedNodeId?: string | null;
}

// ─── Layout constants ────────────────────────────────────────────────────────

const VIEWBOX = { x: -540, y: -360, w: 1080, h: 720 };
const HUB_R = 36;
const CLUSTER_R = 26;
const CLUSTER_RADIUS = 220;   // ecosystem cluster sits above hub, not too close to tier rings

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.4;

// Concentric radii for each tier — capped so that nodes at ±90° stay inside the viewBox
const TIER_RADII: Record<RelationshipTier, number> = {
  tier_1_inner_circle: 170,
  tier_2_strategic:    250,
  tier_3_dormant:      320,
};

// SVG circle radius for the node's <circle> element
const TIER_NODE_RADII: Record<RelationshipTier, number> = {
  tier_1_inner_circle: 18,
  tier_2_strategic:    14,
  tier_3_dormant:      10,
};

// Group-level opacity so that dormant nodes fade into the background
const TIER_OPACITY: Record<RelationshipTier, number> = {
  tier_1_inner_circle: 1.00,
  tier_2_strategic:    0.75,
  tier_3_dormant:      0.30,
};

interface Sector {
  id: string;
  subTypes: CapitalSubType[];
  centerDeg: number;
  spanDeg: number;
  label: string;
}

// Five 36° slices of the right semicircle (-90° to +90°, centre 0°).
// '' (untagged) falls into the "other" catch-all so existing data still renders.
const CAPITAL_SECTORS: Sector[] = [
  { id: 'bank',            subTypes: ['bank'],              centerDeg: -72, spanDeg: 36, label: 'Banks' },
  { id: 'investment_bank', subTypes: ['investment_bank'],   centerDeg: -36, spanDeg: 36, label: 'Inv. Banks' },
  { id: 'pe_vc_fund',      subTypes: ['pe_vc_fund'],        centerDeg:   0, spanDeg: 36, label: 'PE / VC' },
  { id: 'family_office',   subTypes: ['family_office'],     centerDeg:  36, spanDeg: 36, label: 'Family Office' },
  { id: 'other',           subTypes: ['other', ''],         centerDeg:  72, spanDeg: 36, label: 'Other' },
];

const CLIENT_ARC = { center: 180, span: 160 };

// Angles (degrees) where radial divider lines are drawn on the capital side
const SECTOR_BOUNDARIES = [-90, -54, -18, 18, 54, 90] as const;

const GUIDE_INNER_R = 130;   // guide rings + dividers start just beyond the hub
const GUIDE_OUTER_R = 335;   // guide rings end just beyond the tier-3 orbit

// ─── Pure layout helpers ─────────────────────────────────────────────────────

function polarToSvg(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
}

interface Pos { x: number; y: number; angleDeg: number; }

function arcLayout(
  items: ReadonlyArray<{ id: string }>,
  centerDeg: number,
  spanDeg: number,
  radius: number,
): Map<string, Pos> {
  const out = new Map<string, Pos>();
  const n = items.length;
  if (n === 0) return out;
  const half = spanDeg / 2;
  const start = centerDeg - half;
  const step = n === 1 ? 0 : spanDeg / (n - 1);
  items.forEach((item, i) => {
    const deg = n === 1 ? centerDeg : start + step * i;
    const { x, y } = polarToSvg(deg, radius);
    out.set(item.id, { x, y, angleDeg: deg });
  });
  return out;
}

/**
 * New sectored + concentric layout:
 *  - Capital side: 5 sub-type sectors × 3 tier radii
 *  - Client side:  160° arc × 3 tier radii
 */
function computeOrgPositionsSectored(viewOrgs: SideOrgNode[]): Map<string, Pos> {
  const out = new Map<string, Pos>();

  // ── Capital side ──────────────────────────────────────────────────────────
  const capitalOrgs = viewOrgs.filter(o => o.side === 'capital');

  for (const sector of CAPITAL_SECTORS) {
    const sectorOrgs = capitalOrgs.filter(o => sector.subTypes.includes(o.subType));
    for (const tier of ['tier_1_inner_circle', 'tier_2_strategic', 'tier_3_dormant'] as const) {
      const group = sectorOrgs.filter(o => o.tier === tier);
      if (group.length === 0) continue;
      const positions = arcLayout(group, sector.centerDeg, sector.spanDeg, TIER_RADII[tier]);
      for (const [id, pos] of positions) out.set(id, pos);
    }
  }

  // ── Client side ───────────────────────────────────────────────────────────
  const clientOrgs = viewOrgs.filter(o => o.side === 'client');
  for (const tier of ['tier_1_inner_circle', 'tier_2_strategic', 'tier_3_dormant'] as const) {
    const group = clientOrgs.filter(o => o.tier === tier);
    if (group.length === 0) continue;
    const positions = arcLayout(group, CLIENT_ARC.center, CLIENT_ARC.span, TIER_RADII[tier]);
    for (const [id, pos] of positions) out.set(id, pos);
  }

  return out;
}

// ─── Hover tooltip ────────────────────────────────────────────────────────────

interface TooltipData {
  node: SideOrgNode;
  screenX: number;
  screenY: number;
}

function NodeTooltip({ data: { node, screenX, screenY } }: { data: TooltipData }) {
  const allDays = node.contacts.map(c => daysSinceTouch(c)).filter((d): d is number => d !== null);
  const bestDays = allDays.length > 0 ? Math.min(...allDays) : null;

  const tierLabel = node.tier === 'tier_1_inner_circle' ? 'Active'
    : node.tier === 'tier_2_strategic' ? 'Strategic'
    : 'Dormant';
  const tierColor = node.tier === 'tier_1_inner_circle' ? 'var(--accent)'
    : node.tier === 'tier_2_strategic' ? 'var(--hot)'
    : 'var(--text-muted)';

  const subLabel = node.side === 'capital'
    ? CAPITAL_SUBTYPE_LABELS[node.subType]
    : 'Client';

  return (
    <div
      className="netmap__tooltip"
      style={{ position: 'fixed', left: screenX + 14, top: screenY - 12, pointerEvents: 'none' }}
    >
      <div className="netmap__tooltip-name">{node.label}</div>
      <div className="netmap__tooltip-type">{subLabel}</div>
      <div className="netmap__tooltip-row">
        {node.contactCount} {node.contactCount === 1 ? 'contact' : 'contacts'}
        {node.activeCount > 0 && (
          <> · <span style={{ color: 'var(--accent)' }}>{node.activeCount} active</span></>
        )}
      </div>
      {bestDays !== null && (
        <div className="netmap__tooltip-row">
          Last touch: {bestDays === 0 ? 'today' : `${bestDays}d ago`}
        </div>
      )}
      <div className="netmap__tooltip-tier" style={{ color: tierColor }}>
        ● {tierLabel}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function NetworkMap2D({ contacts, onOrgClick, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]     = useState(1);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // ── Data derivation ──────────────────────────────────────────────────────
  const graph = useMemo(() => deriveGraph(contacts), [contacts]);
  const { viewOrgs, ecosystemCluster } = graph;
  const orgPos = useMemo(() => computeOrgPositionsSectored(viewOrgs), [viewOrgs]);

  const clusterPos: Pos = useMemo(
    () => ({ ...polarToSvg(90, CLUSTER_RADIUS), angleDeg: 90 }),
    [],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOrgClick    = (node: SideOrgNode) => onOrgClick?.(node.id);
  const handleClusterClick = () => onOrgClick?.(ECOSYSTEM_CLUSTER_KEY);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Pan ──────────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    pointerId: number;
    startX: number; startY: number;
    origPanX: number; origPanY: number;
    moved: number;
  } | null>(null);

  const isNodeTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    let el: Element | null = target;
    while (el && el !== svgRef.current) {
      if (el.classList?.contains('netmap__hit')) return true;
      el = el.parentElement;
    }
    return false;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isNodeTarget(e.target)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      origPanX: pan.x, origPanY: pan.y,
      moved: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = VIEWBOX.w / rect.width;
    setPan({ x: d.origPanX + dx * factor, y: d.origPanY + dy * factor });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture(d.pointerId);
    dragRef.current = null;
  };

  // ── Wheel zoom ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * delta)));
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const worldTransform = `translate(${pan.x} ${pan.y}) scale(${zoom})`;
  const zoneCount = (zone: ZoneKind) => {
    if (zone === 'ecosystem') return ecosystemCluster.count;
    return viewOrgs.filter(o => o.side === zone).length;
  };
  const isClusterSelected = selectedNodeId === ECOSYSTEM_CLUSTER_KEY;

  return (
    <div className="netmap">
      {/* Tooltip rendered outside SVG so it's positioned in screen space */}
      {tooltip && <NodeTooltip data={tooltip} />}

      <svg
        ref={svgRef}
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="netmap__svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="hub-glow">
            <stop offset="0%" stopColor="var(--accent-light)" stopOpacity="0.40" />
            <stop offset="100%" stopColor="var(--accent-light)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={worldTransform}>

          {/* ── Tier guide rings (faint concentric circles) ─────────── */}
          {([170, 250, 320] as const).map(r => (
            <circle key={`ring-${r}`} cx={0} cy={0} r={r} className="netmap__tier-ring" />
          ))}

          {/* ── Capital sector divider lines ────────────────────────── */}
          {SECTOR_BOUNDARIES.map(angle => {
            const inner = polarToSvg(angle, GUIDE_INNER_R);
            const outer = polarToSvg(angle, GUIDE_OUTER_R);
            return (
              <line
                key={`div-${angle}`}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                className="netmap__sector-line"
              />
            );
          })}

          {/* ── Capital sector labels (outer edge) ──────────────────── */}
          {CAPITAL_SECTORS.map(sector => {
            const pos = polarToSvg(sector.centerDeg, GUIDE_OUTER_R + 20);
            return (
              <text
                key={`sec-lbl-${sector.id}`}
                x={pos.x} y={pos.y}
                className="netmap__sector-label"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {sector.label}
              </text>
            );
          })}

          {/* ── Tier ring labels (bottom-right, outside capital arc) ── */}
          {([
            [170, 'Active'],
            [250, 'Strategic'],
            [320, 'Dormant'],
          ] as const).map(([r, label]) => {
            // Place just below the lowest sector (bank sector bottom = -90°)
            // Offset inward slightly so labels don't sit on the ring line
            const pos = polarToSvg(-82, r);
            return (
              <text
                key={`tier-lbl-${r}`}
                x={pos.x + 4} y={pos.y}
                className="netmap__tier-label"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {label}
              </text>
            );
          })}

          {/* ── Editorial axis ───────────────────────────────────────── */}
          <line
            x1={-VIEWBOX.w / 2} y1={0} x2={VIEWBOX.w / 2} y2={0}
            className="netmap__axis"
          />
          <line
            x1={0} y1={-VIEWBOX.h / 2 + 40} x2={0} y2={0}
            className="netmap__axis netmap__axis--vertical"
          />

          {/* ── Hub → side-node edges (suppressed for tier 3) ─────────── */}
          {viewOrgs.map(node => {
            if (node.tier === 'tier_3_dormant') return null;
            const p = orgPos.get(node.id);
            if (!p) return null;
            const edgeOpacity = node.tier === 'tier_1_inner_circle' ? 0.55 : 0.22;
            return (
              <line
                key={`edge-${node.id}`}
                x1={0} y1={0} x2={p.x} y2={p.y}
                className={`netmap__link netmap__link--${node.side}`}
                opacity={edgeOpacity}
              />
            );
          })}
          {ecosystemCluster.count > 0 && (
            <line
              x1={0} y1={0} x2={clusterPos.x} y2={clusterPos.y}
              className="netmap__link netmap__link--ecosystem"
            />
          )}

          {/* ── Hub glow ─────────────────────────────────────────────── */}
          <circle cx={0} cy={0} r={HUB_R + 22} fill="url(#hub-glow)" />

          {/* ── Hub ──────────────────────────────────────────────────── */}
          <g className="netmap__node netmap__node--hub netmap__hit" transform="translate(0 0)">
            <circle r={HUB_R} className="netmap__node-circle" />
            <text textAnchor="middle" dy="4" className="netmap__hub-label">SAGE 3</text>
          </g>

          {/* ── Ecosystem cluster ─────────────────────────────────────── */}
          {ecosystemCluster.count > 0 && (
            <g
              className={[
                'netmap__node', 'netmap__node--ecosystem', 'netmap__node--cluster',
                isClusterSelected ? 'netmap__node--expanded' : '',
                'netmap__hit',
              ].filter(Boolean).join(' ')}
              transform={`translate(${clusterPos.x} ${clusterPos.y})`}
              onClick={(e) => { e.stopPropagation(); handleClusterClick(); }}
              style={{ cursor: 'pointer' }}
            >
              {isClusterSelected && (
                <circle r={CLUSTER_R + 5} fill="none" stroke="var(--accent)" strokeWidth="2" />
              )}
              <circle r={CLUSTER_R + 3} className="netmap__node-cluster-ring" />
              <circle r={CLUSTER_R} className="netmap__node-circle" />
              <text className="netmap__node-cluster-label" textAnchor="middle" dy="4">
                {ecosystemCluster.count}
              </text>
              <text className="netmap__node-label" textAnchor="middle" y={CLUSTER_R + 18}>
                ECOSYSTEM
              </text>
              <text className="netmap__node-sub" textAnchor="middle" y={CLUSTER_R + 32}>
                {ecosystemCluster.count} {ecosystemCluster.count === 1 ? 'org' : 'orgs'}
                {ecosystemCluster.activeCount > 0 && ` · ${ecosystemCluster.activeCount} active`}
              </text>
            </g>
          )}

          {/* ── Side-nodes — clients on left, capital on right ─────────── */}
          {viewOrgs.map(node => {
            const p = orgPos.get(node.id);
            if (!p) return null;
            const isSelected = selectedNodeId === node.id;
            const isDualRole = node.otherSideCount > 0;
            const nodeR = TIER_NODE_RADII[node.tier];
            // Tier-3 labels only appear via the hover tooltip — labels would
            // be tiny at 10px radius and overlap heavily at high node counts.
            const showLabel = node.tier !== 'tier_3_dormant';

            return (
              <g
                key={node.id}
                className={[
                  'netmap__node', 'netmap__node--org',
                  `netmap__node--${node.side}`,
                  node.isColdHub ? 'netmap__node--cold' : '',
                  isSelected ? 'netmap__node--expanded' : '',
                  isDualRole ? 'netmap__node--dual-role' : '',
                  'netmap__hit',
                ].filter(Boolean).join(' ')}
                transform={`translate(${p.x} ${p.y})`}
                opacity={TIER_OPACITY[node.tier]}
                onClick={(e) => { e.stopPropagation(); handleOrgClick(node); }}
                onMouseEnter={(e) => setTooltip({ node, screenX: e.clientX, screenY: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, screenX: e.clientX, screenY: e.clientY } : null)}
                style={{ cursor: 'pointer' }}
              >
                {node.isColdHub && (
                  <circle
                    r={nodeR + 6}
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.7"
                  />
                )}
                {isSelected && (
                  <circle r={nodeR + 4} fill="none" stroke="var(--accent)" strokeWidth="2" />
                )}
                <circle r={nodeR} className="netmap__node-circle" />
                {isDualRole && (
                  <circle
                    r={nodeR - 4}
                    fill="none"
                    stroke={node.side === 'client' ? 'var(--capital)' : 'var(--client)'}
                    strokeWidth="2"
                    opacity="0.6"
                  />
                )}
                {showLabel && (
                  <>
                    <text className="netmap__node-label" textAnchor="middle" y={nodeR + 14}>
                      {node.label.length > 22
                        ? `${node.label.slice(0, 20)}…`
                        : node.label}
                    </text>
                    <text className="netmap__node-sub" textAnchor="middle" y={nodeR + 26}>
                      {node.contactCount} {node.contactCount === 1 ? 'contact' : 'contacts'}
                      {node.isColdHub
                        ? ' · cold'
                        : node.activeCount < node.contactCount
                          ? ` · ${node.activeCount} active`
                          : ''}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ─── HTML overlays — zone labels, controls, legend ─── */}

      <div className="netmap__zones" aria-hidden>
        <div className="netmap__zone netmap__zone--client">
          <span className="netmap__zone-dot" />
          Clients <span className="netmap__zone-count">{zoneCount('client')}</span>
        </div>
        <div className="netmap__zone netmap__zone--ecosystem">
          <span className="netmap__zone-dot" />
          Ecosystem <span className="netmap__zone-count">{zoneCount('ecosystem')}</span>
        </div>
        <div className="netmap__zone netmap__zone--capital">
          <span className="netmap__zone-dot" />
          Capital providers <span className="netmap__zone-count">{zoneCount('capital')}</span>
        </div>
      </div>

      <div className="netmap__controls">
        <button
          type="button"
          onClick={() => setZoom(z => Math.min(ZOOM_MAX, z * 1.2))}
          aria-label="Zoom in" title="Zoom in"
        >
          <ZoomIn />
        </button>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(ZOOM_MIN, z / 1.2))}
          aria-label="Zoom out" title="Zoom out"
        >
          <ZoomOut />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view" title="Recentre"
        >
          <Maximize2 />
        </button>
      </div>

      <div className="netmap__legend" aria-label="Legend">
        <div className="netmap__legend-row">
          <span className="netmap__legend-dot netmap__legend-dot--tier1" />
          Active (≤ 45 days)
        </div>
        <div className="netmap__legend-row">
          <span className="netmap__legend-dot netmap__legend-dot--tier2" />
          Strategic (46 – 200 days)
        </div>
        <div className="netmap__legend-row">
          <span className="netmap__legend-dot netmap__legend-dot--tier3" />
          Dormant (&gt; 200 days)
        </div>
        <div className="netmap__legend-row">
          <span className="netmap__legend-dot netmap__legend-dot--cold" />
          Cold hub (no active contacts)
        </div>
        <div className="netmap__legend-row">
          <span className="netmap__legend-hint">
            Hover to identify · click to inspect · drag / scroll to navigate
          </span>
        </div>
      </div>

      {viewOrgs.length === 0 && ecosystemCluster.count === 0 && (
        <div className="netmap__empty">
          <strong>No contacts in scope yet.</strong>
          <span>
            Add contacts via <em>Add Contact</em> — orgs will appear here as you save
            them to NetworkTracker.xlsx.
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(NetworkMap2D);
