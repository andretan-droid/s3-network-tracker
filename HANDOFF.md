# Network Tracker — Handoff Guide

## How to Download & Run Locally

### Option A: Clone from GitHub (recommended)

```bash
git clone -b claude/nice-edison-i928a https://github.com/andretan-droid/superpowers.git
cd superpowers/network-tracker
npm install
cp .env.example .env
# Edit .env with your Azure AD credentials (see below)
npm run dev
```

Open `http://localhost:5173` in your browser.

### Option B: Download as ZIP

1. Go to `https://github.com/andretan-droid/superpowers/tree/claude/nice-edison-i928a`
2. Click **Code** → **Download ZIP**
3. Extract and navigate to the `network-tracker/` folder
4. Run:
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

---

## Project Structure

```
network-tracker/
├── docs/
│   └── AZURE_SETUP_GUIDE.md      # Step-by-step Azure AD + Excel setup
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AddEditContact.tsx     # Add/edit contact form
│   │   ├── ContactCard.tsx        # Individual contact card
│   │   ├── ContactsList.tsx       # Filterable contacts list
│   │   ├── Dashboard.tsx          # Stats row (totals, due count)
│   │   ├── FollowUpQueue.tsx      # Prioritized follow-up list
│   │   ├── MeetingAudit.tsx       # Meeting category breakdown chart
│   │   ├── StaffFilter.tsx        # Firm-wide / per-staff dropdown
│   │   ├── StructuralHoleMap.tsx  # Structural hole visualization + metrics
│   │   └── Toast.tsx              # Toast notification provider
│   ├── hooks/
│   │   ├── useContacts.ts         # Contacts data fetching + polling
│   │   └── useInteractions.ts     # Interactions data fetching
│   ├── services/
│   │   ├── authConfig.ts          # MSAL / Azure AD configuration
│   │   ├── excelService.ts        # CRUD operations on Excel tables
│   │   └── graphClient.ts         # Microsoft Graph API client
│   ├── types/
│   │   └── index.ts               # TypeScript types, staff roster, constants
│   ├── App.tsx                    # Main app layout + tab routing
│   ├── main.tsx                   # Entry point (MSAL provider)
│   └── styles.css                 # All styles (single file, no Tailwind)
├── .env.example                   # Environment variable template
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Before You Can Use It: Azure AD + Excel Setup

The app requires two things to work:

### 1. An Azure AD App Registration (for authentication)

Follow `docs/AZURE_SETUP_GUIDE.md` — it walks through every click in the Azure Portal.

You need to copy two values into your `.env` file:
- `VITE_AZURE_CLIENT_ID` — from the app registration overview
- `VITE_AZURE_TENANT_ID` — from the app registration overview

### 2. A New Excel Workbook (for data storage)

Create a **brand new** `NetworkTracker.xlsx` file in OneDrive/SharePoint with two named Tables:

**Table: `Contacts`** (16 columns)
```
id | name | company | position | email | phoneMobile | phoneOffice | linkedin | type | heat | frequency | eventMet | notes | owners | dateAdded | lastTouched
```

**Table: `Interactions`** (7 columns)
```
id | contactId | date | type | notes | loggedBy | category
```

The setup guide has detailed instructions for creating these tables correctly.

---

## What Each Tab Does

| Tab | Purpose | Director's Goal |
|-----|---------|----------------|
| **Contacts** | Browse, search, filter all contacts. Stats row shows totals and overdue count. | "Convert disorganized card piles into a structured, searchable database" |
| **+ Add Contact** | Add or edit a contact with type (client/capital/partner), heat, frequency, owner(s) | "Establish discipline around recording every meeting and contact" |
| **Follow-up Queue** | Prioritized list of contacts due for a touch, sorted by heat (hot first) | "The most valuable contacts are people met approximately twice a year" |
| **Structural Hole Map** | Visual: clients on one side, capital on the other, firm in center. Shows imbalance warnings. | "The firm sits between providers of capital and users of capital" |
| **Meeting Audit** | Categorized bar chart of interactions (client-side / capital-side / neither). Shows % advancing the structural hole. | "Every meeting should be evaluated against whether it advances the firm across the structural hole" |

---

## Staff Hierarchy (dropdown filter)

| Level | Names |
|-------|-------|
| Executive Directors | Ravi, Philip, Davin, Dato' Zaha Rina |
| Associate Directors | Anandh, Andrew Ong |
| Staff | May Tong, Andre, Reedza, Syakirah, Jordan, Eason, Steffie, Yenkern |

The dropdown filters contacts by the `owners` field — selecting a staff member shows only contacts they own.

---

## Key Design Decisions

1. **Excel as database via Microsoft Graph API** — per your M365 constraint. Polling every 60 seconds (not webhooks, for simplicity).
2. **"Biannual" (2x/year) is the default frequency** — per the Director's network science insight that twice-a-year contacts are the most valuable.
3. **One-click "Mark touched"** — logs an interaction automatically in the Interactions table AND updates lastTouched on the contact. Minimal friction for the team.
4. **Owner field supports multiple names** — comma-separated, so shared contacts show up for both people.
5. **Brand new Excel file** — does NOT import from the existing Business Cards Catalogue. That data can be migrated separately once the team classifies contacts by type.

---

## Tech Stack

- **React 19** + TypeScript + Vite
- **@azure/msal-react** — Microsoft authentication
- **@microsoft/microsoft-graph-client** — Excel read/write via Graph API
- **uuid** — generating unique IDs for contacts/interactions
- No CSS framework — custom CSS matching the original prototype's aesthetic

---

## Next Steps After Setup

1. [ ] Register Azure AD app and configure `.env`
2. [ ] Create `NetworkTracker.xlsx` with Contacts + Interactions tables
3. [ ] Run `npm run dev` and sign in
4. [ ] Start adding contacts — classify each as client / capital_provider / partner
5. [ ] Migrate existing contacts from the Business Cards Catalogue (manual or scripted)
6. [ ] Deploy to Azure Static Web Apps or Vercel for team access
