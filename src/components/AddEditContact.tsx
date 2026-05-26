import { useState, useEffect } from 'react';
import type { Contact, ContactType, HeatLevel, Frequency } from '../types';
import { STAFF_ROSTER } from '../types';

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
  type: 'client' as ContactType,
  heat: 'warm' as HeatLevel,
  frequency: 'biannual' as Frequency,
  eventMet: '',
  notes: '',
  owners: '',
  lastTouched: '',
};

export default function AddEditContact({ editingContact, currentUser, onSave, onUpdate, onClear }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
        heat: editingContact.heat,
        frequency: editingContact.frequency,
        eventMet: editingContact.eventMet,
        notes: editingContact.notes,
        owners: editingContact.owners,
        lastTouched: editingContact.lastTouched,
      });
    } else {
      setForm({ ...emptyForm, owners: currentUser });
    }
  }, [editingContact, currentUser]);

  const handleClear = () => {
    setForm({ ...emptyForm, owners: currentUser });
    onClear();
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.company.trim()) {
      alert('Name and company are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingContact) {
        await onUpdate({ ...editingContact, ...form });
      } else {
        await onSave(form);
      }
      handleClear();
    } catch (e: any) {
      alert('Error saving: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <div className="add-form">
      <h2>{editingContact ? 'Edit contact' : 'Add a new contact'}</h2>
      <div className="form-grid">
        <div className="form-group">
          <label>Full name *</label>
          <input value={form.name} onChange={set('name')} placeholder="Ahmad Rizal" />
        </div>
        <div className="form-group">
          <label>Company *</label>
          <input value={form.company} onChange={set('company')} placeholder="Maybank Investment" />
        </div>
        <div className="form-group">
          <label>Role / title</label>
          <input value={form.position} onChange={set('position')} placeholder="VP, Corporate Banking" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="ahmad@maybank.com" />
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
          <input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/ahmad" />
        </div>
        <div className="form-group">
          <label>Contact type *</label>
          <select value={form.type} onChange={set('type')}>
            <option value="client">Client</option>
            <option value="capital_provider">Capital provider (bank / investor)</option>
            <option value="partner">Partner / referrer</option>
            <option value="unclassified">Unclassified</option>
          </select>
        </div>
        <div className="form-group">
          <label>Lead heat</label>
          <select value={form.heat} onChange={set('heat')}>
            <option value="warm">Warm — potential interest</option>
            <option value="hot">Hot — active interest</option>
            <option value="cold">Cold — just collecting</option>
          </select>
        </div>
        <div className="form-group">
          <label>Touch frequency</label>
          <select value={form.frequency} onChange={set('frequency')}>
            <option value="biannual">2x per year (strategic — most valuable)</option>
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
            <option value="asneeded">As needed</option>
          </select>
        </div>
        <div className="form-group">
          <label>Owner(s)</label>
          <input value={form.owners} onChange={set('owners')} placeholder="Ravi, Philip" />
        </div>
        <div className="form-group">
          <label>Where you met</label>
          <input value={form.eventMet} onChange={set('eventMet')} placeholder="e.g. MIFF 2025, Invest Malaysia dinner" />
        </div>
        <div className="form-group full">
          <label>Notes</label>
          <textarea value={form.notes} onChange={set('notes')} placeholder="Mentioned exploring PE fund allocation in Q3..." />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-ghost" onClick={handleClear}>Clear</button>
        <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
          {saving ? 'Saving...' : editingContact ? 'Update contact' : 'Save contact'}
        </button>
      </div>
    </div>
  );
}
