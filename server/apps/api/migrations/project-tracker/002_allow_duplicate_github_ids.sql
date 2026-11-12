
-- GitHub IDs were not unique in the legacy tracker, so don't enforce it.
drop index if exists profiles_github_id_key;
create index if not exists profiles_github_id_idx on profiles (github_id);
