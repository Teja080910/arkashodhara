# Platform — shared NestJS backend for the aso projects

One NestJS codebase, deployed once per project. PostgreSQL + MinIO + Better Auth replace Supabase.
See `../MIGRATION_PLAN.md` for the full design rationale.

## Layout

```
platform/
  apps/
    auth/                  Better Auth service (central SSO, JWKS, admin)
    api/                   the shared API, one deployment per project
  libs/
    common/                env parsing, errors, exception filter
    contracts/             shared Zod schemas / types
    db/                    pg + drizzle factory
    authz/                 JWKS verifier, AuthGuard, @Public/@Roles/@CurrentUser
    storage/               MinIO client, presign helpers
  frontend/packages/
    api-client/            fetch wrapper + typed per-project APIs + realtime client
  deploy/
    docker-compose.yml     postgres, minio, minio-init, auth, 5 api services
    Dockerfile             one image, APP build arg picks auth or api
    nginx/platform.conf    per-subdomain routing
    minio/minio-init.sh    buckets + per-project service accounts
    scripts/render-env.sh  renders deploy/env/*.env from deploy/.env
    scripts/backup.sh      pg_dump all DBs + MinIO mirror
  tests/
    drawer-authz.mjs       cross-tenant / role regression checks
```

## Projects and ports

| Project | API port | Frontend port (existing) | Buckets |
|---|---|---|---|
| arkasodhara | 4101 | 3117 | — |
| drawer | 4102 | 3002 | `drawer-flow-images` |
| env-manager | 4103 | 3011 | — |
| portfolio (folio) | 4104 | 3010 | `portfolio-profile-photos` |
| project-tracker | 4105 | 3001 | `pt-task-screenshots`, `pt-avatars`, `pt-docs`, `pt-apks` |
| auth | 4100 | — | — |

Each API is its own container/process. One project crashing or restarting does not affect the others.
PostgreSQL and MinIO are shared: if either is down, everything is down (accepted trade-off).

## One-command stack (everything)

The full stack — postgres, minio, auth, the 5 APIs **and** the 5 Next.js
frontends — lives in `deploy/docker-compose.all.yml`.

```bash
cd deploy
cp env.example .env          # once: local-only secrets (DB/MinIO/tokens)
./scripts/load-env.sh        # pull project env from the Env Manager
./scripts/up.sh              # start everything (builds on first run)
./scripts/down.sh            # stop everything, keep data
./scripts/down.sh --wipe     # stop and delete DB + uploads
./scripts/up.sh --build      # force rebuild images
```

`up.sh` calls `load-env.sh` automatically when `ENV_MANAGER_EMAIL` /
`ENV_MANAGER_PASSWORD` (or `ENV_MANAGER_COOKIE`) are exported. Use
`--no-env` to skip it.

### Loading env from the Env Manager

`https://env.arkasodhara.tech` is the source of truth for per-project
configuration. `scripts/load-env.sh` reads the projects this stack needs,
merges the values into `deploy/.env`, and re-renders `deploy/env/rendered/*.env`.

```bash
export ENV_MANAGER_EMAIL=you@example.com
export ENV_MANAGER_PASSWORD='...'      # or ENV_MANAGER_COOKIE='em_session=...'

./scripts/load-env.sh                  # local stack  (be-local + fe-local)
./scripts/load-env.sh --env production # production URLs
./scripts/load-env.sh --dry-run        # show the diff, write nothing
./scripts/load-env.sh --only drawer,portfolio
```

What it pulls, per project:

| Project | backend env | frontend env |
|---|---|---|
| arkasodhara-server | `be-local` | — |
| arkasodhara | — | `fe-local` |
| drawer, portfolio, project-tracker, env-manager | `be-local` | `fe-local` |

Behaviour:

- Supabase keys and the old `ADMIN_AUTH_SECRET`/`ADMIN_CREDENTIALS` are
  skipped (replaced by the platform backend).
- Machine-local secrets (`POSTGRES_*`, `MINIO_*`, per-project S3 creds,
  `INTERNAL_SERVICE_TOKEN`, `AUTH_SECRET`) are never overwritten.
- Values containing spaces, `#`, `|` or quotes are written quoted so
  `render-env.sh` can parse `deploy/.env` without executing it.
- `deploy/.env` and `deploy/env/rendered/` are gitignored.

Ports once up:

| Service | URL |
|---|---|
| auth | http://localhost:4100 |
| APIs | 4101 arkasodhara, 4102 drawer, 4103 env-manager, 4104 portfolio, 4105 project-tracker |
| frontends | 3002 drawer, 3010 portfolio, 3005 project-tracker, 3011 env-manager, 3117 arkasodhara |
| minio | http://localhost:19000 (console :19001) |

Verify everything in one shot:

```bash
docker compose -f docker-compose.all.yml ps
for p in 4100 4101 4102 4103 4104 4105; do curl -s http://127.0.0.1:$p/health; echo; done
```

## Running locally (without Docker)

