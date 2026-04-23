# Changelog

All notable changes to Ledger are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows the build plan's phase numbering until we ship to production.

## [Unreleased] — Phase 1: Foundation

### Added

- `design/mockups/` — the 9 canonical HTML mockups (relocated from repo root) that serve as the visual source of truth for the React port in Phase 2.
- pnpm workspace + Turborepo skeleton (`package.json`, `pnpm-workspace.yaml`, `turbo.json`) with pipelines for `build`, `dev`, `lint`, `typecheck`, `test`.
- Shared tooling config: `tsconfig.base.json` (strict TS), flat ESLint config, Prettier, `.editorconfig`, `.nvmrc` pinned to Node 20.17.

### Decisions

- **Seed scope:** Household #1 will include both Jaret and Sarah from day one. Sarah's `User.clerkId` remains null until Phase 5.
- **Schema addition:** `BillPaycheckOverride` table is included in the Phase 1 Prisma schema (not deferred to Phase 3) so Phase 3's bill-to-paycheck pinning is a code-only change with no migration.
- **Tailwind:** pinned to 3.4.x. v4's API churn is not worth absorbing mid-build.
- **Branch:** development on `phase-1-foundation` (renamed from the review branch).
