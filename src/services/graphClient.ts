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

// ─── SharePoint sharing link → Graph API path ──────────────
// Encodes a SharePoint sharing URL into the /shares/{token}/driveItem format
// that Microsoft Graph uses to resolve shared files.
const SHAREPOINT_URL = import.meta.env.VITE_SHAREPOINT_URL
  || 'https://sage3my.sharepoint.com/:x:/s/Sage3BusinessDevelopment/IQDfmSXbZMbaRaVtt7a62voAAWrzZsf1g9S2W7G7LMd-DrM?e=aqCsLI';

function encodeSharingUrl(url: string): string {
  const base64 = btoa(url);
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `u!${base64url}`;
}

// Cache the resolved workbook path so we don't re-resolve on every call
let resolvedWorkbookPath: string | null = null;

export async function resolveWorkbookPath(): Promise<string> {
  if (resolvedWorkbookPath) return resolvedWorkbookPath;

  // If an explicit drive path is provided, use it directly
  const explicitPath = import.meta.env.VITE_EXCEL_WORKBOOK_PATH;
  if (explicitPath) {
    resolvedWorkbookPath = explicitPath;
    return resolvedWorkbookPath;
  }

  // Resolve SharePoint sharing link to a driveItem path
  const shareToken = encodeSharingUrl(SHAREPOINT_URL);
  const client = getGraphClient();
  const driveItem = await client
    .api(`/shares/${shareToken}/driveItem`)
    .select('id,parentReference')
    .get();

  const driveId = driveItem.parentReference?.driveId;
  const itemId = driveItem.id;

  if (!driveId || !itemId) {
    throw new Error('Could not resolve SharePoint file. Check that the sharing link is valid and you have access.');
  }

  resolvedWorkbookPath = `/drives/${driveId}/items/${itemId}`;
  return resolvedWorkbookPath;
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
