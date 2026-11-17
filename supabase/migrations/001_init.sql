-- Baton, Round 3 (improvement 2): real accounts, shared handovers, permissions enforced by Postgres.
--
-- The rule: the database decides who sees what. A chunk's visibility is copied from its source by a
-- trigger (the browser cannot mislabel it), and row-level security means a successor's queries never
-- return leads-only rows: not in the app, not through the API, not to the LLM function.

create extension if not exists pgcrypto;

do $$ begin
  create type public.member_role as enum ('reviewer', 'leaver', 'successor');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tables

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  people jsonb not null default '{}'::jsonb,        -- display names: leaver, successor, reviewer
  workstreams jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.invites (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  project_id uuid not null references public.projects (id) on delete cascade,
  role public.member_role not null,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

-- Reviewer/leaver working state: reviews (with the source text they rest on), interview answers,
-- manual claims, audit log, LLM proposal cache. May quote leads-only text, so never readable by a successor.
create table if not exists public.project_state (
  project_id uuid primary key references public.projects (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- What the successor writes: acknowledgements and questions.
create table if not exists public.successor_state (
  project_id uuid primary key references public.projects (id) on delete cascade,
  acks jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  project_id uuid not null references public.projects (id) on delete cascade,
  id text not null,
  visibility text not null check (visibility in ('team', 'leads')),
  data jsonb not null,                               -- name, kind, url, importedAt, redactions, syncs
  primary key (project_id, id)
);

create table if not exists public.chunks (
  project_id uuid not null,
  id text not null,
  source_id text not null,
  visibility text not null default 'leads' check (visibility in ('team', 'leads')),
  data jsonb not null,                               -- author, ts, text, ref, url, task, key
  primary key (project_id, id),
  foreign key (project_id, source_id) references public.sources (project_id, id) on delete cascade
);
create index if not exists chunks_source_idx on public.chunks (project_id, source_id);

-- Published handover versions. 'full' = the reviewer's copy; 'team' = the successor's copy with
-- leads-only evidence removed. Written only by the server function api/publish (service role),
-- which splits them using the visibility stored in this database, not what the browser says.
create table if not exists public.published (
  project_id uuid not null references public.projects (id) on delete cascade,
  version int not null check (version > 0),
  visibility text not null check (visibility in ('full', 'team')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (project_id, version, visibility)
);

-- ---------------------------------------------------------------- helpers

-- The caller's role in a project (null if not a member). security definer so policies can use it
-- without recursing into members' own policy.
create or replace function public.role_in(p uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.members where project_id = p and user_id = auth.uid()
$$;

-- New project: creator becomes its reviewer; empty state rows are created.
create or replace function public.on_project_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (project_id, user_id, role, display_name)
  values (new.id, new.created_by, 'reviewer', coalesce(new.people ->> 'reviewer', ''))
  on conflict do nothing;
  insert into public.project_state (project_id) values (new.id) on conflict do nothing;
  insert into public.successor_state (project_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists project_created on public.projects;
create trigger project_created after insert on public.projects
  for each row execute function public.on_project_created();

-- A chunk always takes its source's visibility, whatever the client sent.
create or replace function public.chunk_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select visibility into new.visibility from public.sources
   where project_id = new.project_id and id = new.source_id;
  if new.visibility is null then raise exception 'chunk % has no source', new.id; end if;
  return new;
end $$;
drop trigger if exists chunk_visibility on public.chunks;
create trigger chunk_visibility before insert or update on public.chunks
  for each row execute function public.chunk_visibility();

-- Changing a source's visibility re-labels all of its chunks in the same transaction.
create or replace function public.source_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visibility is distinct from old.visibility then
    update public.chunks set visibility = new.visibility
     where project_id = new.project_id and source_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists source_visibility on public.sources;
create trigger source_visibility after update on public.sources
  for each row execute function public.source_visibility();

-- Join a project with an invite link. Returns the project id.
create or replace function public.accept_invite(invite_token text, name text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into inv from public.invites where token = invite_token for update;
  if inv.token is null then raise exception 'This invite link is not valid.'; end if;
  if inv.used_by is not null and inv.used_by <> auth.uid() then raise exception 'This invite link has already been used.'; end if;
  if inv.expires_at < now() then raise exception 'This invite link has expired. Ask for a new one.'; end if;
  insert into public.members (project_id, user_id, role, display_name)
  values (inv.project_id, auth.uid(), inv.role, coalesce(name, ''))
  on conflict (project_id, user_id) do nothing;   -- an existing member keeps their role
  update public.invites set used_by = auth.uid(), used_at = now() where token = invite_token;
  return inv.project_id;
end $$;

-- ---------------------------------------------------------------- row-level security

alter table public.projects enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.project_state enable row level security;
alter table public.successor_state enable row level security;
alter table public.sources enable row level security;
alter table public.chunks enable row level security;
alter table public.published enable row level security;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select using (public.role_in(id) is not null or created_by = auth.uid());
drop policy if exists projects_create on public.projects;
create policy projects_create on public.projects for insert with check (created_by = auth.uid());
drop policy if exists projects_edit on public.projects;
create policy projects_edit on public.projects for update using (public.role_in(id) = 'reviewer');
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (public.role_in(id) = 'reviewer');

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (public.role_in(project_id) is not null);
drop policy if exists members_remove on public.members;
create policy members_remove on public.members for delete using (public.role_in(project_id) = 'reviewer' and user_id <> auth.uid());

drop policy if exists invites_reviewer on public.invites;
create policy invites_reviewer on public.invites for all
  using (public.role_in(project_id) = 'reviewer') with check (public.role_in(project_id) = 'reviewer');

drop policy if exists state_read on public.project_state;
create policy state_read on public.project_state for select using (public.role_in(project_id) in ('reviewer', 'leaver'));
drop policy if exists state_write on public.project_state;
create policy state_write on public.project_state for update using (public.role_in(project_id) in ('reviewer', 'leaver'));

drop policy if exists succ_read on public.successor_state;
create policy succ_read on public.successor_state for select using (public.role_in(project_id) is not null);
drop policy if exists succ_write on public.successor_state;
create policy succ_write on public.successor_state for update using (public.role_in(project_id) is not null);

drop policy if exists sources_read on public.sources;
create policy sources_read on public.sources for select using (
  public.role_in(project_id) in ('reviewer', 'leaver')
  or (public.role_in(project_id) = 'successor' and visibility = 'team'));
drop policy if exists sources_write on public.sources;
create policy sources_write on public.sources for all
  using (public.role_in(project_id) = 'reviewer') with check (public.role_in(project_id) = 'reviewer');

drop policy if exists chunks_read on public.chunks;
create policy chunks_read on public.chunks for select using (
  public.role_in(project_id) in ('reviewer', 'leaver')
  or (public.role_in(project_id) = 'successor' and visibility = 'team'));
drop policy if exists chunks_write on public.chunks;
create policy chunks_write on public.chunks for all
  using (public.role_in(project_id) = 'reviewer') with check (public.role_in(project_id) = 'reviewer');

drop policy if exists published_read on public.published;
create policy published_read on public.published for select using (
  public.role_in(project_id) in ('reviewer', 'leaver')
  or (public.role_in(project_id) = 'successor' and visibility = 'team'));
-- no insert/update policy: only the server function (service role) writes published versions

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.role_in(uuid) to authenticated;
