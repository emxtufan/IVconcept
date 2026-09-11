import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';

// This worker cannot use project credentials or send requests to a real service.
Object.assign(process.env, {
  DOTENV_CONFIG_PATH: path.join(tmpdir(), 'ivconcept-tests-no-env-file'),
  ADMIN_PASSWORD: 'test-password', ADMIN_SESSION_SECRET: 'test-session-secret',
  NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service', R2_ACCOUNT_ID: 'test-account', R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret', R2_BUCKET_NAME: 'test-public-bucket', R2_PRIVATE_BUCKET_NAME: 'test-private-bucket',
  R2_ENDPOINT: 'https://r2.invalid', R2_PUBLIC_BASE_URL: 'https://assets.invalid', VERCEL: '', TRUST_PROXY_HOPS: '0',
});
const { S3Client } = await import('@aws-sdk/client-s3');
const { supabaseAdmin, supabasePublic } = await import('../server/supabase.js');
let courseInsert: Record<string, unknown> | undefined;
let unavailable = false;
let mismatchSize = false;
const counters = new Map<string, number>();
const pending = new Set<string>();
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function resultBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: () => builder, eq: () => builder, order: () => builder, limit: () => builder,
    single: async () => result, maybeSingle: async () => result,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

(supabasePublic as any).from = () => { throw new Error('Unexpected public database request in offline test'); };
(supabaseAdmin as any).from = (table: string) => {
  if (table === 'course_subscribers') return { insert(values: Record<string, unknown>) {
    courseInsert = values;
    return resultBuilder({ data: { id: 1, ...values, gdpr_accepted_at: new Date().toISOString(), created_at: new Date().toISOString() }, error: null });
  } };
  if (table === 'pending_inquiry_uploads') return { insert(values: Array<{ object_key: string }>) {
    values.forEach((value) => pending.add(value.object_key));
    return resultBuilder({ data: null, error: null });
  } };
  if (table === 'inquiry_attachments') return resultBuilder({ data: null, error: null });
  throw new Error(`Unexpected database table in offline test: ${table}`);
};
(supabaseAdmin as any).rpc = (name: string, values: any) => {
  if (name === 'consume_rate_limit') {
    if (unavailable) return resultBuilder({ data: null, error: { message: 'test-only RPC unavailable' } });
    const key = `${values.p_scope}:${values.p_identity}`;
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    return resultBuilder({ data: [{ allowed: count <= values.p_limit, retry_after: 60 }], error: null });
  }
  if (name === 'expired_inquiry_uploads') return resultBuilder({ data: [], error: null });
  throw new Error(`Unexpected database RPC in offline test: ${name}`);
};
S3Client.prototype.send = (async (command: any) => {
  if (command.constructor.name === 'HeadObjectCommand') return { ContentLength: mismatchSize ? 999 : png.length, ContentType: 'image/png' };
  if (command.constructor.name === 'GetObjectCommand' && command.input.Range) return { Body: { transformToByteArray: async () => png } };
  throw new Error(`Unexpected R2 operation in offline test: ${command.constructor.name}`);
}) as any;

