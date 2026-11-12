-- folio (portfolio): profiles, contents, guide, teams, tokens.
create extension if not exists pgcrypto;

create table if not exists profiles (
  id text primary key,
  username text not null,
  email text not null,
  firstname text not null default '',
  lastname text not null default '',
  role text not null default '',
  phone text not null default '',
  photo text,
  description text,
  gitlink text,
  linkedin text,
  resumelink text,
  show boolean not null default true,
  type text not null default 'user' check (type in ('user', 'team', 'business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_key on profiles (username);
create unique index if not exists profiles_email_key on profiles (lower(email));

create table if not exists portfolio_contents (
  user_id text primary key references profiles (id) on delete cascade,
  about jsonb not null default '{}'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  certificates jsonb not null default '[]'::jsonb,
  content_channels jsonb not null default '[]'::jsonb,
  content_works jsonb not null default '[]'::jsonb,
  collaborations jsonb not null default '[]'::jsonb,
  creator_tools jsonb not null default '[]'::jsonb,
  template text not null default 'software',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guide_content (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  title text,
  subtitle text,
  content jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  show boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists guide_content_section_key on guide_content (section);

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  name text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked boolean not null default false
);

create index if not exists api_tokens_user_idx on api_tokens (user_id);

create table if not exists folio_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references profiles (id) on delete cascade,
  slug text not null unique,
  name text not null default '',
  tagline text,
  description text,
  logo text,
  show boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists folio_team_members (
  team_id uuid not null references folio_teams (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  title text,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists folio_team_members_user_idx on folio_team_members (user_id);

create table if not exists folio_team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references folio_teams (id) on delete cascade,
  email text,
  token_hash text not null unique,
  invited_by text references profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists folio_team_invites_team_idx on folio_team_invites (team_id);
create index if not exists folio_team_invites_email_idx on folio_team_invites (lower(email));

create table if not exists folio_team_content_shares (
  team_id uuid not null references folio_teams (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  section text not null check (
    section in (
      'skills', 'projects', 'experience', 'education', 'certificates',
      'content_channels', 'content_works', 'collaborations', 'creator_tools'
    )
  ),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id, section, item_id)
);

create index if not exists folio_team_content_shares_team_idx on folio_team_content_shares (team_id);

create or replace function folio_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portfolio_contents_updated_at on portfolio_contents;
create trigger trg_portfolio_contents_updated_at before update on portfolio_contents
  for each row execute function folio_set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function folio_set_updated_at();

drop trigger if exists trg_folio_teams_updated_at on folio_teams;
create trigger trg_folio_teams_updated_at before update on folio_teams
  for each row execute function folio_set_updated_at();

drop trigger if exists trg_guide_content_updated_at on guide_content;
create trigger trg_guide_content_updated_at before update on guide_content
  for each row execute function folio_set_updated_at();
