export type ContactType = 'client' | 'capital_provider' | 'partner' | 'unclassified';
export type HeatLevel = 'hot' | 'warm' | 'cold';
export type Frequency = 'biannual' | 'quarterly' | 'monthly' | 'asneeded';
export type InteractionType = 'meeting' | 'call' | 'email' | 'event';
export type MeetingCategory = 'client_side' | 'capital_side' | 'neither' | 'internal';
export type StaffLevel = 'executive_director' | 'associate_director' | 'staff';
export type RelationshipTier = 'tier_1_inner_circle' | 'tier_2_strategic' | 'tier_3_dormant';

export interface Contact {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phoneMobile: string;
  phoneOffice: string;
  linkedin: string;
  type: ContactType;
  heat: HeatLevel;
  frequency: Frequency;
  eventMet: string;
  notes: string;
  owners: string;
  dateAdded: string;
  lastTouched: string;
}

export interface Interaction {
  id: string;
  contactId: string;
  date: string;
  type: InteractionType;
  notes: string;
  loggedBy: string;
  category: MeetingCategory;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  level: StaffLevel;
}

export const FREQUENCY_DAYS: Record<Frequency, number> = {
  biannual: 180,
  quarterly: 90,
  monthly: 30,
  asneeded: 9999,
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  biannual: '2x / year',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  asneeded: 'As needed',
};

export const TYPE_LABELS: Record<ContactType, string> = {
  client: 'Client',
  capital_provider: 'Capital Provider',
  partner: 'Partner / Referrer',
  unclassified: 'Unclassified',
};

export const TIER_LABELS: Record<RelationshipTier, string> = {
  tier_1_inner_circle: 'Inner Circle',
  tier_2_strategic: 'Strategic',
  tier_3_dormant: 'Dormant',
};

export const TIER_DESCRIPTIONS: Record<RelationshipTier, string> = {
  tier_1_inner_circle: 'Monthly+ contact — active deals and engagements',
  tier_2_strategic: '~2x/year — your most valuable contacts per network science',
  tier_3_dormant: 'Known but not actively cultivated — at risk of decay',
};

export function computeTier(c: Contact): RelationshipTier {
  if (!c.lastTouched) return 'tier_3_dormant';
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  if (days <= 45) return 'tier_1_inner_circle';
  if (days <= 200) return 'tier_2_strategic';
  return 'tier_3_dormant';
}

export function daysSinceTouch(c: Contact): number | null {
  if (!c.lastTouched) return null;
  return Math.floor((Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000);
}

export function isDue(c: Contact): boolean {
  if (!c.lastTouched) return true;
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  return days >= FREQUENCY_DAYS[c.frequency];
}

export function findDuplicates(contacts: Contact[]): Map<string, Contact[]> {
  const nameMap = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = c.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) continue;
    const existing = nameMap.get(key) || [];
    existing.push(c);
    nameMap.set(key, existing);
  }
  const dupes = new Map<string, Contact[]>();
  for (const [key, group] of nameMap) {
    if (group.length > 1) dupes.set(key, group);
  }
  return dupes;
}

export const STAFF_ROSTER: StaffMember[] = [
  { id: '1', name: 'Ravi', role: 'Executive Director', level: 'executive_director' },
  { id: '2', name: 'Philip', role: 'Executive Director', level: 'executive_director' },
  { id: '3', name: 'Davin', role: 'Executive Director', level: 'executive_director' },
  { id: '4', name: "Dato' Zaha Rina", role: 'Executive Director', level: 'executive_director' },
  { id: '5', name: 'Anandh', role: 'Associate Director', level: 'associate_director' },
  { id: '6', name: 'Andrew Ong', role: 'Associate Director', level: 'associate_director' },
  { id: '7', name: 'May Tong', role: 'Manager', level: 'staff' },
  { id: '8', name: 'Andre', role: 'Senior Executive', level: 'staff' },
  { id: '9', name: 'Reedza', role: 'Senior Executive', level: 'staff' },
  { id: '10', name: 'Syakirah', role: 'Senior Finance & Transformation Officer', level: 'staff' },
  { id: '11', name: 'Jordan', role: 'Executive', level: 'staff' },
  { id: '12', name: 'Eason', role: 'Executive', level: 'staff' },
  { id: '13', name: 'Steffie', role: 'Executive', level: 'staff' },
  { id: '14', name: 'Yenkern', role: 'Executive', level: 'staff' },
];
