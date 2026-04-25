# Changelog

All notable changes to Ledger are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows the build plan's phase numbering until we ship to production.

## [Unreleased] — Phase 1: Foundation

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

### Changed

- **Railway build switched from Nixpacks-with-cd-trick to a repo-root Dockerfile.** First deploy attempt failed with "Error creating build plan with Railpack" because `apps/api/railway.toml` + `cd ../..` didn't survive Railway's build context. Moved `railway.toml` to repo root, set `builder = "DOCKERFILE"`, added a Dockerfile that copies the workspace and runs the verified install/generate/build sequence. Root Directory on the Railway service must be left empty.

### Decisions

- **Seed scope:** Household #1 will include both Jaret and Sarah from day one. Sarah's `User.clerkId` remains null until Phase 5.
- **Schema addition:** `BillPaycheckOverride` table is included in the Phase 1 Prisma schema (not deferred to Phase 3) so Phase 3's bill-to-paycheck pinning is a code-only change with no migration.
- **Tailwind:** pinned to 3.4.x. v4's API churn is not worth absorbing mid-build.
- **Branch:** development on `phase-1-foundation` (renamed from the review branch).
- **Seed data:** the seed script is a deliberate placeholder that only creates Household #1 + both users. The canonical mock dataset (accounts, debts, budgets, bills, income sources, ad-hoc expenses, snapshot) ports from `design/mockups/` in a follow-up commit once the mockup numbers have been transcribed.
