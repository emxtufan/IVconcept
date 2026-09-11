import { createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;
export const MAX_INQUIRY_IMAGE_BYTES = 15 * 1024 * 1024;
export const RASTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
export const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']);
export type UploadPurpose = 'media' | 'gallery' | 'inquiry';

export interface UploadTicket {
  objectKey: string;
  mimeType: string;
  size: number;
  purpose: UploadPurpose;
  galleryId?: number;
  expiresAt: number;
}

export function isAllowedMediaType(mimeType: string, imagesOnly = false) {
  return RASTER_IMAGE_TYPES.has(mimeType) || (!imagesOnly && VIDEO_TYPES.has(mimeType));
}

export function signUploadTicket(ticket: UploadTicket, secret: string) {
  if (!secret) throw new Error('Upload signing is not configured. Set ADMIN_SESSION_SECRET.');
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`upload:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyUploadTicket(token: unknown, secret: string, now = Date.now()): UploadTicket {
  if (typeof token !== 'string' || token.length > 4096 || !secret) throw new Error('Invalid upload token.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new Error('Invalid upload token.');
  const expected = createHmac('sha256', secret).update(`upload:${payload}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid upload token.');
  let ticket: UploadTicket;
  try { ticket = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw new Error('Invalid upload token.'); }
  if (!ticket || !['media', 'gallery', 'inquiry'].includes(ticket.purpose) ||
    typeof ticket.objectKey !== 'string' || ticket.objectKey.includes('..') ||
    !Number.isSafeInteger(ticket.size) || ticket.size <= 0 || ticket.size > MAX_MEDIA_BYTES ||
    !Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= now ||
    !isAllowedMediaType(ticket.mimeType, ticket.purpose !== 'media')) {
    throw new Error('Invalid or expired upload token.');
  }
  if (ticket.purpose === 'inquiry' && (!ticket.objectKey.startsWith('inquiries/') || ticket.size > MAX_INQUIRY_IMAGE_BYTES)) {
    throw new Error('Invalid inquiry upload token.');
  }
  if (ticket.purpose === 'media' && !/^uploads\/[^/]+$/.test(ticket.objectKey)) throw new Error('Invalid media upload token.');
  if (ticket.purpose === 'gallery' && (!ticket.objectKey.startsWith('uploads/galleries/') || !Number.isSafeInteger(ticket.galleryId))) {
    throw new Error('Invalid gallery upload token.');
  }
  return ticket;
}

export function mediaSignatureMatches(bytes: Uint8Array, mimeType: string) {
  const data = Buffer.from(bytes);
  const ascii = (start: number, end: number) => data.subarray(start, end).toString('ascii');
  if (mimeType === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
  if (mimeType === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (mimeType === 'image/avif') return ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 64));
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') return ascii(4, 8) === 'ftyp';
  if (mimeType === 'video/webm') return data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === 'video/ogg') return ascii(0, 4) === 'OggS';
  return false;
}

export function inquiryAttachmentUrl(objectKey: string) {
  if (!/^inquiries\/[a-zA-Z0-9._-]+$/.test(objectKey)) throw new Error('Invalid inquiry object key.');
  return `/api/inquiries/attachments/${Buffer.from(objectKey).toString('base64url')}`;
}

export function inquiryObjectKeyFromUrl(url: string) {
  const match = /^\/api\/inquiries\/attachments\/([A-Za-z0-9_-]+)$/.exec(url);
  if (!match) return null;
  const key = Buffer.from(match[1], 'base64url').toString('utf8');
  return /^inquiries\/[a-zA-Z0-9._-]+$/.test(key) ? key : null;
}
