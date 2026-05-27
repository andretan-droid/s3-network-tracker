/**
 * NetworkMap3D — Custom HTML5 Canvas 3D Structural Hole Engine
 *
 * Architecture: all per-frame state (rotation, pulse, drag) lives in a single
 * mutable ref object so the draw loop never triggers React re-renders. Only
 * the hover card and control buttons use useState, since they touch the DOM.
 *
 * 3D math: standard YX rotation matrices followed by perspective projection.
 * Rendering order: background grid → edges (back-to-front) → nodes (painter's
 * algorithm) → labels. No external packages.
 */

import { useRef, useEffect, useState, useCallback } from 'react';

// ── Node definitions ──────────────────────────────────────────────────────────

interface NetworkNode {
  id: string;
  label: string;
  type: 'hub' | 'client' | 'capital';
  /** Base position in world space (CSS pixels, pre-spread) */
  bx: number; by: number; bz: number;
  radius: number;
  fill: string;
  glow: string;
  meta: Record<string, string>;
}

const NODES: NetworkNode[] = [
  // ── Hub ──
  {
    id: 'hub', label: 'Sage 3 Sdn Bhd', type: 'hub',
    bx: 0, by: 0, bz: 0, radius: 20,
    fill: '#D4AF37', glow: '#FFD700',
    meta: {
      Role:                    'Exclusive Broker / Structural Hub',
      'Betweenness Centrality':'1.00',
      'Brokerage Ratio':       '100%',
      'Active Mandates':       '12',
      'Network Nodes':         '13 Counterparties',
    },
  },
  // ── Clients (left cluster, x < 0) ──
  { id: 'c1', label: 'Petronas Ventures',  type: 'client', bx: -240, by: -70, bz:  80, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Energy',         Engagement: 'M&A Advisory',      'Deal Size': 'USD 320M', Status: 'Active Mandate'   } },
  { id: 'c2', label: 'IHH Healthcare',     type: 'client', bx: -198, by:  82, bz: -52, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Healthcare',      Engagement: 'Equity Placement',  'Deal Size': 'USD 180M', Status: 'Term Sheet Issued' } },
  { id: 'c3', label: 'Sunway Bhd',         type: 'client', bx: -262, by:  12, bz: -92, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Real Estate',     Engagement: 'Debt Structuring',  'Deal Size': 'MYR 750M', Status: 'Due Diligence'    } },
  { id: 'c4', label: 'Gamuda Capital',     type: 'client', bx: -174, by:-122, bz:  24, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Infrastructure',  Engagement: 'Project Finance',   'Deal Size': 'MYR 1.2B', Status: 'Mandate Signed'   } },
  { id: 'c5', label: 'IOI Properties',     type: 'client', bx: -218, by: 112, bz:  54, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Real Estate',     Engagement: 'Bridge Financing',  'Deal Size': 'USD  95M', Status: 'Indicative Terms' } },
  { id: 'c6', label: 'Dialog Group',       type: 'client', bx: -248, by: -28, bz: 114, radius: 11, fill: '#0891B2', glow: '#22D3EE', meta: { Sector: 'Oil & Gas',       Engagement: 'Fund Raising',      'Deal Size': 'USD 210M', Status: 'Pipeline'          } },
  // ── Capital Providers (right cluster, x > 0) ──
  { id: 'f1', label: 'CIMB Investment',    type: 'capital', bx:  240, by: -70, bz:  80, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Investment Bank', AUM: 'MYR 280B', 'Ticket Size': '50M–500M',   Focus: 'Senior Debt'       } },
  { id: 'f2', label: 'Khazanah Nasional',  type: 'capital', bx:  198, by:  82, bz: -52, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Sovereign Fund',  AUM: 'MYR 150B', 'Ticket Size': '100M–2B',    Focus: 'Strategic Equity'  } },
  { id: 'f3', label: 'EPF',                type: 'capital', bx:  262, by:  12, bz: -92, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Pension Fund',    AUM: 'MYR 1.1T', 'Ticket Size': '200M–5B',    Focus: 'Infrastructure'    } },
  { id: 'f4', label: 'RHB Capital',        type: 'capital', bx:  174, by:-122, bz:  24, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Commercial Bank', AUM: 'MYR 320B', 'Ticket Size': '20M–300M',   Focus: 'Mezzanine Debt'    } },
  { id: 'f5', label: 'Amundi Asset Mgmt',  type: 'capital', bx:  218, by: 112, bz:  54, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Asset Manager',   AUM: 'EUR 2.1T', 'Ticket Size': '50M–500M',   Focus: 'Private Credit'    } },
  { id: 'f6', label: 'GIC Singapore',      type: 'capital', bx:  248, by: -28, bz: 114, radius: 11, fill: '#7C3AED', glow: '#A78BFA', meta: { Type: 'Sovereign Fund',  AUM: 'USD 690B', 'Ticket Size': '100M–2B',    Focus: 'Growth Equity'     } },
];

// ── 3D math helpers ───────────────────────────────────────────────────────────

/** Apply Y-axis then X-axis rotation and return [x', y', z']. */
function rotate(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  // Y rotation
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  // X rotation
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return [x1, y2, z2];
}

/** Perspective-project a 3-D point onto 2-D canvas coordinates. */
function project(
  x: number, y: number, z: number,
  fov: number, cx: number, cy: number
): [number, number, number] {
  const p = fov / (fov + z + 300);
  return [cx + x * p, cy + y * p, p];
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Mutable ref bag — never triggers re-renders. */
interface LoopState {
  rot:        { x: number; y: number };
  drag:       { active: boolean; lx: number; ly: number };
  autoRotate: boolean;
  spread:     number;
  pulse:      number;
}

export default function NetworkMap3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const loop      = useRef<LoopState>({
    rot:        { x: 0.22, y: 0 },
    drag:       { active: false, lx: 0, ly: 0 },
    autoRotate: true,
    spread:     1.0,
    pulse:      0,
  });

  // React state — only for DOM-visible UI elements
  const [autoRotate, setAutoRotate] = useState(true);
  const [spread, setSpread]         = useState(1.0);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [hoverPos, setHoverPos]       = useState({ x: 0, y: 0 });

  // Keep loop ref in sync with control state
  useEffect(() => { loop.current.autoRotate = autoRotate; }, [autoRotate]);
  useEffect(() => { loop.current.spread     = spread;     }, [spread]);

  // ── Draw loop ───────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas matches its CSS size each frame
    const W = canvas.offsetWidth  || 400;
    const H = canvas.offsetHeight || 400;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    const cx = W / 2;
    const cy = H / 2;
    const FOV = 520;
    const s = loop.current;

    s.pulse += 0.032;
    if (s.autoRotate) s.rot.y += 0.0042;

    // ── Background ────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, Math.max(W, H) * 0.8);
    bg.addColorStop(0,   '#0d1929');
    bg.addColorStop(0.6, '#06101e');
    bg.addColorStop(1,   '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(148,163,184,0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    ctx.restore();

    // ── Project all nodes ─────────────────────────────────────
    const { x: rx, y: ry } = s.rot;
    const sp = s.spread;

    type Projected = { node: NetworkNode; sx: number; sy: number; scale: number; depth: number };
    const projected: Projected[] = NODES.map(n => {
      const [rx3, ry3, rz3] = rotate(n.bx * sp, n.by * sp, n.bz * sp, rx, ry);
      const [sx, sy, scale] = project(rx3, ry3, rz3, FOV, cx, cy);
      return { node: n, sx, sy, scale, depth: rz3 };
    });

    // Painter's algorithm: back nodes drawn before front nodes
    projected.sort((a, b) => a.depth - b.depth);

    const hubP = projected.find(p => p.node.id === 'hub')!;

    // ── Edges (client → hub, capital → hub only; no cross edges) ──
    projected.forEach(({ node, sx, sy, scale }) => {
      if (node.type === 'hub') return;
      const alpha = Math.max(0.06, Math.min(0.40, scale * 0.75));
      const g = ctx.createLinearGradient(sx, sy, hubP.sx, hubP.sy);
      if (node.type === 'client') {
        g.addColorStop(0,   `rgba(34, 211, 238, ${alpha})`);
        g.addColorStop(0.65,`rgba(212,175,55, ${alpha * 0.5})`);
      } else {
        g.addColorStop(0,   `rgba(167,139,250, ${alpha})`);
        g.addColorStop(0.65,`rgba(212,175,55, ${alpha * 0.5})`);
      }
      g.addColorStop(1, `rgba(212,175,55, ${alpha * 0.25})`);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(hubP.sx, hubP.sy);
      ctx.strokeStyle = g;
      ctx.lineWidth   = Math.max(0.4, scale * 1.8);
      ctx.stroke();
    });

    // ── Nodes ─────────────────────────────────────────────────
    projected.forEach(({ node, sx, sy, scale }) => {
      const r = node.radius * scale;

      if (node.type === 'hub') {
        // Animated pulsating glow rings
        const pulse = 0.5 + 0.5 * Math.sin(s.pulse);
        for (let ring = 3; ring >= 1; ring--) {
          const gr = r * (1 + ring * 0.9 * pulse);
          const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
          rg.addColorStop(0, `rgba(212,175,55,${0.18 / ring})`);
          rg.addColorStop(1, 'rgba(212,175,55,0)');
          ctx.beginPath();
          ctx.arc(sx, sy, gr, 0, Math.PI * 2);
          ctx.fillStyle = rg;
          ctx.fill();
        }
        // Hub fill
        const fill = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r);
        fill.addColorStop(0,   '#FFF8DC');
        fill.addColorStop(0.4, '#F0C832');
        fill.addColorStop(1,   '#8B6410');
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        // Animated ring border
        ctx.beginPath();
        ctx.arc(sx, sy, r + 5 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,175,55,${0.55 * pulse})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

      } else {
        // Satellite glow halo
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
        halo.addColorStop(0, node.glow + '28');
        halo.addColorStop(1, node.glow + '00');
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
        // Node fill
        const nf = ctx.createRadialGradient(sx - r * 0.28, sy - r * 0.28, 0, sx, sy, r);
        nf.addColorStop(0, node.glow);
        nf.addColorStop(1, node.fill);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = nf;
        ctx.fill();
        // Rim
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.strokeStyle = node.glow + '70';
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      }

      // ── Label ──
      const fs = Math.max(9, Math.round(11 * scale));
      ctx.font      = `${node.type === 'hub' ? 600 : 400} ${fs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur  = 5;
      ctx.fillStyle = node.type === 'hub' ? '#FFD700'
                    : node.type === 'client' ? '#67E8F9'
                    : '#C4B5FD';
      ctx.fillText(node.label, sx, sy + r + fs + 3);
      ctx.shadowBlur = 0;
    });

    animRef.current = requestAnimationFrame(draw);
  }, []);

  // ── Canvas lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Seed dimensions immediately so first frame has valid W/H
    canvas.width  = canvas.offsetWidth  || 400;
    canvas.height = canvas.offsetHeight || 400;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [draw]);

  // ── Hover + drag detection ──────────────────────────────────────────────────
  /** Reproject nodes in CSS-pixel space to find what's under the cursor. */
  const findNodeAt = useCallback((mx: number, my: number): NetworkNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const cx = W / 2, cy = H / 2;
    const FOV = 520;
    const { x: rx, y: ry } = loop.current.rot;
    const sp = loop.current.spread;
    for (const n of NODES) {
      const [rx3, ry3, rz3] = rotate(n.bx * sp, n.by * sp, n.bz * sp, rx, ry);
      const [sx, sy, scale] = project(rx3, ry3, rz3, FOV, cx, cy);
      if (Math.hypot(mx - sx, my - sy) <= n.radius * scale + 7) return n;
    }
    return null;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (loop.current.drag.active) {
      const dx = e.clientX - loop.current.drag.lx;
      const dy = e.clientY - loop.current.drag.ly;
      loop.current.rot.y += dx * 0.006;
      loop.current.rot.x += dy * 0.006;
      loop.current.drag.lx = e.clientX;
      loop.current.drag.ly = e.clientY;
      return;
    }

    const hit = findNodeAt(mx, my);
    setHoveredNode(hit);
    if (hit) setHoverPos({ x: mx, y: my });
  }, [findNodeAt]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    loop.current.drag = { active: true, lx: e.clientX, ly: e.clientY };
  }, []);
  const onMouseUp   = useCallback(() => { loop.current.drag.active = false; }, []);

  const toggleRotate = () => setAutoRotate(p => !p);
  const onSpread = (v: number) => setSpread(v);

  // ── Derived hover card styles ───────────────────────────────────────────────
  const hoverAccent = !hoveredNode ? '#D4AF37'
    : hoveredNode.type === 'hub'     ? '#FFD700'
    : hoveredNode.type === 'client'  ? '#22D3EE'
    : '#A78BFA';

  const canvasW = canvasRef.current?.offsetWidth  ?? 500;
  const canvasH = canvasRef.current?.offsetHeight ?? 400;
  const cardX   = Math.min(hoverPos.x + 14, canvasW - 210);
  const cardY   = Math.min(hoverPos.y - 10,  canvasH - 200);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#020617' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: loop.current.drag.active ? 'grabbing' : 'grab' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9,
        padding: '9px 13px', display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {([
          { c: '#FFD700', label: 'Sage 3 Sdn Bhd' },
          { c: '#22D3EE', label: 'Clients (6)' },
          { c: '#A78BFA', label: 'Capital Providers (6)' },
        ] as const).map(({ c, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginTop: 3, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 9, color: '#475569', display: 'block', textAlign: 'center' }}>No direct client-capital edges</span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9,
        padding: '9px 13px', display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <button
          onClick={toggleRotate}
          style={{
            background: autoRotate ? 'rgba(212,175,55,0.12)' : 'transparent',
            border: `1px solid ${autoRotate ? 'rgba(212,175,55,0.35)' : 'rgba(255,255,255,0.10)'}`,
            color: autoRotate ? '#D4AF37' : '#64748B',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          {autoRotate ? '⏸ Pause' : '▶ Rotate'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Spread</span>
          <input
            type="range" min={0.5} max={2.2} step={0.05} value={spread}
            onChange={e => onSpread(parseFloat(e.target.value))}
            style={{ width: 70, accentColor: '#D4AF37' }}
          />
        </div>
        <div style={{ fontSize: 9, color: '#334155', textAlign: 'center' }}>Drag to orbit</div>
      </div>

      {/* ── Hover card (glassmorphic) ── */}
      {hoveredNode && (
        <div style={{
          position: 'absolute', left: cardX, top: cardY,
          background: 'rgba(9,16,33,0.94)', backdropFilter: 'blur(20px)',
          border: `1px solid ${hoverAccent}40`,
          borderRadius: 11, padding: '13px 15px', minWidth: 192,
          pointerEvents: 'none', zIndex: 30,
          boxShadow: `0 0 24px ${hoverAccent}18`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: hoverAccent, marginBottom: 3 }}>
            {hoveredNode.label}
          </div>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            {hoveredNode.type === 'hub' ? 'Network Hub' : hoveredNode.type === 'client' ? 'Client Counterparty' : 'Capital Provider'}
          </div>
          {Object.entries(hoveredNode.meta).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: '#64748B' }}>{k}</span>
              <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 500, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
