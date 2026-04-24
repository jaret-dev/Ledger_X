/**
 * @ledger/shared-types — the API contract between apps/web and apps/api.
 *
 * Rule of thumb: if a type crosses the HTTP boundary, it lives here as a
 * Zod schema. Both sides import from this package; the API uses
 * `Schema.parse()` on input/output, the web uses the inferred type.
 *
 * Phase 1 exposes only HealthResponse. Phase 2 adds Overview, CashFlow,
 * Transactions, NetWorth, Debts, Bills, Budgets, Income, AdHoc.
 */
export * from "./health.js";
