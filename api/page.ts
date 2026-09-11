import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { getProductCategoryBySlug } from '../server/supabaseStore.js';
import { renderPageMetadata } from '../server/pageMetadata.js';
import { getPageMetadata } from '../src/seo.js';

export default async function servePage(request: Request, response: Response, next?: NextFunction) {
  try {
    const pathname = new URL(request.originalUrl || request.url, 'http://localhost').pathname;
    let metadata = getPageMetadata(pathname);
    let status = 200;
    if (/^\/produse(?:\/|$)/.test(pathname)) {
      const parts = pathname.split('/').filter(Boolean);
      try {
        const category = parts.length === 2 ? await getProductCategoryBySlug(decodeURIComponent(parts[1])) : null;
        metadata = getPageMetadata(pathname, category);
        if (!category) status = 404;
      } catch {
        status = 503;
        metadata = { ...metadata, robots: 'noindex, follow' };
      }
    }
    const html = await readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    response.setHeader('Cache-Control', 'no-cache');
    if (metadata.robots.startsWith('noindex')) response.setHeader('X-Robots-Tag', metadata.robots);
    response.status(status).type('html').send(renderPageMetadata(html, metadata));
  } catch (error) {
    if (next) return next(error);
    response.status(503).type('text').send('Pagina nu poate fi încărcată momentan. Reîncearcă în câteva momente.');
  }
}
