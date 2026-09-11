import express from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import multer from 'multer';
import sharp from 'sharp';
import servePage from '../api/page.js';
import { normalizeSiteContent, type SiteContent } from '../src/types/siteContent.js';
import { getGalleryFolderPath, slugifyGalleryName, type GalleryRecord } from '../src/types/galleries.js';
import { slugifyProductCategory } from '../src/types/products.js';
import {
  buildGalleryObjectKey,
  buildPublicAssetUrl,
  buildUploadsObjectKey,
  copyR2Object,
  createR2SignedUploadUrl,
  deleteR2Object,
  deletePrivateR2Object,
  extractManagedObjectKeyFromUrl,
  getR2ConfigurationErrorMessage,
  isR2Configured,
  isPrivateR2Configured,
  joinObjectKey,
  proxyR2ObjectToResponse,
  uploadBufferToR2,
  uploadFileToR2,
  verifyR2UploadedObject,
} from './r2Storage.js';
import {
  createGallery,
  createCourseSubscriber,
  createGalleryItems,
  createInquiry,
  createNewsletterSubscriber,
  createProduct,
  createProductCategory,
  deleteGallery,
  deleteCourseSubscriber,
  deleteGalleryItem,
  deleteInquiry,
  deleteNewsletterSubscriber,
  deleteProduct,
  deleteProductCategory,
  findNewsletterSubscriberByEmail,
  getGalleryById,
  getGalleryBySlug,
  getGalleryItemById,
  getInquiryById,
  hasInquiryAttachment,
  registerPendingInquiryUploads,
  listExpiredInquiryUploads,
  removePendingInquiryUpload,
  isMediaAssetReferenced,
  getMainSiteContent,
  listGalleries,
  listCourseSubscribers,
  listInquiries,
  listNewsletterSubscribers,
  listProductCategories,
  getProductCategoryBySlug,
  saveMainSiteContent,
  updateGallery,
  updateGalleryItemUrl,
  renameGalleryWithItems,
  updateProduct,
  updateProductCategory,
} from './supabaseStore.js';
import {
  getSupabaseAdminErrorMessage,
  getSupabaseConfigurationErrorMessage,
  hasSupabaseAdminAccess,
  isSupabaseConfigured,
} from './supabase.js';
import { createRateLimitMiddleware } from './rateLimit.js';
import { renameGallerySafely } from './galleryRename.js';
import {
  MAX_INQUIRY_IMAGE_BYTES, MAX_MEDIA_BYTES, inquiryAttachmentUrl, inquiryObjectKeyFromUrl,
  isAllowedMediaType, signUploadTicket, verifyUploadTicket, type UploadPurpose, type UploadTicket,
} from './uploadSecurity.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');
const publicPath = path.resolve(__dirname, '../public');
const uploadsPath = path.resolve(publicPath, 'uploads');
const tempUploadsPath = path.resolve(tmpdir(), 'ivconcept-uploads');
const ADMIN_COOKIE_NAME = 'iv_admin_session';
const ADMIN_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET?.trim() || ADMIN_PASSWORD;
mkdirSync(tempUploadsPath, { recursive: true });

const proxyHops = process.env.VERCEL === '1' ? 1 : Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 8) app.set('trust proxy', proxyHops);
app.disable('x-powered-by');
app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', (request, response, next) => {
  let pathname: string;
  try { pathname = path.posix.normalize(decodeURIComponent(request.path).replaceAll('\\', '/')).toLowerCase(); }
  catch { response.status(400).end(); return; }
  if (pathname === '/inquiries' || pathname.startsWith('/inquiries/') || /\.(svg|svgz|html?|xml|js)$/i.test(pathname)) {
    response.status(404).json({ message: 'File not found.' });
    return;
  }
  response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  next();
}, express.static(uploadsPath, { setHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
} }));

const loginRateLimit = createRateLimitMiddleware('admin-login', { limit: 10, windowSeconds: 900, globalLimit: 1000 });
const formRateLimit = createRateLimitMiddleware('public-form', { limit: 10, windowSeconds: 900, globalLimit: 1000 });
const uploadRateLimit = createRateLimitMiddleware('inquiry-upload', { limit: 15, windowSeconds: 900, globalLimit: 500 });
const uploadDailyRateLimit = createRateLimitMiddleware('inquiry-upload-daily', { limit: 12, windowSeconds: 86400, globalLimit: 200 });
const finalizeRateLimit = createRateLimitMiddleware('inquiry-finalize', { limit: 30, windowSeconds: 900, globalLimit: 1000 });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, tempUploadsPath);
  },
  filename: (_request, file, callback) => {
    callback(null, createUploadFilename(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024,
    files: 24,
  },
  fileFilter: (_request, file, callback) => {
    if (!isAllowedMediaType(file.mimetype)) {
      callback(new Error('Only supported raster image and video files are allowed.'));
      return;
    }

    callback(null, true);
  },
});

function timingSafeStringCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((chunk) => {
    const separatorIndex = chunk.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = chunk.slice(0, separatorIndex).trim();
    const value = chunk.slice(separatorIndex + 1).trim();

    if (!key) {
      return;
    }

    try { cookies[key] = decodeURIComponent(value); } catch { /* Ignore malformed cookies. */ }
  });

  return cookies;
}

