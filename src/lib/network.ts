/**
 * Network derivation helpers — pure functions, no I/O, no React.
 *
 * One file owns the grouping rule and the org-level classification used by
 *   • NetworkMap2D    (renders the spatial structural hole)
 *   • DirectorBrief   (renders the action surface)
 *   • StructuralHoleMap's metric bar
 *
 * Keeping the logic here means there's a single source of truth for what
 * counts as a "Cold Hub", how an org's type is derived from its contacts,
 * and how organisations are de-duplicated when their company names are
 * spelled inconsistently in the Excel workbook.
 *
 * Note: SPOF / "key-person risks" logic was deliberately removed. The
 * concept proved more academic than operational for the director audience.
 * Cold Hubs are kept — they're the actionable half.
 */

import type { Contact, ContactType, HeatLevel, CapitalSubType, RelationshipTier } from '../types';
import { computeTier, isEcosystemType } from '../types';

// ─── Graph types ─────────────────────────────────────────────────────────────

export type ZoneKind = 'client' | 'capital' | 'ecosystem';

export interface HubNode {
  id: 'sage3';
  kind: 'hub';
  label: string;
}

export interface OrgNode {
  id: string;          // 'org:{key}'
  kind: 'org';
  key: string;         // normalised key, matches contact register's data-org-key
  label: string;       // canonical display name (first-seen casing)
  orgType: ContactType;
  zone: ZoneKind;      // which side of the structural hole this org belongs to
  contactCount: number;
  activeCount: number;
  isColdHub: boolean;
  contacts: Contact[]; // the contacts at this org, sorted by name
}

export interface PersonNode {
  id: string;          // 'person:{contact.id}'
  kind: 'person';
  label: string;
  orgId: string;       // parent org's id
  orgKey: string;      // parent org's key (convenience)
  type: ContactType;
  heat: HeatLevel;
  lastTouched: string;
  position: string;
  owners: string;
}

export type GraphNode = HubNode | OrgNode | PersonNode;
export type GraphLink = { source: string; target: string; kind: 'hub-org' | 'org-person' };

/**
 * Sentinel key used by the network map and side panel to refer to the
 * single aggregate ecosystem node. Distinct from any real org key.
 */
export const ECOSYSTEM_CLUSTER_KEY = '__ecosystem_cluster__';

/**
 * StructuralHoleSide — which side of the structural hole this node sits on.
 * Distinct from ZoneKind (which still includes 'ecosystem' for the cluster).
 */
export type StructuralHoleSide = 'client' | 'capital';

/**
 * A SideOrgNode represents an org's *structural-hole relationship* of a
 * given side. A firm that has both client contacts and capital-provider
 * contacts (e.g., a bank that's a client on one mandate and a capital
 * provider on another) emits TWO SideOrgNodes — one per side. Each shows
 * only that side's contacts; unclassified colleagues at the same firm are
 * surfaced as a count, not in the contacts list.
 *
 * Compound id format: `org:{key}:{side}` — distinguishes the two halves of
 * a dual-role firm while keeping the underlying orgKey shared so the
 * register row stays one-per-firm.
 */
export interface SideOrgNode {
  id: string;                    // 'org:{key}:{side}'
  kind: 'side-org';
  key: string;                   // underlying org key — register row anchor
  side: StructuralHoleSide;
  label: string;
  contacts: Contact[];           // only contacts tagged for THIS side
  contactCount: number;
  activeCount: number;
  isColdHub: boolean;
  /** Number of contacts at this firm on the OTHER structural-hole side (0 if not dual-role). */
  otherSideCount: number;
  /** Number of `unclassified` colleagues at this firm. */
  unclassifiedCount: number;
  /**
   * The best (most active) relationship tier among all contacts on this side.
   * Tier 1 beats Tier 2 beats Tier 3. Used to place the node at the correct
   * concentric radius on the Structural Hole Map.
   */
  tier: RelationshipTier;
  /**
   * Capital provider sub-type (bank, investment_bank, pe_vc_fund, family_office,
   * other, or '' for untagged). Determines which angular sector this node lands
   * in on the right-hand capital arc. Only meaningful when side === 'capital'.
   */
  subType: CapitalSubType;
}

export function sideNodeId(orgKey: string, side: StructuralHoleSide): string {
  return `org:${orgKey}:${side}`;
}

/**
 * Aggregate representation of all ecosystem orgs. The map renders ONE
 * cluster node instead of 975 individual orgs (which produced an
 * unreadable hatched fan above the hub). Drill-in happens in the side
 * panel, where the cluster's `orgs` array is searchable.
 */
