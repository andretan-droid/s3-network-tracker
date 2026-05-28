import { v4 as uuid } from 'uuid';
import { readTable, readTableHeaders, addTableRow, addTableRows, addTableColumn, updateTableRow, deleteTableRow, clearTableData } from './graphClient';
import type { Contact, Interaction, ContactType, HeatLevel, Frequency, InteractionType, MeetingCategory, CapitalSubType } from '../types';

// ─── Column order must match the Excel table exactly ─────────
// Contacts:     id | name | company | position | email | phoneMobile | phoneOffice | linkedin | type | heat | frequency | eventMet | notes | owners | dateAdded | lastTouched | subType
//   subType — capital provider sub-category; auto-provisioned on first fetchContacts if missing.
// Interactions: id | contactId | date | type | notes | loggedBy | category | attendees
//   contactId  — comma-separated contact IDs (multi-contact meetings)
//   attendees  — comma-separated Sage3 staff names who attended (beyond loggedBy)
//   The attendees column is added automatically on first fetchInteractions if missing.

// Graph API returns mixed types (string | number | boolean | null) even though
// the table is typed as string[][]. Coerce every cell to string at the boundary.
function cell(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function parseContact(row: string[]): Contact {
  return {
    id: cell(row[0]),
    name: cell(row[1]),
    company: cell(row[2]),
    position: cell(row[3]),
    email: cell(row[4]),
    phoneMobile: cell(row[5]),
    phoneOffice: cell(row[6]),
    linkedin: cell(row[7]),
    type: (cell(row[8]) || 'unclassified') as ContactType,
    heat: (cell(row[9])) as HeatLevel,
    frequency: (cell(row[10])) as Frequency,
    eventMet: cell(row[11]),
    notes: cell(row[12]),
    owners: cell(row[13]),
    dateAdded: cell(row[14]),
    lastTouched: cell(row[15]),
    subType: (cell(row[16]) || '') as CapitalSubType,
  };
}

// Set to true once fetchContacts confirms the subType column exists in Excel.
let contactsHasSubTypeCol = false;

function contactToRow(c: Contact): string[] {
  const row = [
    c.id, c.name, c.company, c.position, c.email, c.phoneMobile,
    c.phoneOffice, c.linkedin, c.type, c.heat, c.frequency,
    c.eventMet, c.notes, c.owners, c.dateAdded, c.lastTouched,
  ];
  if (contactsHasSubTypeCol) row.push(c.subType || '');
  return row;
}

// Excel stores dates as serial integers (days since Dec 30 1899).
// When cells are formatted as Date, the Graph API returns the raw number.
// Convert those to ISO strings; pass through any value that already looks like a date.
function excelDateToISO(raw: string): string {
  const n = Number(raw);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date((n - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  return raw;
}

function parseInteraction(row: string[]): Interaction {
  return {
    id: cell(row[0]),
    contactId: cell(row[1]),
    date: excelDateToISO(cell(row[2])),
    type: (cell(row[3]) || 'meeting') as InteractionType,
    notes: cell(row[4]),
    loggedBy: cell(row[5]),
    category: (cell(row[6]) || 'neither') as MeetingCategory,
    attendees: cell(row[7]),  // '' for rows that pre-date the attendees column
  };
}

// Set to true once fetchInteractions confirms the attendees column exists in Excel.
// interactionToRow uses this flag to write 7 or 8 values so it never exceeds the table width.
let interactionsHasAttendeesCol = false;

function interactionToRow(i: Interaction): string[] {
  const row = [i.id, i.contactId, i.date, i.type, i.notes, i.loggedBy, i.category];
  if (interactionsHasAttendeesCol) row.push(i.attendees || '');
  return row;
}

// ─── CONTACTS ────────────────────────────────────────────────

let contactsCache: Contact[] = [];
let contactsRowMap: Map<string, number> = new Map();

export async function fetchContacts(): Promise<Contact[]> {
  // Ensure the subType column exists before reading rows (same pattern as attendees).
  if (!contactsHasSubTypeCol) {
    try {
      const headers = await readTableHeaders('Contacts');
      if (headers.includes('subType')) {
        contactsHasSubTypeCol = true;
      } else {
        await addTableColumn('Contacts', 'subType');
        contactsHasSubTypeCol = true;
        console.log('[Excel] Added subType column to Contacts table');
      }
    } catch (e) {
      console.warn('[Excel] Could not ensure subType column:', e);
    }
  }

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
  let idx = contactsRowMap.get(contact.id);

  // Fallback for imported contacts without UUIDs: match by name + company
  if (idx === undefined) {
    idx = contactsCache.findIndex(
      c => c.name === contact.name && c.company === contact.company,
    );
    if (idx === -1) throw new Error(`Contact "${contact.name}" not found in cache`);
  }

  // Auto-assign a UUID so subsequent edits use the normal ID-based path
  const toSave: Contact = contact.id ? contact : { ...contact, id: uuid() };

  await updateTableRow('Contacts', idx, contactToRow(toSave));
  contactsCache[idx] = toSave;
  // Rebuild rowMap entry: removes the stale '' key and adds the new UUID key
  contactsRowMap = new Map(contactsCache.map((c, i) => [c.id, i]));
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
    attendees: '',
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
let interactionsRowMap: Map<string, number> = new Map();

export async function fetchInteractions(): Promise<Interaction[]> {
  // Ensure the attendees column exists before reading rows.
  // This runs once per session; subsequent calls use the cached flag.
  if (!interactionsHasAttendeesCol) {
    try {
      const headers = await readTableHeaders('Interactions');
      if (headers.includes('attendees')) {
        interactionsHasAttendeesCol = true;
      } else {
        await addTableColumn('Interactions', 'attendees');
        interactionsHasAttendeesCol = true;
        console.log('[Excel] Added attendees column to Interactions table');
      }
    } catch (e) {
      // Column check/add failed (e.g. API limitation). Log and continue
      // without attendees — writes remain at 7 columns, no data is lost.
      console.warn('[Excel] Could not ensure attendees column:', e);
    }
  }

  const rows = await readTable('Interactions');
  interactionsCache = rows.map(parseInteraction);
  interactionsRowMap = new Map(interactionsCache.map((i, idx) => [i.id, idx]));
  return interactionsCache;
}

export async function addInteraction(data: Omit<Interaction, 'id'>): Promise<Interaction> {
  const interaction: Interaction = { ...data, id: uuid() };
  await addTableRow('Interactions', interactionToRow(interaction));
  interactionsCache.push(interaction);
  interactionsRowMap.set(interaction.id, interactionsCache.length - 1);
  return interaction;
}

export async function updateInteraction(interaction: Interaction): Promise<void> {
  const idx = interactionsRowMap.get(interaction.id);
  if (idx === undefined) throw new Error(`Interaction "${interaction.id}" not found in cache`);
  await updateTableRow('Interactions', idx, interactionToRow(interaction));
  interactionsCache[idx] = interaction;
}

export async function deleteInteraction(id: string): Promise<void> {
  const idx = interactionsRowMap.get(id);
  if (idx === undefined) throw new Error('Interaction not found in cache');
  await deleteTableRow('Interactions', idx);
  interactionsCache.splice(idx, 1);
  interactionsRowMap = new Map(interactionsCache.map((i, n) => [i.id, n]));
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
