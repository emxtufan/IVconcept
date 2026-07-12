import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {loadSiteContent} from './data';
import './index.css';

async function bootstrap() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    // Keep the admin panel out of the public bundle (it is dead weight for visitors).
    const {default: AdminApp} = await import('./admin/AdminApp.tsx');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    );
    return;
  }

  await loadSiteContent();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap().catch((error) => {
  console.error('Failed to bootstrap the app:', error);

  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050505;color:#ffffff;font-family:sans-serif;">Failed to load site content.</div>';
});
