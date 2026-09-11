import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { pgcrypto } });
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/backend_security_migration.sql', import.meta.url), 'utf8');

before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(schema);
  await db.exec(migration);
});
after(async () => { await db.close(); });

test('security migration can be reapplied and blocks direct public form writes/RPC', async () => {
  await db.exec(migration);
  const { rows } = await db.query<{ can_insert: boolean; can_rpc: boolean }>(
    `select has_table_privilege('anon','public.course_subscribers','insert') as can_insert,
    has_function_privilege('anon','public.consume_rate_limit(text,text,integer,integer,integer)','execute') as can_rpc`,
  );
  assert.equal(rows[0].can_insert, false);
  assert.equal(rows[0].can_rpc, false);
});

test('a throttled source cannot drain the shared allowance', async () => {
  const consume = (identity: string) => db.query<{ allowed: boolean }>('select * from public.consume_rate_limit($1,$2,2,900,4)', ['quota-test', identity.repeat(64)]);
  const first = [];
  for (let i = 0; i < 6; i++) first.push((await consume('a')).rows[0].allowed);
  assert.deepEqual(first, [true, true, false, false, false, false]);
  assert.equal((await consume('b')).rows[0].allowed, true);
  assert.equal((await consume('b')).rows[0].allowed, true);
  assert.equal((await consume('c')).rows[0].allowed, false);
});

test('inquiry insert and attachment ownership are atomic and remain replay-safe after deletion', async () => {
  const key = 'inquiries/replay-test.png';
  await db.query('insert into public.pending_inquiry_uploads(object_key) values ($1)', [key]);
  const values = { firstName: 'Test', lastName: '', email: 'qa@example.test', phone: '0700000000', projectDetails: 'Test', images: ['/api/inquiries/attachments/test'] };
  const insert = () => db.query<{ id: number }>('select * from public.create_inquiry_with_attachments($1::jsonb,$2::jsonb)', [JSON.stringify(values), JSON.stringify([key])]);
  const { rows } = await insert();
  await assert.rejects(insert, /already used/);
  assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.inquiries')).rows[0].count, 1);
  await db.query('delete from public.inquiries where id=$1', [rows[0].id]);
  await assert.rejects(insert, /already used/);
  assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.inquiries')).rows[0].count, 0);
});

test('expired-upload cleanup does not select photos still attached to a live inquiry', async () => {
  const key = 'inquiries/retained-test.png';
  await db.query('insert into public.pending_inquiry_uploads(object_key) values ($1)', [key]);
  await db.query('select * from public.create_inquiry_with_attachments($1::jsonb,$2::jsonb)', [JSON.stringify({ firstName: 'Test', email: 'qa@example.test', phone: '0700000000', projectDetails: 'Test', images: [] }), JSON.stringify([key])]);
  await db.query("update public.pending_inquiry_uploads set expires_at = now() - interval '1 day' where object_key=$1", [key]);
  const expired = await db.query<{ object_key: string }>('select * from public.expired_inquiry_uploads(100)');
  assert.equal(expired.rows.some((entry) => entry.object_key === key), false);
});

test('gallery rename commits all URLs and rejects stale edits without partial updates', async () => {
  const gallery = (await db.query<{ id: number }>("insert into public.galleries(name,slug) values ('Before','before') returning id")).rows[0];
  const file = { url: '/uploads/galleries/before/a.png', filename: 'a.png', originalName: 'a.png', size: 123, mimeType: 'image/png', width: 10, height: 10 };
  await db.query('select public.add_gallery_items($1,$2,$3::jsonb)', [gallery.id, 'before', JSON.stringify([file])]);
  // Repeated finalization is idempotent.
  await db.query('select public.add_gallery_items($1,$2,$3::jsonb)', [gallery.id, 'before', JSON.stringify([file])]);
  const items = (await db.query<{ id: number; url: string }>('select id,url from public.gallery_items where gallery_id=$1', [gallery.id])).rows;
  assert.equal(items.length, 1);
  await db.query('select public.rename_gallery_with_items($1,$2,$3,$4,$5::jsonb)', [gallery.id, 'After', 'after', 'before', JSON.stringify([{ id: items[0].id, url: '/uploads/galleries/after/a.png' }])]);
  await assert.rejects(() => db.query('select public.rename_gallery_with_items($1,$2,$3,$4,$5::jsonb)', [gallery.id, 'Stale', 'stale', 'before', JSON.stringify(items)]), /Gallery changed/);
  assert.equal((await db.query<{ slug: string }>('select slug from public.galleries where id=$1', [gallery.id])).rows[0].slug, 'after');
  assert.equal((await db.query<{ url: string }>('select url from public.gallery_items where gallery_id=$1', [gallery.id])).rows[0].url, '/uploads/galleries/after/a.png');
});

test('media referenced by product images is retained by cleanup checks', async () => {
  const category = (await db.query<{ id: number }>("insert into public.product_categories(title,slug,image) values ('Mirrors','mirrors','/uploads/shared.png') returning id")).rows[0];
  await db.query("insert into public.products(category_id,title,price,dimensions,images) values ($1,'Mirror','10 lei','10cm',$2::jsonb)", [category.id, JSON.stringify(['/uploads/shared-product.png'])]);
  const query = (url: string) => db.query<{ referenced: boolean }>('select public.is_media_asset_referenced($1::text[]) as referenced', [[url]]);
  assert.equal((await query('/uploads/shared.png')).rows[0].referenced, true);
  assert.equal((await query('/uploads/shared-product.png')).rows[0].referenced, true);
  assert.equal((await query('/uploads/unreferenced.png')).rows[0].referenced, false);
});
