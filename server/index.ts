import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import multer from 'multer';
import sharp from 'sharp';
import { normalizeSiteContent, type SiteContent } from '../src/types/siteContent';
import { getGalleryFolderPath, slugifyGalleryName, type GalleryRecord } from '../src/types/galleries';
import {
  buildGalleryObjectKey,
  buildPublicAssetUrl,
  buildUploadsObjectKey,
  copyR2Object,
  createR2SignedUploadUrl,
  deleteR2Object,
  getR2ConfigurationErrorMessage,
  isR2Configured,
  joinObjectKey,
  proxyR2ObjectToResponse,
  uploadBufferToR2,
  uploadFileToR2,
} from './r2Storage';
import {
  createGallery,
  createGalleryItems,
  createInquiry,
  createNewsletterSubscriber,
  deleteGallery,
  deleteGalleryItem,
  deleteInquiry,
  deleteNewsletterSubscriber,
  findNewsletterSubscriberByEmail,
  getGalleryById,
  getGalleryBySlug,
  getGalleryItemById,
  getMainSiteContent,
  listGalleries,
  listInquiries,
  listNewsletterSubscribers,
  saveMainSiteContent,
  updateGallery,
  updateGalleryItemUrl,
} from './supabaseStore';
import {
  getSupabaseAdminErrorMessage,
  getSupabaseConfigurationErrorMessage,
  hasSupabaseAdminAccess,
  isSupabaseConfigured,
} from './supabase';

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

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsPath));

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
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      callback(new Error('Only image and video files are allowed.'));
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

    cookies[key] = decodeURIComponent(value);
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

  return `${baseName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
}

interface UploadedMediaAssetPayload {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
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
}>) {
  return Promise.all(
    files.map(async (file) => {
      const filename = createUploadFilename(file.originalName);
      const objectKey = objectKeyBuilder(filename);
      const { uploadUrl, cacheControl } = await createR2SignedUploadUrl({
        objectKey,
        contentType: file.mimeType,
      });

      return {
        uploadUrl,
        headers: {
          'Content-Type': file.mimeType,
          'Cache-Control': cacheControl,
        },
        asset: {
          url: buildPublicAssetUrl(objectKey),
          filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          width: null,
          height: null,
        },
      };
    }),
  );
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

app.post('/api/admin/login', (request, response) => {
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
    const record = await saveMainSiteContent(normalizedPayload);

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
    response.json({
      files: uploadedAssets,
    });
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
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image files are allowed for galleries.'));
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

    try {
      if (slugChanged) {
        for (const item of currentGallery.items) {
          const sourceKey = buildGalleryObjectKey(currentGallery.slug, item.filename);
          const destinationKey = buildGalleryObjectKey(nextSlug, item.filename);

          await copyR2Object(sourceKey, destinationKey);
        }
      }

      if (slugChanged) {
        await Promise.all(
          currentGallery.items.map((item) =>
            updateGalleryItemUrl(item.id, buildPublicAssetUrl(buildGalleryObjectKey(nextSlug, item.filename))),
          ),
        );
      }

      await updateGallery(id, {
        name: rawName,
        slug: nextSlug,
      });

      const updatedGallery = await getGalleryById(id);

      if (!updatedGallery) {
        throw new Error('Updated gallery could not be reloaded from Supabase.');
      }

      if (slugChanged) {
        await Promise.all(
          currentGallery.items.map((item) =>
            deleteR2Object(buildGalleryObjectKey(currentGallery.slug, item.filename)),
          ),
        );
      }

      response.json(mapGalleryRecord(updatedGallery));
    } catch (error) {
      if (slugChanged) {
        await Promise.all(
          currentGallery.items.map((item) =>
            deleteR2Object(buildGalleryObjectKey(nextSlug, item.filename)).catch(() => undefined),
          ),
        );
      }
      throw error;
    }
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
          deleteR2Object(buildGalleryObjectKey(gallery.slug, item.filename)),
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
      const startSortOrder = gallery.items.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), -1) + 1;

      await createGalleryItems(
        gallery.id,
        directUploadFiles.map((file, index) => ({
          url: file.url,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          width: file.width,
          height: file.height,
          sortOrder: startSortOrder + index,
        })),
      );

      response.status(201).json({
        files: directUploadFiles,
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

    await deleteR2Object(buildGalleryObjectKey(item.gallery.slug, item.filename));

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/newsletter-subscriptions', async (request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) {
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

// POST /api/inquiries - Submit a new inquiry
app.post('/api/inquiries', async (request, response, next) => {
  try {
    if (!ensureSupabaseConfigured(response)) {
      return;
    }

    const { name, firstName, lastName, email, phone, projectDetails } = request.body;

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

    const inquiry = await createInquiry({
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: email.trim(),
      phone: phone.trim(),
      projectDetails: projectDetails.trim(),
      status: 'Nou',
    });

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

    await deleteInquiry(id);

    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

if (existsSync(distPath)) {
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
