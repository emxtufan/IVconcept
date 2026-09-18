import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {getSiteContent, loadSiteContent} from './data';
import {getLegalRoute, isCourseRoute} from './routes';
import {startTracking} from './components/metaPixel';
import {applyPageMetadata, getPageMetadata} from './seo';
import './index.css';

async function bootstrap() {
  const isAdminRoute = /^\/admin(?:\/|$)/.test(window.location.pathname);
  const isProductsRoute = /^\/produse(?:\/|$)/.test(window.location.pathname);
  // The course page answers on /curs and on the root of the course subdomain.
  const isCoursePageRoute = !isAdminRoute && isCourseRoute(window.location.hostname, window.location.pathname);
  applyPageMetadata(getPageMetadata(window.location.pathname, undefined, window.location.hostname));

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

  if (isCoursePageRoute) {
    const [{default: CoursePage}] = await Promise.all([
      import('./components/CoursePage.tsx'),
      loadSiteContent(),
    ]);
    startTracking(getSiteContent().legal);
    createRoot(document.getElementById('root')!).render(
      <StrictMode><CoursePage /></StrictMode>,
    );
    return;
  }

  const legalRoute = isAdminRoute ? null : getLegalRoute(window.location.pathname);

  if (legalRoute) {
    const [{default: LegalPage}] = await Promise.all([
      import('./components/LegalPage.tsx'),
      loadSiteContent(),
    ]);
    startTracking(getSiteContent().legal);
    createRoot(document.getElementById('root')!).render(
      <StrictMode><LegalPage document={legalRoute} /></StrictMode>,
    );
    return;
  }

  if (isProductsRoute) {
    const [{default: ProductCatalogPage}] = await Promise.all([
      import('./components/ProductCatalogPage.tsx'),
      loadSiteContent(),
    ]);
    startTracking(getSiteContent().legal);
    createRoot(document.getElementById('root')!).render(
      <StrictMode><ProductCatalogPage /></StrictMode>,
    );
    return;
  }

  const [{default: App}] = await Promise.all([import('./App.tsx'), loadSiteContent()]);

  startTracking(getSiteContent().legal);
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
    '<div role="alert" style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:#e8e0d6;color:#2c2218;font-family:sans-serif;padding:24px;text-align:center;"><p>Site-ul nu poate fi încărcat momentan. Te rugăm să încerci din nou.</p><button onclick="location.reload()" style="padding:12px 24px;cursor:pointer;">Reîncearcă</button></div>';
});
