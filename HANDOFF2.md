# Sage3 Network Tracker: Developer Handoff

## What This Is

A React SPA for Sage3 Capital (Malaysian financial advisory firm) that tracks ~3,700+ business contacts stored in a SharePoint Excel workbook. Users sign in with Microsoft 365, and the app reads/writes `NetworkTracker.xlsx` via Microsoft Graph API. Deployed on Vercel, auto-deploys from `master`.

**Live URL:** Hosted on Vercel (auto-deploys from `master` branch)
**Repo:** `andretan-droid/s3-network-tracker`
**Stack:** React 19, TypeScript, Vite, MSAL (Azure AD auth), Microsoft Graph API
**No external database.** All data lives in two Excel tables: `Contacts` and `Interactions`.

---

## Current Visual Identity (Sage3 Brand)

Overhauled in the most recent session. The entire color system uses Sage3 greens:

| Variable | Hex | Usage |
|----------|-----|-------|
| `--sage-forest` | `#3D6027` | Primary: buttons, CTAs, active nav, login, toast |
| `--sage-mid` | `#548235` | Focus borders, client type color |
| `--sage-accent` | `#A8C089` | Hover highlights on cards |
| `--sage-panel` | `#EEF3EA` | Active sidebar item background |
| `--sage-border` | `#DCE8D4` | Card borders, table gridlines |

Contact type colors (remapped from the old teal/blue/purple):
- Client: `#548235` (sage green)
- Capital Provider: `#4A6B8A` (blue-grey)
- Partner: `#8B6914` (warm gold)
- Educational: `#6B5B95` (muted purple)
- Unclassified: `#8A8A86` (neutral grey)

**Design rules established by user:**
- Green as accent only, white/cream backgrounds dominate
- Cards use 1px `--sage-border` borders, no heavy shadows
- Buttons are solid `--sage-forest` with white text
- Active sidebar nav: `--sage-panel` background + 3px `--sage-forest` left border
- Login: sage green gradient (forest to sage to accent)
- Minimal page headers (title only, no long description paragraphs)
- BI dashboard feel for charts and data
- No em-dashes anywhere except ranges. Use colons, periods, commas, or middle dots instead.

---

## Architecture

```
src/
  App.tsx                  # Shell: sidebar nav, login screen, tab routing, staff filter
  styles.css               # ALL styles (no CSS modules, no Tailwind)
  main.tsx                 # Entry: MsalProvider wraps <App />
  types/index.ts           # All types, constants, STAFF_ROSTER, tier/due computation
  components/
    Dashboard.tsx           # 4 quick-stat cards, health gauges (SVG rings), donut chart, balance meter, tier bars
    ContactsList.tsx        # Filterable contact list with type/tier/heat filters + search
    ContactCard.tsx         # Individual contact card (avatar, badges, action buttons)
    AddEditContact.tsx      # Add/edit form with owner multi-select checkboxes
    FollowUpQueue.tsx       # Due contacts sorted by heat then tier, "Mark touched" buttons
    StructuralHoleMap.tsx   # SVG radial network graph (the "neural network" view)
    MeetingAudit.tsx        # Stacked bar chart, strategic assessment, meeting log form
    DuplicatesBanner.tsx    # Detects name duplicates, offers merge
    StaffFilter.tsx         # Dropdown for filtering by staff member
    Toast.tsx               # Notification system (context + provider)
  hooks/
    useContacts.ts          # Polls Excel Contacts table every 60s via Graph API
    useInteractions.ts      # Polls Excel Interactions table every 60s
  services/
    authConfig.ts           # MSAL config (client ID, tenant ID from env vars)
    graphClient.ts          # Microsoft Graph client init
    excelService.ts         # All Excel CRUD: addContact, updateContact, removeContact,
                            # markContactTouched, addInteraction, mergeAllDuplicates
```

### Data Flow

1. User signs in via MSAL redirect (Azure AD single-tenant)
2. `initGraphClient(instance)` creates an authenticated Graph client
3. `useContacts` and `useInteractions` poll the Excel workbook every 60s
4. All writes (add, edit, delete, touch, log meeting) go through `excelService.ts` which calls Graph API to modify Excel rows
5. After any write, `refresh()` re-fetches the full contact/interaction list

### Key Types (from `src/types/index.ts`)

- `ContactType`: `'client' | 'capital_provider' | 'partner' | 'educational' | 'unclassified'`
- `HeatLevel`: `'hot' | 'warm' | 'cold' | ''`
- `Frequency`: `'biannual' | 'quarterly' | 'monthly' | 'asneeded' | ''`
- `RelationshipTier`: `'tier_1_inner_circle' | 'tier_2_strategic' | 'tier_3_dormant'` (auto-computed from `lastTouched` days: <=45 = T1, <=200 = T2, else T3)
- `MeetingCategory`: `'client_side' | 'capital_side' | 'neither' | 'internal'`

### Staff Roster

Hardcoded in `src/types/index.ts` as `STAFF_ROSTER`. Three levels: executive_director, associate_director, staff. Used for the owner multi-select and staff filter dropdown. Must be updated manually when staff changes.

---

## The Network Map (StructuralHoleMap.tsx)

