-- Apply once before deploying the hardened backend. Safe to re-run.
-- All functions below are server-only; public forms must go through the API.

revoke insert on public.inquiries, public.newsletter_subscribers, public.course_subscribers from anon, authenticated;
drop policy if exists "Public can submit inquiries" on public.inquiries;
drop policy if exists "Public can subscribe to newsletter" on public.newsletter_subscribers;
drop policy if exists "Public can register for courses" on public.course_subscribers;

create table if not exists public.request_rate_limits (
  scope text not null,
  identity_hash text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  request_count bigint not null default 0,
  primary key (scope, identity_hash, window_start)
);
create index if not exists request_rate_limits_expiry_idx on public.request_rate_limits (expires_at);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from anon, authenticated;
grant all on public.request_rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_scope text, p_identity text, p_limit integer, p_window_seconds integer, p_global_limit integer
) returns table (allowed boolean, retry_after integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_end timestamptz;
  v_local_count bigint;
  v_global_count bigint;
begin
  if p_limit < 1 or p_global_limit < p_limit or p_window_seconds < 1 or p_window_seconds > 86400
     or length(p_scope) > 80 or length(p_identity) <> 64 then
    raise exception 'Invalid request limit parameters';
  end if;
  v_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_end := v_start + make_interval(secs => p_window_seconds);
  delete from public.request_rate_limits where expires_at < v_now - interval '1 hour';
  -- Locally denied requests do not consume the allowance of other visitors.
  -- Atomic upserts serialize concurrent calls from different serverless instances.
  insert into public.request_rate_limits as limits (scope, identity_hash, window_start, expires_at, request_count)
  values (p_scope, p_identity, v_start, v_end, 1)
  on conflict (scope, identity_hash, window_start)
  do update set request_count = least(limits.request_count + 1, p_limit + 1)
  returning request_count into v_local_count;
  if v_local_count > p_limit then
    return query select false, greatest(1, ceil(extract(epoch from v_end - v_now))::integer);
    return;
  end if;
  insert into public.request_rate_limits as limits (scope, identity_hash, window_start, expires_at, request_count)
  values (p_scope, '*', v_start, v_end, 1)
  on conflict (scope, identity_hash, window_start)
  do update set request_count = least(limits.request_count + 1, p_global_limit + 1)
  returning request_count into v_global_count;
  return query select v_local_count <= p_limit and v_global_count <= p_global_limit,
    greatest(1, ceil(extract(epoch from v_end - v_now))::integer);
end;
$$;
revoke all on function public.consume_rate_limit(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer, integer) to service_role;

create table if not exists public.inquiry_attachments (
  object_key text primary key check (object_key ~ '^inquiries/[a-zA-Z0-9._-]+$'),
  inquiry_id bigint not null references public.inquiries(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.inquiry_attachments enable row level security;
revoke all on public.inquiry_attachments from anon, authenticated;
grant all on public.inquiry_attachments to service_role;
create index if not exists inquiry_attachments_inquiry_idx on public.inquiry_attachments (inquiry_id);

create table if not exists public.pending_inquiry_uploads (
  object_key text primary key check (object_key ~ '^inquiries/[a-zA-Z0-9._-]+$'),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.pending_inquiry_uploads add column if not exists used_at timestamptz;
create index if not exists pending_inquiry_uploads_expiry_idx on public.pending_inquiry_uploads (expires_at);
alter table public.pending_inquiry_uploads enable row level security;
revoke all on public.pending_inquiry_uploads from anon, authenticated;
grant all on public.pending_inquiry_uploads to service_role;

create or replace function public.expired_inquiry_uploads(p_limit integer default 20)
returns table (object_key text)
language sql security definer set search_path = '' as $$
  select pending.object_key from public.pending_inquiry_uploads pending
  where pending.expires_at < now() and not exists (
    select 1 from public.inquiry_attachments attached where attached.object_key = pending.object_key)
  order by pending.expires_at limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.expired_inquiry_uploads(integer) from public, anon, authenticated;
grant execute on function public.expired_inquiry_uploads(integer) to service_role;

create or replace function public.create_inquiry_with_attachments(p_values jsonb, p_attachments jsonb)
returns setof public.inquiries
language plpgsql security definer set search_path = '' as $$
declare
  v_inquiry public.inquiries;
begin
  if jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) > 5 then
    raise exception 'Invalid inquiry attachments';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_attachments) key
    where not exists (select 1 from public.pending_inquiry_uploads pending
      where pending.object_key = key and pending.expires_at > now() and pending.used_at is null)) then
    raise exception 'An attachment is expired or already used';
  end if;
  insert into public.inquiries (first_name, last_name, email, phone, project_details, status, images, gdpr_accepted)
  values (p_values->>'firstName', coalesce(p_values->>'lastName', ''), p_values->>'email', p_values->>'phone',
    p_values->>'projectDetails', 'Nou', coalesce(p_values->'images', '[]'::jsonb), true)
  returning * into v_inquiry;
  -- A key can belong to exactly one inquiry. Replay causes the entire insert to roll back.
  insert into public.inquiry_attachments (object_key, inquiry_id)
  select entry #>> '{}', v_inquiry.id from jsonb_array_elements(p_attachments) entry;
  update public.pending_inquiry_uploads set used_at = now() where object_key in (select jsonb_array_elements_text(p_attachments));
  return next v_inquiry;
end;
$$;
revoke all on function public.create_inquiry_with_attachments(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_inquiry_with_attachments(jsonb, jsonb) to service_role;

create or replace function public.rename_gallery_with_items(
  p_gallery_id bigint, p_name text, p_slug text, p_previous_slug text, p_items jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
begin
  select slug into v_slug from public.galleries where id = p_gallery_id for update;
  if not found or v_slug <> p_previous_slug then raise exception 'Gallery changed. Reload and try again.'; end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) <> (select count(*) from public.gallery_items where gallery_id = p_gallery_id)
    or exists (select 1 from public.gallery_items gi where gi.gallery_id = p_gallery_id
      and not exists (select 1 from jsonb_array_elements(p_items) item where (item->>'id')::bigint = gi.id)) then
    raise exception 'Gallery images changed. Reload and try again.';
  end if;
  update public.gallery_items gi set url = item->>'url'
  from jsonb_array_elements(p_items) item
  where gi.id = (item->>'id')::bigint and gi.gallery_id = p_gallery_id;
  update public.galleries set name = p_name, slug = p_slug where id = p_gallery_id;
end;
$$;
revoke all on function public.rename_gallery_with_items(bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rename_gallery_with_items(bigint, text, text, text, jsonb) to service_role;

create or replace function public.add_gallery_items(p_gallery_id bigint, p_expected_slug text, p_files jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  select slug into v_slug from public.galleries where id = p_gallery_id for update;
  if not found or v_slug <> p_expected_slug then raise exception 'Gallery changed. Reload and try again.'; end if;
  insert into public.gallery_items (gallery_id, url, filename, original_name, size, mime_type, width, height, sort_order)
  select p_gallery_id, entry->>'url', entry->>'filename', entry->>'originalName', (entry->>'size')::integer,
    entry->>'mimeType', (entry->>'width')::integer, (entry->>'height')::integer,
    coalesce((select max(sort_order) + 1 from public.gallery_items where gallery_id = p_gallery_id), 0) + ordinal::integer - 1
  from jsonb_array_elements(p_files) with ordinality as items(entry, ordinal)
  where not exists (select 1 from public.gallery_items existing
    where existing.gallery_id = p_gallery_id and existing.filename = entry->>'filename');
end;
$$;
revoke all on function public.add_gallery_items(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.add_gallery_items(bigint, text, jsonb) to service_role;

-- Consent is always supplied explicitly by the API. Never infer it for new rows.
alter table public.inquiries alter column gdpr_accepted drop default;
alter table public.course_subscribers add column if not exists source text not null default 'registration';

create or replace function public.is_media_asset_referenced(p_urls text[])
returns boolean
language sql security definer set search_path = '' as $$
  -- Substring matching is intentionally conservative: URLs with query parameters
  -- and longer matching URLs retain the object rather than risk data loss.
  select exists (
    select 1 from unnest(p_urls) candidate(url)
    where exists (select 1 from public.site_content c where position(candidate.url in c.content::text) > 0)
      or exists (select 1 from public.product_categories c where position(candidate.url in c.image) > 0)
      or exists (select 1 from public.products p where position(candidate.url in p.images::text) > 0)
      or exists (select 1 from public.gallery_items gi where position(candidate.url in gi.url) > 0)
      or exists (select 1 from public.inquiries i where position(candidate.url in i.images::text) > 0)
  );
$$;
revoke all on function public.is_media_asset_referenced(text[]) from public, anon, authenticated;
grant execute on function public.is_media_asset_referenced(text[]) to service_role;

create or replace function public.migrate_inquiry_attachments(
  p_inquiry_id bigint, p_expected_images jsonb, p_next_images jsonb, p_object_keys text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_images jsonb;
begin
  select images into v_images from public.inquiries where id = p_inquiry_id for update;
  if not found or v_images <> p_expected_images then raise exception 'Inquiry changed; retry migration.'; end if;
  if jsonb_typeof(p_next_images) <> 'array' or jsonb_array_length(p_next_images) <> jsonb_array_length(v_images) then
    raise exception 'Invalid migrated attachment list';
  end if;
  insert into public.inquiry_attachments (object_key, inquiry_id)
  select object_key, p_inquiry_id from unnest(p_object_keys) object_key;
  update public.inquiries set images = p_next_images where id = p_inquiry_id;
  update public.pending_inquiry_uploads set used_at = now() where object_key = any(p_object_keys);
end;
$$;
revoke all on function public.migrate_inquiry_attachments(bigint, jsonb, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.migrate_inquiry_attachments(bigint, jsonb, jsonb, text[]) to service_role;
