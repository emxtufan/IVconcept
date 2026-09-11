import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createPageHandler } from '../server/pageHandler.ts';

const loadHtml = () => readFile(new URL('../index.html', import.meta.url), 'utf8');

async function withNativeServer(handler: ReturnType<typeof createPageHandler>, run: (origin: string) => Promise<void>) {
  const server = http.createServer((request, response) => {
    // No Express/Vercel convenience methods: verifies the portable response contract.
    assert.equal('type' in response, false);
    assert.equal('status' in response, false);
    void handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('page function serves gallery, admin and category HTML with a native Node response', async () => {
  const handler = createPageHandler({ loadHtml, findCategory: async (slug) => slug === 'oglinzi' ? {title:'Oglinzi',slug,image:'https://example.test/mirror.webp'} : null });
  await withNativeServer(handler, async (origin) => {
    for (const route of ['/galerie-foto', '/admin', '/produse/oglinzi']) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      const html = await response.text();
      assert.match(html, /<html lang="ro"/);
      if (route === '/admin') assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      if (route === '/produse/oglinzi') assert.match(html, /<title>Oglinzi \| IV Concept<\/title>/);
    }
    const missing = await fetch(origin + '/produse/lipsa');
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex, follow');
  });
});

test('page function returns a controlled 503 if the HTML template is unavailable', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  const handler = createPageHandler({ loadHtml: async () => {throw new Error('test template missing');}, findCategory: async () => null });
  await withNativeServer(handler, async (origin) => {
    const response = await fetch(origin + '/admin');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /Pagina nu poate fi încărcată momentan/);
  });
});

test('page function preserves the application HTML when category metadata is temporarily unavailable', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  const handler = createPageHandler({ loadHtml, findCategory: async () => {throw new Error('test database unavailable');} });
  await withNativeServer(handler, async (origin) => {
    const response = await fetch(origin + '/produse/oglinzi');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(await response.text(), /id="root"/);
  });
});
