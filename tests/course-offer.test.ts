import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../supabase/siteContent.seed.json';
import { DEFAULT_COURSE_OFFER, normalizeSiteContent, type SiteContent } from '../src/types/siteContent.ts';

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
