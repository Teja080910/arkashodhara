-- env-manager: projects, members, environments, variables, API tokens, audit.
create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists users (
  id text primary key,
  email text not null,
  name text not null default '',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_key on users (lower(email));

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists projects_slug_key on projects (slug);

create table if not exists project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_members_user on project_members (user_id);

create table if not exists environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists idx_env_project on environments (project_id);

create table if not exists variables (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references environments (id) on delete cascade,
  key text not null,
  value text not null,
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_id, key)
);

create index if not exists idx_variables_env on variables (environment_id);

create table if not exists tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_tokens_project on tokens (project_id);

create table if not exists audit (
  id bigint generated always as identity primary key,
  action text not null,
  actor text not null,
  project text,
  env text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on audit (created_at desc);