This is the most complex component. It renders a radial SVG network graph (inspired by Obsidian's graph view but structured for non-tech directors).

**Layout algorithm:**
- Sage3 Capital node at center (large green circle)
- Contacts arranged radially by type sector:
  - Clients at 180 degrees (left)
  - Capital Providers at 0 degrees (right)
  - Partners at 90 degrees (bottom)
  - Educational at 245 degrees (bottom-left)
  - Unclassified at 310 degrees (top-right)
- Distance from center determined by relationship tier (T1 closest, T3 furthest)
- Node size by tier (T1 = 7px, T2 = 5px, T3 = 3.5px)
- Max 16 contacts shown per type, sorted by company then tier then heat
- Seeded pseudo-random jitter for organic feel (stable across re-renders)

**Organization clustering:**
- Contacts sorted by company name within each type, so same-org contacts cluster together
- Company labels shown for orgs with 2+ visible contacts
- Hovering a contact highlights all contacts from the same organization (edges brighten, other nodes dim)

**Visual indicators:**
- Hot contacts: red glow ring
- Warm contacts: orange glow ring
- Tier 1 contacts: names always visible
- Other contacts: names appear on hover
- Hover tooltip: name, company, position, type, tier, heat, owner

**Key constants** (module-level, not component state):
- `W=600, H=520, CX=300, CY=260` (SVG viewBox)
- `TYPE_CFG` maps each ContactType to hex color, angle, and spread
- `TIER_DIST` maps each tier to [minDistance, maxDistance] from center
- `TIER_R` maps each tier to node radius

---

## Dashboard (Dashboard.tsx)

- **Quick stats**: 4 cards (total contacts, due for touch, touches this week, added this month)
- **Health gauges**: 4 SVG ring gauges (overall health, balance, tier depth, meeting focus)
  - Overall = weighted: 30% balance + 30% tier depth + 40% meeting focus
  - Balance = how evenly split clients vs capital providers are
  - Tier depth = percentage of Tier 2 (Strategic) contacts
  - Meeting focus = percentage of meetings that are client-side or capital-side
- **Donut chart**: SVG donut showing contact type distribution with legend
- **Balance meter**: horizontal bar showing client vs capital ratio
- **Tier bars**: horizontal bars for T1/T2/T3 distribution with Tier 2 spotlight chips

---

## Recent Session Changes (what was just done)

### Commit: `f68e4e2` - Remove all em-dashes
All em-dashes (17 instances across 5 files) replaced with colons, periods, commas, or middle dots.

### Commit: `bd45c33` - Org clustering + build fix
- Fixed TS6133: removed unused `decayingTier2` variable in FollowUpQueue.tsx
- Network map now sorts contacts by company so same-org contacts cluster together
- Hovering highlights all contacts from the same organization
- Company labels appear for orgs with 2+ visible contacts

### Commit: `106accd` - Sage3 brand overhaul
- Complete color system replacement (see "Visual Identity" section above)
- All cards changed from shadow-based to border-based styling
- Sidebar active state: sage-panel bg + forest green left border
- All buttons changed to solid sage-forest green
- Login gradient: forest to sage to accent greens
- Network Map: replaced old two-sided bridge visualization with radial SVG graph
- Trimmed verbose description paragraphs across Dashboard, Follow-ups, Meeting Audit

---

## Style Conventions

- **All styles in one file**: `src/styles.css`, no CSS modules or utility frameworks
- **CSS variables** for all colors, radii, shadows (defined in `:root`)
- **No em-dashes** in UI text
- **No emojis** in UI text
- Components use inline styles only for dynamic values (SVG positions, tooltip coordinates)
- Responsive breakpoints: 1024px (sidebar collapses), 900px (grid stacks), 768px (forms stack), 560px (compact mobile)

---

## Build and Deploy

```bash
npm install          # Install deps
npm run dev          # Dev server at localhost:5173
npm run build        # Production build (runs tsc -b && vite build)
npx tsc --noEmit     # Type-check without building
```

**Vercel**: auto-deploys from `master`. Needs env vars `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` set in Vercel project settings.

**TypeScript**: strict mode. Build will fail on unused variables (TS6133), type errors, etc. Always run `npx tsc --noEmit` before pushing.

---

## Known Patterns / Gotchas

1. **No npm packages allowed** for visualization. The network graph, donut chart, health gauges, and bar charts are all hand-built SVG in React. Do not add D3, Chart.js, vis.js, etc.
2. **Excel as database** means no relational queries, no indexing, no transactions. The app reads the entire table every 60 seconds.
3. **Owner field is comma-separated text** (e.g., "Ravi, Philip"). Filtering splits on commas. The AddEditContact form uses checkboxes that produce this format.
4. **Tier is computed, not stored.** `computeTier(contact)` derives the tier from `lastTouched` date. There is no tier column in Excel.
5. **Heat and frequency can be empty strings** (not set yet). The types allow `''` and the UI says "Not set (to be filled later)".
6. **The `id` field** in Excel is a string. New contacts get a UUID from the `uuid` package.
7. **Structural Hole concept**: Sage3 Capital sits between clients (who need capital/advisory) and capital providers (banks/investors who need deal flow). The firm creates value by bridging this gap. This concept drives the network map layout and meeting audit categorization.

---

## What the User Cares About

The user (Andre, Sage3 Capital staff) wants:
- Professional BI dashboard aesthetic, not a flashy startup look
- Sage3 brand greens as accent, not dominant
- Clean, minimal text (no verbose explanations)
- The network map to feel like Obsidian's graph view but be understandable by non-tech directors
- Organization-level clustering in the network map (many contacts share the same company)
- No em-dashes in the UI (except number ranges)
