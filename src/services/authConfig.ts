import type { Configuration } from '@azure/msal-browser';
import { LogLevel } from '@azure/msal-browser';

// ─── Replace these with your Azure AD app registration values ───
// See docs/AZURE_SETUP_GUIDE.md for step-by-step instructions
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID';
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || 'YOUR_TENANT_ID';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        if (import.meta.env.DEV) console.debug('[MSAL]', message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
};

export const graphScopes = {
  scopes: ['Files.ReadWrite.All', 'Sites.ReadWrite.All'],
};
