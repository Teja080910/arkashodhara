# Integration tests

These hit a live stack. Start one first:

```bash
cd deploy
cp env.example .env          # fill values
./scripts/render-env.sh
docker compose up -d
```

Then run:

```bash
AUTH_URL=http://localhost:4100 API_URL=http://localhost:4102 node tests/drawer-authz.mjs
```
