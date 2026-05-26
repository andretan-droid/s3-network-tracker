# Network Tracker — Complete Setup Guide for Beginners

**What is this?**
A private web app for Sage3 Capital that stores all your business contacts in a Microsoft Excel file on SharePoint and helps you track follow-ups, categorise meetings, and visualise your firm's network. You log in with your Sage3 Microsoft account. No external database. No monthly fees.

**Who is this guide for?**
Someone who has never built a website before. Every single step is written out. You do not need to understand how any of it works — just follow the steps exactly.

**How long does this take?**
About 90 minutes the first time. Most of that is waiting for things to load.

---

## What You Will End Up With

- A live website at a URL like `https://sage3-network-tracker.vercel.app`
- Everyone at Sage3 can open that URL, log in with their Microsoft account, and use the app
- All data is stored in one Excel file on your SharePoint — no separate database needed

---

## Before You Start — What You Need

Check these off before continuing:

- [ ] A computer running Windows (this guide is written for Windows)
- [ ] A Sage3 Capital Microsoft account (the one you use for Outlook and Teams)
- [ ] Admin access to your Azure portal — ask your IT admin or Ravi if you are not sure

---

## The Big Picture — 7 Steps

1. Install the tools on your computer
2. Download the code
3. Register the app in Microsoft Azure (so staff can log in)
4. Upload the Excel data file to SharePoint
5. Connect the code to Azure
6. Publish the website to the internet (Vercel)
7. Tell Azure about the published website address

Each step is explained in full below.

---

## Step 1 — Install the Tools on Your Computer

You need three free programs. Install them in this order.

### 1A — Install Node.js

Node.js is the engine that runs the app on your computer before you publish it.

1. Open your web browser and go to: `https://nodejs.org`
2. Click the big green button that says **"LTS"** (it will say something like "22.x.x LTS — Recommended For Most Users")
3. A file will download. Open it and click **Next** through all the steps. Keep all the default settings.
4. When it finishes, click **Finish**.

**How to check it worked:**
1. Press the **Windows key** on your keyboard
2. Type `cmd` and press **Enter** — a black window opens (this is called the Command Prompt)
3. Type exactly this and press Enter:
   ```
   node --version
   ```
4. You should see something like `v22.0.0`. If you see a version number, Node.js is installed correctly.

---

### 1B — Install Git

Git is a tool that lets you download the code from GitHub (where the code is stored).

1. Go to: `https://git-scm.com/download/win`
2. The download should start automatically. If not, click the first link under "Standalone Installer".
3. Open the downloaded file and click **Next** through all the steps. Keep all the default settings.
4. When it finishes, click **Finish**.

**How to check it worked:**
1. Open Command Prompt again (Windows key → type `cmd` → Enter)
2. Type this and press Enter:
   ```
   git --version
   ```
3. You should see something like `git version 2.x.x`.

---

### 1C — Install Visual Studio Code (recommended)

VS Code is a text editor that makes it easier to edit configuration files.

1. Go to: `https://code.visualstudio.com`
2. Click the big blue **Download for Windows** button
3. Open the downloaded file and install with all default settings

---

## Step 2 — Download the Code

1. Open **Command Prompt** (Windows key → type `cmd` → Enter)

2. Decide where you want to save the project. To save it on your Desktop, type this and press Enter:
   ```
   cd Desktop
   ```

3. Download the code from GitHub by typing this exactly and pressing Enter:
   ```
   git clone https://github.com/andretan-droid/sage3-network-tracker.git
   ```
   You will see text scrolling as files download. Wait for it to finish.

4. Go into the project folder:
   ```
   cd sage3-network-tracker
   ```

5. Install all the code dependencies (this downloads extra pieces the app needs):
   ```
   npm install
   ```
   This may take 1–2 minutes. You will see lots of text. This is normal.

**How to check it worked:**
When `npm install` finishes, you should see a line like `added 123 packages`. No red error messages means success.

---

## Step 3 — Register the App in Microsoft Azure

This step tells Microsoft "there is a new app, and Sage3 staff are allowed to log in to it." Without this, the login button will not work.

**You need:** Admin access to the Azure Portal. If you do not have it, ask your IT admin to complete this section and give you two values: a **Client ID** and a **Tenant ID**.

### 3A — Sign in to Azure Portal