```bash
npm install
npm run build

# 1. infra
docker run -d --name local-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=platform -p 5432:5432 postgres:16-alpine
docker run -d --name local-minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=dev -e MINIO_ROOT_PASSWORD=devpassword quay.io/minio/minio server /data

# 2. schema
npm run db:generate   # drizzle-kit for the api workspace (optional; SQL migrations run at boot)

# 3. auth
PROJECT= PORT=4100 DATABASE_URL=postgres://platform:dev@localhost:5432/auth \
AUTH_SECRET=dev-secret-dev-secret-dev-secret-00 AUTH_BASE_URL=http://localhost:4100 \
AUTH_TRUSTED_ORIGINS=http://localhost:3000 npm run dev:auth

# 4. one api
PORT=4102 PROJECT=drawer DATABASE_URL=postgres://platform:dev@localhost:5432/drawer \
AUTH_ISSUER=http://localhost:4100 AUTH_JWKS_URL=http://localhost:4100/api/auth/.well-known/jwks.json \
AUTH_AUDIENCE=platform S3_ENDPOINT=http://localhost:9000 S3_BUCKET=drawer-flow-images \
S3_ACCESS_KEY=dev S3_SECRET_KEY=devpassword npm run dev:api
```

Or use the whole stack:

```bash
cd deploy
cp env.example .env      # fill in
./scripts/render-env.sh
docker compose up -d --build
```

## Auth model

- Better Auth owns users, sessions, password reset, Google OAuth, and admin roles.
- Passwords never reach the per-project APIs.
- Access tokens: RS256/EdDSA JWTs, 15 min, verified locally via JWKS (no auth DB call per request).
- Refresh: httpOnly cookie scoped to the parent domain (`.arkasodhara.tech`), so one login works across all products.
- Per-project permissions live in `app_membership` (auth DB) and in each project DB (teams, members, roles).

## Authorization model

RLS is gone. Every Supabase policy has a matching check in the service layer:

| Original (Supabase) | Replacement |
|---|---|
| `auth.uid() = owner_id` | `assertRole` / `assertFlowRole` / owner comparisons in services |
| `team_role()` / `flow_role()` RPCs | `DrawerAccessService.teamRole/flowRole` |
| `is_user_disabled()` policy | `ProjectTrackerService.assertActive` |
| Public read policies | `@Public()` controllers returning only visible rows |
| `auth.admin.*` (service role) | `/admin/*` routes on the auth service, admin-role guarded |

`tests/drawer-authz.mjs` covers the critical ones (cross-tenant read/write, viewer vs editor, anonymous access).

## Storage

- API never proxies file bytes. It returns presigned PUT/GET URLs after an authz check.
- One MinIO user per project, policy restricted to that project's bucket(s) (`deploy/minio/minio-init.sh`).
- DB stores object keys only. Public buckets are served through `files.arkasodhara.tech`.

## Realtime (project-tracker)

- `RealtimeGateway` (`apps/api/src/modules/project-tracker/realtime.gateway.ts`) speaks plain WebSocket at `/ws`.
- Auth: first message `{type:'auth', token}`; then `{type:'subscribe', topics:['comments:<taskId>']}`.
- Events are emitted from services after the DB write succeeds, via `@nestjs/event-emitter`.
- Topics: `comments:<taskId>`, `reactions:<commentId>`, `notifications:<userId>`, `project:<projectId>`.
- Frontend: `createProjectTrackerRealtime()` from `@platform/api-client`.

## Migrations

- `apps/api/migrations/<project>/NNN_*.sql`, applied at boot, tracked in `platform_migrations`.
- Better Auth schema is created by its own migration helper at auth boot.
- `app_membership` is created alongside the auth schema.

## Frontend integration

```ts
import { ApiClient, createDrawerApi } from '@platform/api-client';

const client = new ApiClient({
  baseUrl: 'https://drawer.arkasodhara.tech',   // nginx routes /api to the drawer API
  authUrl: 'https://auth.arkasodhara.tech',
});

const drawer = createDrawerApi(client);
const { flows } = await drawer.flows.list();
```

The client fetches a 15-minute JWT from the auth service using the SSO cookie, retries once on 401 after refreshing, and surfaces `ApiError` for non-2xx.

## Environment variables (API)

Required: `PROJECT`, `DATABASE_URL`, `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE`,
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

Optional: `CORS_ORIGINS`, `FEATURE_*`, `S3_PUBLIC_BASE_URL`, `SMTP_*`, `VAPID_*`, `APP_SECRET` (env-manager encryption), `RUN_MIGRATIONS`.

## Checks

```bash
npm run typecheck
npm run build
AUTH_URL=... API_URL=... node tests/drawer-authz.mjs
```

## Known gaps before production

- Documented but not implemented: SMTP-based password reset on the per-project APIs (auth service handles it), VAPID push delivery (subscriptions are stored, delivery worker not written), APK upload route (registration + public lookup implemented; direct upload uses presign).
- Ownership transfer in drawer requires resolving the target user's auth id (`/internal/users/by-email`); the API method takes `newOwnerId` but no controller route exposes it yet.
- project-tracker `/api/pt/*` routes are flat and unauthenticated-by-resource (any active user can read any project). Add project_members checks before multi-tenant use.
- nginx configs are HTTP-only stubs. Add TLS via certbot and switch `listen 443 ssl`.

## Verifying the build

```bash
npm run typecheck && npm run build
cd deploy && cp env.example .env && ./scripts/render-env.sh && docker compose up -d --build
curl localhost:4100/health   # auth
curl localhost:4102/health   # drawer
AUTH_URL=http://localhost:4100 API_URL=http://localhost:4102 node ../tests/drawer-authz.mjs
```
