import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPageMetadata } from '../src/seo.ts';
import { renderPageMetadata } from '../server/pageMetadata.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('gallery and product pages have distinct canonical URLs and Romanian metadata', () => {
  const gallery = getPageMetadata('/galerie-foto/');
  const category = getPageMetadata('/produse/oglinzi', { title: 'Oglinzi', slug: 'oglinzi', image: '/uploads/mirror.webp' });
  assert.equal(gallery.canonical, 'https://www.ivconcept.ro/galerie-foto');
  assert.equal(category.canonical, 'https://www.ivconcept.ro/produse/oglinzi');
  assert.equal(category.title, 'Oglinzi | IV Concept');
  const output = renderPageMetadata(html, category);
  assert.match(output, /<html lang="ro"/);
  assert.match(output, /<title>Oglinzi \| IV Concept<\/title>/);
  assert.match(output, /property="og:url" content="https:\/\/www.ivconcept.ro\/produse\/oglinzi"/);
  assert.match(output, /property="og:image" content="\/uploads\/mirror.webp"/);
  assert.doesNotMatch(output, /rel="canonical" href="https:\/\/www.ivconcept.ro"/);
});

test('category content cannot inject HTML into server-rendered metadata', () => {
  const output = renderPageMetadata(html, getPageMetadata('/produse/test', {
    title: '</title><script>alert(1)</script>', slug: 'test', image: 'https://example.test/" onload="alert(1)',
  }));
  assert.doesNotMatch(output, /<script>alert/);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /&quot; onload=&quot;/);
});

test('admin and missing product categories are marked noindex', () => {
  assert.equal(getPageMetadata('/admin').robots, 'noindex, nofollow');
  assert.equal(getPageMetadata('/produse/missing', null).robots, 'noindex, follow');
  assert.match(renderPageMetadata(html, getPageMetadata('/admin')), /name="robots" content="noindex, nofollow"/);
});