1. Open your browser and go to: `https://portal.azure.com`
2. Sign in with your Sage3 Microsoft admin account

### 3B — Create a New App Registration

1. In the search bar at the top of the page, type `App registrations` and click the matching result
2. Click the **+ New registration** button (top left area)
3. Fill in the form:
   - **Name:** `Network Tracker`
   - **Supported account types:** Select **"Accounts in this organizational directory only (Sage3 only - Single tenant)"**
   - **Redirect URI:** Leave blank for now — you will fill this in at Step 8
4. Click the **Register** button

### 3C — Copy Your Client ID and Tenant ID

After registering, you land on the app's overview page. You need two values from here.

1. Find **Application (client) ID** — it looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Click the copy icon next to it and paste it into Notepad
   - Label it **CLIENT ID**

2. Find **Directory (tenant) ID** — it also looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Copy it and paste it into Notepad
   - Label it **TENANT ID**

### 3D — Add API Permissions

1. In the left sidebar, click **API permissions**
2. Click **+ Add a permission**
3. Click **Microsoft Graph**
4. Click **Delegated permissions**
5. In the search box, type `Files.ReadWrite` and tick the checkbox next to **Files.ReadWrite**
6. Clear the search box, type `User.Read` and tick the checkbox next to **User.Read**
7. Click **Add permissions** at the bottom
8. Click the button that says **Grant admin consent for Sage3** (it has a green tick icon)
9. Click **Yes** when the confirmation dialog appears

### 3E — Enable the Right Token Type

1. In the left sidebar, click **Authentication**
2. Scroll down to **Advanced settings**
3. Under **Allow public client flows**, toggle the switch to **Yes**
4. Click **Save** at the top

---

## Step 4 — Upload the Excel Data File to SharePoint

The app stores all its data in one Excel file called `NetworkTracker.xlsx`. This file has already been created for you with the correct structure. You just need to put it in SharePoint.

### 4A — Find the File

The file is already on your computer at this location:
```
Desktop\sage3-network-tracker\NetworkTracker.xlsx
```

### 4B — Upload to SharePoint

1. Open your browser and go to: `https://sage3my.sharepoint.com`
2. Navigate to the site where you want to store the data (for example, the **Networks** site)
3. Go into the **Documents** library (or any folder you prefer)
4. Create a new folder called `NetworkTracker`
5. Open that folder and upload `NetworkTracker.xlsx` into it

### 4C — Confirm the File Looks Correct

1. Click on `NetworkTracker.xlsx` to open it in Excel Online
2. You should see two sheets at the bottom of the screen: **Contacts** and **Interactions**
3. The **Contacts** sheet should have a dark blue header row with these column names:
   ```
   id | name | company | position | email | phoneMobile | phoneOffice | linkedin | type | heat | frequency | eventMet | notes | owners | dateAdded | lastTouched
   ```
4. The **Interactions** sheet should have a dark blue header row with:
   ```
   id | contactId | date | type | notes | loggedBy | category
   ```
5. When you click on any cell in the table, the Excel ribbon at the top should show a **"Table Design"** tab — this confirms it is a proper Excel table, not just coloured cells. This is important.

---

## Step 5 — Connect the Code to Azure

The code needs to know your Client ID and Tenant ID. You store these in a special file called `.env` (pronounced "dot env").

### 5A — Create the .env File

1. Open **File Explorer** and go to your project folder:
   ```
   Desktop\sage3-network-tracker\
   ```
2. Find the file called `.env.example`
3. Right-click it → **Copy**, then right-click in the same folder → **Paste**
4. Rename the copy to exactly `.env` (delete `.example` from the name)
   - If Windows asks "Are you sure you want to change the extension?", click **Yes**
   - The file must be named `.env` — nothing else

### 5B — Fill In Your Values

1. Right-click the `.env` file → **Open with** → **Notepad**
2. You will see:
   ```
   VITE_AZURE_CLIENT_ID=your-client-id-here
   VITE_AZURE_TENANT_ID=your-tenant-id-here
   ```
3. Replace `your-client-id-here` with your **CLIENT ID** from Step 3C
4. Replace `your-tenant-id-here` with your **TENANT ID** from Step 3C
5. Save the file (press Ctrl + S)