const { default: app } = await import('../server/index.js');
let server: http.Server;
let origin = '';
before(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
const post = (route: string, payload: unknown) => fetch(`${origin}${route}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});

test('HTTP: course offer stores the supplied full name and phone and preserves full registration', async () => {
  counters.clear();
  assert.equal((await post('/api/course-subscribers', {
    firstName: '  Ana Maria Popescu  ', phone: '  +40 (712) 345-678  ',
    email: 'Offer@example.com', gdprAccepted: true, source: 'course-offer',
  })).status, 201);
  assert.equal(courseInsert?.source, 'course-offer');
  assert.equal(courseInsert?.first_name, 'Ana Maria Popescu');
  assert.equal(courseInsert?.last_name, '');
  assert.equal(courseInsert?.phone, '+40 (712) 345-678');
  assert.equal(courseInsert?.email, 'offer@example.com');
  assert.equal((await post('/api/course-subscribers', { email: 'full@example.com', gdprAccepted: true })).status, 400);
  assert.equal((await post('/api/course-subscribers', { firstName: 'Ana', phone: '0712345678', email: 'full@example.com', gdprAccepted: true })).status, 400);
  assert.equal((await post('/api/course-subscribers', { firstName: 'Ana', lastName: 'Test', phone: '0712345678', email: 'full@example.com', gdprAccepted: true })).status, 201);
  assert.equal(courseInsert?.source, 'registration');
  assert.equal(courseInsert?.first_name, 'Ana');
  assert.equal(courseInsert?.last_name, 'Test');
  assert.equal(courseInsert?.phone, '0712345678');
});

test('HTTP: course offer requires name, phone, email and explicit consent', async () => {
  counters.clear();
  const valid = { firstName: 'Ana Popescu', phone: '0712345678', email: 'offer@example.com', gdprAccepted: true, source: 'course-offer' };
  const invalidFields = [
    { firstName: undefined }, { firstName: '  ' }, { phone: undefined }, { phone: '  ' },
    { email: undefined }, { email: 'invalid' }, { gdprAccepted: false }, { gdprAccepted: 'true' },
  ];
  for (const fields of invalidFields) {
    courseInsert = undefined;
    assert.equal((await post('/api/course-subscribers', { ...valid, ...fields })).status, 400, JSON.stringify(fields));
    assert.equal(courseInsert, undefined, 'Invalid submissions must not reach storage');
  }
});

test('HTTP: course phone validation requires 7 to 15 digits with an optional leading plus', async () => {
  counters.clear();
  const valid = { firstName: 'Ana Popescu', email: 'offer@example.com', gdprAccepted: true, source: 'course-offer' };
  for (const phone of ['()----()', '123456', '1234567890123456', '0712+345678', '++40712345678', '0712abc345678', '0712\n345678', `${'('.repeat(24)}1234567`]) {
    courseInsert = undefined;
    assert.equal((await post('/api/course-subscribers', { ...valid, phone })).status, 400, phone);
    assert.equal(courseInsert, undefined, 'Invalid phone numbers must not reach storage');
  }
  for (const phone of ['1234567', '+123456789012345']) {
    assert.equal((await post('/api/course-subscribers', { ...valid, phone })).status, 201, phone);
    assert.equal(courseInsert?.phone, phone);
  }
});

test('HTTP: incorrect admin passwords are throttled and protection failure closes the endpoint', async () => {
  counters.clear();
  for (let attempt = 0; attempt < 10; attempt += 1) assert.equal((await post('/api/admin/login', { password: 'wrong' })).status, 401);
  const limited = await post('/api/admin/login', { password: 'wrong' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  unavailable = true;
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const closed = await post('/api/course-subscribers', { email: 'offer@example.com', gdprAccepted: true, source: 'course-offer' });
    assert.equal(closed.status, 503);
    assert.equal(JSON.stringify(await closed.json()).includes('migration'), false);
  } finally { unavailable = false; console.error = originalError; }
});

test('HTTP: public presign rejects SVG and oversize uploads, signs exact size/type without an empty checksum', async () => {
  counters.clear();
  const file = { originalName: 'photo.png', mimeType: 'image/png', size: png.length };
  assert.equal((await post('/api/inquiries/uploads/presign', { files: [{ ...file, mimeType: 'image/svg+xml' }] })).status, 400);
  assert.equal((await post('/api/inquiries/uploads/presign', { files: [{ ...file, size: 16 * 1024 * 1024 }] })).status, 400);
  const response = await post('/api/inquiries/uploads/presign', { files: [file] });
  assert.equal(response.status, 200);
  const payload = await response.json();
  const signed = new URL(payload.files[0].uploadUrl);
  const signedHeaders = signed.searchParams.get('X-Amz-SignedHeaders')?.split(';') ?? [];
  assert.ok(signedHeaders.includes('content-length'));
  assert.ok(signedHeaders.includes('content-type'));
  assert.equal([...signed.searchParams.keys()].some((key) => key.toLowerCase().includes('checksum')), false);
  assert.ok(payload.files[0].asset.uploadToken);
  assert.ok(payload.files[0].asset.url.startsWith('/api/inquiries/attachments/'));
  assert.equal(pending.size, 1);
  const asset = payload.files[0].asset;
  const finalized = await post('/api/inquiries/uploads', { files: [asset] });
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).files[0].uploadToken, asset.uploadToken);
  mismatchSize = true;
  const originalError = console.error;
  console.error = () => undefined;
  try { assert.equal((await post('/api/inquiries/uploads', { files: [asset] })).status, 400); }
  finally { mismatchSize = false; console.error = originalError; }
});

test('HTTP: legacy public attachments and active files are blocked; protected attachments require login', async () => {
  for (const route of ['/uploads/old.svg', '/uploads/old.%73vg', '/uploads/inquiries/photo.png', '/uploads//inquiries/photo.png', '/uploads/%5Cinquiries%5Cphoto.png']) {
    assert.equal((await fetch(`${origin}${route}`)).status, 404);
  }
  assert.equal((await fetch(`${origin}/api/inquiries/attachments/aW5xdWlyaWVzL3Bob3RvLnBuZw`)).status, 401);
});

test('HTTP: inquiry cannot store an arbitrary external or same-origin attachment URL', async () => {
  counters.clear();
  const response = await post('/api/inquiries', {
    name: 'Ana Test', email: 'ana@example.com', phone: '0712345678', projectDetails: 'Test project', gdprAccepted: true,
    images: ['/uploads/inquiries/active.svg'], imageUploadTokens: [],
  });
  assert.equal(response.status, 400);
});

test('HTTP: authorized attachments are private and failed object deletion preserves the inquiry for retry', async () => {
  const { inquiryAttachmentUrl } = await import('../server/uploadSecurity.js');
  const objectKey = 'inquiries/retained-photo.png';
  const url = inquiryAttachmentUrl(objectKey);
  const inquiry = { id: 7, first_name: 'Ana', last_name: 'Test', email: 'ana@example.com', phone: '0712345678',
    project_details: 'Project', status: 'Nou', images: [url], gdpr_accepted: true,
    created_at: new Date().toISOString(), gdpr_accepted_at: new Date().toISOString() };
  const originalFrom = (supabaseAdmin as any).from;
  const originalSend = S3Client.prototype.send;
  const originalError = console.error;
  const actions: string[] = [];
  let deleteFails = true;
  (supabaseAdmin as any).from = (table: string) => {
    if (table === 'inquiry_attachments') return resultBuilder({ data: { object_key: objectKey }, error: null });
    if (table === 'inquiries') return {
      ...resultBuilder({ data: inquiry, error: null }),
      delete() { actions.push('delete-database-row'); return resultBuilder({ data: null, error: null }); },
    };
    throw new Error('Unexpected table in attachment test');
  };
  S3Client.prototype.send = (async (command: any) => {
    assert.equal(command.input.Bucket, 'test-private-bucket');
    if (command.constructor.name === 'GetObjectCommand') return {
      ContentType: 'image/png', ContentLength: png.length, CacheControl: 'public, max-age=31536000', Body: Readable.from(png),
    };
    if (command.constructor.name === 'DeleteObjectCommand') {
      actions.push('delete-r2-object');
      if (deleteFails) throw new Error('simulated R2 failure');
      return {};
    }
    throw new Error('Unexpected R2 operation in attachment test');
  }) as any;
  const expires = String(Date.now() + 60000);
  const cookie = `iv_admin_session=${expires}.${createHmac('sha256', 'test-session-secret').update(expires).digest('base64url')}`;
  try {
    const image = await fetch(`${origin}${url}`, { headers: { Cookie: cookie } });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('cache-control'), 'private, no-store');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(image.headers.get('content-security-policy')?.includes('sandbox'));
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    console.error = () => undefined;
    assert.equal((await fetch(`${origin}/api/inquiries/7`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 400);
    assert.deepEqual(actions, ['delete-r2-object']);
    deleteFails = false;
    assert.equal((await fetch(`${origin}/api/inquiries/7`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 200);
    assert.deepEqual(actions, ['delete-r2-object', 'delete-r2-object', 'delete-database-row']);
  } finally {
    (supabaseAdmin as any).from = originalFrom;
    S3Client.prototype.send = originalSend;
    console.error = originalError;
  }
});
