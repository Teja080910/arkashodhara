-- project-tracker (Pathfinder): projects, tasks, comments, docs, apks, notifications.
create extension if not exists pgcrypto;

create table if not exists roles (
  id text primary key,
  name text not null,
  description text
);

insert into roles (id, name, description) values
  ('super_admin', 'Super Admin', 'Full access to everything'),
  ('project_admin', 'Project Admin', 'Manages assigned projects'),
  ('developer', 'Developer', 'Works on assigned tasks'),
  ('tester', 'Tester', 'Creates bugs, issues, stories'),
  ('viewer', 'Viewer', 'Read-only access'),
  ('admin', 'Admin', 'Can create projects')
on conflict (id) do nothing;

create table if not exists profiles (
  id text primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'viewer' references roles (id),
  disabled boolean not null default false,
  github_id text,
  created_by text references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on profiles (lower(email));
create index if not exists profiles_github_id_idx on profiles (github_id);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  client_name text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  owner_id text not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  role text not null default 'developer' references roles (id),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_project_members_project_id on project_members (project_id);
create index if not exists idx_project_members_user_id on project_members (user_id);

create table if not exists versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  release_date date,
  status text not null default 'active' check (status in ('active', 'released', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name),
  unique (project_id, slug)
);

create index if not exists idx_versions_project_id on versions (project_id);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  color text default 'gray',
  unique (project_id, name)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  project_id uuid not null references projects (id) on delete cascade,
  version_id uuid references versions (id) on delete set null,
  title text not null,
  description text,
  type text not null default 'task' check (type in ('task', 'bug', 'story', 'issue')),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'testing', 'test_release', 'released', 'completed', 'cancelled')
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  assignee_id text references profiles (id) on delete set null,
  reporter_id text not null references profiles (id),
  due_date date,
  deleted_at timestamptz,
  deleted_by text references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_project_id on tasks (project_id);
create index if not exists idx_tasks_version_id on tasks (version_id);
create index if not exists idx_tasks_assignee_id on tasks (assignee_id);
create index if not exists idx_tasks_status on tasks (status);
create index if not exists idx_tasks_type on tasks (type);
create index if not exists idx_tasks_deleted_at on tasks (deleted_at) where deleted_at is not null;

create table if not exists task_tags (
  task_id uuid not null references tasks (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create table if not exists task_images (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  storage_path text not null,
  file_name text,
  uploaded_by text not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_task_images_task_id on task_images (task_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  message text not null check (length(btrim(message)) > 0),
  image_path text,
  file_type text,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists idx_comments_task_id on comments (task_id);

create table if not exists comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index if not exists idx_comment_reactions_comment_id on comment_reactions (comment_id);
create index if not exists idx_comment_reactions_user_id on comment_reactions (user_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  actor_id text references profiles (id) on delete set null,
  project_id uuid references projects (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  priority text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on notifications (user_id);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  user_id text references profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_project_id on activity_logs (project_id);
create index if not exists idx_activity_logs_task_id on activity_logs (task_id);

create table if not exists personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  name text not null default 'token',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_pats_user on personal_access_tokens (user_id);

create table if not exists project_apks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  uploaded_by text references profiles (id),
  number int not null,
  file_name text not null,
  size_bytes bigint not null default 0,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_apks_project on project_apks (project_id, created_at desc);

create or replace function set_apk_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number
    from project_apks where project_id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apk_number_trigger on project_apks;
create trigger apk_number_trigger before insert on project_apks
  for each row execute function set_apk_number();

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);

create table if not exists project_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  parent_id uuid references project_docs (id) on delete set null,
  title text not null default 'Untitled',
  content text not null default '',
  created_by text references profiles (id) on delete set null,
  updated_by text references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_docs_project_id on project_docs (project_id);
create index if not exists idx_project_docs_parent_id on project_docs (parent_id);

create or replace function slugify(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(lower(trim(value)), '\s+', '-', 'g'), '[^a-z0-9\-]', '', 'g');
$$;

create or replace function set_slug()
returns trigger
language plpgsql
as $$
begin
  new.slug := slugify(new.name);
  return new;
end;
$$;

drop trigger if exists set_slug_projects on projects;
create trigger set_slug_projects before insert or update of name on projects
  for each row execute function set_slug();

drop trigger if exists set_slug_versions on versions;
create trigger set_slug_versions before insert or update of name on versions
  for each row execute function set_slug();

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on profiles;
create trigger set_updated_at_profiles before update on profiles
  for each row execute function touch_updated_at();

drop trigger if exists set_updated_at_projects on projects;
create trigger set_updated_at_projects before update on projects
  for each row execute function touch_updated_at();

drop trigger if exists set_updated_at_versions on versions;
create trigger set_updated_at_versions before update on versions
  for each row execute function touch_updated_at();

drop trigger if exists set_updated_at_tasks on tasks;
create trigger set_updated_at_tasks before update on tasks
  for each row execute function touch_updated_at();

drop trigger if exists set_updated_at_comments on comments;
create trigger set_updated_at_comments before update on comments
  for each row execute function touch_updated_at();

drop trigger if exists set_updated_at_project_docs on project_docs;
create trigger set_updated_at_project_docs before update on project_docs
  for each row execute function touch_updated_at();

create sequence if not exists tasks_number_seq;
alter sequence tasks_number_seq owned by tasks.number;
alter table tasks alter column number set default nextval('tasks_number_seq');