**What it should look like after editing (your values will be different):**
```
VITE_AZURE_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
VITE_AZURE_TENANT_ID=f9e8d7c6-b5a4-3210-fedc-ba9876543210
```

**Rules — get these wrong and nothing will work:**
- No spaces around the `=` sign
- No quotation marks around the values
- No extra lines or other text

---

## Step 6 — Test the App on Your Computer (Optional)

Before publishing online, test that the app runs on your machine.

1. Open **Command Prompt**
2. Navigate to the project folder:
   ```
   cd Desktop\sage3-network-tracker
   ```
3. Start the app:
   ```
   npm run dev
   ```
4. You will see:
   ```
   VITE v6.x.x  ready in 500 ms
   ➜  Local:   http://localhost:5173/
   ```
5. Open your browser and go to: `http://localhost:5173`
6. The app should load and show a login screen

**To stop the app:** Go back to Command Prompt and press **Ctrl + C**

**Note:** The login button may not fully work yet because you have not added the local address to Azure. You will fix that in Step 8. Just confirm the page loads without errors for now.

---

## Step 7 — Publish the Website Online (Vercel)

Vercel hosts your website so anyone can open it. Your code is already on GitHub, so Vercel just needs to connect to it.

### 7A — Create a Vercel Account

1. Go to: `https://vercel.com`
2. Click **Sign Up**
3. Choose **Continue with GitHub**
4. Authorise Vercel to access your GitHub account

### 7B — Import Your Project

1. After signing in, you will see a dashboard. Click **Add New Project**
2. You will see a list of your GitHub repositories. Find **`sage3-network-tracker`** and click **Import**
3. Vercel automatically detects this is a Vite project. The settings should show:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

   Do not change any of these. They are already correct.

### 7C — Add Environment Variables in Vercel

Before clicking Deploy, scroll down to find **Environment Variables**. Add each one:

Click **Add** and fill in:
| Name (exactly as shown) | Value |
|---|---|
| `VITE_AZURE_CLIENT_ID` | Paste your CLIENT ID |
| `VITE_AZURE_TENANT_ID` | Paste your TENANT ID |

After adding both, you should see two rows listed.

### 7D — Click Deploy

Click the **Deploy** button.

Vercel will build and publish your website. This takes about 1–2 minutes. When you see **"Congratulations! Your project has been deployed"**, it is live.

**Copy your website URL** — it will look like:
```
https://sage3-network-tracker.vercel.app
```
Save this. You need it in the next step.

---

## Step 8 — Tell Azure Your Website Address

Azure needs to know your published URL to allow logins from it. This is the last configuration step.

1. Go back to `https://portal.azure.com`
2. Click **App registrations** and open the **Network Tracker** app
3. In the left sidebar, click **Authentication**
4. Under **Platform configurations**, click **+ Add a platform**
5. Click **Single-page application**
6. In the **Redirect URIs** box, enter your Vercel URL:
   ```
   https://sage3-network-tracker.vercel.app
   ```
   (Replace this with your actual Vercel URL if it is different)
7. Click **Configure**

Now add the local address too (for testing on your computer):
8. Under the same **Redirect URIs** section, click **Add URI**
9. Type: `http://localhost:5173`
10. Click **Save** at the top of the page

---

## Step 9 — Confirm Everything Works

1. Open a new browser tab
2. Go to your Vercel URL (e.g., `https://sage3-network-tracker.vercel.app`)
3. Click **Sign in with Microsoft**
4. Log in with your Sage3 Microsoft account
5. The app should open and show the Contacts tab

If you reach the Contacts tab after signing in, the setup is complete.

---

## Step 10 — Migrate Contacts from the Business Cards Catalogue

Your existing contacts are in `Business Cards Catalogue.xlsx` on SharePoint. The old file has these columns:

```
NO | NAME | COMPANY | POSITION | EMAIL | PHONE (MOBILE) | PHONE (OFFICE) | DATE ADDED
```

The new file needs more columns. Here is how every column maps:

