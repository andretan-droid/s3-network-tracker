export type ContactType = 'client' | 'capital_provider' | 'partner' | 'unclassified';
export type HeatLevel = 'hot' | 'warm' | 'cold';
export type Frequency = 'biannual' | 'quarterly' | 'monthly' | 'asneeded';
export type InteractionType = 'meeting' | 'call' | 'email' | 'event';
export type MeetingCategory = 'client_side' | 'capital_side' | 'neither' | 'internal';
export type StaffLevel = 'executive_director' | 'associate_director' | 'staff';

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
