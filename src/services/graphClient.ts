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

// ─── Excel workbook helpers ──────────────────────────────────
// The DRIVE_ITEM_PATH points to the shared Excel file.
// Format: /drives/{driveId}/items/{itemId}  OR
//         /me/drive/root:/path/to/NetworkTracker.xlsx:
// Set via env var or configure after first deployment.

const WORKBOOK_PATH = import.meta.env.VITE_EXCEL_WORKBOOK_PATH
  || '/me/drive/root:/NetworkTracker.xlsx:';

export function getWorkbookPath() {
  return WORKBOOK_PATH;
}

export async function readTable(tableName: string): Promise<string[][]> {
  const client = getGraphClient();
  const path = getWorkbookPath();
  const res = await client
    .api(`${path}/workbook/tables/${tableName}/rows`)
    .get();
  return (res.value || []).map((row: { values: string[][] }) => row.values[0]);
}

export async function readTableHeaders(tableName: string): Promise<string[]> {
  const client = getGraphClient();
  const path = getWorkbookPath();
  const res = await client
    .api(`${path}/workbook/tables/${tableName}/columns`)
    .get();
  return (res.value || []).map((col: { name: string }) => col.name);
}

export async function addTableRow(tableName: string, values: (string | number | null)[]): Promise<void> {
  const client = getGraphClient();
  const path = getWorkbookPath();
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
  const path = getWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`)
    .patch({ values: [values] });
}

export async function deleteTableRow(tableName: string, rowIndex: number): Promise<void> {
  const client = getGraphClient();
  const path = getWorkbookPath();
  await client
    .api(`${path}/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`)
    .delete();
}