| Old column | New column | What to do |
|---|---|---|
| NAME | `name` | Copy directly |
| COMPANY | `company` | Copy directly |
| POSITION | `position` | Copy directly |
| EMAIL | `email` | Copy directly |
| PHONE (MOBILE) | `phoneMobile` | Copy directly |
| PHONE (OFFICE) | `phoneOffice` | Copy directly |
| DATE ADDED | `dateAdded` | Copy directly |
| *(new)* | `id` | Use a unique number per row — e.g. `001`, `002`, `003` |
| *(new)* | `lastTouched` | Set equal to `dateAdded` to start |
| *(new)* | `type` | Choose one: `client`, `capital_provider`, or `partner` |
| *(new)* | `heat` | Choose one: `hot`, `warm`, or `cold` |
| *(new)* | `frequency` | Choose one: `weekly`, `monthly`, `quarterly`, `biannual`, `annual` |
| *(new)* | `owners` | Name of the Sage3 staff member who owns this contact |
| *(new)* | `linkedin` | LinkedIn URL (leave blank if unknown) |
| *(new)* | `eventMet` | Where you first met them (leave blank if unknown) |
| *(new)* | `notes` | Any free-text notes (leave blank if none) |

### Migration Steps

1. Open `Business Cards Catalogue.xlsx` (the old file) in Excel
2. Open `NetworkTracker.xlsx` (the new file) in a second Excel window
3. In the old file, each person's contacts are on a separate tab (Ravi's contacts on Ravi's tab, etc.)
4. For each tab:
   - Select all contact rows (not the header row, just the data rows)
   - Copy them (Ctrl + C)
   - Switch to `NetworkTracker.xlsx`, click on the first empty row below the sample rows in the **Contacts** sheet
   - Paste (Ctrl + V)
5. Fill in the new columns (`id`, `type`, `heat`, `frequency`, `owners`) for every row you pasted
6. Delete the 3 sample/demo rows that were pre-filled in the file when it was created (rows 2, 3, 4)
7. Save `NetworkTracker.xlsx`

The app re-reads the Excel file every 60 seconds, so new contacts will appear in the app automatically after saving.

---

## Troubleshooting — Common Problems and Fixes

### The page is blank or does not load
- Make sure you are going to `http://localhost:5173` (not a different address)
- Make sure `npm run dev` is still running in Command Prompt
- If you closed Command Prompt, open it again, navigate to the project folder, and run `npm run dev`

### Login fails with an error about "redirect URI"
- Go to Azure Portal → App registrations → Network Tracker → Authentication
- Make sure your exact URL is in the Redirect URIs list (check for typos and missing `https://`)
- Common mistake: a trailing slash at the end (e.g., `https://myapp.vercel.app/` — remove the `/`)

### Login works but no contacts appear
- The app connected to Azure but is not finding the Excel file
- Open `NetworkTracker.xlsx` in Excel Online and confirm:
  - The sheet is named `Contacts` (not `Sheet1` or anything else)
  - There is data in the table
  - When you click a cell, the ribbon shows a **Table Design** tab (it must be a formal Excel table)

### Login fails with an "MSAL" error
- This usually means the Client ID or Tenant ID in your `.env` file is wrong
- Open `.env` and check the values exactly match what Azure Portal shows (no extra spaces, no quotation marks)

### npm install gives errors
- Make sure Node.js installed correctly (`node --version` should return a version number)
- Close Command Prompt completely, reopen it, navigate to the project folder, and try `npm install` again

### Vercel build failed
- In your Vercel dashboard, click on the failed deployment to read the error log
- The most common cause: environment variables are missing
- Go to your Vercel project → **Settings** → **Environment Variables** and confirm both `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` are listed

---

## Staff Accounts — Who Can Log In

Everyone at Sage3 with a Microsoft account on the `sage3.com` tenant can log in automatically. No separate user management is needed.

| Level | Names |
|-------|-------|
| Executive Directors | Ravi, Philip, Davin, Dato' Zaha Rina |
| Associate Directors | Anandh, Andrew Ong |
| Staff | May Tong, Andre, Reedza, Syakirah, Jordan, Eason, Steffie, Yenkern |

The staff filter dropdown in the app is based on this list. If someone new joins Sage3, the list in the code must be updated (in `src/types/index.ts`).

---

## What Each Tab Does

| Tab | What it shows |
|-----|---------------|
| **Contacts** | The full list of all contacts. Search, filter by owner, see who is overdue for a follow-up. |
| **+ Add Contact** | Form to add a new contact or edit an existing one. |
| **Follow-up Queue** | Contacts sorted by priority — those you have not touched recently appear at the top. |
| **Structural Hole Map** | Visual diagram: clients on one side, capital providers on the other, firm in the middle. Shows network balance. |
| **Meeting Audit** | Chart breaking down all meetings by category (client-side, capital-side, or neither). |