function createAdminSessionValue(expiresAt: number) {
  const payload = String(expiresAt);
  const signature = createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyAdminSessionValue(value?: string) {
  if (!value || !ADMIN_SESSION_SECRET) {
    return false;
  }

  const separatorIndex = value.lastIndexOf('.');

  if (separatorIndex === -1) {
    return false;
  }

  const payload = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expectedSignature = createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  if (!timingSafeStringCompare(signature, expectedSignature)) {
    return false;
  }

  const expiresAt = Number(payload);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  return true;
}

function getIsSecureRequest(request: express.Request) {
  if (request.secure) {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];

  if (typeof forwardedProto === 'string') {
    return forwardedProto.includes('https');
  }

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.some((value) => value.includes('https'));
  }

  return process.env.NODE_ENV === 'production';
}

function setAdminSessionCookie(response: express.Response, request: express.Request) {
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_MS;

  response.cookie(ADMIN_COOKIE_NAME, createAdminSessionValue(expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getIsSecureRequest(request),
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
  });
}

function clearAdminSessionCookie(response: express.Response, request: express.Request) {
  response.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getIsSecureRequest(request),
    path: '/',
  });
}

function requireAdminSession(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    response.status(503).json({
      message: 'Admin authentication is not configured on the server.',
    });
    return;
  }

  const sessionValue = parseCookies(request.headers.cookie)[ADMIN_COOKIE_NAME];

  if (!verifyAdminSessionValue(sessionValue)) {
    clearAdminSessionCookie(response, request);
    response.status(401).json({
      message: 'Admin authentication required.',
    });
    return;
  }

  next();
}

function ensureR2StorageConfigured(response: express.Response) {
  if (isR2Configured()) {
    return true;
  }

  response.status(503).json({
    message: getR2ConfigurationErrorMessage(),
  });
  return false;
}

function ensurePrivateR2StorageConfigured(response: express.Response) {
  if (isPrivateR2Configured()) return true;
  console.error('Configure R2_PRIVATE_BUCKET_NAME as a separate R2 bucket with public access disabled.');
  response.status(503).json({ message: 'Încărcarea fotografiilor este temporar indisponibilă. Poți trimite cererea fără fotografii sau poți încerca mai târziu.' });
  return false;
}

function ensureSupabaseConfigured(response: express.Response) {
  if (isSupabaseConfigured()) {
    return true;
  }

  response.status(503).json({
    message: getSupabaseConfigurationErrorMessage(),
  });
  return false;
}

function ensureSupabaseAdminConfigured(response: express.Response) {
  if (hasSupabaseAdminAccess()) {
    return true;
  }

  response.status(503).json({
    message: getSupabaseAdminErrorMessage(),
  });
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSiteContentPayload(value: unknown): value is SiteContent {
  if (!isPlainObject(value)) {
    return false;
  }

  const requiredKeys: Array<keyof SiteContent> = [
    'hero',
    'about',
    'imageSection',
    'logoSection',
    'textSection',
    'cardsSection',
    'slidersSection',
    'videoCardSection',
    'reviews',
    'footer',
  ];

  return requiredKeys.every((key) => key in value);
}

function collectManagedSiteContentObjectKeys(value: unknown, objectKeys = new Set<string>()) {
  if (typeof value === 'string') {
    const objectKey = extractManagedObjectKeyFromUrl(value);

    if (objectKey && !objectKey.startsWith('uploads/galleries/')) {
      objectKeys.add(objectKey);
    }

    return objectKeys;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectManagedSiteContentObjectKeys(item, objectKeys);
    });
    return objectKeys;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => {
      collectManagedSiteContentObjectKeys(item, objectKeys);
    });
  }

  return objectKeys;
}

function isRasterImage(mimeType: string) {
  return mimeType.startsWith('image/') && !/image\/(gif|svg\+xml)/i.test(mimeType);
}

