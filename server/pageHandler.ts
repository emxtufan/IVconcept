import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderPageMetadata } from './pageMetadata.js';
import { getPageMetadata } from '../src/seo.js';

interface PageLoaders {
  loadHtml: () => Promise<string>;
  findCategory: (slug: string) => Promise<{ title: string; slug: string; image: string } | null>;
}

// Use Node's response API: this handler runs both directly on Vercel and inside Express.
export function createPageHandler({ loadHtml, findCategory }: PageLoaders) {
  return async function servePage(
    request: IncomingMessage & { originalUrl?: string },
    response: ServerResponse,
    next?: (error: unknown) => void,
  ) {
    try {
      const pathname = new URL(request.originalUrl || request.url || '/', 'http://localhost').pathname;
      let metadata = getPageMetadata(pathname);
      let status = 200;
      if (/^\/produse(?:\/|$)/.test(pathname)) {
        const parts = pathname.split('/').filter(Boolean);
        try {
          const category = parts.length === 2 ? await findCategory(decodeURIComponent(parts[1])) : null;
          metadata = getPageMetadata(pathname, category);
          if (!category) status = 404;
        } catch (error) {
          console.error('Product page metadata unavailable:', error);
          status = 503;
          metadata = { ...metadata, robots: 'noindex, follow' };
        }
      }
      const html = renderPageMetadata(await loadHtml(), metadata);
      response.statusCode = status;
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (metadata.robots.startsWith('noindex')) response.setHeader('X-Robots-Tag', metadata.robots);
      response.end(html);
    } catch (error) {
      if (typeof next === 'function') return next(error);
      console.error('Page rendering failed:', error);
      response.statusCode = 503;
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end('Pagina nu poate fi încărcată momentan. Reîncearcă în câteva momente.');
    }
  };
}
