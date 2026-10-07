-- CareVest CMS: Supabase schema
-- Run this once in the Supabase SQL editor of a fresh project (Database > SQL Editor > New query > paste > Run).
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Profiles: one row per dashboard user. Role decides what they can do.
--   editor : edit content, upload documents, publish
--   admin  : editor + manage users and deploy targets
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'editor' check (role in ('admin','editor')),
  created_at  timestamptz not null default now()
);

-- Create a profile automatically for every new auth user.
-- The FIRST user ever created becomes admin; later users are editors until an admin changes them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'editor' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Content: one row per top-level unit (see SPEC.md "Database mapping").
--   key examples: page:index, page:core-mic, collection:team, figures, globals
-- ---------------------------------------------------------------------------
create table if not exists public.content (
  key          text primary key,
  draft        jsonb,
  published    jsonb,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id),
  published_at timestamptz
);

create or replace function public.touch_content()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

drop trigger if exists content_touch on public.content;
create trigger content_touch before update on public.content
  for each row execute function public.touch_content();

-- ---------------------------------------------------------------------------
-- Documents: every upload is a row; is_current marks the live file for a slot.
-- Files themselves live in Storage bucket "documents".
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  slot          text not null,
  title         text not null,
  url           text not null,
  storage_path  text,
  version_label text,
  file_size     bigint,
  is_current    boolean not null default true,
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references public.profiles(id)
);
create index if not exists documents_slot_current on public.documents (slot, is_current);

-- Only one current file per slot.
create or replace function public.single_current_document()
returns trigger language plpgsql as $$
begin
  if new.is_current then
    update public.documents set is_current = false
      where slot = new.slot and id <> new.id and is_current;
  end if;
  return new;
end $$;

drop trigger if exists documents_single_current on public.documents;
create trigger documents_single_current after insert or update of is_current on public.documents
  for each row execute function public.single_current_document();

-- ---------------------------------------------------------------------------
-- Deploy targets: the Vercel deploy hooks to call. Admins fill these in once.
--   kind = production : called when Publish is pressed
--   kind = preview    : called when "Update preview" is pressed (builds drafts)
-- ---------------------------------------------------------------------------
create table if not exists public.deploy_targets (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  kind      text not null check (kind in ('production','preview')),
  hook_url  text not null,
  site_url  text,
  enabled   boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Publish log + deploy requests
-- ---------------------------------------------------------------------------
create table if not exists public.publish_log (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('production','preview')),
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  hooks_called integer not null default 0
);

-- Calls every enabled deploy hook of the given kind through pg_net (server side, so hook URLs never reach the browser).
create or replace function public.call_deploy_hooks(p_kind text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  t record; n integer := 0;
begin
  for t in select hook_url from public.deploy_targets where kind = p_kind and enabled loop
    perform net.http_post(url := t.hook_url, body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Publish: copy every draft into published, log it, trigger production builds.
create or replace function public.publish_all(p_note text default null)
returns public.publish_log language plpgsql security definer set search_path = public as $$
declare
  rec public.publish_log;
begin
  if not public.is_editor() then
    raise exception 'Not allowed';
  end if;
  update public.content
     set published = draft, published_at = now()
   where draft is not null and (published is distinct from draft);
  insert into public.publish_log (kind, note, created_by, hooks_called)
  values ('production', p_note, auth.uid(), public.call_deploy_hooks('production'))
  returning * into rec;
  return rec;
end $$;

-- Preview: rebuild the preview site from drafts.
create or replace function public.request_preview()
returns public.publish_log language plpgsql security definer set search_path = public as $$
declare
  rec public.publish_log;
begin
  if not public.is_editor() then
    raise exception 'Not allowed';
  end if;
  insert into public.publish_log (kind, created_by, hooks_called)
  values ('preview', auth.uid(), public.call_deploy_hooks('preview'))
  returning * into rec;
  return rec;
end $$;

-- Does anything differ between draft and published? (Drives the "Unpublished changes" badge.)
create or replace function public.pending_changes()
returns table (key text, updated_at timestamptz) language sql stable as $$
  select key, updated_at from public.content where draft is distinct from published;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.content        enable row level security;
alter table public.documents      enable row level security;
alter table public.deploy_targets enable row level security;
alter table public.publish_log    enable row level security;

drop policy if exists "profiles: editors read all" on public.profiles;
create policy "profiles: editors read all" on public.profiles for select using (public.is_editor());
drop policy if exists "profiles: admins update" on public.profiles;
create policy "profiles: admins update" on public.profiles for update using (public.is_admin());
drop policy if exists "profiles: admins delete" on public.profiles;
create policy "profiles: admins delete" on public.profiles for delete using (public.is_admin());

-- Anyone (including the public build with the anon key) may read content rows,
-- but only the published column is exposed to anon through the view below.
drop policy if exists "content: editors read" on public.content;
create policy "content: editors read" on public.content for select using (public.is_editor());
drop policy if exists "content: editors write" on public.content;
create policy "content: editors write" on public.content for insert with check (public.is_editor());
drop policy if exists "content: editors update" on public.content;
create policy "content: editors update" on public.content for update using (public.is_editor());

drop policy if exists "documents: public read current" on public.documents;
create policy "documents: public read current" on public.documents for select using (true);
drop policy if exists "documents: editors insert" on public.documents;
create policy "documents: editors insert" on public.documents for insert with check (public.is_editor());
drop policy if exists "documents: editors update" on public.documents;
create policy "documents: editors update" on public.documents for update using (public.is_editor());
drop policy if exists "documents: editors delete" on public.documents;
create policy "documents: editors delete" on public.documents for delete using (public.is_editor());

drop policy if exists "deploy_targets: admins all" on public.deploy_targets;
create policy "deploy_targets: admins all" on public.deploy_targets for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "deploy_targets: editors read" on public.deploy_targets;
create policy "deploy_targets: editors read" on public.deploy_targets for select using (public.is_editor());

drop policy if exists "publish_log: editors read" on public.publish_log;
create policy "publish_log: editors read" on public.publish_log for select using (public.is_editor());

-- Public, read-only view of published content for the production build (anon key).
create or replace view public.published_content with (security_invoker = false) as
  select key, published as value, published_at from public.content where published is not null;
grant select on public.published_content to anon, authenticated;

-- Public, read-only view of DRAFT content for the preview build (anon key). The preview site is itself
-- public (noindex), so exposing drafts here adds nothing that the preview page does not already show.
create or replace view public.draft_content with (security_invoker = false) as
  select key, coalesce(draft, published) as value, updated_at from public.content where coalesce(draft, published) is not null;
grant select on public.draft_content to anon, authenticated;
grant select on public.documents to anon;

-- ---------------------------------------------------------------------------
-- Storage buckets (public read, editor write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents','documents', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict (id) do nothing;

drop policy if exists "storage: public read" on storage.objects;
create policy "storage: public read" on storage.objects for select using (bucket_id in ('documents','media'));
drop policy if exists "storage: editors upload" on storage.objects;
create policy "storage: editors upload" on storage.objects for insert with check (bucket_id in ('documents','media') and public.is_editor());
drop policy if exists "storage: editors update" on storage.objects;
create policy "storage: editors update" on storage.objects for update using (bucket_id in ('documents','media') and public.is_editor());
drop policy if exists "storage: editors delete" on storage.objects;
create policy "storage: editors delete" on storage.objects for delete using (bucket_id in ('documents','media') and public.is_editor());