function createUploadFilename(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path
    .basename(originalName, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image';

  return `${baseName}-${randomUUID()}${extension}`;
}

interface UploadedMediaAssetPayload {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadToken?: string;
}

function isUploadedMediaAssetPayload(value: unknown): value is UploadedMediaAssetPayload {
  return isPlainObject(value) &&
    typeof value.url === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.originalName === 'string' &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    typeof value.mimeType === 'string' &&
    (typeof value.width === 'number' || value.width === null) &&
    (typeof value.height === 'number' || value.height === null);
}

function parseUploadedMediaAssets(value: unknown) {
  if (!isPlainObject(value) || !Array.isArray(value.files)) {
    return null;
  }

  const files = value.files.filter(isUploadedMediaAssetPayload);

  if (files.length !== value.files.length) {
    return null;
  }

  return files;
}

function parsePresignFilesPayload(value: unknown) {
  if (!isPlainObject(value) || !Array.isArray(value.files)) {
    return null;
  }

  const files = value.files.filter((file): file is {
    originalName: string;
    mimeType: string;
    size: number;
  } => (
    isPlainObject(file) &&
    typeof file.originalName === 'string' &&
    typeof file.mimeType === 'string' &&
    typeof file.size === 'number' &&
    Number.isFinite(file.size)
  ));

  if (files.length !== value.files.length) {
    return null;
  }

  return files;
}

async function createPresignedUploadAssets(objectKeyBuilder: (filename: string) => string, files: Array<{
  originalName: string;
  mimeType: string;
  size: number;
}>, purpose: UploadPurpose = 'media', galleryId?: number) {
  const maxFiles = purpose === 'inquiry' ? 5 : purpose === 'gallery' ? 48 : 24;
  if (!ADMIN_SESSION_SECRET) throw new Error('Upload signing is not configured.');
  if (files.length > maxFiles || files.some((file) => !isAllowedMediaType(file.mimeType, purpose !== 'media') ||
    !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > (purpose === 'inquiry' ? MAX_INQUIRY_IMAGE_BYTES : MAX_MEDIA_BYTES))) {
    throw new Error('Invalid upload size, count, or media type. SVG files are not accepted.');
  }
  const assets = await Promise.all(
    files.map(async (file) => {
      const filename = createUploadFilename(file.originalName);
      const objectKey = objectKeyBuilder(filename);
      const { uploadUrl, cacheControl } = await createR2SignedUploadUrl({
        objectKey,
        contentType: file.mimeType,
        contentLength: file.size,
        privateAsset: purpose === 'inquiry',
        ...(purpose === 'inquiry' ? { cacheControl: 'private, no-store' } : {}),
      });

      return {
        uploadUrl,
        headers: {
          'Content-Type': file.mimeType,
          'Cache-Control': cacheControl,
        },
        asset: {
          url: purpose === 'inquiry' ? inquiryAttachmentUrl(objectKey) : buildPublicAssetUrl(objectKey),
          filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          width: null,
          height: null,
          uploadToken: signUploadTicket({ objectKey, mimeType: file.mimeType, size: file.size, purpose, galleryId,
            expiresAt: Date.now() + 60 * 60 * 1000 }, ADMIN_SESSION_SECRET),
        },
      };
    }),
  );
  if (purpose === 'inquiry') {
    await registerPendingInquiryUploads(assets.map((entry) => verifyUploadTicket(entry.asset.uploadToken, ADMIN_SESSION_SECRET).objectKey));
  }
  return assets;
}

async function validateUploadedAssets(files: UploadedMediaAssetPayload[], purpose: UploadPurpose, gallery?: { id: number; slug: string }) {
  const maxFiles = purpose === 'inquiry' ? 5 : purpose === 'gallery' ? 48 : 24;
  if (files.length < 1 || files.length > maxFiles) throw new Error('Invalid uploaded file count.');
  const tokens = new Set<string>();
  return Promise.all(files.map(async (file) => {
    const ticket = verifyUploadTicket(file.uploadToken, ADMIN_SESSION_SECRET);
    if (ticket.purpose !== purpose || (gallery && (ticket.galleryId !== gallery.id ||
      !ticket.objectKey.startsWith(`uploads/galleries/${gallery.slug}/`)))) throw new Error('Upload does not belong to this destination.');
    if (tokens.has(ticket.objectKey)) throw new Error('Duplicate uploaded file.');
    tokens.add(ticket.objectKey);
    await verifyR2UploadedObject(ticket);
    return {
      ...file,
      url: purpose === 'inquiry' ? inquiryAttachmentUrl(ticket.objectKey) : buildPublicAssetUrl(ticket.objectKey),
      filename: path.posix.basename(ticket.objectKey),
      size: ticket.size,
      mimeType: ticket.mimeType,
    };
  }));
}

async function deleteUnreferencedMediaObject(objectKey: string) {
  if (!await isMediaAssetReferenced([buildPublicAssetUrl(objectKey), `/${objectKey}`])) await deleteR2Object(objectKey);
}

async function normalizeUploadedFile(file: {
  path: string;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}, objectKeyPrefix: string) {
  const sourcePath = file.path;

  try {
    if (isRasterImage(file.mimetype)) {
      const baseName = path.basename(file.filename, path.extname(file.filename));
      const optimizedFilename = `${baseName}.webp`;
      const objectKey = joinObjectKey(objectKeyPrefix, optimizedFilename);

      const image = sharp(sourcePath).rotate();
      const metadata = await image.metadata();
      const { data, info } = await image
        .resize({
          width: 1800,
          height: 1800,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      await uploadBufferToR2({
        body: data,
        objectKey,
        contentType: 'image/webp',
      });

      return {
        url: buildPublicAssetUrl(objectKey),
        filename: optimizedFilename,
        originalName: file.originalname,
        size: info.size,
        mimeType: 'image/webp',
        width: info.width ?? metadata.width ?? null,
        height: info.height ?? metadata.height ?? null,
      };
    }

    const objectKey = joinObjectKey(objectKeyPrefix, file.filename);

    if (file.mimetype.startsWith('image/')) {
      await uploadFileToR2({
        filePath: sourcePath,
        objectKey,
        contentType: file.mimetype,
      });

      try {
        const metadata = await sharp(sourcePath, { animated: true }).metadata();
        return {
          url: buildPublicAssetUrl(objectKey),
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
        };
      } catch {
        return {
          url: buildPublicAssetUrl(objectKey),
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          width: null,
          height: null,
        };
      }
    }

    await uploadFileToR2({
      filePath: sourcePath,
      objectKey,
      contentType: file.mimetype,
    });

    return {
      url: buildPublicAssetUrl(objectKey),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      width: null,
      height: null,
    };
  } finally {
    await rm(sourcePath, { force: true }).catch(() => undefined);
  }
}

async function createUniqueGallerySlug(name: string, excludeId?: number) {
  const baseSlug = slugifyGalleryName(name) || 'galerie';
  let slug = baseSlug;
  let attempt = 1;

  while (true) {
    const existing = await getGalleryBySlug(slug);

    if (!existing || Number(existing.id) === excludeId) {
      return slug;
    }

    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
}

function mapGalleryRecord(gallery: {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
    createdAt: Date;
  }>;
}): GalleryRecord {
  return {
    id: gallery.id,
    name: gallery.name,
    slug: gallery.slug,
    folderPath: getGalleryFolderPath(gallery.slug),
    itemCount: gallery.items.length,
    createdAt: gallery.createdAt.toISOString(),
    updatedAt: gallery.updatedAt.toISOString(),
    items: gallery.items.map((item) => ({
      id: item.id,
      url: item.url,
      filename: item.filename,
      originalName: item.originalName,
      size: item.size,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

app.get('/uploads/*', async (request, response, next) => {
  if (!isR2Configured()) {
    response.status(404).json({ message: 'File not found.' });
    return;
  }

  try {
    await proxyR2ObjectToResponse(request.path.replace(/^\/+/g, ''), response);
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/admin/session', (request, response) => {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    response.status(503).json({
      authenticated: false,
      message: 'Admin authentication is not configured on the server.',
    });
    return;
  }

  const sessionValue = parseCookies(request.headers.cookie)[ADMIN_COOKIE_NAME];

  if (!verifyAdminSessionValue(sessionValue)) {
    clearAdminSessionCookie(response, request);
    response.status(401).json({
      authenticated: false,
      message: 'Admin authentication required.',
    });
    return;
  }

  response.json({
    authenticated: true,
  });
});

app.post('/api/admin/login', loginRateLimit, (request, response) => {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    response.status(503).json({
      message: 'Admin authentication is not configured on the server.',
    });
    return;
  }

  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  if (!password) {
    response.status(400).json({
      message: 'Parola este obligatorie.',
    });
    return;
  }

  if (!timingSafeStringCompare(password, ADMIN_PASSWORD)) {
    clearAdminSessionCookie(response, request);
    response.status(401).json({
      message: 'Parola admin este incorecta.',
    });
    return;
  }

  setAdminSessionCookie(response, request);
  response.json({
    authenticated: true,
  });
});

app.post('/api/admin/logout', (request, response) => {
  clearAdminSessionCookie(response, request);
  response.json({
    success: true,
  });
});

app.get('/api/site-content', async (_request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) {
      return;
    }

    const record = await getMainSiteContent();

    if (!record) {
      response.status(404).json({ message: 'Site content not found.' });
      return;
    }

    response.json(normalizeSiteContent(record.content as SiteContent));
  } catch (error) {
    next(error);
  }
});

app.put('/api/site-content', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const payload = request.body;

    if (!isSiteContentPayload(payload)) {
      response.status(400).json({ message: 'Invalid site content payload.' });
      return;
    }

    const normalizedPayload = normalizeSiteContent(payload);
    const currentRecord = await getMainSiteContent();
    const previousObjectKeys = currentRecord
      ? collectManagedSiteContentObjectKeys(currentRecord.content)
      : new Set<string>();
    const nextObjectKeys = collectManagedSiteContentObjectKeys(normalizedPayload);
    const record = await saveMainSiteContent(normalizedPayload);

    if (isR2Configured()) {
      const removedObjectKeys = [...previousObjectKeys].filter((objectKey) => !nextObjectKeys.has(objectKey));

      if (removedObjectKeys.length > 0) {
        const deleteResults = await Promise.allSettled(
          removedObjectKeys.map(async (objectKey) => {
            // A homepage image can also be used by a product or another record.
            // Failure to prove it is unused retains the file instead of deleting it.
            await deleteUnreferencedMediaObject(objectKey);
          }),
        );

        const failedDeletes = deleteResults
          .map((result, index) => ({ result, objectKey: removedObjectKeys[index] }))
          .filter((entry): entry is {
            result: PromiseRejectedResult;
            objectKey: string;
          } => entry.result.status === 'rejected');

        if (failedDeletes.length > 0) {
          console.error(
            'Failed to delete orphaned R2 assets after site-content update:',
            failedDeletes.map((entry) => ({
              objectKey: entry.objectKey,
              reason: entry.result.reason,
            })),
          );
        }
      }
    }

    response.json(normalizeSiteContent(record.content as SiteContent));
  } catch (error) {
    next(error);
  }
});

function handleMediaUpload(request: express.Request, response: express.Response, next: express.NextFunction) {
  if (!ensureR2StorageConfigured(response)) {
    return;
  }

  const uploadedAssets = parseUploadedMediaAssets(request.body);

  if (uploadedAssets) {
    void validateUploadedAssets(uploadedAssets, 'media')
      .then((files) => response.json({ files })).catch(next);
    return;
  }

  upload.array('files', 24)(request, response, (error) => {
    if (error) {
      next(error);
      return;
    }

    const files = (
      request as express.Request & {
        files?: Array<{
          path: string;
          filename: string;
          originalname: string;
          size: number;
          mimetype: string;
        }>;
      }
    ).files ?? [];

    if (files.length === 0) {
      response.status(400).json({ message: 'No media files were uploaded.' });
      return;
    }

    void Promise.all(files.map((file) => normalizeUploadedFile(file, 'uploads')))
      .then((normalizedFiles) => {
        response.json({
          files: normalizedFiles,
        });
      })
      .catch(next);
  });
}

app.post('/api/uploads/presign', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureR2StorageConfigured(response)) {
      return;
    }

    const files = parsePresignFilesPayload(request.body);

    if (!files || files.length === 0) {
      response.status(400).json({ message: 'No files were provided for direct upload.' });
      return;
    }

    response.json({
      files: await createPresignedUploadAssets(buildUploadsObjectKey, files),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/uploads/media', requireAdminSession, handleMediaUpload);
app.post('/api/uploads/images', requireAdminSession, handleMediaUpload);

const galleryUpload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024,
    files: 48,
  },
  fileFilter: (_request, file, callback) => {
    if (!isAllowedMediaType(file.mimetype, true)) {
      callback(new Error('Only supported raster image files are allowed for galleries.'));
      return;
    }

    callback(null, true);
  },
});

