-- Teams: a team owns projects, has team admins/members, and projects can be
-- moved between teams by global admins.
insert into roles (id, name, description) values
  ('team_admin', 'Team Admin', 'Manages a team, its members and its projects')
on conflict (id) do nothing;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  owner_id text not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists teams_name_key on teams (name);
create unique index if not exists teams_slug_key on teams (slug);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  role text not null default 'developer' references roles (id),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_members_team_id on team_members (team_id);
create index if not exists idx_team_members_user_id on team_members (user_id);

alter table projects add column if not exists team_id uuid references teams (id) on delete set null;
create index if not exists idx_projects_team_id on projects (team_id);

drop trigger if exists set_slug_teams on teams;
create trigger set_slug_teams before insert or update of name on teams
  for each row execute function set_slug();

drop trigger if exists set_updated_at_teams on teams;
create trigger set_updated_at_teams before update on teams
  for each row execute function touch_updated_at();
