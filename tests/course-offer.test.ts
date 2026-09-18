import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../supabase/siteContent.seed.json';
import { DEFAULT_COURSE_OFFER, DEFAULT_COURSE_PAGE, DEFAULT_LEGAL, normalizeSiteContent, type SiteContent } from '../src/types/siteContent.ts';

test('existing site content receives a working offer without reseeding or losing other fields', () => {
  const legacy = structuredClone(seed) as unknown as SiteContent;
  delete legacy.courseOffer;
  const normalized = normalizeSiteContent(legacy);
  assert.deepEqual(normalized.courseOffer, DEFAULT_COURSE_OFFER);
  assert.equal(normalized.about.description, legacy.about.description);
});

test('an administrator can change the offer and disable automatic display', () => {
  const content = structuredClone(seed) as unknown as SiteContent;
  content.courseOffer = { ...DEFAULT_COURSE_OFFER, enabled: false, title: 'Curs nou', imageUrl: '/uploads/course.webp' };
  const result = normalizeSiteContent(content);
  assert.equal(result.courseOffer.enabled, false);
  assert.equal(result.courseOffer.title, 'Curs nou');
  assert.equal(result.courseOffer.imageUrl, '/uploads/course.webp');
});

test('older offers keep their desktop image when no mobile image has been configured', () => {
  const content = structuredClone(seed) as unknown as SiteContent;
  content.courseOffer.imageUrl = '/uploads/existing-course.webp';
  delete content.courseOffer.mobileImageUrl;
  const result = normalizeSiteContent(content);
  assert.equal(result.courseOffer.imageUrl, '/uploads/existing-course.webp');
  assert.equal(result.courseOffer.mobileImageUrl, '');
});

test('a separate mobile image survives content normalization and can be cleared', () => {
  const content = structuredClone(seed) as unknown as SiteContent;
  content.courseOffer.imageUrl = '/uploads/desktop-course.webp';
  content.courseOffer.mobileImageUrl = '  /uploads/mobile-course.webp  ';
  const saved = normalizeSiteContent(content);
  assert.equal(saved.courseOffer.imageUrl, '/uploads/desktop-course.webp');
  assert.equal(saved.courseOffer.mobileImageUrl, '/uploads/mobile-course.webp');
  saved.courseOffer.mobileImageUrl = '  ';
  assert.equal(normalizeSiteContent(saved).courseOffer.mobileImageUrl, '');
});

test('an existing site gains the course page and the new offer button without reseeding', () => {
  const legacy = structuredClone(seed) as unknown as SiteContent;
  delete (legacy as Partial<SiteContent>).coursePage;
  delete (legacy.courseOffer as Partial<typeof legacy.courseOffer>).pageButtonText;
  legacy.courseOffer.title = 'Titlu personalizat';

  const normalized = normalizeSiteContent(legacy);

  assert.deepEqual(normalized.coursePage, DEFAULT_COURSE_PAGE);
  assert.equal(normalized.courseOffer.pageButtonText, DEFAULT_COURSE_OFFER.pageButtonText);
  assert.equal(normalized.courseOffer.title, 'Titlu personalizat');
  assert.equal(normalized.footer.brandName, legacy.footer.brandName);
});

test('the course page keeps only the description and the form texts', () => {
  const normalized = normalizeSiteContent(structuredClone(seed) as unknown as SiteContent);

  assert.deepEqual(Object.keys(normalized.coursePage).sort(), ['description', 'formTitle', 'title']);
});

test('course page edits survive a save and a reload of the content', () => {
  const content = structuredClone(seed) as unknown as SiteContent;
  content.coursePage.title = 'Curs de tencuieli decorative';
  content.coursePage.description = 'Primul paragraf.\n\nAl doilea paragraf.';
  content.coursePage.formTitle = 'Rezervă un loc';

  const saved = normalizeSiteContent(content);

  assert.equal(saved.coursePage.title, 'Curs de tencuieli decorative');
  assert.equal(saved.coursePage.description, 'Primul paragraf.\n\nAl doilea paragraf.');
  assert.equal(saved.coursePage.formTitle, 'Rezervă un loc');
  assert.deepEqual(normalizeSiteContent(saved).coursePage, saved.coursePage);
});

test('the privacy details start empty and keep the default retention wording', () => {
  const legacy = structuredClone(seed) as unknown as SiteContent;
  delete (legacy as Partial<SiteContent>).legal;

  const normalized = normalizeSiteContent(legacy);

  assert.deepEqual(normalized.legal, DEFAULT_LEGAL);
  assert.equal(normalized.legal.legalEntityName, '');
  assert.equal(normalized.legal.metaPixelId, '', 'No pixel id means no tracking at all');
  assert.ok(normalized.legal.retentionPeriod.length > 0);
});

test('an administrator fills in the operator details and the tracking ids', () => {
  const content = structuredClone(seed) as unknown as SiteContent;
  content.legal.legalEntityName = '  IV Concept SRL  ';
  content.legal.registrationNumber = 'CUI 12345678';
  content.legal.metaPixelId = ' 1010134275417624 ';
  content.legal.retentionPeriod = '   ';

  const saved = normalizeSiteContent(content);

  assert.equal(saved.legal.legalEntityName, 'IV Concept SRL');
  assert.equal(saved.legal.registrationNumber, 'CUI 12345678');
  assert.equal(saved.legal.metaPixelId, '1010134275417624');
  // The privacy page must never show an empty retention period.
  assert.equal(saved.legal.retentionPeriod, DEFAULT_LEGAL.retentionPeriod);
  assert.deepEqual(normalizeSiteContent(saved).legal, saved.legal);
});

test('the legal settings keep only the operator details and the tracking ids', () => {
  const { legal } = normalizeSiteContent(structuredClone(seed) as unknown as SiteContent);

  assert.deepEqual(Object.keys(legal).sort(), [
    'address', 'contactEmail', 'googleAnalyticsId', 'lastUpdated',
    'legalEntityName', 'metaPixelId', 'registrationNumber', 'retentionPeriod',
  ]);
});
