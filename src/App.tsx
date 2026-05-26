import { useState, useCallback, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './services/authConfig';
import { initGraphClient } from './services/graphClient';
import { addContact, updateContact, removeContact, markContactTouched } from './services/excelService';
import { useContacts } from './hooks/useContacts';
import { useInteractions } from './hooks/useInteractions';
import { ToastProvider, useToast } from './components/Toast';
import StaffFilter from './components/StaffFilter';
import Dashboard from './components/Dashboard';
import ContactsList from './components/ContactsList';
import AddEditContact from './components/AddEditContact';
import FollowUpQueue from './components/FollowUpQueue';
import StructuralHoleMap from './components/StructuralHoleMap';
import MeetingAudit from './components/MeetingAudit';
import type { Contact } from './types';

type Tab = 'contacts' | 'add' | 'followup' | 'holemap' | 'audit';

function AppContent() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [graphReady, setGraphReady] = useState(false);
  const [tab, setTab] = useState<Tab>('contacts');
  const [staffView, setStaffView] = useState('all');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const toast = useToast();

  const userEmail = accounts[0]?.username || '';
  const userName = accounts[0]?.name || userEmail.split('@')[0] || 'guest';

  useEffect(() => {
    if (isAuthenticated && !graphReady) {
      initGraphClient(instance);
      setGraphReady(true);
    }
  }, [isAuthenticated, graphReady, instance]);

  const { contacts, loading, error, lastSync, refresh } = useContacts(graphReady ? 60_000 : 0);
  const { interactions, refresh: refreshInteractions } = useInteractions(graphReady ? 60_000 : 0);

  const filteredContacts =
    staffView === 'all'
      ? contacts
      : contacts.filter(c => {
          const owners = c.owners.toLowerCase();
          return owners.includes(staffView.toLowerCase());
        });

  const handleLogin = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  const handleMarkTouched = useCallback(
    async (id: string) => {
      try {
        await markContactTouched(id, userName);
        toast('Marked as touched.');
        refresh();
        refreshInteractions();
      } catch (e: any) {
        toast('Error: ' + (e.message || e));
      }
    },
    [userName, toast, refresh, refreshInteractions]
  );

  const handleEdit = useCallback(
    (id: string) => {
      const c = contacts.find(x => x.id === id);
      if (c) {
        setEditingContact(c);
        setTab('add');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [contacts]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const c = contacts.find(x => x.id === id);
      if (!c || !confirm(`Delete ${c.name}?`)) return;
      try {
        await removeContact(id);
        toast('Contact deleted.');
        refresh();
      } catch (e: any) {
        toast('Error: ' + (e.message || e));
      }
    },
    [contacts, toast, refresh]
  );

  const handleSave = useCallback(
    async (data: Omit<Contact, 'id' | 'dateAdded'>) => {
      await addContact(data);
      toast('Contact saved!');
      refresh();
    },
    [toast, refresh]
  );

  const handleUpdate = useCallback(
    async (contact: Contact) => {
      await updateContact(contact);
      toast('Contact updated.');
      refresh();
    },
    [toast, refresh]
  );

  const handleClearForm = useCallback(() => {
    setEditingContact(null);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <h1>Network Tracker</h1>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sage3 Capital</span>
        <p>
          Sign in with your Microsoft 365 account to access the firm's network database.
          This app connects to a shared Excel workbook for real-time collaboration.
        </p>
        <button className="login-btn" onClick={handleLogin}>
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  if (!graphReady) {
    return (
      <div className="loading">
        <span className="spinner" />
        Initializing...
      </div>
    );
  }

  const syncLabel = lastSync
    ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Syncing...';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'contacts', label: 'Contacts' },
    { key: 'add', label: '+ Add contact' },
    { key: 'followup', label: 'Follow-up queue' },
    { key: 'holemap', label: 'Structural hole map' },
    { key: 'audit', label: 'Meeting audit' },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Network Tracker</h1>
          <span className="topbar-brand">Sage3 Capital</span>
          <span className="user-pill">{userName}</span>
        </div>
        <div className="topbar-right">
          <span>{error ? 'Sync error' : syncLabel}</span>
          <button className="sync-btn" onClick={() => { refresh(); refreshInteractions(); }}>
            Sync now
          </button>
          <button className="sign-out-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="main">
        <StaffFilter value={staffView} onChange={setStaffView} />

        <div className="tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && contacts.length === 0 ? (
          <div className="loading">
            <span className="spinner" />
            Loading contacts from Excel...
          </div>
        ) : (
          <>
            {tab === 'contacts' && (
              <>
                <Dashboard contacts={filteredContacts} />
                <ContactsList
                  contacts={filteredContacts}
                  onMarkTouched={handleMarkTouched}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </>
            )}
            {tab === 'add' && (
              <AddEditContact
                editingContact={editingContact}
                currentUser={userName}
                onSave={handleSave}
                onUpdate={handleUpdate}
                onClear={handleClearForm}
              />
            )}
            {tab === 'followup' && (
              <FollowUpQueue contacts={filteredContacts} onMarkTouched={handleMarkTouched} />
            )}
            {tab === 'holemap' && <StructuralHoleMap contacts={filteredContacts} />}
            {tab === 'audit' && <MeetingAudit interactions={interactions} />}
          </>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
