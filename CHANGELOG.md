# Changelog

All notable changes to Ledger are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows the build plan's phase numbering until we ship to production.

## [0.4.0] — 2026-04-26 — Phase 4: OpenClaw Ledger agent (shipped)

Closes Phase 4 of `BUILD_PLAN.md §7`. The Ledger agent now syncs from Plaid Sandbox automatically every hour, categorizes transactions through OpenClaw's gateway, and writes to production via authenticated ingest endpoints.

**Live state after the first sync:**
- 1 of 11 accounts (TD Chequing) Plaid-linked, cursor stored
- 154 transactions in production: 9 from the seed, 144 from Plaid sandbox (5 months of historical data), 1 manually edited
- All 144 Plaid transactions classified by Ledger SOUL via `model: openclaw/ledger` — no LLM provider keys touched the codebase

### Added (this repo)

- **5 ingest endpoints** under `/api/ingest/*`, all gated by a separate `x-agent-key` header (constant-time compared against `LEDGER_AGENT_KEY` env). Distinct sub-tree from user-facing `/api/*` so rotating either secret never breaks the other:
  - `GET /api/ingest/accounts` — lists accounts (linked + unlinked) with tokens + cursors
  - `POST /api/ingest/transactions` — atomic write of categorized transactions + cursor advance, idempotent on `plaidTransactionId`
  - `POST /api/ingest/balances` — updates `Account.currentBalance` + writes `AccountBalanceSnapshot` row
  - `POST /api/ingest/liabilities` — refreshes matching `Debt` row's APR, min payment, due day
  - `POST /api/ingest/sync-log` — audit trail; the SyncLog table records every run with status, duration, errors
- **`POST /api/ingest/accounts/:id/plaid-link`** — one-time bootstrap endpoint the agent calls after Plaid `/sandbox/public_token/create` + `/item/public_token/exchange` to attach Plaid linkage to a seeded `Account` row. Refuses to touch `isManual: true` accounts.
- **`agentAuth` middleware** with constant-time key comparison + structured 401 (missing) / 403 (invalid) responses. 4 tests covering missing/wrong/valid key + cross-bleed guard verifying `x-agent-key` can't bypass `householdAuth` on user-facing routes.
- **Schema:** `Account.plaidSyncCursor String?` column (migration `20260426125711_add_plaid_sync_cursor`). Holds Plaid's cursor per account; advanced atomically with each successful POST `/api/ingest/transactions`.
- **`packages/shared-types/src/ingest.ts`** — Zod schemas + inferred TS types for every ingest request/response. Frozen contract the OpenClaw script targets.

### Added (handoff to OpenClaw)

- **`PHASE_4_OPENCLAW_HANDOFF.md`** at the repo root — 8-step spec doc the OpenClaw Claude Code agent executed against. Env vars, cron command, failure-mode table.
- **`docs/ledger-plaid-sync.mjs`** — full ~280-line Node ESM source. Three modes: default sync, `--bootstrap` (one-time sandbox setup), `--status` (read-only diagnostic). Built-in fetch only — no Plaid SDK, no npm install.
- **`docs/ledger-soul-addendum.md`** — `§LedgerX` section appended to Ledger's `SOUL.md` defining the categorization protocol (14 fixed categories, Toronto merchant shortcuts, confidence-threshold rule).

### OpenClaw side (separate repo)

Executed by the OpenClaw Claude Code agent against the handoff doc:
- Script copied to `~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs`
- 6 env vars added to `~/.openclaw/.env` (`LEDGER_API_URL`, `LEDGER_AGENT_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`, `PLAID_COUNTRY_CODES=CA`); `OPENCLAW_GATEWAY_TOKEN` already present
- `§LedgerX` section appended to `~/.openclaw/workspace/agents/ledger/SOUL.md`
- Cron registered: `0 * * * *` America/Toronto, "LedgerX Plaid Sync (hourly during dev)". Will switch to `0 4 * * *` (BUILD_PLAN's nightly cadence) once stable

### Architectural decisions

- **No LLM provider keys anywhere.** Per OpenClaw's standing rule (top of `~/.openclaw/CLAUDE.md`), categorization routes through the local gateway at `http://localhost:18789/v1/chat/completions` authed by `OPENCLAW_GATEWAY_TOKEN`. The Anthropic key originally listed in BUILD_PLAN §11 for Phase 4 is now scrapped — Phase 6's Railway-hosted co-pilot chat is a separate problem (tunnel, proxy, or carve-out key — not solving today).
- **Cursor advancement is atomic with transaction writes.** A failed POST `/api/ingest/transactions` doesn't advance the cursor, so the next sync re-pulls the same window. Idempotency on `plaidTransactionId` means re-runs produce `created: 0, updated: N` without duplicates.
- **Manual category edits stick.** Transactions where `categorySource === "user"` or `"rule"` are never overwritten by agent re-categorization. Jaret's UI corrections survive nightly syncs forever.
- **Plaid-managed account protection.** The mutation endpoints (`POST /api/accounts/manual`, `PATCH /api/accounts/:id`) refuse to touch any account where `isManual === false` — Plaid is the source of truth for those. Phase 7's Plaid Link UI will be the only way to add new linked accounts.

### Fixed during deployment

- Railway's GitHub webhook briefly failed to fire after a "Degraded Build Performance" incident, leaving production stuck on PR #3's container even though PRs #4-#6 had merged. Fixed via empty commit to `main` to push a fresh SHA past the webhook's last-seen state.

### Known follow-ups for Phase 5+

- Plaid sandbox returned ~5 months of historical data on first sync, inflating current-cycle Budget totals. Real production banks (Phase 7) won't have this artifact since Plaid only returns transactions from the link date forward.
- Only TD Chequing is bootstrapped. Re-running `--bootstrap` adds the next unlinked account; deferring this until needed to avoid sandbox-data dilution across all accounts.
- `GET /api/ingest/sync-log` doesn't exist yet (write-only audit). Phase 6's in-app health indicator will need it.

## [0.3.0] — 2026-04-25 — Phase 3: Writes + mutations (shipped)

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