---

## Updating the App After Code Changes

If someone makes changes to the code and pushes them to GitHub, Vercel will automatically detect the new code and re-deploy within 1–2 minutes. You do not need to do anything.

If you want to pull new code to your own computer:
1. Open Command Prompt and navigate to the project folder
2. Run: `git pull`

---

## Complete Setup Checklist

Use this to make sure nothing is missed:

- [ ] Node.js installed — `node --version` shows a version number
- [ ] Git installed — `git --version` shows a version number
- [ ] Code downloaded with `git clone`
- [ ] `npm install` completed with no errors
- [ ] Azure App Registration created
- [ ] Client ID and Tenant ID copied from Azure and saved somewhere
- [ ] API permissions added: `Files.ReadWrite` and `User.Read`
- [ ] Admin consent granted in Azure
- [ ] `.env` file created with correct Client ID and Tenant ID
- [ ] `NetworkTracker.xlsx` uploaded to SharePoint
- [ ] Both tables (`Contacts` and `Interactions`) confirmed in the Excel file
- [ ] Vercel account created and connected to GitHub
- [ ] `sage3-network-tracker` repo imported in Vercel
- [ ] Both environment variables added in Vercel
- [ ] Website deployed — Vercel URL noted
- [ ] Vercel URL added as Redirect URI in Azure
- [ ] `http://localhost:5173` added as Redirect URI in Azure
- [ ] Signed in to live website successfully
- [ ] Contacts migrated from Business Cards Catalogue

---

## Project File Structure (for reference)

```
sage3-network-tracker/
├── docs/
│   └── AZURE_SETUP_GUIDE.md      — Detailed Azure Portal walkthrough
├── src/
│   ├── components/
│   │   ├── AddEditContact.tsx     — Add/edit contact form
│   │   ├── ContactCard.tsx        — Individual contact card
│   │   ├── ContactsList.tsx       — Filterable contacts list
│   │   ├── Dashboard.tsx          — Stats row (totals, overdue count)
│   │   ├── FollowUpQueue.tsx      — Prioritised follow-up list
│   │   ├── MeetingAudit.tsx       — Meeting category chart
│   │   ├── StaffFilter.tsx        — Staff dropdown filter
│   │   ├── StructuralHoleMap.tsx  — Network visualisation
│   │   └── Toast.tsx              — Notification system
│   ├── hooks/
│   │   ├── useContacts.ts         — Contact data fetching (polls every 60s)
│   │   └── useInteractions.ts     — Interactions data fetching
│   ├── services/
│   │   ├── authConfig.ts          — Azure AD / MSAL configuration
│   │   ├── excelService.ts        — Excel read/write via Graph API
│   │   └── graphClient.ts         — Microsoft Graph API client setup
│   ├── types/
│   │   └── index.ts               — TypeScript types, staff list, constants
│   ├── App.tsx                    — Main layout and tab navigation
│   ├── main.tsx                   — App entry point
│   └── styles.css                 — All styles
├── NetworkTracker.xlsx            — Upload this to SharePoint (do not edit locally)
├── .env.example                   — Copy this to .env and fill in your values
├── vercel.json                    — Vercel routing config (do not edit)
├── package.json                   — Project dependencies
└── vite.config.ts                 — Build configuration
```

---

## Key Design Decisions (for context)

1. **Excel as the database** — data lives in `NetworkTracker.xlsx` on SharePoint, read and written via the Microsoft Graph API. No external database required.
2. **Biannual (2x/year) is the default contact frequency** — based on network science research that contacts made approximately twice a year are the most valuable for maintaining weak ties.
3. **One-click "Mark touched"** — logs an interaction in the Interactions table and updates the `lastTouched` field on the contact in one click.
4. **Multiple owners** — the `owners` field is comma-separated, so a contact can appear in both Ravi's and Philip's filtered view.
5. **60-second polling** — the app re-reads the Excel file every 60 seconds. Changes made directly in Excel will appear in the app within one minute.

---

*Built for Sage3 Capital. Tech stack: React 19 + TypeScript + Vite + Microsoft Graph API + Azure AD authentication.*
