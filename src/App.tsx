import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './services/authConfig';
import { initGraphClient } from './services/graphClient';
import {
  addContact, updateContact, removeContact, markContactTouched,
  addInteraction, mergeAllDuplicates,
} from './services/excelService';
import { useContacts } from './hooks/useContacts';
import { useInteractions } from './hooks/useInteractions';
import { ToastProvider, useToast } from './components/Toast';
import { DialogProvider, SyncStateProvider, useDialog, useSyncState } from './components/ui';
import StaffFilter from './components/StaffFilter';
import SyncStatus from './components/SyncStatus';
import Dashboard from './components/Dashboard';
import ContactsList from './components/ContactsList';
import AddEditContact from './components/AddEditContact';
import FollowUpQueue from './components/FollowUpQueue';
import StructuralHoleMap from './components/StructuralHoleMap';
import MeetingAudit from './components/MeetingAudit';
import type { Contact, Interaction } from './types';
import {
  LayoutDashboard, Users, UserPlus, Clock, Network, Flag,
  Menu, X, RefreshCw, LogOut, GitBranch, Target, GraduationCap, Sparkles,
} from './components/ui/icons';

/* ────────────────────────────────────────────────────────────
   Route map — single source of truth for paths + nav labels
   ──────────────────────────────────────────────────────────── */

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** End=true so /contacts doesn't stay active when on /contacts/new */
  end?: boolean;
  /** When the route is active, also match these paths (for sidebar highlight) */
  alsoActiveOn?: string[];
}

const NAV: NavItem[] = [
  { to: '/',                 label: 'Dashboard',       icon: <LayoutDashboard />, end: true },
  { to: '/contacts',         label: 'Contacts',        icon: <Users />,           end: true, alsoActiveOn: ['/contacts/'] },
  { to: '/contacts/new',     label: 'Add Contact',     icon: <UserPlus />,        end: true },
  { to: '/follow-ups',       label: 'Follow-ups',      icon: <Clock /> },
  { to: '/structural-hole',  label: 'Structural Hole', icon: <Network /> },
  { to: '/audit',            label: 'Meeting Audit',   icon: <Flag /> },
];

/* ────────────────────────────────────────────────────────────
   EditContactRoute — reads the contact from navigation state.
   This avoids putting the contact ID in the URL, which would
   fail for the majority of imported contacts that have no UUID.
   ──────────────────────────────────────────────────────────── */

interface EditContactRouteProps {
  currentUser: string;
  onSave: (data: Omit<Contact, 'id' | 'dateAdded'>) => Promise<void>;
  onUpdate: (contact: Contact) => Promise<void>;
}

