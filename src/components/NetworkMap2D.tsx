/**
 * NetworkMap2D — 2D structural-hole map with SEMANTIC positions.
 *
 *      ECOSYSTEM cluster (top — single aggregate node)
 *                       │
 *      CLIENTS ────── Sage 3 ────── CAPITAL PROVIDERS
 *      (left arc)        ●            (right arc)
 *
 * Design choices that matter:
 *
 * 1. **One ecosystem cluster, not N orgs.** The dataset has ~975 ecosystem
 *    organisations. Rendering each as its own node produced an unreadable
 *    hatched fan above the hub and ~16,000 SVG elements of total DOM cost.
 *    The cluster collapses them into one tappable node; drill-in happens
 *    in the side panel (OrgDetailPanel).
 *
 * 2. **No person nodes in the map.** All person/contact detail moved to the
 *    side panel. The map is now a pure structural overview.
 *
 * 3. **Fixed-zone arc layout, not force-directed.** Clients are always left,
 *    capital always right, ecosystem always above. Spatial meaning is stable
 *    across refreshes and pans — what makes the structural hole legible to
 *    a non-technical director.
 *
 * Interaction:
 *   • Click an org or the ecosystem cluster → parent opens the side panel
 *   • Drag empty space        — pan
 *   • Wheel / pinch           — zoom (clamped 0.7× – 2.4×)
 *   • Reset button (corner)   — recentre + zoom 1×
 */

import { useMemo, useRef, useEffect, useState, memo } from 'react';
import type { Contact } from '../types';
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
const ORG_R = 18;
const CLUSTER_R = 26;        // slightly larger to read as "aggregate"
const ORG_RADIUS = 290;
const CLUSTER_RADIUS = 250;  // pull the cluster in closer than individual orgs

const ARCS: Record<'client' | 'capital', { center: number; span: number }> = {
  client:  { center: 180, span: 100 }, // left semicircle
  capital: { center: 0,   span: 100 }, // right semicircle
};

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.4;

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