app.get('/api/galleries', async (_request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) {
      return;
    }

    const galleries = await listGalleries();

    response.json(galleries.map(mapGalleryRecord));
  } catch (error) {
    next(error);
  }
});

app.post('/api/galleries', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const rawName = typeof request.body?.name === 'string' ? request.body.name.trim() : '';

    if (!rawName) {
      response.status(400).json({ message: 'Numele galeriei este obligatoriu.' });
      return;
    }

    const slug = await createUniqueGallerySlug(rawName);
    const gallery = await createGallery(rawName, slug);

    response.status(201).json(mapGalleryRecord(gallery));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/galleries/:id', requireAdminSession, async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const rawName = typeof request.body?.name === 'string' ? request.body.name.trim() : '';

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    if (!rawName) {
      response.status(400).json({ message: 'Numele galeriei este obligatoriu.' });
      return;
    }

    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const currentGallery = await getGalleryById(id);

    if (!currentGallery) {
      response.status(404).json({ message: 'Galeria nu a fost găsită.' });
      return;
    }

    const nextSlug = await createUniqueGallerySlug(rawName, id);
    const slugChanged = nextSlug !== currentGallery.slug;

    if (slugChanged && currentGallery.items.length > 0 && !ensureR2StorageConfigured(response)) {
      return;
    }

    await renameGallerySafely(currentGallery, rawName, nextSlug, {
      copy: copyR2Object, commit: renameGalleryWithItems, remove: deleteUnreferencedMediaObject,
      objectKey: buildGalleryObjectKey, assetUrl: buildPublicAssetUrl,
      reportCleanupFailure: (objectKeys) => console.error('Gallery rename committed; old files need cleanup:', objectKeys),
    });
    const updatedGallery = await getGalleryById(id);
    if (!updatedGallery) throw new Error('Updated gallery could not be reloaded from Supabase.');
    response.json(mapGalleryRecord(updatedGallery));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/galleries/:id', requireAdminSession, async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const gallery = await getGalleryById(id);

    if (!gallery) {
      response.status(404).json({ message: 'Galeria nu a fost găsită.' });
      return;
    }

    if (gallery.items.length > 0 && !ensureR2StorageConfigured(response)) {
      return;
    }

    await deleteGallery(id);

    if (gallery.items.length > 0) {
      await Promise.all(
        gallery.items.map((item) =>
          deleteUnreferencedMediaObject(buildGalleryObjectKey(gallery.slug, item.filename)),
        ),
      );
    }

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/galleries/:id/upload/presign', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response) || !ensureR2StorageConfigured(response)) {
      return;
    }

    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    const gallery = await getGalleryById(id);

    if (!gallery) {
      response.status(404).json({ message: 'Galeria nu a fost găsită.' });
      return;
    }

    const files = parsePresignFilesPayload(request.body);

    if (!files || files.length === 0) {
      response.status(400).json({ message: 'No files were provided for direct upload.' });
      return;
    }

    response.json({
      files: await createPresignedUploadAssets(
        (filename) => buildGalleryObjectKey(gallery.slug, filename),
        files,
        'gallery',
        gallery.id,
      ),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/galleries/:id/upload', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    if (!ensureR2StorageConfigured(response)) {
      return;
    }

    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    const gallery = await getGalleryById(id);

    if (!gallery) {
      response.status(404).json({ message: 'Galeria nu a fost găsită.' });
      return;
    }

    const directUploadFiles = parseUploadedMediaAssets(request.body);

    if (directUploadFiles) {
      const validatedFiles = await validateUploadedAssets(directUploadFiles, 'gallery', gallery);
      const startSortOrder = gallery.items.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), -1) + 1;

      await createGalleryItems(
        gallery.id,
        validatedFiles.map((file, index) => ({
          url: file.url,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          width: file.width,
          height: file.height,
          sortOrder: startSortOrder + index,
        })),
        gallery.slug,
      );

      response.status(201).json({
        files: validatedFiles,
      });
      return;
    }

    galleryUpload.array('files', 48)(request, response, (error) => {
      if (error) {
        next(error);
        return;
      }

      const files = (
        request as express.Request & {
          files?: Array<{
            path: string;
            filename: string;
            originalname: string;
            size: number;
            mimetype: string;
          }>;
        }
      ).files ?? [];

      if (files.length === 0) {
        response.status(400).json({ message: 'Nu au fost încărcate imagini.' });
        return;
      }

      const startSortOrder = gallery.items.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), -1) + 1;

      void Promise.all(files.map((file) => normalizeUploadedFile(file, joinObjectKey('uploads', 'galleries', gallery.slug))))
        .then(async (normalizedFiles) => {
          await createGalleryItems(
            gallery.id,
            normalizedFiles.map((file, index) => ({
              url: file.url,
              filename: file.filename,
              originalName: file.originalName,
              size: file.size,
              mimeType: file.mimeType,
              width: file.width,
              height: file.height,
              sortOrder: startSortOrder + index,
            })),
            gallery.slug,
          );

          response.status(201).json({
            files: normalizedFiles,
          });
        })
        .catch(next);
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/galleries/items/:id', requireAdminSession, async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const item = await getGalleryItemById(id);

    if (!item) {
      response.status(404).json({ message: 'Imaginea nu a fost găsită.' });
      return;
    }

    if (!ensureR2StorageConfigured(response)) {
      return;
    }

    await deleteGalleryItem(id);

    await deleteUnreferencedMediaObject(buildGalleryObjectKey(item.gallery.slug, item.filename));

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/product-categories', async (_request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) return;
    response.json(await listProductCategories());
  } catch (error) {
    next(error);
  }
});

