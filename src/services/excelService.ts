import { v4 as uuid } from 'uuid';
import { readTable, addTableRow, updateTableRow, deleteTableRow } from './graphClient';
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
