import { Client } from '@microsoft/microsoft-graph-client';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { graphScopes } from './authConfig';

let graphClient: Client | null = null;

export function initGraphClient(msalInstance: IPublicClientApplication) {
  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const accounts = msalInstance.getAllAccounts();
        if (!accounts.length) throw new Error('No accounts found. Please sign in.');
        const response = await msalInstance.acquireTokenSilent({
          ...graphScopes,
          account: accounts[0],
        });
        return response.accessToken;
      },
    },
  });
  return graphClient;
}

export function getGraphClient(): Client {
  if (!graphClient) throw new Error('Graph client not initialized. Call initGraphClient first.');
  return graphClient;
}

// ─── SharePoint file resolution ─────────────────────────────
// We try multiple strategies to find the workbook:
// 1. Explicit VITE_EXCEL_WORKBOOK_PATH (if set)
// 2. SharePoint sharing link via /shares API
// 3. Direct site-relative path as fallback

const SHAREPOINT_URL = import.meta.env.VITE_SHAREPOINT_URL
  || 'https://sage3my.sharepoint.com/:x:/s/Sage3BusinessDevelopment/IQDfmSXbZMbaRaVtt7a62voAAWrzZsf1g9S2W7G7LMd-DrM?e=aqCsLI';

function encodeSharingUrl(url: string): string {
  const base64 = btoa(url);
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `u!${base64url}`;
}

let resolvedWorkbookPath: string | null = null;

export async function resolveWorkbookPath(): Promise<string> {
  if (resolvedWorkbookPath) return resolvedWorkbookPath;

  const explicitPath = import.meta.env.VITE_EXCEL_WORKBOOK_PATH;
  if (explicitPath) {
    resolvedWorkbookPath = explicitPath;
    return explicitPath;
  }

  const client = getGraphClient();
  const errors: string[] = [];

  // Strategy 1: Resolve via /shares API (with query params)
  try {
    const shareToken = encodeSharingUrl(SHAREPOINT_URL);
    const driveItem = await client
      .api(`/shares/${shareToken}/driveItem`)
      .select('id,parentReference')
      .get();
    const driveId = driveItem.parentReference?.driveId;
    const itemId = driveItem.id;
    if (driveId && itemId) {
      resolvedWorkbookPath = `/drives/${driveId}/items/${itemId}`;
      console.log('[Graph] Resolved workbook via sharing link:', resolvedWorkbookPath);
      return resolvedWorkbookPath;
    }
  } catch (e: any) {
    errors.push(`Sharing link: ${e.message || e}`);
    console.warn('[Graph] Sharing link resolution failed:', e.message || e);
  }

  // Strategy 2: Try sharing link without query params
  try {
    const urlNoParams = SHAREPOINT_URL.split('?')[0];
    const shareToken = encodeSharingUrl(urlNoParams);
    const driveItem = await client
      .api(`/shares/${shareToken}/driveItem`)
      .select('id,parentReference')
      .get();
    const driveId = driveItem.parentReference?.driveId;
    const itemId = driveItem.id;
    if (driveId && itemId) {
      resolvedWorkbookPath = `/drives/${driveId}/items/${itemId}`;
      console.log('[Graph] Resolved workbook via sharing link (no params):', resolvedWorkbookPath);
      return resolvedWorkbookPath;
    }
  } catch (e: any) {
    errors.push(`Sharing link (no params): ${e.message || e}`);
    console.warn('[Graph] Sharing link (no params) resolution failed:', e.message || e);
  }

  // Strategy 3: Try direct SharePoint site path
  try {
    const siteRes = await client
      .api('/sites/sage3my.sharepoint.com:/sites/Sage3BusinessDevelopment:')
      .select('id')
      .get();
    const siteId = siteRes.id;
    if (siteId) {
      const driveRes = await client
        .api(`/sites/${siteId}/drive`)
        .select('id')
        .get();
      const driveId = driveRes.id;
      if (driveId) {
        // Search for the file in the drive root
        const searchRes = await client
          .api(`/drives/${driveId}/root/children`)
          .filter("name eq 'NetworkTracker.xlsx'")
          .select('id')
          .get();
        if (searchRes.value && searchRes.value.length > 0) {
          resolvedWorkbookPath = `/drives/${driveId}/items/${searchRes.value[0].id}`;
          console.log('[Graph] Resolved workbook via site path:', resolvedWorkbookPath);
          return resolvedWorkbookPath;
        }
        // Try searching all files
        const allFiles = await client
          .api(`/drives/${driveId}/root/search(q='NetworkTracker')`)
          .select('id,name')
          .get();
        if (allFiles.value && allFiles.value.length > 0) {
          resolvedWorkbookPath = `/drives/${driveId}/items/${allFiles.value[0].id}`;
          console.log('[Graph] Resolved workbook via drive search:', resolvedWorkbookPath);
          return resolvedWorkbookPath;
        }
        errors.push('Site found but NetworkTracker.xlsx not found in drive');
      }
    }
  } catch (e: any) {
    errors.push(`Site path: ${e.message || e}`);
    console.warn('[Graph] Site path resolution failed:', e.message || e);
  }

  // Strategy 4: Try user's OneDrive as last resort
  try {
    const searchRes = await client
      .api("/me/drive/root/search(q='NetworkTracker')")
      .select('id,name,parentReference')
      .get();
    if (searchRes.value && searchRes.value.length > 0) {
      const item = searchRes.value[0];
      const driveId = item.parentReference?.driveId;
      if (driveId) {
        resolvedWorkbookPath = `/drives/${driveId}/items/${item.id}`;
      } else {
        resolvedWorkbookPath = `/me/drive/items/${item.id}`;
      }
      console.log('[Graph] Resolved workbook via OneDrive search:', resolvedWorkbookPath);
      return resolvedWorkbookPath;
    }
  } catch (e: any) {
    errors.push(`OneDrive search: ${e.message || e}`);
    console.warn('[Graph] OneDrive search failed:', e.message || e);
  }

  throw new Error(
    `Could not find NetworkTracker.xlsx. Tried ${errors.length} strategies:\n${errors.join('\n')}`
  );
}

