# Power Query M-Code: Migrate Business Cards Catalogue → NetworkTracker

## Overview

This Power Query approach dynamically reads **every sheet** from the legacy
workbook, appends them into a single table, and maps columns to the
NetworkTracker schema. The sheet name is captured automatically as the
`owners` column.

---

## Step-by-Step Instructions

### 1. Open NetworkTracker.xlsx in Excel Desktop

### 2. Data → Get Data → From File → From Workbook
   - Browse to `Business_Cards_Catalogue.xlsx`
   - In the Navigator, **do NOT select a specific sheet** — select the
     workbook-level node (the file name itself) to see all sheets.
   - Click **Transform Data** to open Power Query Editor.

### 3. Replace the auto-generated M-code with the code below

   In the Power Query Editor → Home → Advanced Editor, paste:

```m
let
    // ─── STEP 1: Connect to the legacy workbook ───
    Source = Excel.Workbook(
        File.Contents("C:\path\to\Business_Cards_Catalogue.xlsx"),
        null, true
    ),

    // ─── STEP 2: Filter to only actual sheets (not named ranges) ───
    SheetsOnly = Table.SelectRows(Source, each [Kind] = "Sheet"),

    // ─── STEP 3: Exclude Sheet2 (different column layout) ───
    // Sheet2 is handled separately below if needed.
    StandardSheets = Table.SelectRows(SheetsOnly, each [Name] <> "Sheet2"),

    // ─── STEP 4: Expand each sheet's data and tag with sheet name ───
    AddSheetData = Table.AddColumn(StandardSheets, "SheetData", each
        let
            raw = [Data],
            promoted = Table.PromoteHeaders(raw, [PromoteAllScalars=true]),
            // Only keep rows where NAME is not null/blank
            filtered = Table.SelectRows(promoted, each
                [NAME] <> null and [NAME] <> ""
            ),
            // Add the tab name as the owners column
            withOwner = Table.AddColumn(filtered, "owners", each [Name], type text)
        in
            withOwner
        , type table
    ),

    // ─── STEP 5: Remove unnecessary columns and expand ───
    ExpandedSheets = Table.ExpandTableColumn(
        AddSheetData, "SheetData",
        {"NAME", "COMPANY", "POSITION", "EMAIL",
         "PHONE (MOBILE)", "PHONE (OFFICE)", "DATE ADDED", "owners"}
    ),

    // ─── STEP 6: Select and rename columns to target schema ───
    Renamed = Table.RenameColumns(ExpandedSheets, {
        {"NAME", "name"},
        {"COMPANY", "company"},
        {"POSITION", "position"},
        {"EMAIL", "email"},
        {"PHONE (MOBILE)", "phoneMobile"},
        {"PHONE (OFFICE)", "phoneOffice"},
        {"DATE ADDED", "dateAdded"}
    }),

    // Keep only the mapped columns
    Selected = Table.SelectColumns(Renamed,
        {"name", "company", "position", "email",
         "phoneMobile", "phoneOffice", "dateAdded", "owners"}
    ),

    // ─── STEP 7: Add derived columns ───
    WithIndex = Table.AddIndexColumn(Selected, "id", 1, 1, Int64.Type),

    // Format id as zero-padded 3-digit string
    WithIdFormatted = Table.TransformColumns(WithIndex,
        {{"id", each Text.PadStart(Text.From(_), 3, "0"), type text}}
    ),

    // lastTouched = dateAdded
    WithLastTouched = Table.AddColumn(WithIdFormatted, "lastTouched",
        each [dateAdded], type text
    ),

    // Blank columns for manual entry
    WithLinkedin = Table.AddColumn(WithLastTouched, "linkedin", each null, type text),
    WithType = Table.AddColumn(WithLinkedin, "type", each null, type text),
    WithHeat = Table.AddColumn(WithType, "heat", each null, type text),
    WithEventMet = Table.AddColumn(WithHeat, "eventMet", each null, type text),
    WithNotes = Table.AddColumn(WithEventMet, "notes", each null, type text),

    // Default frequency to "biannual"
    WithFrequency = Table.AddColumn(WithNotes, "frequency",
        each "biannual", type text
    ),

    // ─── STEP 8: Reorder columns to match target schema ───
    FinalTable = Table.ReorderColumns(WithFrequency,
        {"id", "name", "company", "position", "email", "phoneMobile",
         "phoneOffice", "linkedin", "type", "heat", "frequency",
         "eventMet", "notes", "owners", "dateAdded", "lastTouched"}
    )
in
    FinalTable
```

### 4. Handle Sheet2 separately (if needed)

Sheet2 uses a completely different column layout (42 columns, phone-contacts
export). Create a second query for it:

```m
let
    Source = Excel.Workbook(
        File.Contents("C:\path\to\Business_Cards_Catalogue.xlsx"),
        null, true
    ),
    Sheet2Only = Table.SelectRows(Source, each [Name] = "Sheet2"),
    RawData = Sheet2Only{0}[Data],
    Promoted = Table.PromoteHeaders(RawData, [PromoteAllScalars=true]),
    Filtered = Table.SelectRows(Promoted, each
        [Full Name] <> null and [Full Name] <> ""
    ),
    Mapped = Table.SelectColumns(Filtered,
        {"Full Name", "Company1", "Job Title1", "Email1",
         "Mobile1", "Tel1", "Date Created"}
    ),
    Renamed = Table.RenameColumns(Mapped, {
        {"Full Name", "name"},
        {"Company1", "company"},
        {"Job Title1", "position"},
        {"Email1", "email"},
        {"Mobile1", "phoneMobile"},
        {"Tel1", "phoneOffice"},
        {"Date Created", "dateAdded"}
    }),
    WithOwner = Table.AddColumn(Renamed, "owners", each "Sheet2", type text)
in
    WithOwner
```

Then append both queries:
- Home → Append Queries → Append as New
- Select the standard-sheets query and the Sheet2 query
- Add the derived columns (id, lastTouched, frequency, blanks) to the
  appended result.

### 5. Load to the Contacts sheet

- Close & Load To → Existing worksheet → select cell A1 on the Contacts sheet
- Ensure "Table" is selected as the load destination
- After loading, delete the 3 original sample rows manually (or filter them
  out in the query)

### 6. Format the table

- Right-click the table → Table Design → select **TableStyleMedium9**
- The dark blue header (#1F4E79) with white bold text matches automatically

---

## Notes

- **Dynamic**: If new tabs are added to the legacy file, the standard-sheets
  query will pick them up automatically (no hardcoded sheet names).
- **Others tab**: The 8th column is `SOURCE` instead of `DATE ADDED`. The
  query will leave `dateAdded` blank for that tab since the header doesn't
  match. This is the correct behavior.
- **Empty tabs** (Eason, Jordan): Automatically filtered out since they have
  no data rows where NAME is populated.
