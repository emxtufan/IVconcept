import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPageMetadata } from '../src/seo.ts';
import { getCourseHref, getHomeHref, getLegalHref, getLegalRoute, isCourseRoute } from '../src/routes.ts';
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

test('the course page shares one canonical address between /curs and the subdomain', () => {
  const path = getPageMetadata('/curs/');
  const subdomain = getPageMetadata('/', undefined, 'course.ivconcept.ro');
  assert.equal(path.canonical, 'https://course.ivconcept.ro');
  assert.equal(subdomain.canonical, path.canonical);
  assert.equal(subdomain.title, path.title);
  assert.equal(path.robots, 'index, follow');
  assert.match(renderPageMetadata(html, path), /<title>Curs de finisaje decorative \| IV Concept<\/title>/);
  // The main site keeps its own homepage metadata.
  assert.equal(getPageMetadata('/', undefined, 'www.ivconcept.ro').canonical, 'https://www.ivconcept.ro');
});

test('course links point at the subdomain in production and stay local elsewhere', () => {
  assert.equal(getCourseHref('www.ivconcept.ro'), 'https://course.ivconcept.ro');
  assert.equal(getCourseHref('ivconcept.ro'), 'https://course.ivconcept.ro');
  assert.equal(getCourseHref('course.ivconcept.ro'), '/');
  assert.equal(getCourseHref('localhost'), '/curs');
  assert.equal(getCourseHref('ivconcept-preview.vercel.app'), '/curs');
  assert.equal(getHomeHref('course.ivconcept.ro'), 'https://www.ivconcept.ro');
  assert.equal(getHomeHref('www.ivconcept.ro'), '/');
});

test('the course route ignores the port and a trailing slash but not other paths', () => {
  assert.equal(isCourseRoute('course.ivconcept.ro:3000', '/'), true);
  assert.equal(isCourseRoute('COURSE.IVCONCEPT.RO', '/curs/'), true);
  assert.equal(isCourseRoute('course.ivconcept.ro', '/admin'), false);
  assert.equal(isCourseRoute('www.ivconcept.ro', '/'), false);
});

test('admin and missing product categories are marked noindex', () => {
  assert.equal(getPageMetadata('/admin').robots, 'noindex, nofollow');
  assert.equal(getPageMetadata('/produse/missing', null).robots, 'noindex, follow');
  assert.match(renderPageMetadata(html, getPageMetadata('/admin')), /name="robots" content="noindex, nofollow"/);
});

test('the legal pages have their own canonical addresses on the main site', () => {
  const privacy = getPageMetadata('/confidentialitate');
  const terms = getPageMetadata('/termeni/');
  assert.equal(privacy.canonical, 'https://www.ivconcept.ro/confidentialitate');
  assert.equal(terms.canonical, 'https://www.ivconcept.ro/termeni');
  assert.equal(privacy.title, 'Politica de confidențialitate | IV Concept');
  assert.equal(privacy.robots, 'index, follow');

  // They keep the main-site canonical even when served from the course subdomain.
  assert.equal(getPageMetadata('/confidentialitate', undefined, 'course.ivconcept.ro').canonical, privacy.canonical);
});

test('the policy link is absolute on the course subdomain and relative on the main site', () => {
  assert.equal(getLegalHref('course.ivconcept.ro', 'privacy'), 'https://www.ivconcept.ro/confidentialitate');
  assert.equal(getLegalHref('www.ivconcept.ro', 'privacy'), '/confidentialitate');
  assert.equal(getLegalHref('localhost', 'terms'), '/termeni');
  assert.equal(getLegalRoute('/confidentialitate/'), 'privacy');
  assert.equal(getLegalRoute('/termeni'), 'terms');
  assert.equal(getLegalRoute('/curs'), null);
});