app.get('/api/product-categories/:slug', async (request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) return;
    const category = await getProductCategoryBySlug(request.params.slug);
    if (!category) {
      response.status(404).json({ message: 'Categoria nu a fost găsită.' });
      return;
    }
    response.json(category);
  } catch (error) {
    next(error);
  }
});

app.post('/api/product-categories', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const image = typeof request.body?.image === 'string' ? request.body.image.trim() : '';
    if (!title || !image) {
      response.status(400).json({ message: 'Titlul și imaginea categoriei sunt obligatorii.' });
      return;
    }
    const baseSlug = slugifyProductCategory(title) || 'categorie';
    let slug = baseSlug;
    let suffix = 1;
    while (await getProductCategoryBySlug(slug)) slug = `${baseSlug}-${++suffix}`;
    await createProductCategory({ title, slug, image });
    response.status(201).json(await listProductCategories());
  } catch (error) {
    next(error);
  }
});

app.put('/api/product-categories/:id', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const id = Number(request.params.id);
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const image = typeof request.body?.image === 'string' ? request.body.image.trim() : '';
    if (!Number.isFinite(id) || !title || !image) {
      response.status(400).json({ message: 'Datele categoriei sunt invalide.' });
      return;
    }
    const categories = await listProductCategories();
    const current = categories.find((category) => category.id === id);
    if (!current) {
      response.status(404).json({ message: 'Categoria nu a fost găsită.' });
      return;
    }
    await updateProductCategory(id, { title, slug: current.slug, image });
    response.json(await listProductCategories());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/product-categories/:id', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }
    await deleteProductCategory(id);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

function parseProductPayload(body: unknown) {
  if (!isPlainObject(body)) return null;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = typeof body.price === 'string' ? body.price.trim() : '';
  const dimensions = typeof body.dimensions === 'string' ? body.dimensions.trim() : '';
  const images = Array.isArray(body.images)
    ? body.images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0).slice(0, 2)
    : [];
  if (!title || !description || !price || !dimensions || images.length < 1) return null;
  return { title, description, price, dimensions, images };
}

