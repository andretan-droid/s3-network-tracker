import { v4 as uuid } from 'uuid';
import { readTable, addTableRow, addTableRows, updateTableRow, deleteTableRow, clearTableData } from './graphClient';
import type { Contact, Interaction, ContactType, HeatLevel, Frequency, InteractionType, MeetingCategory } from '../types';

// ─── Column order must match the Excel table exactly ─────────
// Contacts: id | name | company | position | email | phoneMobile | phoneOffice | linkedin | type | heat | frequency | eventMet | notes | owners | dateAdded | lastTouched
// Interactions: id | contactId | date | type | notes | loggedBy | category

function parseContact(row: string[]): Contact {
  return {
    id: row[0] || '',
    name: row[1] || '',
    company: row[2] || '',
    position: row[3] || '',
    email: row[4] || '',
    phoneMobile: row[5] || '',
    phoneOffice: row[6] || '',
    linkedin: row[7] || '',
    type: (row[8] || 'unclassified') as ContactType,
    heat: (row[9] || 'warm') as HeatLevel,
    frequency: (row[10] || 'biannual') as Frequency,
    eventMet: row[11] || '',
    notes: row[12] || '',
    owners: row[13] || '',
    dateAdded: row[14] || '',
    lastTouched: row[15] || '',
  };
}

function contactToRow(c: Contact): string[] {
  return [
    c.id, c.name, c.company, c.position, c.email, c.phoneMobile,
    c.phoneOffice, c.linkedin, c.type, c.heat, c.frequency,
    c.eventMet, c.notes, c.owners, c.dateAdded, c.lastTouched,
  ];
}

function parseInteraction(row: string[]): Interaction {
  return {
    id: row[0] || '',
    contactId: row[1] || '',
    date: row[2] || '',
    type: (row[3] || 'meeting') as InteractionType,
    notes: row[4] || '',
    loggedBy: row[5] || '',
    category: (row[6] || 'neither') as MeetingCategory,
  };
}

function interactionToRow(i: Interaction): string[] {
  return [i.id, i.contactId, i.date, i.type, i.notes, i.loggedBy, i.category];
}

// ─── CONTACTS ────────────────────────────────────────────────

let contactsCache: Contact[] = [];
let contactsRowMap: Map<string, number> = new Map();

export async function fetchContacts(): Promise<Contact[]> {
  const rows = await readTable('Contacts');
  contactsCache = rows.map(parseContact);
  contactsRowMap = new Map(contactsCache.map((c, i) => [c.id, i]));
  return contactsCache;
}

export async function addContact(data: Omit<Contact, 'id' | 'dateAdded'>): Promise<Contact> {
  const contact: Contact = {
    ...data,
    id: uuid(),
    dateAdded: new Date().toISOString().slice(0, 10),
  };
  await addTableRow('Contacts', contactToRow(contact));
  contactsCache.push(contact);
  contactsRowMap.set(contact.id, contactsCache.length - 1);
  return contact;
}

export async function updateContact(contact: Contact): Promise<void> {
  const idx = contactsRowMap.get(contact.id);
  if (idx === undefined) throw new Error('Contact not found in cache');
  await updateTableRow('Contacts', idx, contactToRow(contact));
  contactsCache[idx] = contact;
}

export async function removeContact(id: string): Promise<void> {
  const idx = contactsRowMap.get(id);
  if (idx === undefined) throw new Error('Contact not found in cache');
  await deleteTableRow('Contacts', idx);
  contactsCache.splice(idx, 1);
  contactsRowMap = new Map(contactsCache.map((c, i) => [c.id, i]));
}

export async function markContactTouched(id: string, loggedBy: string): Promise<void> {
  const idx = contactsRowMap.get(id);
  if (idx === undefined) throw new Error('Contact not found in cache');
  const contact = { ...contactsCache[idx], lastTouched: new Date().toISOString().slice(0, 10) };
  await updateTableRow('Contacts', idx, contactToRow(contact));
  contactsCache[idx] = contact;

  const interaction: Interaction = {
    id: uuid(),
    contactId: id,
    date: new Date().toISOString().slice(0, 10),
    type: 'meeting',
    notes: 'Quick touch logged via app',
    loggedBy,
    category: categorizeByContactType(contact.type),
  };
  await addTableRow('Interactions', interactionToRow(interaction));
}

function categorizeByContactType(type: ContactType): MeetingCategory {
  if (type === 'client') return 'client_side';
  if (type === 'capital_provider') return 'capital_side';
  if (type === 'partner') return 'neither';
  return 'neither';
}

// ─── INTERACTIONS ────────────────────────────────────────────

