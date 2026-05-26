# Azure AD & Excel Setup Guide

This guide walks you through connecting the Network Tracker to your Microsoft 365 environment. No prior Azure experience required.

---

## Part 1: Register the App in Azure AD

### Step 1: Open Azure Portal

1. Go to [portal.azure.com](https://portal.azure.com)
2. Sign in with your Microsoft 365 admin account
3. In the search bar at the top, type **"App registrations"** and click on it

### Step 2: Create a New Registration

1. Click **"+ New registration"**
2. Fill in:
   - **Name**: `Network Tracker - Sage3 Capital`
   - **Supported account types**: Select **"Accounts in this organizational directory only"** (single tenant)
   - **Redirect URI**: Select **"Single-page application (SPA)"** from the dropdown, then enter `http://localhost:5173`
3. Click **"Register"**

### Step 3: Copy Your IDs

After registration, you'll see an overview page. Copy these two values:

| Field | Where to find it | What to copy to |
|-------|-----------------|-----------------|
| **Application (client) ID** | Overview page, top section | `VITE_AZURE_CLIENT_ID` in your `.env` file |
| **Directory (tenant) ID** | Overview page, top section | `VITE_AZURE_TENANT_ID` in your `.env` file |

### Step 4: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and check these permissions:
   - `User.Read` (should already be there)
   - `Files.ReadWrite.All`
   - `Sites.ReadWrite.All`
6. Click **"Add permissions"**
7. Click **"Grant admin consent for [your org]"** (the green checkmark button)
8. Confirm when prompted

### Step 5: Add Production Redirect URI (later)

When you deploy to production:

1. Go to **"Authentication"** in the left sidebar
2. Under **"Single-page application"** → **"Redirect URIs"**
3. Click **"Add URI"**
4. Add your production URL (e.g., `https://network-tracker.yourdomain.com`)
5. Click **"Save"**

---

## Part 2: Create the Excel Workbook

### Step 1: Create a New Excel File

1. Go to [onedrive.com](https://onedrive.com) or your SharePoint site
2. Click **"+ New"** → **"Excel workbook"**
3. Name it exactly: **`NetworkTracker.xlsx`**

### Step 2: Create the "Contacts" Table

1. In **Sheet1**, rename the sheet tab to **`Contacts`** (right-click the tab → Rename)
2. In row 1, enter these exact headers (one per column, A through P):

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | name | company | position | email | phoneMobile | phoneOffice | linkedin | type | heat | frequency | eventMet | notes | owners | dateAdded | lastTouched |

3. Select the header row (A1:P1)
4. Go to **Insert** → **Table**
5. Make sure **"My table has headers"** is checked
6. Click **OK**
7. A table will be created. Click on the table, then go to **Table Design** tab
8. In the **"Table Name"** field (top-left), rename it to exactly: **`Contacts`**

### Step 3: Create the "Interactions" Table

1. Click the **"+"** button next to the sheet tabs to add a new sheet
2. Rename it to **`Interactions`**
3. In row 1, enter these headers (A through G):

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| id | contactId | date | type | notes | loggedBy | category |

4. Select A1:G1 → **Insert** → **Table** → Check "My table has headers" → **OK**
5. Rename the table to exactly: **`Interactions`**

### Step 4: Share the File (for team access)

1. Click the **"Share"** button in the top-right corner of Excel Online
2. Enter the email addresses of your team members
3. Set permission to **"Can edit"**
4. Click **"Send"**

### Step 5: Get the File Path (if using SharePoint)

If the file is in a SharePoint document library (recommended for teams):

1. Open the file in your browser
2. The URL will look like: `https://yourtenant.sharepoint.com/sites/SiteName/Shared Documents/NetworkTracker.xlsx`
3. You'll need the **drive ID** and **item ID**. To find these:
   - Open a browser and go to: `https://graph.microsoft.com/v1.0/me/drive/root:/NetworkTracker.xlsx`
   - Sign in if prompted
   - Look for `"id"` in the response — that's your item ID
   - Look for `"parentReference"` → `"driveId"` — that's your drive ID
4. Update your `.env` file:
   ```
   VITE_EXCEL_WORKBOOK_PATH=/drives/{driveId}/items/{itemId}
   ```

For personal OneDrive, keep the default:
```
VITE_EXCEL_WORKBOOK_PATH=/me/drive/root:/NetworkTracker.xlsx:
```

---

## Part 3: Configure the App

### Step 1: Create your `.env` file

```bash
cp .env.example .env
```

### Step 2: Fill in your values

Open `.env` and replace the placeholder values:

```env
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_REDIRECT_URI=http://localhost:5173
VITE_EXCEL_WORKBOOK_PATH=/me/drive/root:/NetworkTracker.xlsx:
```

### Step 3: Run the app

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser and click "Sign in with Microsoft".

---

## Part 4: Valid Values Reference

### Contact Type (`type` column)
| Value | Meaning |
|-------|---------|
| `client` | Client — entrepreneurial business needing capital/advisory |
| `capital_provider` | Capital provider — bank, fund, institutional investor |
| `partner` | Partner / referrer |
| `unclassified` | Not yet classified |

### Heat Level (`heat` column)
| Value | Meaning |
|-------|---------|
| `hot` | Active interest — reach out now |
| `warm` | Potential interest — nurture |
| `cold` | Just collecting — no urgency |

### Touch Frequency (`frequency` column)
| Value | Meaning | Days threshold |
|-------|---------|---------------|
| `biannual` | 2x per year (most valuable per network science) | 180 days |
| `quarterly` | Every 3 months | 90 days |
| `monthly` | Every month | 30 days |
| `asneeded` | No fixed schedule | N/A |

### Interaction Category (`category` column in Interactions)
| Value | Meaning |
|-------|---------|
| `client_side` | Meeting/call advancing client relationships |
| `capital_side` | Meeting/call advancing capital-provider relationships |
| `neither` | Not directly related to structural hole |
| `internal` | Internal firm meeting |

---

## Troubleshooting

### "AADSTS50011: The redirect URI does not match"
Your `.env` redirect URI doesn't match what's registered in Azure AD. Go to Azure Portal → App registrations → your app → Authentication, and make sure the redirect URI matches exactly (including `http` vs `https` and trailing slashes).

### "Insufficient privileges" or 403 errors
Admin consent hasn't been granted. Go to API permissions and click "Grant admin consent".

### "The workbook was not found"
Check that `VITE_EXCEL_WORKBOOK_PATH` points to the correct location and the file name matches exactly.

### "Table not found: Contacts"
The Excel tables haven't been created properly. Make sure you created them as **Tables** (Insert → Table), not just headers in cells, and that the table names are exactly `Contacts` and `Interactions`.