app.post('/api/product-categories/:id/products', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const categoryId = Number(request.params.id);
    const payload = parseProductPayload(request.body);
    if (!Number.isFinite(categoryId) || !payload) {
      response.status(400).json({ message: 'Completează toate câmpurile și adaugă una sau două imagini.' });
      return;
    }
    await createProduct({ categoryId, ...payload });
    response.status(201).json(await listProductCategories());
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:id', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const id = Number(request.params.id);
    const payload = parseProductPayload(request.body);
    if (!Number.isFinite(id) || !payload) {
      response.status(400).json({ message: 'Datele produsului sunt invalide.' });
      return;
    }
    await updateProduct(id, payload);
    response.json(await listProductCategories());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }
    await deleteProduct(id);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/newsletter-subscriptions', formRateLimit, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const { email } = request.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      response.status(400).json({ message: 'Email-ul este obligatoriu.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      response.status(400).json({ message: 'Formatul email-ului este invalid.' });
      return;
    }

    const existingSubscriber = await findNewsletterSubscriberByEmail(normalizedEmail);

    if (existingSubscriber) {
      response.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: 'Email-ul este deja inscris.',
      });
      return;
    }

    const subscriber = await createNewsletterSubscriber(normalizedEmail, 'footer');

    response.status(201).json({
      success: true,
      alreadySubscribed: false,
      message: 'Te-ai abonat cu succes.',
      subscriber,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/newsletter-subscriptions', requireAdminSession, async (_request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const subscribers = await listNewsletterSubscribers();

    response.json(subscribers);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/newsletter-subscriptions/:id', requireAdminSession, async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    await deleteNewsletterSubscriber(id);

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/course-subscribers', formRateLimit, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const firstName = typeof request.body?.firstName === 'string' ? request.body.firstName.trim() : '';
    const lastName = typeof request.body?.lastName === 'string' ? request.body.lastName.trim() : '';
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim() : '';
    const gdprAccepted = request.body?.gdprAccepted === true;
    const source = request.body?.source === 'course-offer' ? 'course-offer' : 'registration';
    if (!email || !gdprAccepted || (source !== 'course-offer' && (!firstName || !lastName || !phone))) {
      response.status(400).json({ message: 'Completează toate câmpurile și acceptă acordul GDPR.' });
      return;
    }
    if (firstName.length > 100 || lastName.length > 100 || email.length > 254 || phone.length > 30) {
      response.status(400).json({ message: 'Unul dintre câmpuri este prea lung.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ message: 'Adresa de email nu este validă.' });
      return;
    }
    if ((source !== 'course-offer' || phone) && !/^[+0-9\s\-()]{7,30}$/.test(phone)) {
      response.status(400).json({ message: 'Numărul de telefon nu este valid.' });
      return;
    }
    await createCourseSubscriber({ firstName, lastName, email, phone, source });
    response.status(201).json({ success: true, message: 'Înscrierea a fost înregistrată.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/course-subscribers', requireAdminSession, async (_request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    response.json(await listCourseSubscribers());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/course-subscribers/:id', requireAdminSession, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) return;
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }
    await deleteCourseSubscriber(id);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/inquiries - Fetch all inquiries
app.get('/api/inquiries', requireAdminSession, async (_request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const inquiries = await listInquiries();
    response.json(inquiries);
  } catch (error) {
    next(error);
  }
});

app.post('/api/inquiries/uploads/presign', uploadRateLimit, uploadDailyRateLimit, async (request, response, next) => {
  try {
    if (!ensurePrivateR2StorageConfigured(response)) return;
    // Reclaim expired uploads before issuing more storage. Failed deletes keep their
    // tracking row and are retried on the next upload request.
    const expiredKeys = await listExpiredInquiryUploads();
    await Promise.all(expiredKeys.map(async (key) => {
      await deletePrivateR2Object(key);
      await removePendingInquiryUpload(key);
    }));
    const files = parsePresignFilesPayload(request.body);
    if (!files || files.length < 1 || files.length > 5) {
      response.status(400).json({ message: 'Poți încărca între 1 și 5 fotografii.' });
      return;
    }
    if (files.some((file) => !isAllowedMediaType(file.mimeType, true) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_INQUIRY_IMAGE_BYTES)) {
      response.status(400).json({ message: 'Sunt acceptate doar imagini JPEG, PNG, WebP, GIF sau AVIF de maximum 15 MB fiecare.' });
      return;
    }
    response.json({
      files: await createPresignedUploadAssets(
        (filename) => joinObjectKey('inquiries', filename),
        files,
        'inquiry',
      ),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/inquiries/uploads', finalizeRateLimit, async (request, response, next) => {
  try {
    if (!ensurePrivateR2StorageConfigured(response)) return;
    const files = parseUploadedMediaAssets(request.body);
    if (!files || files.length < 1 || files.length > 5) {
      response.status(400).json({ message: 'Datele fotografiilor încărcate sunt invalide.' });
      return;
    }
    response.json({ files: await validateUploadedAssets(files, 'inquiry') });
  } catch (error) {
    next(error);
  }
});

app.get('/api/inquiries/attachments/:attachment', requireAdminSession, async (request, response, next) => {
  try {
    const objectKey = inquiryObjectKeyFromUrl(`/api/inquiries/attachments/${request.params.attachment}`);
    if (!objectKey || !await hasInquiryAttachment(objectKey)) {
      response.status(404).json({ message: 'Fotografia nu a fost găsită.' });
      return;
    }
    if (!ensurePrivateR2StorageConfigured(response)) return;
    await proxyR2ObjectToResponse(objectKey, response, true);
  } catch (error) { next(error); }
});

// POST /api/inquiries - Submit a new inquiry
app.post('/api/inquiries', formRateLimit, async (request, response, next) => {
  try {
    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const { name, firstName, lastName, email, phone, projectDetails, gdprAccepted } = request.body;
    let images = Array.isArray(request.body?.images)
      ? request.body.images.filter((image: unknown): image is string => typeof image === 'string' && image.trim().length > 0)
      : [];

    // The form sends a single full-name field; older payloads may still send
    // firstName/lastName separately. Store the name split across the existing
    // columns either way (lastName may be empty for single-word names).
    let resolvedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    let resolvedLastName = typeof lastName === 'string' ? lastName.trim() : '';

    if (typeof name === 'string' && name.trim()) {
      const tokens = name.trim().split(/\s+/);
      resolvedFirstName = tokens[0];
      resolvedLastName = tokens.slice(1).join(' ');
    }

    // Validation
    if (!resolvedFirstName) {
      response.status(400).json({ message: 'Numele este obligatoriu.' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      response.status(400).json({ message: 'Email-ul este obligatoriu.' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      response.status(400).json({ message: 'Formatul email-ului este invalid.' });
      return;
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      response.status(400).json({ message: 'Numărul de telefon este obligatoriu.' });
      return;
    }
    const phoneRegex = /^[+0-9\s-()]{7,20}$/;
    if (!phoneRegex.test(phone.trim())) {
      response.status(400).json({ message: 'Numărul de telefon este invalid.' });
      return;
    }
    if (!projectDetails || typeof projectDetails !== 'string' || !projectDetails.trim()) {
      response.status(400).json({ message: 'Detaliile lucrării sunt obligatorii.' });
      return;
    }

    if (gdprAccepted !== true) {
      response.status(400).json({ message: 'Acordul GDPR este obligatoriu.' });
      return;
    }
    if (resolvedFirstName.length > 100 || resolvedLastName.length > 200 ||
      (typeof email === 'string' && email.length > 254) ||
      (typeof projectDetails === 'string' && projectDetails.length > 10000)) {
      response.status(400).json({ message: 'Unul dintre câmpuri este prea lung.' });
      return;
    }
    if (images.length > 5) {
      response.status(400).json({ message: 'Poți atașa maximum 5 fotografii.' });
      return;
    }

    const uploadTokens = request.body?.imageUploadTokens ?? [];
    if (!Array.isArray(uploadTokens) || uploadTokens.length > 5 || (images.length > 0 && uploadTokens.length !== images.length)) {
      response.status(400).json({ message: 'Fotografiile trebuie încărcate prin formular înainte de trimitere.' });
      return;
    }
    const tickets: UploadTicket[] = uploadTokens.map((token: unknown) => verifyUploadTicket(token, ADMIN_SESSION_SECRET));
    if (tickets.some((ticket) => ticket.purpose !== 'inquiry') || new Set(tickets.map((ticket) => ticket.objectKey)).size !== tickets.length) {
      response.status(400).json({ message: 'Fotografiile atașate sunt invalide.' });
      return;
    }
    if (tickets.length && !ensurePrivateR2StorageConfigured(response)) return;
    await Promise.all(tickets.map(verifyR2UploadedObject));
    images = tickets.map((ticket) => inquiryAttachmentUrl(ticket.objectKey));

    const inquiry = await createInquiry({
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: email.trim(),
      phone: phone.trim(),
      projectDetails: projectDetails.trim(),
      status: 'Nou',
      images,
    }, tickets.map((ticket) => ticket.objectKey));

    response.status(201).json(inquiry);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/inquiries/:id - Delete an inquiry
app.delete('/api/inquiries/:id', requireAdminSession, async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (isNaN(id)) {
      response.status(400).json({ message: 'ID invalid.' });
      return;
    }

    if (!ensureSupabaseAdminConfigured(response)) {
      return;
    }

    const inquiry = await getInquiryById(id);
    if (!inquiry) {
      response.status(404).json({ message: 'Cererea nu a fost găsită.' });
      return;
    }
    const privateKeys = inquiry.images.map(inquiryObjectKeyFromUrl).filter((key): key is string => Boolean(key));
    const legacyKeys = inquiry.images.map(extractManagedObjectKeyFromUrl)
      .filter((key): key is string => Boolean(key?.startsWith('uploads/inquiries/')));
    if (privateKeys.length && !ensurePrivateR2StorageConfigured(response)) return;
    if (legacyKeys.length && !ensureR2StorageConfigured(response)) return;
    // Keep the row until every delete succeeds, so a retry still has the object keys.
    await Promise.all(privateKeys.map(deletePrivateR2Object));
    await Promise.all(legacyKeys.map(deleteR2Object));
    await deleteInquiry(id);

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

if (existsSync(distPath)) {
  app.get(['/produse', '/produse/*', '/galerie-foto', '/admin', '/admin/*'], servePage);
  app.use(express.static(distPath));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next();
      return;
    }

    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('API error:', error);

  if (error instanceof Error) {
    response.status(400).json({ message: error.message });
    return;
  }

  response.status(500).json({ message: 'Internal server error.' });
});

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  app.listen(port, () => {
    console.log(`Content API listening on http://localhost:${port}`);
  });
}

export default app;
