-- Drawer: flows, collaboration, teams, uploaded images.
create extension if not exists pgcrypto;

create table if not exists flows (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null default 'Untitled flow',
  graph jsonb not null default '{"nodes":[],"relations":[]}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  share_token text,
  team_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flows_owner_updated_idx on flows (owner_id, updated_at desc);
create index if not exists flows_team_updated_idx on flows (team_id, updated_at desc);
create unique index if not exists flows_share_token_key on flows (share_token) where share_token is not null;

create table if not exists flow_members (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows (id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  invited_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists flow_members_flow_email_key on flow_members (flow_id, lower(email));
create index if not exists flow_members_email_idx on flow_members (lower(email));

create table if not exists flow_activity (
  id bigint generated always as identity primary key,
  flow_id uuid not null references flows (id) on delete cascade,
  actor_id text,
  actor_email text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flow_activity_flow_created_idx on flow_activity (flow_id, created_at desc);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled team',
  owner_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_idx on teams (owner_id);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  invited_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists team_members_team_email_key on team_members (team_id, lower(email));
create index if not exists team_members_email_idx on team_members (lower(email));

alter table flows
  drop constraint if exists flows_team_id_fkey;
alter table flows
  add constraint flows_team_id_fkey foreign key (team_id) references teams (id) on delete set null;

create table if not exists team_activity (
  id bigint generated always as identity primary key,
  team_id uuid not null references teams (id) on delete cascade,
  actor_id text,
  actor_email text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_activity_team_created_idx on team_activity (team_id, created_at desc);

create table if not exists image_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  bucket text not null,
  object_key text not null,
  content_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists image_objects_bucket_key_key on image_objects (bucket, object_key);
create index if not exists image_objects_owner_idx on image_objects (owner_id);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flows_touch_updated_at on flows;
create trigger flows_touch_updated_at before update on flows
  for each row execute function touch_updated_at();

drop trigger if exists teams_touch_updated_at on teams;
create trigger teams_touch_updated_at before update on teams
  for each row execute function touch_updated_at();
