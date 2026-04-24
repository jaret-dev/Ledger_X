# @ledger/db

Prisma schema, migrations, generated client, and seed for Ledger.

## Setup (first time)

```bash
# 1. copy env template and point DATABASE_URL at a running Postgres
cp .env.example .env

# 2. generate the Prisma client + apply initial migration
pnpm --filter @ledger/db generate
pnpm --filter @ledger/db migrate    # creates prisma/migrations/<ts>_init/

# 3. seed the canonical mock dataset
pnpm --filter @ledger/db seed
```

## Daily use

| Command | When |
|---|---|
| `pnpm --filter @ledger/db generate` | After editing `schema.prisma` |
| `pnpm --filter @ledger/db migrate` | After editing `schema.prisma`, to create + apply a new dev migration |
| `pnpm --filter @ledger/db migrate:deploy` | In CI / production — applies pending migrations without generating new ones |
| `pnpm --filter @ledger/db migrate:reset` | Drops the DB and re-applies all migrations + seed |
| `pnpm --filter @ledger/db studio` | Browse/edit rows in the Prisma Studio GUI |
| `pnpm --filter @ledger/db seed` | Re-run the seed (idempotent) |

## Schema

The schema lives in `prisma/schema.prisma` and is the source of truth. Any change must first be discussed with Jaret per BUILD_PLAN §13. See §4 of the build plan for conventions (Decimal amounts, positive=outflow, `@db.Date` for dates, nullable Plaid fields).

## Using the client elsewhere in the monorepo

```ts
import { prisma } from "@ledger/db";

const overview = await prisma.household.findUnique({ where: { id: 1 } });
```

A singleton pattern (`src/index.ts`) prevents exhausting the Postgres connection pool during dev hot reloads.
