# Dockerfile — Railway build for apps/api.
#
# Single-stage on purpose: the workspace install is tiny and a multi-stage
# build doesn't materially shrink the image (the runtime needs Prisma's
# query engine + node_modules anyway). Re-evaluate post Phase 4 when the
# image is bigger.
#
# Build context is the repo ROOT (Railway's Root Directory must be empty /
# unset). railway.toml at the repo root tells Railway to use this file.

FROM node:20-alpine

WORKDIR /app

# pnpm via corepack — pinned to match packageManager in package.json
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy manifests first so docker can cache the install layer when only
# source changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Now the source
COPY packages ./packages
COPY apps/api ./apps/api

# Generate the Prisma client (lands in node_modules/.pnpm/...) and compile
# @ledger/shared-types, @ledger/db, @ledger/api in dep order via Turbo.
RUN pnpm --filter @ledger/db generate
RUN pnpm build --filter @ledger/api

# Railway sets PORT at runtime; our env.ts reads it.
EXPOSE 3001

# Apply pending migrations, then boot the server. migrate deploy is a no-op
# when nothing is pending so this is safe on every restart.
CMD ["sh", "-c", "pnpm --filter @ledger/db exec prisma migrate deploy && pnpm --filter @ledger/api start"]
