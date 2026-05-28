import { useState, useEffect } from 'react';
import type { Contact, ContactType, HeatLevel, Frequency, CapitalSubType } from '../types';
import { STAFF_ROSTER } from '../types';
import { Card, CardHeader, CardFooter, Button, Disclosure, useDialog } from './ui';
import { Plus, X } from './ui/icons';

interface Props {
  editingContact: Contact | null;
  currentUser: string;
  onSave: (data: Omit<Contact, 'id' | 'dateAdded'>) => Promise<void>;
  onUpdate: (contact: Contact) => Promise<void>;
  onClear: () => void;
}

const emptyForm = {
  name: '',
  company: '',
  position: '',
  email: '',
  phoneMobile: '',
  phoneOffice: '',
  linkedin: '',
  type: 'unclassified' as ContactType,
  subType: '' as CapitalSubType,
  heat: '' as HeatLevel,
  frequency: '' as Frequency,
  eventMet: '',
  notes: '',
  owners: '' as string,
  lastTouched: '',
};

function parseOwners(str: string): string[] {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/* ────────────────────────────────────────────────────────────
   Smart owner block
   - Default: current user pre-selected, shown as a single chip
   - "Add co-owner" expands the full STAFF_ROSTER tri-group picker
   - When editing, auto-expand if the contact has multiple owners
     or a single owner that is not the current user
   ──────────────────────────────────────────────────────────── */

function OwnerBlock({
  value,
  onChange,
  forceOpen,
}: {
  value: string;
  onChange: (val: string) => void;
  forceOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = expanded || forceOpen;
  const selected = parseOwners(value);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter(n => n !== name)
      : [...selected, name];
    onChange(next.join(', '));
  };

  const eds = STAFF_ROSTER.filter(s => s.level === 'executive_director');
  const ads = STAFF_ROSTER.filter(s => s.level === 'associate_director');
  const staff = STAFF_ROSTER.filter(s => s.level === 'staff');

  // Collapsed state: chip summary + expand button
  if (!isOpen) {
    return (
      <div className="owner-summary-row">
        {selected.map(name => (
          <span key={name} className="owner-summary-chip">{name}</span>
        ))}
        <button
          type="button"
          className={`add-coowner-btn${selected.length === 0 ? ' add-coowner-btn--required' : ''}`}
          onClick={() => setExpanded(true)}
        >
          <Plus /> {selected.length === 0 ? 'Add owner' : 'Add co-owner'}
        </button>
      </div>
    );
  }

  return (
    <div className="owner-select">
      <div className="owner-group-label">Executive Directors</div>
      <div className="owner-checkboxes">
        {eds.map(s => (
          <label key={s.id} className={`owner-chip ${selected.includes(s.name) ? 'owner-chip-active' : ''}`}>
            <input
              type="checkbox"
              checked={selected.includes(s.name)}
              onChange={() => toggle(s.name)}
            />
            {s.name}
          </label>
        ))}
      </div>
      <div className="owner-group-label">Associate Directors</div>
      <div className="owner-checkboxes">
        {ads.map(s => (
          <label key={s.id} className={`owner-chip ${selected.includes(s.name) ? 'owner-chip-active' : ''}`}>
            <input
              type="checkbox"
              checked={selected.includes(s.name)}
              onChange={() => toggle(s.name)}
            />
            {s.name}
          </label>
        ))}
      </div>
      <div className="owner-group-label">Staff</div>
      <div className="owner-checkboxes">
        {staff.map(s => (
          <label key={s.id} className={`owner-chip ${selected.includes(s.name) ? 'owner-chip-active' : ''}`}>
            <input
              type="checkbox"
              checked={selected.includes(s.name)}
              onChange={() => toggle(s.name)}
            />
            {s.name}
          </label>
        ))}
      </div>
      <div className="owner-summary">
        {selected.length > 0 ? (
          <>Selected: <strong>{selected.join(', ')}</strong></>
        ) : (
          <em>No owner selected. At least one is required.</em>
        )}
        {!forceOpen && (
          <button
            type="button"
            className="add-coowner-btn"
            onClick={() => setExpanded(false)}
            style={{ marginLeft: 8 }}
          >
            <X /> Collapse
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   AddEditContact
   ──────────────────────────────────────────────────────────── */

export default function AddEditContact({ editingContact, currentUser, onSave, onUpdate, onClear }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const dialog = useDialog();

  useEffect(() => {
    if (editingContact) {
      setForm({
        name: editingContact.name,
        company: editingContact.company,
        position: editingContact.position,
        email: editingContact.email,
        phoneMobile: editingContact.phoneMobile,
        phoneOffice: editingContact.phoneOffice,
        linkedin: editingContact.linkedin,
        type: editingContact.type,
        subType: editingContact.subType,
        heat: editingContact.heat,
        frequency: editingContact.frequency,
        eventMet: editingContact.eventMet,
        notes: editingContact.notes,
        owners: editingContact.owners,
        lastTouched: editingContact.lastTouched,
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [editingContact, currentUser]);

  const handleClear = () => {
    setForm({ ...emptyForm });
    onClear();
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.company.trim()) {
      await dialog.alert({
        title: 'Missing required fields',
        body: 'Both Name and Company are required to save this contact.',
        tone: 'warn',
      });
      return;
    }
    if (!form.owners.trim()) {
      await dialog.alert({
        title: 'Owner required',
        body: 'Please select at least one owner so this contact is attributed.',
        tone: 'warn',
      });
      return;
    }
    setSaving(true);
    try {
      if (editingContact) {
        await onUpdate({ ...editingContact, ...form });
      } else {
        await onSave(form);
      }
      // "Save & add another": reset the form so the next card can be typed in straight away.
      handleClear();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await dialog.alert({
        title: 'Could not save contact',
        body: `The Excel workbook did not accept the write: ${msg}`,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  // Auto-expand owner picker if editing a contact whose ownership isn't a simple
  // "just me" case — directors will usually want to see the full picker then.
  const selectedOwners = parseOwners(form.owners);
  const ownerForceOpen =
    !!editingContact &&
    (selectedOwners.length > 1 ||
      (selectedOwners.length === 1 && selectedOwners[0] !== currentUser));

  // Has the user filled any optional detail field? Open the disclosure if so,
  // so editors don't have to expand to see their own data.
  const hasDetails = !!(
    form.position || form.email || form.phoneMobile || form.phoneOffice ||
    form.linkedin || form.eventMet
  );
  const hasClassification = !!(
    (form.type && form.type !== 'unclassified') || form.heat || form.frequency
  );

  return (
    <Card>
      <CardHeader
        title={editingContact ? 'Edit contact' : 'Add a new contact'}
        subtitle={
          editingContact
            ? 'To merge a duplicate, add extra owners below and then delete the duplicate entry.'
            : 'Start with the essentials. Details and classification can be filled in now or after the first conversation.'
        }
      />

      {/* ─── Step 1: Essentials (always visible) ─── */}
      <div className="form-section">
        <div className="form-grid">
          <div className="form-group">
            <label>Full name *</label>
            <input value={form.name} onChange={set('name')} placeholder="Contact full name" autoFocus />
          </div>
          <div className="form-group">
            <label>Company *</label>
            <input value={form.company} onChange={set('company')} placeholder="Company name" />
          </div>
          <div className="form-group full">
            <label>Owner(s) *</label>
            <OwnerBlock
              value={form.owners}
              onChange={val => setForm(prev => ({ ...prev, owners: val }))}
              forceOpen={ownerForceOpen}
            />
          </div>
        </div>
      </div>

      {/* ─── Step 2: Contact details (disclosure) ─── */}
      <div className="form-section">
        <Disclosure
          label="Contact details"
          hint="Role, email, phones, LinkedIn, where you met"
          defaultOpen={hasDetails}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Role / title</label>
              <input value={form.position} onChange={set('position')} placeholder="Role or title" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" />
            </div>
            <div className="form-group">
              <label>Phone (mobile)</label>
              <input value={form.phoneMobile} onChange={set('phoneMobile')} placeholder="+60 12-xxx xxxx" />
            </div>
            <div className="form-group">
              <label>Phone (office)</label>
              <input value={form.phoneOffice} onChange={set('phoneOffice')} placeholder="+603 xxxx xxxx" />
            </div>
            <div className="form-group">
              <label>LinkedIn</label>
              <input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/profile" />
            </div>
            <div className="form-group">
              <label>Where you met</label>
              <input value={form.eventMet} onChange={set('eventMet')} placeholder="e.g. conference, dinner, referral" />
            </div>
          </div>
        </Disclosure>
      </div>

      {/* ─── Step 3: Classification (disclosure) ─── */}
      <div className="form-section">
        <Disclosure
          label="Classification"
          hint="Skip on first save and come back after the first real conversation."
          defaultOpen={hasClassification}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Contact type</label>
              <select value={form.type} onChange={set('type')}>
                <option value="unclassified">Unclassified</option>
                <optgroup label="Structural hole">
                  <option value="client">Client</option>
                  <option value="capital_provider">Capital provider (bank / investor)</option>
                </optgroup>
                <optgroup label="Ecosystem">
                  <option value="partner">Partner / referrer</option>
                  <option value="educational">Educational (university, research, training)</option>
                  <option value="regulatory">Regulatory body</option>
                  <option value="government">Government</option>
                  <option value="institute">Institute / think-tank</option>
                </optgroup>
              </select>
            </div>
            {form.type === 'capital_provider' && (
              <div className="form-group">
                <label>Capital sub-type</label>
                <select value={form.subType} onChange={set('subType')}>
                  <option value="">— Not tagged —</option>
                  <option value="bank">Commercial Bank</option>
                  <option value="investment_bank">Investment Bank</option>
                  <option value="pe_vc_fund">PE / VC Fund</option>
                  <option value="family_office">Family Office</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Lead heat</label>
              <select value={form.heat} onChange={set('heat')}>
                <option value="">Not set</option>
                <option value="hot">Hot: active interest</option>
                <option value="warm">Warm: potential interest</option>
                <option value="cold">Cold: just collecting</option>
              </select>
            </div>
            <div className="form-group">
              <label>Touch frequency</label>
              <select value={form.frequency} onChange={set('frequency')}>
                <option value="">Not set</option>
                <option value="biannual">2x per year (strategic, most valuable)</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
                <option value="asneeded">As needed</option>
              </select>
            </div>
          </div>
        </Disclosure>
      </div>

      {/* ─── Notes (always visible) ─── */}
      <div className="form-section">
        <div className="form-group full">
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="Any context worth remembering — interests, mandate, next step..."
            rows={3}
          />
        </div>
      </div>

      <CardFooter>
        <Button variant="ghost" onClick={handleClear}>
          {editingContact ? 'Cancel edit' : 'Clear'}
        </Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>
          {saving
            ? 'Saving'
            : editingContact
              ? 'Update contact'
              : 'Save & add another'}
        </Button>
      </CardFooter>
    </Card>
  );
}
