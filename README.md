# Arkasodhara — site

Marketing site and admin console for **Arkasodhara**, built with **Next.js 14**,
**Tailwind CSS** and **Framer Motion**.

This repository contains the site only. The backend and deployment live in
separate repositories:

| Repo | Purpose |
| --- | --- |
| `arkasodhara` (this) | Next.js site + `/admin` UI |
| `arkasodhara-server` | NestJS platform: auth, contact form, project APIs |
| `arkasodhara-docker` | Compose stack, Dockerfiles, nginx, deploy scripts |

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local`:

```bash
AUTH_URL=http://localhost:4100
NEXT_PUBLIC_AUTH_URL=http://localhost:4100
ADMIN_EMAILS=you@example.com
ADMIN_SERVERS="local|This server|local"
```

`AUTH_URL` is only used by server-side routes. `ADMIN_EMAILS` is the admin
allow-list for `/admin`.

## Admin

`/admin` signs in through the auth service and shows server/container metrics.
Access is granted when the auth user has `role = "admin"` or their email is in
`ADMIN_EMAILS`.

## Production

```bash
npm run build
npm start
```

Production runs in Docker from the [`arkasodhara-docker`](../arkasodhara-docker)
repo. That repo owns the Compose file, Dockerfiles, nginx configs, env examples
and deploy script.