export async function readTable(tableName: string): Promise<string[][]> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  const res = await client
    .api(`${path}/workbook/tables/${tableName}/rows`)
    .get();
  return (res.value || []).map((row: { values: string[][] }) => row.values[0]);
}

export async function readTableHeaders(tableName: string): Promise<string[]> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  const res = await client
    .api(`${path}/workbook/tables/${tableName}/columns`)
    .get();
  return (res.value || []).map((col: { name: string }) => col.name);
}

export async function addTableRow(tableName: string, values: (string | number | null)[]): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows`)
    .post({ values: [values] });
}

export async function updateTableRow(
  tableName: string,
  rowIndex: number,
  values: (string | number | null)[]
): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`)
    .patch({ values: [values] });
}

export async function deleteTableRow(tableName: string, rowIndex: number): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`)
    .delete();
}

export async function clearTableData(tableName: string): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  try {
    await client
      .api(`${path}/workbook/tables/${tableName}/dataBodyRange/delete`)
      .post({ shift: 'Up' });
  } catch (e: any) {
    if (e.statusCode === 404 || e.message?.includes('empty')) return;
    throw e;
  }
}

export async function addTableRows(tableName: string, rows: (string | number | null)[][]): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows`)
    .post({ values: rows });
}

// Appends a new column to a table. The `values` array contains [header, ...dataRows].
// Passing only [[headerName]] names the column; the API fills existing rows with ''.
// Throws if the Graph API rejects the request (caller should catch).
export async function addTableColumn(tableName: string, columnName: string): Promise<void> {
  const client = getGraphClient();
  const path = await resolveWorkbookPath();
  const headers = await readTableHeaders(tableName);
  await client
    .api(`${path}/workbook/tables/${tableName}/columns/add`)
    .post({ index: headers.length, values: [[columnName]] });
}
