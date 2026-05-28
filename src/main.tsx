import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { HashRouter } from 'react-router-dom';
import { msalConfig } from './services/authConfig';
import App from './App';
import './styles.css';

const msalInstance = new PublicClientApplication(msalConfig);

/**
 * HashRouter (not BrowserRouter) is intentional: the app is shipped without
 * any server-side rewrite config, so deep links like /contacts/:id/edit must
 * resolve without help from the host. Hash-based routing keeps everything
 * client-side and works under SharePoint, static hosts, or local file:// runs.
 */

msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <HashRouter>
          <App />
        </HashRouter>
      </MsalProvider>
    </StrictMode>
  );
});
