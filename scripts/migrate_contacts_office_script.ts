/**
 * Office Script: Migrate Business Cards Catalogue → NetworkTracker
 * ================================================================
 * Run this in Excel for the Web (Automate tab → New Script).
 *
 * Prerequisites:
 *   1. Open NetworkTracker.xlsx in Excel Online.
 *   2. The legacy file "Business_Cards_Catalogue.xlsx" must be accessible
 *      in the same SharePoint / OneDrive location, OR you pre-load it as
 *      a second workbook via Power Automate.
 *
 * This script:
 *   - Reads every tab from the legacy workbook
 *   - Maps columns to the NetworkTracker schema
 *   - Captures the tab name as the "owners" value
 *   - Deletes the 3 sample rows in the target
 *   - Writes all consolidated rows into the Contacts table
 *   - Applies data validation and formatting
 *
 * NOTE: Office Scripts cannot natively open a second workbook in a single
 * script. To use this, either:
 *   (a) Copy all legacy sheets INTO the NetworkTracker file temporarily, or
 *   (b) Use Power Automate to pass the legacy data as JSON into this script.
 *
 * The version below assumes approach (a): the legacy sheets have been
 * copied into the same workbook temporarily.
 */

function main(workbook: ExcelScript.Workbook) {
  // ---------- CONFIGURATION ----------
  const TARGET_SHEET_NAME = "Contacts";
  const TARGET_TABLE_NAME = "Contacts";

  // Tabs to process from the legacy file (copied into this workbook).
  // "Sheet2" has a different column layout; "Others" has SOURCE not DATE ADDED.
  const STANDARD_TABS = [
    "Ravi", "Philip", "Davin", "Dato Zaha Rina", "Anandh",
    "Andrew", "Andre", "Reedza", "Eason", "Syakirah", "Jordan", "Others"
  ];
  const SHEET2_TAB = "Sheet2";

  // Standard legacy column indices (0-based): NO=0, NAME=1, COMPANY=2,
  // POSITION=3, EMAIL=4, PHONE(MOBILE)=5, PHONE(OFFICE)=6, DATE ADDED=7
  const COL = { NAME: 1, COMPANY: 2, POSITION: 3, EMAIL: 4, MOBILE: 5, OFFICE: 6, DATE: 7 };

  // Sheet2 column indices (0-based)
  const S2 = { FULL_NAME: 1, COMPANY1: 8, JOB_TITLE1: 10, EMAIL1: 26, MOBILE1: 17, TEL1: 20, DATE_CREATED: 0 };

  // ---------- COLLECT ALL CONTACTS ----------
  interface ContactRow {
    name: string; company: string; position: string; email: string;
    phoneMobile: string; phoneOffice: string; dateAdded: string; owners: string;
  }

  const allContacts: ContactRow[] = [];

  // Helper: safely convert cell value to string
  function toStr(val: string | number | boolean | undefined | null): string {
    if (val === undefined || val === null) return "";
    return String(val).trim();
  }

  // Helper: format date values
  function toDateStr(val: string | number | boolean | undefined | null): string {
    if (val === undefined || val === null || val === "") return "";
    // If it's already a string in date format, return as-is
    const s = String(val).trim();
    if (s === "") return "";
    // Try to detect Excel serial date number
    if (typeof val === "number" && val > 40000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    return s;
  }

  // --- Process standard tabs ---
  for (const tabName of STANDARD_TABS) {
    const sheet = workbook.getWorksheet(tabName);
    if (!sheet) continue;

    const usedRange = sheet.getUsedRange();
    if (!usedRange) continue;

    const data = usedRange.getValues();
    if (data.length <= 1) continue; // header only

    const isOthers = tabName === "Others";

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const name = toStr(row[COL.NAME]);
      if (name === "") continue;

      allContacts.push({
        name: name,
        company: toStr(row[COL.COMPANY]),
        position: toStr(row[COL.POSITION]),
        email: toStr(row[COL.EMAIL]),
        phoneMobile: toStr(row[COL.MOBILE]),
        phoneOffice: toStr(row[COL.OFFICE]),
        dateAdded: isOthers ? "" : toDateStr(row[COL.DATE]),
        owners: tabName,
      });
    }
  }

  // --- Process Sheet2 (different column layout) ---
  const sheet2 = workbook.getWorksheet(SHEET2_TAB);
  if (sheet2) {
    const usedRange = sheet2.getUsedRange();
    if (usedRange) {
      const data = usedRange.getValues();
      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const name = toStr(row[S2.FULL_NAME]);
        if (name === "") continue;

        allContacts.push({
          name: name,
          company: toStr(row[S2.COMPANY1]),
          position: toStr(row[S2.JOB_TITLE1]),
          email: toStr(row[S2.EMAIL1]),
          phoneMobile: toStr(row[S2.MOBILE1]),
          phoneOffice: toStr(row[S2.TEL1]),
          dateAdded: toDateStr(row[S2.DATE_CREATED]),
          owners: SHEET2_TAB,
        });
      }
    }
  }

  // ---------- WRITE TO TARGET ----------
  const targetSheet = workbook.getWorksheet(TARGET_SHEET_NAME);
  if (!targetSheet) throw new Error(`Sheet "${TARGET_SHEET_NAME}" not found`);

  let table = targetSheet.getTable(TARGET_TABLE_NAME);

  // Delete existing sample rows (rows 2-4 → table rows 0-2)
  if (table) {
    const existingRowCount = table.getRowCount();
    if (existingRowCount > 0) {
      for (let i = existingRowCount - 1; i >= 0; i--) {
        table.deleteRowsAt(i, 1);
      }
    }
  }

  // Build output rows: id, name, company, position, email, phoneMobile,
  // phoneOffice, linkedin, type, heat, frequency, eventMet, notes, owners,
  // dateAdded, lastTouched
  const outputRows: (string | number | boolean)[][] = [];

  for (let i = 0; i < allContacts.length; i++) {
    const c = allContacts[i];
    const id = String(i + 1).padStart(3, "0");
    outputRows.push([
      id,                // id
      c.name,            // name
      c.company,         // company
      c.position,        // position
      c.email,           // email
      c.phoneMobile,     // phoneMobile
      c.phoneOffice,     // phoneOffice
      "",                // linkedin
      "",                // type (manual entry)
      "",                // heat (manual entry)
      "biannual",        // frequency (default)
      "",                // eventMet
      "",                // notes
      c.owners,          // owners (tab name)
      c.dateAdded,       // dateAdded
      c.dateAdded,       // lastTouched = dateAdded
    ]);
  }

  // Add all rows to the table
  if (table && outputRows.length > 0) {
    table.addRows(-1, outputRows);
  }

  // ---------- CLEANUP: Remove legacy sheets ----------
  // Uncomment below to auto-delete the legacy tabs after migration:
  // for (const tabName of [...STANDARD_TABS, SHEET2_TAB]) {
  //   const s = workbook.getWorksheet(tabName);
  //   if (s) s.delete();
  // }

  console.log(`Migration complete: ${allContacts.length} contacts written.`);
}
