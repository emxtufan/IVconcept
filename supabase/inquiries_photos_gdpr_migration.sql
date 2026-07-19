-- Rulează o singură dată în Supabase SQL Editor.
alter table public.inquiries
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists gdpr_accepted boolean not null default true,
  add column if not exists gdpr_accepted_at timestamptz not null default timezone('utc', now());

alter table public.inquiries
  drop constraint if exists inquiries_images_limit,
  add constraint inquiries_images_limit check (
    jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 5
  );

alter table public.inquiries
  drop constraint if exists inquiries_gdpr_required,
  add constraint inquiries_gdpr_required check (gdpr_accepted = true);
