import { useState, useCallback, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './services/authConfig';
import { initGraphClient } from './services/graphClient';
import { addContact, updateContact, removeContact, markContactTouched, addInteraction, mergeAllDuplicates } from './services/excelService';
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
import type { Contact, Interaction } from './types';

type Tab = 'dashboard' | 'contacts' | 'add' | 'followup' | 'holemap' | 'audit';

function AppContent() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [graphReady, setGraphReady] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
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

  const filteredInteractions =
    staffView === 'all'
      ? interactions
      : interactions.filter(i => i.loggedBy.toLowerCase().includes(staffView.toLowerCase()));

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
        toast('Interaction logged — contact marked as touched.');
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

  const handleLogMeeting = useCallback(
    async (data: Omit<Interaction, 'id'>) => {
      await addInteraction(data);
      toast('Meeting logged successfully.');
      refreshInteractions();
    },
    [toast, refreshInteractions]
  );

  const handleMergeAll = useCallback(
    async () => {
      const result = await mergeAllDuplicates((msg) => console.log('[Merge]', msg));
      toast(`Merged ${result.merged} duplicate groups, removed ${result.removed} extra entries.`);
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
        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">S3</div>
            <h1>Network Tracker</h1>
            <span className="login-firm">Sage3 Capital</span>
          </div>

          <div className="login-hero">
            <h2>Strategic Relationship Intelligence</h2>
            <p>
              Your firm sits in a <strong>structural hole</strong> — bridging clients who
              need capital and advisory with banks and investors who need deal flow. This
              gap is your strategic advantage. This tool helps you see, measure, and
              strengthen it.
            </p>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon" style={{ background: 'var(--client-bg)', color: 'var(--client)' }}>&#9679;</div>
              <div>
                <strong>Structural Hole Map</strong>
                <span>Visualize your position between clients and capital providers</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon" style={{ background: 'var(--capital-bg)', color: 'var(--capital)' }}>&#9679;</div>
              <div>
                <strong>Relationship Tiers</strong>
                <span>Auto-track which contacts are Inner Circle, Strategic, or Dormant</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon" style={{ background: 'var(--partner-bg)', color: 'var(--partner)' }}>&#9679;</div>
              <div>
                <strong>Meeting Audit</strong>
                <span>Evaluate whether your meetings advance the structural hole</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon" style={{ background: 'var(--surface-alt)', color: 'var(--text-muted)' }}>&#9679;</div>
              <div>
                <strong>Firm-Wide View</strong>
                <span>See all connections across directors and staff with owner tracking</span>
              </div>
            </div>
          </div>

          <button className="login-btn" onClick={handleLogin}>
            Sign in with Microsoft 365
          </button>
          <span className="login-note">
            Connects to your shared Excel workbook via Microsoft Graph for real-time collaboration.
          </span>
        </div>
      </div>
    );
  }

  if (!graphReady) {
    return (
      <div className="loading">
        <span className="spinner" />
        Initializing Microsoft Graph connection...
      </div>
    );
  }

  const syncLabel = lastSync
    ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Syncing...';

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'contacts', label: 'Contacts', badge: filteredContacts.length },
    { key: 'add', label: editingContact ? 'Edit contact' : '+ Add contact' },
    { key: 'followup', label: 'Follow-up queue', badge: filteredContacts.filter(c => {
      if (!c.lastTouched) return true;
      const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
      return days >= (c.frequency === 'biannual' ? 180 : c.frequency === 'quarterly' ? 90 : c.frequency === 'monthly' ? 30 : 9999);
    }).length },
    { key: 'holemap', label: 'Structural hole' },
    { key: 'audit', label: 'Meeting audit' },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">S3</div>
          <div className="topbar-text">
            <h1>Network Tracker</h1>
            <span className="topbar-brand">Sage3 Capital — Strategic Relationship Intelligence</span>
          </div>
          <span className="user-pill">{userName}</span>
        </div>
        <div className="topbar-right">
          <span title={error || ''}>{error ? `Sync error: ${error.substring(0, 60)}` : syncLabel}</span>
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
              {t.badge !== undefined && t.badge > 0 && (
                <span className="tab-badge">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {loading && contacts.length === 0 ? (
          <div className="loading">
            <span className="spinner" />
            Loading contacts from Excel workbook...
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                contacts={filteredContacts}
                interactions={filteredInteractions}
                staffView={staffView}
              />
            )}
            {tab === 'contacts' && (
              <ContactsList
                contacts={filteredContacts}
                onMarkTouched={handleMarkTouched}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMergeAll={handleMergeAll}
              />
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
            {tab === 'audit' && (
              <MeetingAudit
                interactions={filteredInteractions}
                onLogMeeting={handleLogMeeting}
                currentUser={userName}
              />
            )}
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