export interface EcosystemCluster {
  count: number;
  activeCount: number;
  orgs: OrgNode[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tie-break precedence for org-type derivation when contacts at the same
 * firm have mixed types. Capital wins over client (capital sourcing is
 * harder to replace), client wins over ecosystem types, ecosystem types
 * tie-break among themselves by alphabetical order.
 */
const TYPE_PRECEDENCE: ContactType[] = [
  'capital_provider', 'client',
  'partner', 'educational', 'regulatory', 'government', 'institute',
  'unclassified',
];

export function orgTypeFor(orgContacts: Contact[]): ContactType {
  const counts: Record<ContactType, number> = {
    client: 0, capital_provider: 0, partner: 0, educational: 0,
    regulatory: 0, government: 0, institute: 0, unclassified: 0,
  };
  for (const c of orgContacts) counts[c.type]++;
  let bestType: ContactType = 'unclassified';
  let bestCount = -1;
  for (const t of TYPE_PRECEDENCE) {
    if (counts[t] > bestCount) {
      bestCount = counts[t];
      bestType = t;
    }
  }
  return bestType;
}

/**
 * Normalise a company name into a stable grouping key.
 * "EPF" / "epf" / "  EPF " all collapse to "epf".
 * Empty / whitespace company names group under "unspecified".
 */
export function normaliseOrgKey(company: string): string {
  const trimmed = company.trim().toLowerCase().replace(/\s+/g, ' ');
  return trimmed || 'unspecified';
}

/** Which side of the structural hole does this org belong on? */
export function zoneFor(orgType: ContactType): ZoneKind {
  if (orgType === 'client') return 'client';
  if (orgType === 'capital_provider') return 'capital';
  return 'ecosystem'; // partner, educational, regulatory, government, institute, unclassified
}

/** A contact is "active" if they're not in Tier 3 dormancy. */
export function isActive(c: Contact): boolean {
  return computeTier(c) !== 'tier_3_dormant';
}

// ─── Main derivation: contacts → graph ───────────────────────────────────────

export interface DerivedGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  /**
   * One side-node per structural-hole relationship per org. A firm with
   * contacts on both sides emits two entries (different `side` values,
   * same `key`).
   */
  viewOrgs: SideOrgNode[];
  /** Aggregate stand-in for all ecosystem-only orgs in the map render. */
  ecosystemCluster: EcosystemCluster;
}

/**
 * Derive side-nodes for a single org. Returns 0, 1, or 2 entries:
 *   • 2 if the org has both client AND capital-provider contacts
 *   • 1 if the org has exactly one of those roles
 *   • 0 if neither — caller should send the org to the ecosystem cluster
 *
 * Unclassified contacts are tracked as a count (`unclassifiedCount`) but
 * are NOT included in either side's `contacts` array. They surface in the
 * panel as a "+ N unclassified colleagues" footnote.
 */
/** Best (most active) tier among a set of contacts. */
function bestTier(contacts: Contact[]): RelationshipTier {
  for (const c of contacts) {
    if (computeTier(c) === 'tier_1_inner_circle') return 'tier_1_inner_circle';
  }
  for (const c of contacts) {
    if (computeTier(c) === 'tier_2_strategic') return 'tier_2_strategic';
  }
  return 'tier_3_dormant';
}

/**
 * Pick the most-common non-empty subType among capital contacts at this org.
 * Falls back to '' (untagged) if none are set.
 */
function bestSubType(contacts: Contact[]): CapitalSubType {
  const counts: Partial<Record<CapitalSubType, number>> = {};
  for (const c of contacts) {
    if (!c.subType) continue;
    counts[c.subType] = (counts[c.subType] ?? 0) + 1;
  }
  let best: CapitalSubType = '';
  let bestCount = 0;
  for (const [st, n] of Object.entries(counts) as [CapitalSubType, number][]) {
    if (n > bestCount) { best = st; bestCount = n; }
  }
  return best;
}

function deriveSideNodes(org: OrgNode): SideOrgNode[] {
  const clientContacts  = org.contacts.filter(c => c.type === 'client');
  const capitalContacts = org.contacts.filter(c => c.type === 'capital_provider');
  const unclassifiedCount = org.contacts.filter(c => c.type === 'unclassified').length;

  const out: SideOrgNode[] = [];

  const makeSide = (side: StructuralHoleSide, contacts: Contact[], otherSideCount: number): SideOrgNode => {
    const activeCount = contacts.filter(isActive).length;
    return {
      id: sideNodeId(org.key, side),
      kind: 'side-org',
      key: org.key,
      side,
      label: org.label,
      contacts,
      contactCount: contacts.length,
      activeCount,
      isColdHub: contacts.length > 0 && activeCount === 0,
      otherSideCount,
      unclassifiedCount,
      tier: bestTier(contacts),
      subType: side === 'capital' ? bestSubType(contacts) : '',
    };
  };

  if (clientContacts.length > 0)  out.push(makeSide('client',  clientContacts,  capitalContacts.length));
  if (capitalContacts.length > 0) out.push(makeSide('capital', capitalContacts, clientContacts.length));

  return out;
}

export function deriveGraph(contacts: Contact[]): DerivedGraph {
  const hub: HubNode = { id: 'sage3', kind: 'hub', label: 'Sage 3 Sdn Bhd' };

  const orgMap = new Map<string, { display: string; contacts: Contact[] }>();
  for (const c of contacts) {
    const display = c.company?.trim() || 'Unspecified';
    const key = normaliseOrgKey(display);
    const bucket = orgMap.get(key);
    if (bucket) bucket.contacts.push(c);
    else orgMap.set(key, { display, contacts: [c] });
  }

  const orgs: OrgNode[] = [];
  const persons: PersonNode[] = [];
  const links: GraphLink[] = [];

  for (const [key, { display, contacts: orgContacts }] of orgMap) {
    // Sort contacts within org alphabetically for stable rendering
    const sorted = [...orgContacts].sort((a, b) => a.name.localeCompare(b.name));
    const activeCount = sorted.filter(isActive).length;
    const isColdHub = sorted.length > 0 && activeCount === 0;
    const orgType = orgTypeFor(sorted);
    const zone = zoneFor(orgType);

    const orgId = `org:${key}`;
    orgs.push({
      id: orgId, kind: 'org', key, label: display,
      orgType, zone,
      contactCount: sorted.length, activeCount,
      isColdHub,
      contacts: sorted,
    });
    links.push({ source: hub.id, target: orgId, kind: 'hub-org' });

    for (const c of sorted) {
      const personId = `person:${c.id}`;
      persons.push({
        id: personId, kind: 'person', label: c.name,
        orgId, orgKey: key,
        type: c.type, heat: c.heat, lastTouched: c.lastTouched,
        position: c.position, owners: c.owners,
      });
      links.push({ source: orgId, target: personId, kind: 'org-person' });
    }
  }

  // Sort orgs alphabetically within their zone for stable layout
  orgs.sort((a, b) => a.label.localeCompare(b.label));

  // viewOrgs = side-nodes (one per role per org, so dual-role firms appear
  // on both sides). Orgs with no structural-hole presence join the cluster.
  const viewOrgs: SideOrgNode[] = [];
  const ecosystemOrgs: OrgNode[] = [];
  for (const o of orgs) {
    const sides = deriveSideNodes(o);
    if (sides.length === 0) {
      ecosystemOrgs.push(o);
    } else {
      viewOrgs.push(...sides);
    }
  }
  // Sort each side's nodes alphabetically — stable arc layout.
  viewOrgs.sort((a, b) => {
    if (a.side !== b.side) return a.side < b.side ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const ecosystemCluster: EcosystemCluster = {
    count: ecosystemOrgs.length,
    activeCount: ecosystemOrgs.reduce((s, o) => s + o.activeCount, 0),
    orgs: ecosystemOrgs,
  };

  return {
    nodes: [hub, ...orgs, ...persons],
    links,
    viewOrgs,
    ecosystemCluster,
  };
}

// ─── Brief data — derived from the same graph ────────────────────────────────

export interface ColdHubRow {
  org: string;
  orgKey: string;
  contactCount: number;
  daysSinceMostRecent: number | null;
}

export interface BriefData {
  colds: ColdHubRow[];
  clientCount: number;
  capitalCount: number;
  ecosystemCount: number;
  activeCount: number;
  totalCount: number;
  orgCount: number;
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / 86_400_000);
}

export function computeBrief(contacts: Contact[]): BriefData {
  const graph = deriveGraph(contacts);
  const orgs = graph.nodes.filter((n): n is OrgNode => n.kind === 'org');

  const colds: ColdHubRow[] = orgs
    .filter(o => o.isColdHub)
    .map(o => {
      // The most-recently-touched (now-dormant) contact tells us how cold "cold" is
      const everTouched = o.contacts.filter(c => c.lastTouched);
      let daysSinceMostRecent: number | null = null;
      if (everTouched.length > 0) {
        const sorted = [...everTouched].sort(
          (a, b) => new Date(b.lastTouched).getTime() - new Date(a.lastTouched).getTime()
        );
        daysSinceMostRecent = daysSince(sorted[0].lastTouched);
      }
      return {
        org: o.label,
        orgKey: o.key,
        contactCount: o.contactCount,
        daysSinceMostRecent,
      };
    })
    .sort((a, b) => (b.daysSinceMostRecent ?? 99_999) - (a.daysSinceMostRecent ?? 99_999));

  return {
    colds,
    clientCount: contacts.filter(c => c.type === 'client').length,
    capitalCount: contacts.filter(c => c.type === 'capital_provider').length,
    ecosystemCount: contacts.filter(c => isEcosystemType(c.type)).length,
    activeCount: contacts.filter(isActive).length,
    totalCount: contacts.length,
    orgCount: orgs.length,
  };
}