function EditContactRoute({ currentUser, onSave, onUpdate }: EditContactRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const contact = (location.state as { contact?: Contact } | null)?.contact ?? null;

  if (!contact) {
    return <Navigate to="/contacts" replace />;
  }

  return (
    <AddEditContact
      editingContact={contact}
      currentUser={currentUser}
      onSave={onSave}
      onUpdate={onUpdate}
      onClear={() => navigate('/contacts')}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   AddContactRoute — add-new form, stays on /contacts/new
   ──────────────────────────────────────────────────────────── */

interface AddContactRouteProps {
  currentUser: string;
  onSave: (data: Omit<Contact, 'id' | 'dateAdded'>) => Promise<void>;
  onUpdate: (contact: Contact) => Promise<void>;
}

function AddContactRoute({ currentUser, onSave, onUpdate }: AddContactRouteProps) {
  return (
    <AddEditContact
      editingContact={null}
      currentUser={currentUser}
      onSave={onSave}
      onUpdate={onUpdate}
      onClear={() => { /* stay on /contacts/new, form clears internally */ }}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   AppContent — main shell, sidebar + routed main
   ──────────────────────────────────────────────────────────── */

function AppContent() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [graphReady, setGraphReady] = useState(false);
  const [staffView, setStaffView] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toast = useToast();
  const dialog = useDialog();
  const sync = useSyncState();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Close mobile sidebar whenever a route change happens
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const filteredContacts =
    staffView === 'all'
      ? contacts
      : contacts.filter(c => c.owners.toLowerCase().includes(staffView.toLowerCase()));

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

  /* ── Mutation handlers — every write wrapped in sync.track() ── */

  const handleMarkTouched = useCallback(
    async (id: string) => {
      try {
        await sync.track(markContactTouched(id, userName));
        toast('Interaction logged. Contact marked as touched.');
        refresh();
        refreshInteractions();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast('Error: ' + msg);
      }
    },
    [userName, sync, toast, refresh, refreshInteractions]
  );

  const handleEdit = useCallback(
    (contact: Contact) => {
      // Pass the full contact via navigation state — avoids putting the ID in
      // the URL, which breaks for the majority of imported contacts with no UUID.
      navigate('/contacts/edit', { state: { contact } });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const c = contacts.find(x => x.id === id);
      if (!c) return;
      const ok = await dialog.confirm({
        title: `Delete ${c.name}?`,
        body: (
          <>
            This will permanently remove <strong>{c.name}</strong>
            {c.company ? <> ({c.company})</> : null} from the shared
            NetworkTracker workbook. This action cannot be undone.
          </>
        ),
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        await sync.track(removeContact(id));
        toast('Contact deleted.');
        refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast('Error: ' + msg);
      }
    },
    [contacts, dialog, sync, toast, refresh]
  );

  const handleSave = useCallback(
    async (data: Omit<Contact, 'id' | 'dateAdded'>) => {
      await sync.track(addContact(data));
      toast('Contact saved.');
      refresh();
    },
    [sync, toast, refresh]
  );

  const handleUpdate = useCallback(
    async (contact: Contact) => {
      await sync.track(updateContact(contact));
      toast('Contact updated.');
      refresh();
    },
    [sync, toast, refresh]
  );

  const handleLogMeeting = useCallback(
    async (data: Omit<Interaction, 'id'>) => {
      await sync.track(addInteraction(data));
      toast('Meeting logged successfully.');
      refreshInteractions();
    },
    [sync, toast, refreshInteractions]
  );

  const handleMergeAll = useCallback(
    async () => {
      const result = await sync.track(
        mergeAllDuplicates((msg) => console.log('[Merge]', msg))
      );
      toast(`Merged ${result.merged} duplicate groups, removed ${result.removed} extra entries.`);
      refresh();
    },
    [sync, toast, refresh]
  );

  /**
   * Bulk-update writer used by the Contacts tab's bulk-edit toolbar.
   *
   * Writes are SEQUENTIAL on purpose: the SharePoint workbook is a shared
   * resource and `excelService.ts` maintains an in-memory `contactsRowMap`
   * that each `updateContact` call mutates. Parallel writes would race the
   * map and risk version conflicts on the Graph side.
   *
   * Each individual write is `sync.track()`ed so the top strip reflects
   * exact in-flight count during the bulk operation.
   */
  const handleBulkUpdate = useCallback(
    async (updates: Contact[], onProgress?: (done: number, total: number) => void) => {
      let done = 0;
      const failures: { name: string; reason: string }[] = [];
      for (const c of updates) {
        try {
          await sync.track(updateContact(c));
        } catch (e: unknown) {
          failures.push({
            name: c.name,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
        done += 1;
        onProgress?.(done, updates.length);
      }
      refresh();
      if (failures.length === 0) {
        toast(`Updated ${updates.length} contact${updates.length === 1 ? '' : 's'}.`);
      } else {
        toast(`Updated ${updates.length - failures.length} of ${updates.length}. ${failures.length} failed.`);
        console.warn('[BulkUpdate] failures:', failures);
      }
    },
    [sync, toast, refresh]
  );

  /* ── Auth gate ── */

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-left">
          <div className="login-left-content">
            <div className="login-left-logo">S3</div>
            <h1>Network Tracker</h1>
            <p className="login-left-tagline">
              Strategic relationship intelligence for Sage3 Capital.
              Bridge the structural hole between clients and capital providers.
            </p>
            <div className="login-left-features">
              <div className="login-left-feature">
                <div className="login-left-feature-icon"><Network /></div>
                <span>Structural Hole Map: visualise your brokerage position</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon"><GitBranch /></div>
                <span>Auto-tiered relationships: Inner Circle, Strategic, Dormant</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon"><Flag /></div>
                <span>Meeting audit: measure if meetings advance the hole</span>
              </div>
              <div className="login-left-feature">
                <div className="login-left-feature-icon"><Users /></div>
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
              <h2>Strategic relationship intelligence</h2>
              <p>
                Your firm sits in a <strong>structural hole</strong>, bridging clients who
                need capital and advisory with banks and investors who need deal flow. This
                gap is your strategic advantage. This tool helps you see, measure, and
                strengthen it.
              </p>
            </div>

            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon" style={{ background: 'var(--client-bg)', color: 'var(--client)' }}>
                  <Target />
                </div>
                <div>
                  <strong>Structural Hole Map</strong>
                  <span>Visualise your position between clients and capital providers</span>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon" style={{ background: 'var(--capital-bg)', color: 'var(--capital)' }}>
                  <GitBranch />
                </div>
                <div>
                  <strong>Relationship Tiers</strong>
                  <span>Auto-track which contacts are Inner Circle, Strategic, or Dormant</span>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon" style={{ background: 'var(--sage-panel)', color: 'var(--sage-forest)' }}>
                  <Sparkles />
                </div>
                <div>
                  <strong>Meeting Audit</strong>
                  <span>Evaluate whether your meetings advance the structural hole</span>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon" style={{ background: 'var(--surface-alt)', color: 'var(--text-secondary)' }}>
                  <GraduationCap />
                </div>
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

  const getBadge = (to: string): number | undefined => {
    if (to === '/contacts')   return filteredContacts.length;
    if (to === '/follow-ups') return dueCount;
    return undefined;
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
        {sidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app-shell">
        {/* ─── Sidebar ─── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-logo">S3</div>
            <div className="sidebar-brand-text">
              <h1>Network Tracker</h1>
              <span>Sage3 Capital</span>
            </div>
          </div>

          <div className="sidebar-section-label">View</div>
          <div className="sidebar-staff-filter">
            <StaffFilter value={staffView} onChange={setStaffView} />
          </div>

          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav">
            {NAV.map(n => {
              const badge = getBadge(n.to);
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => {
                    // Highlight "Add Contact" when on /contacts/:id/edit too
                    const altMatch =
                      n.alsoActiveOn?.some(p => location.pathname.startsWith(p)) &&
                      !NAV.some(other => other !== n && other.end && other.to === location.pathname);
                    return `sidebar-nav-item ${isActive || altMatch ? 'active' : ''}`;
                  }}
                >
                  <span className="sidebar-nav-icon">{n.icon}</span>
                  <span className="sidebar-nav-label">{n.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="sidebar-nav-badge">{badge}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-sync">
            <span className="sidebar-sync-status" title={error || ''}>
              {error ? 'Sync error' : syncLabel}
            </span>
            <button
              className="sidebar-sync-btn"
              onClick={() => { refresh(); refreshInteractions(); }}
              title="Refresh from Excel"
            >
              <RefreshCw size={11} style={{ verticalAlign: 'middle' }} />
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">Sage3 Capital</div>
            </div>
            <button
              className="sidebar-signout"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={12} />
            </button>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <div className="main">
          <SyncStatus
            lastSync={lastSync}
            error={error}
            onRefresh={() => { refresh(); refreshInteractions(); }}
          />
          {loading && contacts.length === 0 ? (
            <div className="loading">
              <span className="spinner" />
              Loading contacts from Excel workbook...
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    contacts={filteredContacts}
                    interactions={filteredInteractions}
                    staffView={staffView}
                  />
                }
              />
              <Route
                path="/contacts"
                element={
                  <ContactsList
                    contacts={filteredContacts}
                    onMarkTouched={handleMarkTouched}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onMergeAll={handleMergeAll}
                    onBulkUpdate={handleBulkUpdate}
                  />
                }
              />
              <Route
                path="/contacts/new"
                element={
                  <AddContactRoute
                    currentUser={userName}
                    onSave={handleSave}
                    onUpdate={handleUpdate}
                  />
                }
              />
              <Route
                path="/contacts/edit"
                element={
                  <EditContactRoute
                    currentUser={userName}
                    onSave={handleSave}
                    onUpdate={handleUpdate}
                  />
                }
              />
              <Route
                path="/follow-ups"
                element={<FollowUpQueue contacts={filteredContacts} onMarkTouched={handleMarkTouched} />}
              />
              <Route
                path="/structural-hole"
                element={<StructuralHoleMap contacts={filteredContacts} onBulkUpdate={handleBulkUpdate} onEdit={handleEdit} />}
              />
              <Route
                path="/audit"
                element={
                  <MeetingAudit
                    interactions={filteredInteractions}
                    onLogMeeting={handleLogMeeting}
                    currentUser={userName}
                  />
                }
              />
              {/* Catch-all: anything unknown drops you back at the dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <SyncStateProvider>
          <AppContent />
        </SyncStateProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