function computeOrgPositions(viewOrgs: SideOrgNode[]): Map<string, Pos> {
  const bySide: Record<'client' | 'capital', SideOrgNode[]> = { client: [], capital: [] };
  for (const o of viewOrgs) bySide[o.side].push(o);
  const out = new Map<string, Pos>();
  for (const side of ['client', 'capital'] as const) {
    const arc = ARCS[side];
    const adjustedRadius = ORG_RADIUS + Math.max(0, bySide[side].length - 5) * 8;
    const positions = arcLayout(bySide[side], arc.center, arc.span, adjustedRadius);
    for (const [id, pos] of positions) out.set(id, pos);
  }
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

function NetworkMap2D({ contacts, onOrgClick, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // ── Data derivation ──────────────────────────────────────────────────────
  const graph = useMemo(() => deriveGraph(contacts), [contacts]);
  const { viewOrgs, ecosystemCluster } = graph;
  const orgPos = useMemo(() => computeOrgPositions(viewOrgs), [viewOrgs]);

  // Cluster position — fixed at top centre, just inside the canvas.
  const clusterPos: Pos = useMemo(
    () => ({ ...polarToSvg(90, CLUSTER_RADIUS), angleDeg: 90 }),
    [],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOrgClick = (node: SideOrgNode) => onOrgClick?.(node.id);
  const handleClusterClick = () => onOrgClick?.(ECOSYSTEM_CLUSTER_KEY);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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
    setPan({
      x: d.origPanX + dx * factor,
      y: d.origPanY + dy * factor,
    });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture(d.pointerId);
    dragRef.current = null;
  };

  // ── Wheel zoom — passive: false so we can preventDefault ─────────────────
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

          {/* Editorial axis — two pencil-thin sage lines through the hub */}
          <line
            x1={-VIEWBOX.w / 2} y1={0} x2={VIEWBOX.w / 2} y2={0}
            className="netmap__axis"
          />
          <line
            x1={0} y1={-VIEWBOX.h / 2 + 40} x2={0} y2={0}
            className="netmap__axis netmap__axis--vertical"
          />

          {/* Hub → side-node links (one per side-node + one to the cluster) */}
          {viewOrgs.map(node => {
            const p = orgPos.get(node.id);
            if (!p) return null;
            return (
              <line
                key={`L-${node.id}`}
                x1={0} y1={0} x2={p.x} y2={p.y}
                className={`netmap__link netmap__link--${node.side}`}
              />
            );
          })}
          {ecosystemCluster.count > 0 && (
            <line
              x1={0} y1={0} x2={clusterPos.x} y2={clusterPos.y}
              className="netmap__link netmap__link--ecosystem"
            />
          )}

          {/* Hub glow */}
          <circle cx={0} cy={0} r={HUB_R + 22} fill="url(#hub-glow)" />

          {/* Hub */}
          <g
            className="netmap__node netmap__node--hub netmap__hit"
            transform="translate(0 0)"
          >
            <circle r={HUB_R} className="netmap__node-circle" />
            <text textAnchor="middle" dy="4" className="netmap__hub-label">
              SAGE 3
            </text>
          </g>

          {/* Ecosystem cluster — a single aggregate node above the hub */}
          {ecosystemCluster.count > 0 && (
            <g
              className={[
                'netmap__node',
                'netmap__node--ecosystem',
                'netmap__node--cluster',
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
              {/* Outer ring suggests "many orgs in one node" */}
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

          {/* Side-nodes — clients on left, capital on right. A dual-role firm
              appears on both sides with the same label but distinct contacts. */}
          {viewOrgs.map(node => {
            const p = orgPos.get(node.id);
            if (!p) return null;
            const isSelected = selectedNodeId === node.id;
            const isDualRole = node.otherSideCount > 0;
            return (
              <g
                key={node.id}
                className={[
                  'netmap__node',
                  'netmap__node--org',
                  `netmap__node--${node.side}`,
                  node.isColdHub ? 'netmap__node--cold' : '',
                  isSelected ? 'netmap__node--expanded' : '',
                  isDualRole ? 'netmap__node--dual-role' : '',
                  'netmap__hit',
                ].filter(Boolean).join(' ')}
                transform={`translate(${p.x} ${p.y})`}
                onClick={(e) => { e.stopPropagation(); handleOrgClick(node); }}
                style={{ cursor: 'pointer' }}
              >
                {node.isColdHub && (
                  <circle
                    r={ORG_R + 6}
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.7"
                  />
                )}
                {isSelected && (
                  <circle r={ORG_R + 4} fill="none" stroke="var(--accent)" strokeWidth="2" />
                )}
                <circle r={ORG_R} className="netmap__node-circle" />
                {/* Dual-role badge — small inner ring on the OPPOSITE side of the node */}
                {isDualRole && (
                  <circle
                    r={ORG_R - 4}
                    fill="none"
                    stroke={node.side === 'client' ? 'var(--capital)' : 'var(--client)'}
                    strokeWidth="2"
                    opacity="0.6"
                  />
                )}
                <text className="netmap__node-label" textAnchor="middle" y={ORG_R + 16}>
                  {node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label}
                </text>
                <text className="netmap__node-sub" textAnchor="middle" y={ORG_R + 30}>
                  {node.contactCount} {node.contactCount === 1 ? 'contact' : 'contacts'}
                  {node.isColdHub
                    ? ' · cold'
                    : node.activeCount < node.contactCount
                      ? ` · ${node.activeCount} active`
                      : ''}
                </text>
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
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn />
        </button>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(ZOOM_MIN, z / 1.2))}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          title="Recentre"
        >
          <Maximize2 />
        </button>
      </div>

      <div className="netmap__legend" aria-label="Legend">
        <div className="netmap__legend-row">
          <span className="netmap__legend-dot netmap__legend-dot--cold" />
          Cold hub (no active contacts)
        </div>
        <div className="netmap__legend-row">
          <span className="netmap__legend-hint">Click an organisation to reveal its people.</span>
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
