import type { Configuration } from '@azure/msal-browser';
import { LogLevel } from '@azure/msal-browser';

// ─── Replace these with your Azure AD app registration values ───
// See docs/AZURE_SETUP_GUIDE.md for step-by-step instructions
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || 'd2835b9d-9ef3-4cb1-9d43-c8c200e62aaa';
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || 'e5081217-bc55-42cf-a9c4-ff012e6900de';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'localStorage',
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
