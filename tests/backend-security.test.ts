import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renameGallerySafely, type GalleryRenameOperations } from '../server/galleryRename.js';
import { inquiryAttachmentUrl, inquiryObjectKeyFromUrl, isAllowedMediaType, mediaSignatureMatches, signUploadTicket, verifyUploadTicket, type UploadTicket } from '../server/uploadSecurity.js';

const secret = 'test-only-upload-signing-secret';
const ticket: UploadTicket = { objectKey: 'inquiries/photo-123.png', purpose: 'inquiry', mimeType: 'image/png', size: 128, expiresAt: 2000 };

test('upload tickets reject tampering, expiry, wrong namespace and active content', () => {
  const token = signUploadTicket(ticket, secret);
  assert.deepEqual(verifyUploadTicket(token, secret, 1000), ticket);
  assert.throws(() => verifyUploadTicket(token, 'different-secret', 1000));
  assert.throws(() => verifyUploadTicket(token, secret, 2000));
  assert.throws(() => verifyUploadTicket(signUploadTicket({ ...ticket, size: 16 * 1024 * 1024 }, secret), secret, 1000));
  assert.throws(() => verifyUploadTicket(signUploadTicket({ ...ticket, objectKey: 'uploads/public.png' }, secret), secret, 1000));
  assert.throws(() => verifyUploadTicket(signUploadTicket({ ...ticket, mimeType: 'image/svg+xml' }, secret), secret, 1000));
  assert.equal(isAllowedMediaType('image/svg+xml'), false);
  assert.equal(isAllowedMediaType('text/html'), false);
  assert.equal(isAllowedMediaType('video/mp4'), true);
  assert.equal(isAllowedMediaType('video/mp4', true), false);
});

test('a declared raster MIME type cannot conceal SVG bytes', () => {
  assert.equal(mediaSignatureMatches(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png'), false);
  assert.equal(mediaSignatureMatches(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(mediaSignatureMatches(Buffer.from('GIF89a'), 'image/gif'), true);
});

test('attachment URLs only resolve protected inquiry keys', () => {
  assert.equal(inquiryObjectKeyFromUrl(inquiryAttachmentUrl(ticket.objectKey)), ticket.objectKey);
  assert.equal(inquiryObjectKeyFromUrl('/uploads/inquiries/photo.png'), null);
  assert.equal(inquiryObjectKeyFromUrl('https://external.example/photo.png'), null);
  assert.throws(() => inquiryAttachmentUrl('inquiries/../public.png'));
});

function renameFixture() {
  const gallery = { id: 1, slug: 'old', items: [{ id: 1, filename: 'a.png' }, { id: 2, filename: 'b.png' }] };
  const objects = new Set(['old/a.png', 'old/b.png']);
  const committed: string[][] = [];
  const cleanupFailures: string[][] = [];
  const operations: GalleryRenameOperations = {
    objectKey: (slug, filename) => `${slug}/${filename}`,
    assetUrl: (key) => `/${key}`,
    copy: async (source, destination) => { assert.ok(objects.has(source)); objects.add(destination); },
    commit: async (_id, _name, _slug, _old, items) => { committed.push(items.map((item) => item.url)); },
    remove: async (key) => { objects.delete(key); },
    reportCleanupFailure: (keys) => cleanupFailures.push(keys),
  };
  return { gallery, objects, committed, cleanupFailures, operations };
}

test('rename cleanup failure preserves every committed destination', async () => {
  const state = renameFixture();
  state.operations.remove = async (key) => {
    if (key === 'old/a.png') throw new Error('transient R2 failure');
    state.objects.delete(key);
  };
  await renameGallerySafely(state.gallery, 'New', 'new', state.operations);
  assert.deepEqual(state.committed, [['/new/a.png', '/new/b.png']]);
  assert.ok(state.objects.has('new/a.png'));
  assert.ok(state.objects.has('new/b.png'));
  assert.deepEqual(state.cleanupFailures, [['old/a.png']]);
});

test('an ambiguous database commit never deletes original or destination files', async () => {
  const state = renameFixture();
  state.operations.commit = async () => { throw new Error('response lost after commit'); };
  await assert.rejects(renameGallerySafely(state.gallery, 'New', 'new', state.operations));
  assert.deepEqual([...state.objects].sort(), ['new/a.png', 'new/b.png', 'old/a.png', 'old/b.png']);
});

test('a failed concurrent copy never removes another rename operation destination', async () => {
  const state = renameFixture();
  state.operations.copy = async (_source, destination) => {
    if (destination === 'new/b.png') throw new Error('copy failed');
    state.objects.add(destination);
  };
  await assert.rejects(renameGallerySafely(state.gallery, 'New', 'new', state.operations));
  assert.equal(state.committed.length, 0);
  assert.ok(state.objects.has('new/a.png'));
  assert.ok(state.objects.has('old/a.png'));
  assert.ok(state.objects.has('old/b.png'));
});
