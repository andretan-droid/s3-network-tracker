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

const NAV_ITEMS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'contacts', label: 'Contacts', icon: '☺' },
  { key: 'add', label: 'Add Contact', icon: '+' },
  { key: 'followup', label: 'Follow-ups', icon: '⏰' },
  { key: 'holemap', label: 'Structural Hole', icon: '◉' },
  { key: 'audit', label: 'Meeting Audit', icon: '⚑' },
];

function AppContent() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [graphReady, setGraphReady] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [staffView, setStaffView] = useState('all');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        toast('Interaction logged. Contact marked as touched.');
        refresh();
        refreshInteractions();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast('Error: ' + msg);
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast('Error: ' + msg);
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
        <div className="login-left">
          <div className="login-left-content">
            <div className="login-left-logo">S3</div>
            <h1>Network Tracker</h1>
            <p className="login-left-tagline">
              Strategic Relationship Intelligence for Sage3 Capital.
              Bridge the structural hole between clients and capital providers.
            </p>
            <div className="login-left-features">
              <div className="login-left-feature">
                <div className="login-left-feature-icon">{'◉'}</div>
                <span>Structural Hole Map: visualize your brokerage position</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon">{'⬡'}</div>
                <span>Auto-tiered relationships: Inner Circle, Strategic, Dormant</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon">{'⚑'}</div>
                <span>Meeting audit: measure if meetings advance the hole</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon">{'☺'}</div>
                <span>Firm-wide view across directors and staff</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-card">
            <div className="login-brand">
              <div className="login-logo">S3</div>
              <h1>Network Tracker</h1>
              <span className="login-firm">Sage3 Capital</span>
            </div>

            <div className="login-hero">
              <h2>Strategic Relationship Intelligence</h2>
              <p>
                Your firm sits in a <strong>structural hole</strong>, bridging clients who
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

  const dueCount = filteredContacts.filter(c => {
    if (!c.lastTouched) return true;
    const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
    return days >= (c.frequency === 'biannual' ? 180 : c.frequency === 'quarterly' ? 90 : c.frequency === 'monthly' ? 30 : 9999);
  }).length;

  const getBadge = (key: Tab): number | undefined => {
    if (key === 'contacts') return filteredContacts.length;
    if (key === 'followup') return dueCount;
    return undefined;
  };

  const getNavLabel = (key: Tab): string => {
    if (key === 'add' && editingContact) return 'Edit Contact';
    const item = NAV_ITEMS.find(n => n.key === key);
    return item?.label ?? '';
  };

  const userInitials = userName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile sidebar toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app-shell">
        {/* ─── Sidebar ─── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          {/* Brand */}
          <div className="sidebar-brand">
            <div className="sidebar-logo">S3</div>
            <div className="sidebar-brand-text">
              <h1>Network Tracker</h1>
              <span>Sage3 Capital</span>
            </div>
          </div>

          {/* Staff filter */}
          <div className="sidebar-section-label">View</div>
          <div className="sidebar-staff-filter">
            <StaffFilter value={staffView} onChange={setStaffView} />
          </div>

          {/* Navigation */}
          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(n => {
              const badge = getBadge(n.key);
              return (
                <button
                  key={n.key}
                  className={`sidebar-nav-item ${tab === n.key ? 'active' : ''}`}
                  onClick={() => { setTab(n.key); setSidebarOpen(false); }}
                >
                  <span className="sidebar-nav-icon">{n.icon}</span>
                  <span className="sidebar-nav-label">{getNavLabel(n.key)}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="sidebar-nav-badge">{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sync row */}
          <div className="sidebar-sync">
            <span className="sidebar-sync-status" title={error || ''}>
              {error ? `Err: ${error.substring(0, 40)}` : syncLabel}
            </span>
            <button
              className="sidebar-sync-btn"
              onClick={() => { refresh(); refreshInteractions(); }}
            >
              Sync
            </button>
          </div>

          {/* User footer */}
          <div className="sidebar-footer">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">Sage3 Capital</div>
            </div>
            <button className="sidebar-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <div className="main">
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
