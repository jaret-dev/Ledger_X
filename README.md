# Ledger

Personal finance PWA. Mobile-first, privacy-first, built for one household.

> Phase 1 (Foundation) in progress. See `BUILD_PLAN.md` for the full roadmap and `CHANGELOG.md` for what has landed so far.

## Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS (PWA)
- **Backend:** Node + Express + TypeScript + Zod + Prisma
- **Database:** PostgreSQL
- **Monorepo:** pnpm workspaces + Turborepo
- **Hosting:** Vercel (web) · Railway (api + Postgres)
- **Agent:** Python / OpenClaw (lives in a separate repo; not in this monorepo)

## Layout

```
ledger/
├── apps/
│   ├── web/                # React + Vite + TS (PWA)                 [Phase 1]
│   └── api/                # Node + Express + TS                     [Phase 1]
├── packages/
│   ├── db/                 # Prisma schema + migrations + seed       [Phase 1]
│   └── shared-types/       # TS types + Zod schemas shared web ↔ api [Phase 1]
├── design/
│   └── mockups/            # 9 HTML files — design source of truth
├── .github/workflows/      # CI                                       [Phase 1]
├── BUILD_PLAN.md
├── CHANGELOG.md
├── LEDGER_AGENT_CONFIG.md
└── README.md
```

## Prerequisites

- Node `>=20.11` (see `.nvmrc` → 20.17.0)
- pnpm `>=9` (enabled via Corepack: `corepack enable && corepack prepare pnpm@9.12.3 --activate`)
- PostgreSQL 15+ (local or Railway)

## Local development

> Commands below will work once subsequent Phase 1 commits land the `apps/*` and `packages/*` workspaces. This README is being written ahead of the code.

```bash
# install
pnpm install

# db: apply migrations and seed the canonical mock dataset
pnpm --filter @ledger/db migrate
pnpm --filter @ledger/db seed

# run everything
pnpm dev
```

Services started by `pnpm dev`:

- `apps/api` → <http://localhost:3001>
- `apps/web` → <http://localhost:5173>

## Environment variables

Each workspace ships a `.env.example`. Copy to `.env` and fill in locally. See `BUILD_PLAN.md §11` for the full authoritative list.

## Scripts

| Command           | What it does                                       |
| ----------------- | -------------------------------------------------- |
| `pnpm dev`        | Start all workspaces in watch mode (Turbo)         |
| `pnpm build`      | Production build across all workspaces             |
| `pnpm lint`       | ESLint across all workspaces                       |
| `pnpm typecheck`  | `tsc --noEmit` across all workspaces               |
| `pnpm test`       | Vitest across all workspaces                       |
| `pnpm format`     | Prettier write                                     |
| `pnpm format:check` | Prettier check (used by CI)                      |

## Deployment

- **Vercel** (web): root directory `apps/web`, framework `Vite`, install command `pnpm install --frozen-lockfile`, build command `pnpm -C apps/web build`, output `apps/web/dist`.
- **Railway** (api + Postgres): two services. API service targets `apps/api`, runs `pnpm --filter @ledger/db migrate:deploy && pnpm -C apps/api start` on release. Postgres is a managed plugin; `DATABASE_URL` injected by Railway.
- **CI** (GitHub Actions): every PR runs `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test`. Preview deploys happen automatically on Vercel; Railway auto-deploys from `main`.

Deploy configuration and exact env vars land in subsequent Phase 1 commits.

## Guardrails

See `BUILD_PLAN.md §13`. Short version: don't redesign mockups, don't add dependencies not listed in the plan without asking, don't skip phases, don't commit `.env`.
