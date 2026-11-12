-- Arkasodhara: contact form submissions and admin audit trail.
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_idx on contact_messages (created_at desc);

create table if not exists metrics_audit (
  id bigint generated always as identity primary key,
  actor_id text not null,
  actor_email text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists metrics_audit_created_idx on metrics_audit (created_at desc);
