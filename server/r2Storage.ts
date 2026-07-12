import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type express from 'express';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim() ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME?.trim() ?? '';
const R2_ENDPOINT = process.env.R2_ENDPOINT?.trim() || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL?.trim() ?? '').replace(/\/+$/g, '');
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const REQUIRED_R2_ENV_NAMES = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

const hasR2Config = REQUIRED_R2_ENV_NAMES.every((name) => {
  switch (name) {
    case 'R2_ACCOUNT_ID':
      return Boolean(R2_ACCOUNT_ID);
    case 'R2_ACCESS_KEY_ID':
      return Boolean(R2_ACCESS_KEY_ID);
    case 'R2_SECRET_ACCESS_KEY':
      return Boolean(R2_SECRET_ACCESS_KEY);
    case 'R2_BUCKET_NAME':
      return Boolean(R2_BUCKET_NAME);
    default:
      return false;
  }
}) && Boolean(R2_ENDPOINT);

const r2Client = hasR2Config
  ? new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

function stripLeadingSlashes(value: string) {
  return value.replace(/^\/+/g, '');
}

function stripSearchAndHash(value: string) {
  return value.split(/[?#]/, 1)[0] ?? value;
}

export function joinObjectKey(...segments: string[]) {
  return segments
    .flatMap((segment) => segment.split('/'))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function buildUploadsObjectKey(filename: string) {
  return joinObjectKey('uploads', filename);
}

export function buildGalleryObjectKey(slug: string, filename: string) {
  return joinObjectKey('uploads', 'galleries', slug, filename);
}

export async function createR2SignedUploadUrl({
  objectKey,
  contentType,
  expiresInSeconds = 60 * 10,
  cacheControl = IMMUTABLE_CACHE_CONTROL,
}: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
  cacheControl?: string;
}) {
  const client = requireR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: stripLeadingSlashes(objectKey),
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    cacheControl,
  };
}

export function buildPublicAssetUrl(objectKey: string) {
  const normalizedKey = stripLeadingSlashes(objectKey);

  if (R2_PUBLIC_BASE_URL) {
    return `${R2_PUBLIC_BASE_URL}/${normalizedKey}`;
  }

  return `/${normalizedKey}`;
}

export function extractManagedObjectKeyFromUrl(assetUrl: string) {
  const normalizedUrl = stripSearchAndHash(assetUrl.trim());

  if (!normalizedUrl) {
    return null;
  }

  if (normalizedUrl.startsWith('/')) {
    const objectKey = stripLeadingSlashes(normalizedUrl);
    return objectKey.startsWith('uploads/') ? objectKey : null;
  }

  if (R2_PUBLIC_BASE_URL && normalizedUrl.startsWith(`${R2_PUBLIC_BASE_URL}/`)) {
    const objectKey = stripLeadingSlashes(normalizedUrl.slice(R2_PUBLIC_BASE_URL.length));
    return objectKey.startsWith('uploads/') ? objectKey : null;
  }

  return null;
}

export function getR2ConfigurationErrorMessage() {
  return `Cloudflare R2 is not configured. Add ${REQUIRED_R2_ENV_NAMES.join(', ')} to your environment.`;
}

export function isR2Configured() {
  return Boolean(r2Client);
}

function requireR2Client() {
  if (!r2Client || !R2_BUCKET_NAME) {
    throw new Error(getR2ConfigurationErrorMessage());
  }

  return r2Client;
}

function buildCopySource(objectKey: string) {
  const encodedKey = stripLeadingSlashes(objectKey)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${R2_BUCKET_NAME}/${encodedKey}`;
}

function isObjectMissingError(error: unknown) {
  return error instanceof S3ServiceException &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404);
}

export async function uploadBufferToR2({
  body,
  objectKey,
  contentType,
  cacheControl = IMMUTABLE_CACHE_CONTROL,
}: {
  body: Buffer;
  objectKey: string;
  contentType: string;
  cacheControl?: string;
}) {
  const client = requireR2Client();

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: stripLeadingSlashes(objectKey),
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
}

export async function uploadFileToR2({
  filePath,
  objectKey,
  contentType,
  cacheControl = IMMUTABLE_CACHE_CONTROL,
}: {
  filePath: string;
  objectKey: string;
  contentType: string;
  cacheControl?: string;
}) {
  const client = requireR2Client();

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: stripLeadingSlashes(objectKey),
    Body: createReadStream(filePath),
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
}

export async function copyR2Object(sourceKey: string, destinationKey: string) {
  const client = requireR2Client();

  await client.send(new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: stripLeadingSlashes(destinationKey),
    CopySource: buildCopySource(sourceKey),
  }));
}

export async function deleteR2Object(objectKey: string) {
  const client = requireR2Client();

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: stripLeadingSlashes(objectKey),
    }));
  } catch (error) {
    if (isObjectMissingError(error)) {
      return;
    }

    throw error;
  }
}

export async function proxyR2ObjectToResponse(objectKey: string, response: express.Response) {
  const client = requireR2Client();

  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: stripLeadingSlashes(objectKey),
    }));

    if (result.ContentType) {
      response.setHeader('Content-Type', result.ContentType);
    }

    if (typeof result.ContentLength === 'number') {
      response.setHeader('Content-Length', String(result.ContentLength));
    }

    if (result.CacheControl) {
      response.setHeader('Cache-Control', result.CacheControl);
    }

    if (result.ETag) {
      response.setHeader('ETag', result.ETag);
    }

    if (result.LastModified) {
      response.setHeader('Last-Modified', result.LastModified.toUTCString());
    }

    if (!result.Body) {
      response.status(404).json({ message: 'File not found.' });
      return;
    }

    if (result.Body instanceof Readable) {
      result.Body.on('error', (error) => {
        console.error('R2 stream error:', error);
        if (!response.headersSent) {
          response.status(500).end();
          return;
        }

        response.end();
      });

      result.Body.pipe(response);
      return;
    }

    if (typeof result.Body.transformToByteArray === 'function') {
      const body = await result.Body.transformToByteArray();
      response.end(Buffer.from(body));
      return;
    }

    response.status(500).json({ message: 'Unsupported R2 response body.' });
  } catch (error) {
    if (isObjectMissingError(error)) {
      response.status(404).json({ message: 'File not found.' });
      return;
    }

    throw error;
  }
}
