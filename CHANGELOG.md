# Changelog

All notable changes to Ledger are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows the build plan's phase numbering until we ship to production.

## [0.1.0] — 2026-04-25 — Phase 1: Foundation (shipped)

**Live:**
- Web: <https://ledger-x-web.vercel.app>
- API: <https://ledgerx-production.up.railway.app>
- DB: Railway-managed Postgres 16

Production hello-world renders `status: ok, db: connected, <timestamp>` end-to-end: browser → Vercel static bundle → Railway API → Postgres.

### Added

- `design/mockups/` — the 9 canonical HTML mockups (relocated from repo root) that serve as the visual source of truth for the React port in Phase 2.
- pnpm workspace + Turborepo skeleton (`package.json`, `pnpm-workspace.yaml`, `turbo.json`) with pipelines for `build`, `dev`, `lint`, `typecheck`, `test`.
- Shared tooling config: `tsconfig.base.json` (strict TS), flat ESLint config, Prettier, `.editorconfig`, `.nvmrc` pinned to Node 20.17.
- `packages/db` — Prisma schema for every §4 model plus `BillPaycheckOverride`, a `PrismaClient` singleton (hot-reload safe), and an initial migration (`20260424000000_init`) generated via `prisma migrate diff` and verified against a real Postgres.
- `packages/shared-types` — Zod schemas + inferred types shared across `apps/web` and `apps/api`; ships `HealthResponse` for Phase 1, roomy for Phase 2's additions.
- `apps/api` — Express + Zod + Prisma backend with `/api/health` returning `{status, db, timestamp}`. Includes pino-http logging, CORS, a ZodError-aware error middleware, graceful shutdown, and Vitest + supertest tests (2 passing).
- `apps/web` — Vite + React 18 + TypeScript + Tailwind 3.4 frontend. Hello-world page fetches `/api/health` through React Query, parses the response with the shared Zod schema, and renders status/db/timestamp. Phase 2 ports the mockups.
- `.github/workflows/ci.yml` — GitHub Actions CI: Postgres 16 service, pnpm + Turbo caching, Prisma migrate + drift check, then lint → typecheck → test → build on every push to `main` and every PR.
- `DEPLOYMENT.md` — step-by-step runbook for Vercel (web) and Railway (api + Postgres). Includes `apps/web/vercel.json`, repo-root `railway.toml`, and a repo-root `Dockerfile` so Railway's monorepo build is deterministic.

### Changed / fixed during deploy

- **Railway build switched from Nixpacks-with-cd-trick to a repo-root Dockerfile.** Auto-detection with pnpm workspaces + nested `railway.toml` failed with Railpack errors; a repo-root Dockerfile is deterministic.
- **`.dockerignore` no longer excludes `apps/web`.** The Dockerfile needs `apps/web/package.json` for pnpm's lockfile resolution; the file is copied but no web sources enter the runtime image.
- **Express binds to `0.0.0.0`** explicitly (not Node's default) so Railway's internal healthcheck reaches the server inside the Alpine container.
- **Migrations moved out of the container CMD** into `railway.toml`'s `preDeployCommand`. Healthcheck window (bumped to 300 s) now covers only server boot, not migrations.
- **OpenSSL installed in the Docker image** via `apk add --no-cache openssl` so Prisma's query engine finds its TLS dependency at runtime.

### Decisions

- **Seed scope:** Household #1 will include both Jaret and Sarah from day one. Sarah's `User.clerkId` remains null until Phase 5.
- **Schema addition:** `BillPaycheckOverride` table is included in the Phase 1 Prisma schema (not deferred to Phase 3) so Phase 3's bill-to-paycheck pinning is a code-only change with no migration.
- **Tailwind:** pinned to 3.4.x. v4's API churn is not worth absorbing mid-build.
- **Seed data:** the seed script currently only creates Household #1 + both users. The canonical mock dataset (accounts, debts, budgets, bills, income sources, ad-hoc expenses, snapshot) ports from `design/mockups/` as the first commit of Phase 2 — Phase 2's pages need the data anyway.

### Known gaps carried into Phase 2

- **CORS_ORIGIN only matches the production Vercel URL.** Preview deploys (`ledger-x-web-git-*.vercel.app`) will be blocked by CORS until the API accepts a regex/glob list. Phase 2 opener.
- **Canonical seed dataset.** Placeholder seed today; full dataset from mockups in Phase 2.
- **No tests on `apps/web` yet.** `pnpm test` is a no-op there. React Testing Library + Vitest lands alongside the first ported component.