let interactionsCache: Interaction[] = [];

export async function fetchInteractions(): Promise<Interaction[]> {
  const rows = await readTable('Interactions');
  interactionsCache = rows.map(parseInteraction);
  return interactionsCache;
}

export async function addInteraction(data: Omit<Interaction, 'id'>): Promise<Interaction> {
  const interaction: Interaction = { ...data, id: uuid() };
  await addTableRow('Interactions', interactionToRow(interaction));
  interactionsCache.push(interaction);
  return interaction;
}

export function getCachedContacts(): Contact[] {
  return contactsCache;
}

export function getCachedInteractions(): Interaction[] {
  return interactionsCache;
}

// ─── DUPLICATE MERGE ────────────────────────────────────────

function pickBest(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

function pickLatestDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

function mergeOwners(contacts: Contact[]): string {
  const ownerSet = new Set<string>();
  for (const c of contacts) {
    c.owners.split(',').map(s => s.trim()).filter(Boolean).forEach(o => ownerSet.add(o));
  }
  return [...ownerSet].join(', ');
}

function mergeContactGroup(group: Contact[]): Contact {
  const base = group[0];
  const merged: Contact = { ...base };

  for (let i = 1; i < group.length; i++) {
    const c = group[i];
    merged.company = pickBest(merged.company, c.company);
    merged.position = pickBest(merged.position, c.position);
    merged.email = pickBest(merged.email, c.email);
    merged.phoneMobile = pickBest(merged.phoneMobile, c.phoneMobile);
    merged.phoneOffice = pickBest(merged.phoneOffice, c.phoneOffice);
    merged.linkedin = pickBest(merged.linkedin, c.linkedin);
    merged.eventMet = pickBest(merged.eventMet, c.eventMet);
    merged.notes = pickBest(merged.notes, c.notes);
    merged.dateAdded = pickLatestDate(merged.dateAdded, c.dateAdded);
    merged.lastTouched = pickLatestDate(merged.lastTouched, c.lastTouched);
    if (merged.type === 'unclassified' && c.type !== 'unclassified') merged.type = c.type;
    if (merged.heat === 'cold' && c.heat !== 'cold') merged.heat = c.heat;
    if (c.heat === 'hot') merged.heat = 'hot';
  }
  merged.owners = mergeOwners(group);
  return merged;
}

export async function mergeAllDuplicates(
  onProgress?: (msg: string) => void
): Promise<{ merged: number; removed: number }> {
  onProgress?.('Reading all contacts...');
  const allContacts = await fetchContacts();

  onProgress?.('Finding duplicates...');
  const nameMap = new Map<string, Contact[]>();
  for (const c of allContacts) {
    const key = c.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) continue;
    const group = nameMap.get(key) || [];
    group.push(c);
    nameMap.set(key, group);
  }

  const dupeGroups: Contact[][] = [];
  for (const group of nameMap.values()) {
    if (group.length > 1) dupeGroups.push(group);
  }

  if (dupeGroups.length === 0) {
    return { merged: 0, removed: 0 };
  }

  const dupeIds = new Set<string>();
  for (const group of dupeGroups) {
    for (const c of group) dupeIds.add(c.id);
  }

  const mergedContacts: Contact[] = dupeGroups.map(mergeContactGroup);
  const mergedIds = new Set(mergedContacts.map(c => c.id));

  const finalList: Contact[] = [];
  const seen = new Set<string>();
  for (const c of allContacts) {
    if (dupeIds.has(c.id)) {
      if (!seen.has(c.id) && mergedIds.has(c.id)) {
        const merged = mergedContacts.find(m => m.id === c.id)!;
        finalList.push(merged);
        seen.add(c.id);
      }
    } else {
      finalList.push(c);
    }
  }

  const removed = allContacts.length - finalList.length;
  onProgress?.(`Merging ${dupeGroups.length} groups, removing ${removed} duplicates...`);

  onProgress?.('Clearing table...');
  await clearTableData('Contacts');

  const BATCH_SIZE = 100;
  for (let i = 0; i < finalList.length; i += BATCH_SIZE) {
    const batch = finalList.slice(i, i + BATCH_SIZE);
    const rows = batch.map(contactToRow);
    onProgress?.(`Writing contacts ${i + 1}–${Math.min(i + BATCH_SIZE, finalList.length)} of ${finalList.length}...`);
    await addTableRows('Contacts', rows);
  }

  contactsCache = finalList;
  contactsRowMap = new Map(contactsCache.map((c, i) => [c.id, i]));

  onProgress?.('Done!');
  return { merged: dupeGroups.length, removed };
}
