# Changelog

All notable changes to Ledger are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows the build plan's phase numbering until we ship to production.

## [Unreleased] — Phase 3: Writes + mutations

Branch: `phase-3-mutations`. Closes Phase 3 of BUILD_PLAN.

**Done-when checklist (BUILD_PLAN §6):**
- [x] All POST/PATCH/DELETE endpoints implemented with Zod validation
- [x] Every "+" button opens a working form (Budgets, Bills, Debts, Ad-Hoc, Income)
- [x] Every row can be edited via modal
- [x] Every row can be deleted with confirmation
- [x] Errors surface as toast notifications
- [x] Undo works for destructive actions (5-second window)
- [~] Optimistic updates — handled via React Query `invalidateQueries`; full optimistic patches deferred to a polish pass

### Added

- **17 mutation endpoints** on apps/api: POST/PATCH/DELETE for `/api/debts`, `/api/bills`, `/api/budgets`, `/api/income`, `/api/adhoc`; PATCH/DELETE on `/api/accounts/:id` + POST `/api/accounts/manual` (Plaid-managed accounts can't be edited via this path); PATCH `/api/transactions/:id` + POST `/api/transactions/:id/assign`. Every mutation parses the body via shared Zod schemas and verifies household ownership before touching the row.
- **Soft-delete pattern** — `isActive: false` (or `status: cancelled` for ad-hoc) preserves historical Transaction foreign keys so deletes can be undone via PATCH.
- **Toaster + Modal primitives** in `apps/web/src/components/`. Toast kinds: success (3s), error (sticky), undo (5s countdown bar with Undo action). Modal includes form primitives (`Field`, `TextInput`, `Select`, `Textarea`, `ModalActions`).
- **Mutation hooks** in `apps/web/src/api/mutations.ts` — `useCreate*`, `useUpdate*`, `useDelete*` per resource. Each invalidates relevant React Query keys plus the composite endpoints (`overview`, `networth`, `cashflow`, `sidebar`) so every page that reads affected data refreshes automatically.
- **Forms** in `apps/web/src/components/forms.tsx` — `BudgetForm`, `BillForm`, `DebtForm`, `AdHocForm`, `IncomeForm`, `AccountForm`, `TransactionEditForm`. Single file because they share so much structure.
- **Page wiring** — Budgets, Bills, Debts, AdHoc, Income each got a `+ Add` button + per-row Edit/Delete via `RowActions`; Transactions rows are clickable to open the edit modal (recategorize / hide / notes).
- **Mobile nav menu** — `+` hamburger button reveals the sidebar as a fixed overlay on <900px, with a dimmed backdrop and tap-link-to-close behaviour.
- **Live sidebar counts** — new `/api/sidebar` endpoint returns transactionsCount / debtsCount / billsCount / budgetsCount / incomeCount / adhocCount and a `netWorthTrend` ("up" | "flat" | "down") derived from the latest two snapshots. Sidebar consumes via `useSidebar()` so the chips reflect mutations live.

### Changed

- **Seed-on-deploy disabled.** Phase 2's `release` script ran `prisma migrate deploy && tsx prisma/seed.ts`. With mutations landing, the seed half of that chain would silently reset every user edit on the next push. The `release` script is now migrate-only; the standalone `seed` script remains for fresh-environment use.
- **Sidebar footer** label flipped from "Phase 1 · Mock data · seeded" to "Phase 3 · Mutations · live" so the visible label tracks the current build state.

### Known gaps deferred to Phase 4 opener

- **Optimistic updates** — currently invalidate-then-refetch instead of patch-the-cache-eagerly. Snappier but more code; punt until any specific mutation feels sluggish.
- **`/api/transactions/:id/assign` UI** — the endpoint exists; the frontend currently only exposes recategorize/hide/notes. Pin-to-bill / pin-to-debt UX lands when the mockup's `assign` interaction is needed.
- **Optimistic delete with undo** — undo currently triggers a server round-trip. Could be wholly client-side with snapshot rollback once we have a shape for that.
- **Web component tests** — still empty. First mutation form is a natural target.

## [0.2.0] — 2026-04-25 — Phase 2: Read-only frontend + API (shipped)

Branch: `phase-2-pages`. Closes Phase 2 of BUILD_PLAN.

**Done-when checklist (BUILD_PLAN §5):**
- [x] All 9 pages implemented as React routes
- [x] Every page fetches from `/api/*` and renders the same content as the mockup
- [x] Mobile responsive at 380px (sidebar collapses, grids restack)
- [x] Navigation between pages works (React Router v6)
- [x] Loading + error states handled on every page (`<PageState>` wrapper)
- [ ] Lighthouse ≥90 (untested in this PR — measure after merge to production)

### Added

- **Canonical seed dataset.** Transcribed every account, debt, bill, budget, income source, ad-hoc expense, and net worth snapshot from `design/mockups/` into `packages/db/prisma/seed.ts`. Seed re-runs on every Railway deploy (idempotent — disabled at the start of Phase 3 when mutations land).
- **Design system port.** CSS variables for all mockup tokens (--bg, --ink, --accent variants, --line, --danger, --success). Tailwind config overrides colors / fontFamily / borderRadius so engineers reach for design-system utilities. Three Google Fonts loaded: Fraunces (display), JetBrains Mono (data + labels with tabular-nums), Inter Tight (body).
- **App shell.** `AppLayout` (sidebar 220px + max-w 1400px main), `Sidebar` (View / Manage sections, italic-serif "l" wordmark in burnt orange), `TopBar` (page title + italic subtitle + right-side meta, stacks on mobile).
- **Stub auth on the API.** `householdAuth` middleware reads `x-household-id` header, looks up the Household, attaches to `req`. `/api/health` bypasses auth so Railway's healthcheck still works. 5 middleware tests passing.
- **13 read endpoints.** Overview, Cash Flow (90-day projection + events), Transactions (paginated, filtered, faceted), Transactions Summary, Debts + Payoff Scenarios (avalanche / snowball / minimums amortization engine), Bills (grouped by category), Budgets (cycle math + recent transactions per envelope), Income (sources + 30d upcoming + 6mo projection), Ad-Hoc (time-bucketed), Net Worth (current + history + assets + liabilities), Allocation, Milestones.
- **Shared services in `apps/api/src/services/`:** `dates.ts` (UTC date helpers, biweekly/monthly projection, day-of-month clamping), `cycle.ts` (current paycheck cycle, frequency normalization), `payoff.ts` (debt amortization engine for the 3 scenarios).
- **Shared Zod schemas in `@ledger/shared-types`** for every endpoint's request + response shape. The API parses outgoing payloads with `.parse()` and the frontend gets compile-time types from `z.infer<>`. One contract, two consumers.
- **9 page implementations** porting each mockup file with live data via React Query hooks. Reusable UI primitives (`StatCard`, `StatGrid`, `Panel`, `BarTag`, `ProgressBar`, `StatusPill`, `PageState`, `MoneyAmount`) grouped in `components/ui.tsx`.

### Fixed

- TopBar squeeze on mobile — title + meta now stack vertically below 900px so long subtitles like "known one-offs" don't word-break across the right column.

### Known gaps carried into Phase 3

- **Mobile nav menu.** Sidebar hides at <900px but no replacement (hamburger / drawer) yet. Each page renders fine in isolation; navigation requires the URL bar on mobile.
- **Sidebar nav counts** are still hardcoded placeholders (`—` / `90d` / `↗`). Wiring them to live data needs a single shared header query — postponed to alongside the Phase 3 mutation invalidation work.
- **Lighthouse not measured.** Will profile after Phase 2 merges to production.
- **No web component tests yet.** `apps/web/test` is empty — landing alongside the first mutation in Phase 3 when there's user-facing logic worth testing.

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
