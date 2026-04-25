# Ledger — deployment runbook

Phase 1 deploys: `apps/web` on Vercel, `apps/api` + managed Postgres on Railway. Both repos auto-deploy from `main`; Vercel produces a preview URL for every PR.

Jaret does the dashboard clicking; this doc lists exactly what to enter.

---

## 1. Railway (apps/api + Postgres)

### One-time setup

1. Sign in to Railway → **New Project** → **Deploy from GitHub repo** → pick `jaret-dev/Ledger_X`.
2. **Leave Root Directory empty / unset** — Railway must build from the repo root so the pnpm workspace resolves. The `Dockerfile` and `railway.toml` at the repo root tell Railway exactly what to do.
3. (Optional but recommended) In the API service's **Settings → Source**, set **Watch Paths** to `apps/api/**,packages/**,pnpm-lock.yaml,package.json,turbo.json,Dockerfile,railway.toml` so unrelated changes (mockups, web, docs) don't trigger redeploys.
4. In the same project, click **New** → **Database** → **Add PostgreSQL**. Railway creates the DB and provisions a `DATABASE_URL` environment variable.
5. In the API service's **Variables** tab, **link** `DATABASE_URL` from the Postgres service (dropdown → pick the Postgres plugin's `DATABASE_URL`). Then add the rest below.

### Environment variables (API service)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | *linked from Postgres service* | Auto-injected once linked |
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | Railway overrides to its own `$PORT`; our server reads `env.PORT` which defaults if unset |
| `CORS_ORIGIN` | `https://<your-vercel-domain>` | Comma-separate to allow previews: `https://ledger.vercel.app,https://ledger-*.vercel.app` |
| `LEDGER_AGENT_KEY` | `<openssl rand -hex 32>` | Reused in Phase 4 by the OpenClaw agent |

Later phases add `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `PLAID_*` — see `BUILD_PLAN §11`.

### Deploy triggers

Railway auto-deploys on every push to `main` (or whichever branch is configured under **Settings → Source**). The container is built from `Dockerfile` at the repo root, then the `CMD` runs migrations before the server comes up:

```
pnpm --filter @ledger/db exec prisma migrate deploy && pnpm --filter @ledger/api start
```

If a migration fails, the new revision does not receive traffic — Railway keeps routing to the previous version. Check the **Deployments** tab for logs.

### Healthcheck

Railway hits `/api/health` every 30 s. Expected response:

```json
{ "status": "ok", "db": "connected", "timestamp": "2026-04-24T04:00:00.000Z" }
```

If `db` is ever `disconnected`, the service is up but Postgres is unreachable — check the Postgres plugin's **Metrics** and **Logs** tabs.

---

## 2. Vercel (apps/web)

### One-time setup

1. Sign in to Vercel → **Add New** → **Project** → import `jaret-dev/Ledger_X`.
2. In the **Configure Project** step:
   - **Root Directory** → `apps/web`
   - **Framework Preset** → Vite (should auto-detect via `vercel.json`)
   - Leave install/build commands as defaults — `vercel.json` overrides them to run `pnpm install` + `pnpm build --filter @ledger/web` from the monorepo root so workspace deps resolve correctly.
3. **Environment Variables** → add `VITE_API_URL` set to the Railway API's public URL (e.g. `https://ledger-api.up.railway.app`). Apply to **Production**, **Preview**, and **Development**.

### Preview deploys

Every PR gets a unique preview URL. To let the API accept its origin, include the Vercel preview wildcard in Railway's `CORS_ORIGIN` — `https://ledger-*-jaret-dev.vercel.app` (your exact pattern depends on the team slug shown in Vercel's preview URLs).

Later phases will add `VITE_CLERK_PUBLISHABLE_KEY` (Phase 5).

---

## 3. GitHub secrets (CI)

CI does not need any production secrets — it spins up a disposable Postgres service container and tests against it. No action required on GitHub beyond allowing Actions on the repo (default).

---

## 4. Local development mirror

Production configs are designed to be reproduced locally without drift:

```bash
# 1. Postgres (e.g. via Docker)
docker run -d --name ledger-pg -p 5432:5432 \
  -e POSTGRES_USER=ledger -e POSTGRES_PASSWORD=ledger -e POSTGRES_DB=ledger \
  postgres:16-alpine

# 2. Environments
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env

# 3. DB + seed
pnpm install
pnpm --filter @ledger/db generate
pnpm --filter @ledger/db migrate:deploy
pnpm --filter @ledger/db seed

# 4. Run everything
pnpm dev
```

Open <http://localhost:5173> — the hello-world page should display `status: ok`, `db: connected`.

---

## 5. Smoke test after first production deploy

1. Open Vercel preview URL in a browser.
2. Expect to see `status: ok` and `db: connected` rendered.
3. In the browser devtools Network tab, confirm the request to `https://<railway-api>.up.railway.app/api/health` returns 200 and the CORS response headers are present.
4. If anything is off, check:
   - Railway **Logs** for the API service — pino pretty output will show the request and any errors
   - Postgres plugin **Logs** for connection errors
   - Vercel **Deployments** → **Runtime Logs** for client-side errors (rare on a static build)

When this smoke test passes, tell Jaret to confirm visually and Phase 1 is done.
