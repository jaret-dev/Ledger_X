# Ledger — Full Build Plan

**For:** Claude Code  
**Project owner:** Jaret (solo build initially, Sarah joins as second user in Phase 5)  
**Target:** Working PWA by end of Phase 4, production-connected by end of Phase 5  
**Stack (non-negotiable):** React + Vite + TypeScript frontend · Node + Express + TypeScript backend · PostgreSQL · Python OpenClaw agent · Plaid Sandbox → Production  
**Hosting:** Vercel (frontend) · Railway (backend + Postgres) · Jaret's laptop overnight (OpenClaw agent)

---

## 0. Read this first

This document is the complete build plan. It's structured as **phases**, each with a **goal**, a **done-when checklist**, and **specific tasks**. Execute phases in order. Do not skip.

Design is already locked — the HTML/CSS mockups in `/home/claude/ledger/` are the source of truth for visual design. Pull colors, spacing, typography, and component shapes directly from those files. Do not re-design.

There are **9 pages** total:
- `index.html` (Overview) · `cashflow.html` · `transactions.html` · `networth.html` · `debts.html` · `bills.html` · `budgets.html` · `income.html` · `adhoc.html`

There are **4 agent responsibilities:**
- Sync transactions/balances from Plaid nightly
- Categorize new transactions with an LLM pass
- Answer user questions via a chat endpoint (Pattern B — agent as co-pilot)
- Notify user of anomalies (over-budget, unusual charges) — stubbed in MVP, built in Phase 6

When in doubt: **build the simplest version that works, ship it, iterate.** Do not add features not in this plan without asking.

---

## 1. Architectural principles

**Single source of truth: Postgres.** Everything else reads from or writes to Postgres. The agent doesn't hold state. The frontend doesn't hold state beyond UI concerns.

**Agent pushes, frontend pulls.** The OpenClaw agent runs nightly on Jaret's laptop, pulls from Plaid, normalizes, categorizes with LLM, and POSTs to the backend. The frontend never talks to Plaid directly.

**Plaid is abstracted behind an interface.** The agent calls `dataSources.plaid.fetchTransactions()`. Later we can swap in `dataSources.emailParser.fetchTransactions()` without touching anything else.

**Auth is stubbed in Phase 1-4, real in Phase 5.** For early phases, a single env-based API key authenticates the agent. A single hardcoded `user_id = 1` represents Jaret. No login UI. We add Clerk in Phase 5 when Sarah joins.

**Mobile-first PWA.** Every page must work on a 380px viewport. Service worker + manifest.json so Jaret can install to iOS home screen.

**Deploy from day one.** Vercel preview URLs on every PR. Railway auto-deploys from `main`. Staging = preview, production = main. No manual deploys.

---

## 2. Repository layout

```
ledger/
├── apps/
│   ├── web/                    # React + Vite + TS frontend (PWA)
│   ├── api/                    # Node + Express + TS backend
│   └── agent/                  # Python OpenClaw Ledger agent
├── packages/
│   ├── shared-types/           # TS types shared between web + api
│   └── db/                     # Prisma schema + migrations
├── .github/workflows/          # CI/CD
├── package.json                # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo for build caching
└── README.md
```

Use **pnpm** and **Turborepo**. Not npm, not yarn.

---

## 3. Phase 1 — Foundation (Week 1)

### Goal
Empty project is deployed, database is live, frontend talks to backend, backend talks to database. No real features yet, just the plumbing.

### Done when
- [ ] pnpm monorepo initialized with `apps/web`, `apps/api`, and `packages/db` + `packages/shared-types`
- [ ] Postgres on Railway with a working connection from the API
- [ ] Frontend at a Vercel preview URL renders a "Hello from API: [response]" page pulling from `/api/health`
- [ ] Prisma schema exists with all tables defined (even if empty) — see §4
- [ ] CI passes: lint, typecheck, test on every PR
- [ ] `.env.example` files in each app with every required var documented
- [ ] README explains how to run locally and how to deploy

### Tasks

**1.1 — Initialize monorepo.**
```bash
mkdir ledger && cd ledger
pnpm init
# create pnpm-workspace.yaml with: packages: [apps/*, packages/*]
pnpm add -Dw turbo typescript @types/node prettier eslint
```

Create `turbo.json` with pipelines for `build`, `dev`, `lint`, `typecheck`, `test`.

**1.2 — Initialize `packages/db` with Prisma.**
```bash
cd packages/db
pnpm add @prisma/client
pnpm add -D prisma
pnpm prisma init
```
Paste the schema from §4 into `schema.prisma`. Run `pnpm prisma migrate dev --name init`.

**1.3 — Initialize `apps/api`.**
Express + TypeScript + Prisma client import. Endpoints:
- `GET /api/health` → `{ status: "ok", db: "connected", timestamp }`
- Middleware: CORS (allow Vercel domain + localhost), JSON body parser, error handler, request logger (pino)

Use **Zod** for request validation. Every endpoint validates input with a Zod schema before touching the DB.

**1.4 — Initialize `apps/web`.**
Vite + React + TypeScript + TailwindCSS. Install `@tanstack/react-query` for data fetching and `react-router-dom` for routing. On the home page, fetch `/api/health` and render the response. Confirm CORS works.

**1.5 — Provision Railway.**
Create a Railway project. Add a Postgres instance. Create a Node.js service for `apps/api` pointing at the repo, set root dir to `apps/api`, set `DATABASE_URL` from the Postgres service. Configure auto-deploy from `main`.

**1.6 — Provision Vercel.**
Import the repo, set root dir to `apps/web`, set `VITE_API_URL` to the Railway API URL. Configure preview deploys on every PR.

**1.7 — CI.**
GitHub Actions workflow that runs `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` on every PR. Fail build if any step fails.

**1.8 — Seed data script.**
In `packages/db/prisma/seed.ts`, write a seed that creates user_id=1 (Jaret) with every account, every debt, every budget, every recurring bill, every income source, and every ad-hoc expense exactly matching the mock data in the HTML mockups. This seed becomes the **canonical mock dataset** we test against.

The seed should be idempotent — running it twice shouldn't create duplicates.

Run `pnpm prisma db seed` and verify every table has rows.

---

## 4. Database schema (Prisma)

This is the complete schema. Every table Ledger will ever need is here. Some are unused in MVP but included so we don't have to migrate later for obvious extensions.

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ IDENTITY ============

model Household {
  id        Int       @id @default(autoincrement())
  name      String    // e.g. "Jaret & Sarah"
  createdAt DateTime  @default(now())
  users     User[]
  accounts  Account[]
  debts     Debt[]
  bills     RecurringBill[]
  budgets   Budget[]
  incomeSources IncomeSource[]
  adhocExpenses AdHocExpense[]
  transactions Transaction[]
  netWorthSnapshots NetWorthSnapshot[]
  agentMessages AgentMessage[]
}

model User {
  id          Int       @id @default(autoincrement())
  householdId Int
  email       String    @unique
  name        String    // "Jaret" / "Sarah"
  role        String    @default("member")  // "primary" | "member"
  clerkId     String?   @unique             // set in Phase 5
  createdAt   DateTime  @default(now())
  household   Household @relation(fields: [householdId], references: [id])
  incomeSources IncomeSource[]
}

// ============ ACCOUNTS + PLAID ============

model Account {
  id               Int       @id @default(autoincrement())
  householdId      Int
  plaidAccessToken String?   // encrypted, see §9
  plaidItemId      String?
  plaidAccountId   String?   @unique
  institution      String    // "TD Canada Trust" / "American Express"
  nickname         String    // "TD Chequing" / "Amex Cobalt"
  mask             String?   // "8842"
  type             String    // "depository" | "credit" | "loan" | "investment"
  subtype          String?   // "checking" | "credit card" | "auto" | "tfsa" | "rrsp"
  currentBalance   Decimal?  @db.Decimal(12,2)
  availableBalance Decimal?  @db.Decimal(12,2)
  creditLimit      Decimal?  @db.Decimal(12,2)
  currency         String    @default("CAD")
  isActive         Boolean   @default(true)
  isManual         Boolean   @default(false)  // not synced via Plaid
  lastSyncedAt     DateTime?
  createdAt        DateTime  @default(now())
  household        Household @relation(fields: [householdId], references: [id])
  transactions     Transaction[]
  balanceHistory   AccountBalanceSnapshot[]

  @@index([householdId])
  @@index([plaidItemId])
}

model AccountBalanceSnapshot {
  id        Int      @id @default(autoincrement())
  accountId Int
  balance   Decimal  @db.Decimal(12,2)
  recordedAt DateTime @default(now())
  account   Account  @relation(fields: [accountId], references: [id])

  @@index([accountId, recordedAt])
}

// ============ TRANSACTIONS ============

model Transaction {
  id               Int       @id @default(autoincrement())
  householdId      Int
  accountId        Int
  plaidTransactionId String? @unique
  date             DateTime  @db.Date
  amount           Decimal   @db.Decimal(12,2)   // positive = outflow, negative = inflow
  merchantName     String?
  merchantRaw      String    // original string from Plaid/bank
  description      String?
  category         String?   // our internal category: "groceries" | "gas" | "dining" | etc
  categorySource   String    @default("llm")     // "llm" | "user" | "rule" | "plaid"
  categoryConfidence Decimal? @db.Decimal(3,2)   // 0.00-1.00 if LLM categorized
  budgetId         Int?      // which budget envelope this counts against
  billId           Int?      // if this matches a recurring bill
  debtId           Int?      // if this is a debt payment
  adhocId          Int?      // if this fulfills an ad-hoc expense
  incomeSourceId   Int?      // if this is an income deposit
  isPending        Boolean   @default(false)
  isHidden         Boolean   @default(false)     // user can hide transfers between own accounts
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  household        Household @relation(fields: [householdId], references: [id])
  account          Account   @relation(fields: [accountId], references: [id])
  budget           Budget?   @relation(fields: [budgetId], references: [id])
  bill             RecurringBill? @relation(fields: [billId], references: [id])
  debt             Debt?     @relation(fields: [debtId], references: [id])
  adhoc            AdHocExpense? @relation(fields: [adhocId], references: [id])
  incomeSource     IncomeSource? @relation(fields: [incomeSourceId], references: [id])

  @@index([householdId, date])
  @@index([accountId, date])
  @@index([budgetId])
  @@index([category])
}

// ============ DEBTS ============

model Debt {
  id              Int       @id @default(autoincrement())
  householdId     Int
  accountId       Int?      // linked account if one exists
  name            String    // "TD Visa"
  type            String    // "credit_card" | "line_of_credit" | "loan" | "student_loan" | "mortgage"
  balance         Decimal   @db.Decimal(12,2)
  originalBalance Decimal?  @db.Decimal(12,2)
  creditLimit     Decimal?  @db.Decimal(12,2)
  apr             Decimal   @db.Decimal(5,2)   // e.g. 22.90
  minPayment      Decimal   @db.Decimal(10,2)
  dueDayOfMonth   Int?      // 1-31, or null if installment loan
  payoffDate      DateTime? @db.Date             // for installment loans
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  household       Household @relation(fields: [householdId], references: [id])
  transactions    Transaction[]
}

// ============ RECURRING BILLS ============

model RecurringBill {
  id              Int       @id @default(autoincrement())
  householdId     Int
  name            String    // "Rent" / "Hydro"
  category        String    // "housing" | "utilities" | "insurance" | "subscription"
  amount          Decimal   @db.Decimal(10,2)
  amountVariable  Boolean   @default(false)      // true if avg amount (hydro etc)
  frequency       String    // "monthly" | "biweekly" | "quarterly" | "annual"
  dueDayOfMonth   Int?      // 1-31 for monthly
  nextDueDate     DateTime  @db.Date
  autopay         Boolean   @default(true)
  paymentAccountId Int?     // which account it comes from
  paymentMethod   String?   // "TD Chq ····8842"
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  household       Household @relation(fields: [householdId], references: [id])
  transactions    Transaction[]
}

// ============ BUDGETS ============

model Budget {
  id            Int       @id @default(autoincrement())
  householdId   Int
  name          String    // "Groceries" / "Gas"
  category      String    // matches Transaction.category values
  amount        Decimal   @db.Decimal(10,2)
  cycleType     String    @default("paycheck")  // "paycheck" | "monthly" | "biweekly"
  cycleStartDay Int?      // for monthly: day of month. for paycheck: see IncomeSource
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  household     Household @relation(fields: [householdId], references: [id])
  transactions  Transaction[]
}

// ============ INCOME ============

model IncomeSource {
  id              Int       @id @default(autoincrement())
  householdId     Int
  userId          Int       // who earns it
  name            String    // "Mojo Food Group"
  type            String    // "salary" | "self_employed" | "bonus" | "other"
  amount          Decimal   @db.Decimal(12,2)
  amountVariable  Boolean   @default(false)
  frequency       String    // "biweekly" | "monthly" | "annual" | "variable"
  payDayOfWeek    Int?      // 0-6 (0=Sunday) for biweekly
  nextPayDate     DateTime? @db.Date
  depositAccountId Int?
  isPrimary       Boolean   @default(false)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  household       Household @relation(fields: [householdId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
  transactions    Transaction[]
}

// ============ AD-HOC EXPENSES ============

model AdHocExpense {
  id            Int       @id @default(autoincrement())
  householdId   Int
  name          String    // "Connor's wedding hotel"
  description   String?   // freeform notes
  category      String    // "travel" | "gifts" | "auto" | "medical" | "home" | "other"
  amount        Decimal   @db.Decimal(10,2)
  dueDate       DateTime  @db.Date
  paymentAccountId Int?
  status        String    @default("planned")   // "planned" | "funded" | "paid" | "cancelled"
  assignedPaycheckDate DateTime? @db.Date       // which paycheck covers this
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  household     Household @relation(fields: [householdId], references: [id])
  transactions  Transaction[]
}

// ============ NET WORTH SNAPSHOTS ============

model NetWorthSnapshot {
  id             Int       @id @default(autoincrement())
  householdId    Int
  snapshotDate   DateTime  @db.Date @unique
  totalAssets    Decimal   @db.Decimal(14,2)
  totalLiabilities Decimal @db.Decimal(14,2)
  netWorth       Decimal   @db.Decimal(14,2)
  breakdown      Json      // { cash: 24812, investments: 62430, crypto: 8200, ... }
  createdAt      DateTime  @default(now())
  household      Household @relation(fields: [householdId], references: [id])

  @@index([householdId, snapshotDate])
}

// ============ AGENT / CHAT ============

model AgentMessage {
  id          Int       @id @default(autoincrement())
  householdId Int
  userId      Int?
  role        String    // "user" | "assistant" | "system"
  content     String    @db.Text
  metadata    Json?     // tool calls, citations, etc
  conversationId String // groups messages into conversations
  createdAt   DateTime  @default(now())
  household   Household @relation(fields: [householdId], references: [id])

  @@index([conversationId, createdAt])
}

// ============ AUDIT / SYNC LOG ============

model SyncLog {
  id          Int       @id @default(autoincrement())
  source      String    // "plaid" | "llm_categorize" | "email_parser"
  status      String    // "success" | "partial" | "failed"
  itemsProcessed Int     @default(0)
  errorMessage String?   @db.Text
  metadata    Json?
  startedAt   DateTime
  completedAt DateTime?
}
```

**Key conventions:**
- **Amounts are Decimal, not Float.** Never store money as a float.
- **Positive amount = outflow, negative = inflow.** This matches Plaid's convention and avoids sign confusion.
- **Dates are `@db.Date` (no time).** Timestamps are for audit fields only.
- **Plaid fields are nullable.** Accounts can be manual (e.g., OSAP) with `isManual: true`.

---

## 5. Phase 2 — Read-only backend + static frontend (Week 2)

### Goal
Every page in the mockup renders with real data from the database (seeded from the mock). No writes yet. No agent yet. Just: database → API → React pages that look identical to the HTML mockups.

### Done when
- [ ] All 9 pages implemented as React routes
- [ ] Every page fetches from `/api/*` endpoints and renders the exact same content as the HTML mockup (when seeded with mock data)
- [ ] Mobile responsive at 380px on every page
- [ ] Navigation between pages works
- [ ] Loading states + error states handled on every page
- [ ] Lighthouse score ≥90 for performance on desktop

### API endpoints for Phase 2

All endpoints are **GET only** in this phase. Authentication is stubbed — every request includes `x-household-id: 1` header (we'll replace with real auth in Phase 5).

```
GET  /api/health
GET  /api/household                    → household + user info
GET  /api/overview                     → everything needed for index.html (stats + next 4 paychecks + debts summary + budgets summary + upcoming adhoc)
GET  /api/cashflow?days=90             → 90-day projection + calendar events
GET  /api/transactions?limit=50&offset=0&category=&search=&accountId=&startDate=&endDate=
GET  /api/transactions/summary?days=30 → money in/out/net/avg for transactions page header
GET  /api/networth                     → current breakdown + historical snapshots
GET  /api/networth/allocation          → cash/investments/crypto pct
GET  /api/networth/milestones          → progress toward goals
GET  /api/debts                        → all debts + totals + payoff scenarios (computed server-side)
GET  /api/debts/scenarios              → minimum/avalanche/snowball calculations
GET  /api/bills                        → all recurring bills, grouped by category
GET  /api/budgets?cycle=current        → all budgets for current cycle + recent transactions per budget
GET  /api/income                       → all sources + upcoming 30-day deposits + 6-month projection
GET  /api/adhoc                        → all ad-hoc expenses grouped by time window
```

Each endpoint returns JSON matching a Zod schema defined in `packages/shared-types`. The frontend imports the type, so the API contract is typed end-to-end.

### Frontend architecture

```
apps/web/src/
├── main.tsx                  # entry, React Query provider, router
├── App.tsx                   # layout (sidebar + main)
├── components/
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── StatCard.tsx
│   ├── PaycheckBlock.tsx
│   ├── DebtRow.tsx
│   ├── BudgetCard.tsx
│   ├── AdHocCard.tsx
│   └── ... (one per repeated UI element from the mockup)
├── pages/
│   ├── Overview.tsx
│   ├── CashFlow.tsx
│   ├── Transactions.tsx
│   ├── NetWorth.tsx
│   ├── Debts.tsx
│   ├── Bills.tsx
│   ├── Budgets.tsx
│   ├── Income.tsx
│   └── AdHoc.tsx
├── api/
│   ├── client.ts             # fetch wrapper, adds x-household-id
│   └── queries.ts            # React Query hooks: useOverview, useTransactions, etc
├── lib/
│   ├── format.ts             # formatCurrency, formatDate, formatRelativeDate
│   └── theme.ts              # re-export of design tokens from mockup
└── index.css                 # Tailwind + custom CSS vars from mockup
```

**Styling approach:** Copy the CSS variables, typography imports, and component-specific styles from the mockup HTML files directly into the React app. Don't rewrite — port. If the mockup has `.paycheck-date .day { font-family:'Fraunces'; font-size:28px; }`, the React version should produce identical output.

**Use Tailwind for layout/spacing/utilities**, keep the mockup's custom CSS (in `index.css`) for the typography and color system.

**React Query config:** 30 second stale time, refetch on window focus.

---

## 6. Phase 3 — Writes + mutations (Week 3)

### Goal
Every "+" button in the app actually creates things. Users can add/edit/delete debts, bills, budgets, income sources, ad-hoc expenses. Transactions can be manually categorized and reassigned.

### Done when
- [ ] All POST/PATCH/DELETE endpoints implemented with Zod validation
- [ ] Every "+" button in mockups opens a working form
- [ ] Every row can be edited in place or via modal
- [ ] Every row can be deleted with confirmation
- [ ] Optimistic updates work via React Query mutations
- [ ] Errors surface as toast notifications
- [ ] Undo works for destructive actions (5-second window)

### Mutation endpoints

```
POST   /api/debts                      PATCH  /api/debts/:id          DELETE /api/debts/:id
POST   /api/bills                      PATCH  /api/bills/:id          DELETE /api/bills/:id
POST   /api/budgets                    PATCH  /api/budgets/:id        DELETE /api/budgets/:id
POST   /api/income                     PATCH  /api/income/:id         DELETE /api/income/:id
POST   /api/adhoc                      PATCH  /api/adhoc/:id          DELETE /api/adhoc/:id
POST   /api/accounts/manual            PATCH  /api/accounts/:id       DELETE /api/accounts/:id
PATCH  /api/transactions/:id           # update category, budget, notes, hidden
POST   /api/transactions/:id/assign    # assign to bill/debt/adhoc/budget
```

Every mutation:
1. Validates input with Zod
2. Wraps in a transaction if it touches multiple tables
3. Returns the updated resource
4. Invalidates relevant React Query caches on the client

### Bill-to-paycheck assignment logic (Hybrid, per Jaret's spec)

This is the "which paycheck covers this bill" question. Implementation:

```typescript
// apps/api/src/services/paycheckAssignment.ts

// Auto-assign logic (runs when a bill is created/updated or when paychecks shift)
function autoAssignBillToPaycheck(bill: RecurringBill, paychecks: Paycheck[]): Date {
  // Rule: a bill is covered by the most recent paycheck before its due date
  const dueDate = bill.nextDueDate;
  const sorted = paychecks.filter(p => p.date <= dueDate).sort((a, b) => b.date - a.date);
  return sorted[0]?.date ?? paychecks[0].date;
}

// Override: user can pin a bill to a specific paycheck
model BillPaycheckOverride {
  id           Int
  billId       Int
  paycheckDate Date  // the paycheck it's pinned to
  pinnedAt     DateTime
}
```

If an override exists, use it. Otherwise, use auto-assignment. The Overview page's cash flow view consumes both and merges them.

Same pattern for ad-hoc expenses — auto-assigned by due date, user can pin.

---

## 7. Phase 4 — OpenClaw Ledger agent (Week 4)

### Goal
The Ledger agent runs on Jaret's laptop every night, pulls from Plaid Sandbox, categorizes transactions with an LLM, and POSTs to the backend. No real banks yet — Sandbox only.

### Done when
- [ ] Agent runs via `python -m openclaw.agents.ledger sync` from Jaret's laptop
- [ ] Agent authenticates to the backend with an API key (env var)
- [ ] Agent pulls Plaid Sandbox data for at least 3 test institutions
- [ ] Agent categorizes new transactions with Claude (Haiku for cost)
- [ ] Agent posts transactions, balance snapshots, liability updates to the API
- [ ] SyncLog table records every run with status, items processed, errors
- [ ] Agent is idempotent — running twice produces the same state (via Plaid's cursor-based sync)
- [ ] Cron entry on Jaret's laptop runs it at 4:00 AM daily

### Agent architecture

```
apps/agent/
├── pyproject.toml
├── openclaw/
│   └── agents/
│       └── ledger/
│           ├── __init__.py
│           ├── __main__.py          # CLI entry: sync | categorize | chat
│           ├── config.py            # loads LEDGER_API_KEY, LEDGER_API_URL, PLAID_*
│           ├── plaid_client.py      # wraps plaid-python, handles sandbox/production
│           ├── categorizer.py       # LLM categorization via Anthropic SDK
│           ├── api_client.py        # HTTP client for posting to backend
│           ├── sync.py              # main sync loop
│           ├── chat.py              # co-pilot chat (Phase 6)
│           └── prompts/
│               ├── categorize.txt   # categorization prompt
│               └── chat.txt         # co-pilot system prompt
└── tests/
```

### Agent → API contract

The agent POSTs to **ingestion endpoints** that are agent-only (not called from the frontend):

```
POST /api/ingest/transactions
Body: {
  source: "plaid",
  accountPlaidId: string,
  transactions: Array<{
    plaidTransactionId: string,
    date: string,           // YYYY-MM-DD
    amount: number,         // positive = outflow
    merchantName: string | null,
    merchantRaw: string,
    description: string | null,
    isPending: boolean,
    suggestedCategory: string | null,  // from LLM
    categoryConfidence: number | null
  }>
}
Response: { created: number, updated: number, skipped: number }

POST /api/ingest/balances
Body: {
  source: "plaid",
  snapshots: Array<{
    accountPlaidId: string,
    currentBalance: number,
    availableBalance: number | null,
    creditLimit: number | null,
    recordedAt: string  // ISO datetime
  }>
}

POST /api/ingest/liabilities
Body: {
  source: "plaid",
  liabilities: Array<{
    accountPlaidId: string,
    balance: number,
    apr: number,
    minPayment: number,
    dueDayOfMonth: number | null
  }>
}

POST /api/ingest/sync-log
Body: {
  source: string,
  status: "success" | "partial" | "failed",
  itemsProcessed: number,
  errorMessage: string | null,
  metadata: object | null,
  startedAt: string,
  completedAt: string
}
```

All ingest endpoints authenticate with header `x-agent-key: <LEDGER_AGENT_KEY>` matching an env var on the server. Not Clerk/user auth — a separate, agent-only secret.

### Categorization prompt

```
You are categorizing a bank transaction into exactly one of these categories:
- groceries
- gas
- dining
- entertainment
- household
- transport
- travel
- gifts
- medical
- subscription
- income
- debt_payment
- transfer
- other

Given:
- Merchant: {merchant_name}
- Raw description: {merchant_raw}
- Amount: {amount}
- Date: {date}
- Account: {account_type}

Return JSON only:
{"category": "<one of above>", "confidence": 0.0-1.0, "reasoning": "<one short sentence>"}

Examples:
- "LOBLAWS #1234 TORONTO" → {"category": "groceries", "confidence": 0.98, "reasoning": "Loblaws is a grocery chain"}
- "UBER   *TRIP   HELP.UBER.COM" → {"category": "transport", "confidence": 0.95, "reasoning": "Uber trip"}
- "TD VISA PAYMENT" from chequing → {"category": "debt_payment", "confidence": 0.99, "reasoning": "Credit card payment"}
```

Use **Claude Haiku** for categorization — it's cheap and fast and 99% accurate on this task. Batch 20 transactions per API call to save on overhead.

If confidence < 0.7, mark the transaction `categorySource: "llm_uncertain"` and surface it in a "Review" UI on the Transactions page for the user to correct.

### Sync logic (pseudocode)

```python
def sync():
    log = start_sync_log(source="plaid")
    try:
        accounts = api.get_accounts()
        for account in accounts:
            if not account.plaid_access_token:
                continue
            
            # 1. Pull transactions since last cursor
            cursor = api.get_account_cursor(account.id)
            result = plaid.transactions_sync(access_token=account.plaid_access_token, cursor=cursor)
            
            # 2. Categorize new transactions in batches of 20
            new_txns = result.added
            categorized = categorize_batch(new_txns)
            
            # 3. Post to API
            api.post_transactions(account.plaid_account_id, categorized)
            
            # 4. Update cursor
            api.set_account_cursor(account.id, result.next_cursor)
            
            # 5. Pull balances
            balances = plaid.accounts_balance_get(access_token=account.plaid_access_token)
            api.post_balances(balances)
            
            # 6. Pull liabilities if credit/loan
            if account.type in ("credit", "loan"):
                liab = plaid.liabilities_get(access_token=account.plaid_access_token)
                api.post_liabilities(liab)
        
        complete_sync_log(log, status="success", items_processed=total)
    except Exception as e:
        complete_sync_log(log, status="failed", error=str(e))
        raise
```

### Running on Jaret's laptop

Cron entry:
```
0 4 * * * cd /Users/jaret/code/openclaw && /usr/bin/env python -m openclaw.agents.ledger sync >> /Users/jaret/.openclaw/logs/ledger-$(date +\%Y\%m\%d).log 2>&1
```

Or, better, use `launchd` on macOS for reliability. Include a LaunchAgent plist in the repo at `apps/agent/launchd/com.openclaw.ledger.plist`.

---

## 8. Phase 5 — Auth + Sarah joins (Week 5)

### Goal
Replace the stubbed `x-household-id` with real user authentication. Sarah can log in as a second user on the same household. Both see the same data.

### Done when
- [ ] Clerk integrated on frontend (sign-in, sign-up, user menu)
- [ ] Backend validates Clerk JWT on every `/api/*` request (except `/api/ingest/*` which still uses agent key)
- [ ] User's `clerkId` mapped to `User.clerkId` in DB; `householdId` derived from the user's membership
- [ ] Sarah can sign up via invite link from Jaret's account
- [ ] Both see the same data; role field distinguishes primary vs member for future permissioning
- [ ] Sign-out works; session persists across reloads

### Tasks

**5.1 — Add Clerk.** `pnpm add @clerk/clerk-react` on web, `@clerk/clerk-sdk-node` on api. Wrap `<App>` in `<ClerkProvider>`. Protect routes with `<SignedIn>` + `<SignedOut>` components.

**5.2 — Backend middleware.** Verify JWT on every incoming request. Extract Clerk user ID. Look up `User` by `clerkId`. Attach `user` and `household` to `req`. If user doesn't exist in DB, auto-create on first request (self-provision).

**5.3 — Invite flow.** On Jaret's account, a "Invite Sarah" button generates a Clerk invitation with `publicMetadata: { householdId: 1, role: "member" }`. On Sarah's first sign-up, the backend reads that metadata and creates her User linked to the same household.

**5.4 — Remove stubbed auth.** Delete `x-household-id` header. All household context comes from the authenticated user.

---

## 9. Phase 6 — Agent co-pilot chat (Week 6)

### Goal
A chat panel appears on every page where Jaret can talk to the Ledger agent: "Why did groceries spike this month?" / "Move $100 from entertainment to household." / "When do I pay off the Amex if I put an extra $200/month on it?"

### Done when
- [ ] Chat panel UI (collapsible, right side) on every page
- [ ] Agent responds using context from the database
- [ ] Agent has tool-call access to read data and propose (not execute) changes
- [ ] Write actions require user confirmation in chat ("I can move $100 from entertainment to household — confirm?")
- [ ] Chat history persists in `AgentMessage` table
- [ ] Streaming responses (SSE or WebSocket)

### Chat architecture

The chat runs **on the server**, not on Jaret's laptop. The laptop agent is for nightly sync only. The co-pilot is a separate process hosted on Railway.

```
apps/api/src/chat/
├── router.ts              # POST /api/chat, streaming response
├── tools.ts               # tool definitions for Claude
├── executor.ts            # safe execution of proposed actions
└── prompts/
    └── copilot.txt
```

### Tool definitions

Claude (Sonnet 4.6 — we need reasoning for budget/debt math) is given these tools:

- `get_overview()` — read current state
- `get_transactions(filters)` — search transactions
- `get_budget(name)` — specific budget details
- `get_debt(name)` — specific debt details
- `propose_budget_transfer(from_id, to_id, amount)` — does NOT execute, returns a pending action
- `propose_adhoc_create(name, amount, date, category, notes)` — does NOT execute
- `propose_bill_edit(bill_id, changes)` — does NOT execute
- `calculate_payoff(debt_id, extra_monthly_payment)` — pure function, no DB write

Write-capable tools return a **proposal object** with a confirmation token. The user clicks "Confirm" in the UI, which POSTs to `/api/chat/confirm/:token` to actually execute. This is the "agent as co-pilot" model — the agent never writes without explicit user approval.

### System prompt (excerpt)

```
You are Ledger, Jaret's personal finance co-pilot. You have read access to his 
household's financial data and can propose changes that he confirms before execution.

Core principles:
- Be concise. Numbers > narrative. Cite the data.
- Never move money without a confirmation token.
- Flag risk honestly. If over-budget, say so. If surplus is tight, say so.
- When asked "can I afford X", compute against real upcoming cash flow, not averages.
- Use Canadian dollar formatting. Know that Jaret is in Toronto, pays Canadian taxes.

Jaret is the primary user. His partner Sarah is a secondary user on the same 
household. Assume joint finances unless told otherwise.
```

---

## 10. Phase 7 — Production Plaid + polish (Week 7)

### Goal
Ledger connects to Jaret's real banks. Production-grade: encryption, backups, error recovery, PWA polish.

### Done when
- [ ] Plaid Link flow works from the web UI for adding a new bank
- [ ] Access tokens encrypted at rest in Postgres (AES-256, key from env)
- [ ] Production Plaid credentials set; agent switched from Sandbox to Production
- [ ] All of Jaret's real banks connected (TD, Amex, RBC, Wealthsimple, Questrade if available, manual account for OSAP)
- [ ] First successful real sync with real transactions
- [ ] PWA manifest + service worker; installable on iOS and Android
- [ ] Lighthouse PWA score 100

### Plaid Link flow

The one place the frontend touches Plaid is the "Add bank" flow:

1. Jaret clicks "+ Connect bank" on the Accounts settings page
2. Frontend POSTs to `/api/plaid/link-token` → backend calls `/link/token/create` → returns short-lived `link_token`
3. Frontend opens Plaid Link SDK with that token
4. User logs into TD in the Plaid UI
5. Link returns a `public_token` to the frontend
6. Frontend POSTs it to `/api/plaid/exchange` → backend calls `/item/public_token/exchange` → gets `access_token`
7. Backend encrypts and stores the `access_token` on the Account record
8. Backend triggers an initial sync (calls the agent endpoint that runs a single-account sync)

### Encryption

Access tokens are sensitive. Use Node's built-in `crypto`:

```typescript
// apps/api/src/lib/crypto.ts
import crypto from 'node:crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

Generate `ENCRYPTION_KEY` once with `openssl rand -hex 32` and store in Railway env vars. Never commit.

### PWA manifest

```json
// apps/web/public/manifest.json
{
  "name": "Ledger",
  "short_name": "Ledger",
  "description": "Personal finance, private.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5f3ee",
  "theme_color": "#1a1a1a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Service worker with Vite PWA plugin: `pnpm add -D vite-plugin-pwa`. Cache static assets. Don't cache API responses — always fresh.

---

## 11. Environment variables (full list)

### `apps/api/.env`
```
DATABASE_URL=postgresql://...
NODE_ENV=development|production
PORT=3001
CORS_ORIGIN=http://localhost:5173,https://ledger.vercel.app
LEDGER_AGENT_KEY=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
ANTHROPIC_API_KEY=<for co-pilot chat>
CLERK_SECRET_KEY=<phase 5+>
PLAID_CLIENT_ID=<phase 7+>
PLAID_SECRET=<phase 7+>
PLAID_ENV=sandbox|production
PLAID_COUNTRY_CODES=CA
```

### `apps/web/.env`
```
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=<phase 5+>
```

### `apps/agent/.env`
```
LEDGER_API_URL=http://localhost:3001
LEDGER_AGENT_KEY=<same as api>
ANTHROPIC_API_KEY=<for categorization>
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox|production
```

---

## 12. Testing strategy

**Unit tests** (Vitest on web/api, pytest on agent):
- Every service function: budget calculations, payoff scenarios, paycheck assignment, categorization prompt formatter
- Every API route: happy path + validation errors

**Integration tests** (apps/api with a test Postgres):
- Full request → response cycles
- Seed data, hit endpoint, assert shape

**E2E tests** (Playwright on web):
- Smoke test per page: page loads, key elements render, no console errors
- Critical flow: add a debt, edit it, delete it
- Critical flow: categorize a transaction, it shows up in the right budget

**Visual regression** (optional, Percy or manual):
- Screenshot each page after Phase 2; compare on future PRs

**Target coverage:** 70% on api services, 50% on web components. Don't chase 100% — chase the flows that break in production.

---

## 13. Guardrails for Claude Code

Do **not**:
- Add features not in this plan
- Change the database schema without an explicit migration plan
- Add new dependencies without justification (stay lean)
- Touch the HTML mockups in `/home/claude/ledger/` — they are the design source of truth
- Use any paid service beyond what's in the stack (Vercel, Railway, Plaid, Anthropic, Clerk)
- Write tests with hardcoded UUIDs or dates — use factories and relative dates
- Commit `.env` files
- Deploy to production without Jaret's explicit say-so after Phase 4

Do:
- Ask if anything is ambiguous before building
- Propose schema changes with migration SQL before running them
- Keep PRs focused — one phase per PR at most, ideally one feature per PR
- Write commit messages that explain *why*, not just *what*
- Run `pnpm lint && pnpm typecheck && pnpm test` before every commit
- Add a short `CHANGELOG.md` entry for each phase completion

---

## 14. Open questions (for Jaret to resolve)

1. **Plaid account.** Jaret to complete signup when able. Until then, use Sandbox credentials from any Plaid account. The build doesn't block on this.
2. **Investment accounts.** Confirm whether Questrade is supported by Plaid. If not, decide: email-parsed statements or manual monthly balance updates?
3. **OSAP.** Confirm this is a manual-balance-only account (very likely).
4. **Currency.** Assuming CAD throughout. If any account is USD (e.g., USD Amex or cross-border investment), flag before Phase 4.
5. **Anomaly notifications (Phase 6+).** Push notifications, email, or in-app only? MVP is in-app.
6. **Profit share / bonuses.** 5% Mojo profit share starting late 2026 — log as `IncomeSource` with `type: "bonus"` and `frequency: "annual"`. Sarah's monthly bonus and Jaret's biannual bonus handled the same way. Seed data to include these from Phase 1.

---

## 15. What "done" looks like (end of Phase 7)

- Jaret opens `ledger.[domain]` on his phone. Logs in via Clerk. Sees his real net worth, real debts, real upcoming cash flow. All 9 pages work.
- At 4:00 AM the next morning, the agent runs on his laptop, pulls new transactions from TD and Amex, categorizes them, and POSTs to Railway. When he opens the app at 7 AM, yesterday's transactions are there, sorted correctly.
- He asks the co-pilot "can I afford a $600 expense next week?" and gets a real answer based on upcoming paychecks minus committed expenses.
- Sarah has her own login and sees the same data.
- Total monthly cost: $0 on Plaid Trial, ~$5-10/mo on Anthropic API calls, $0 on Clerk free tier, $0 on Vercel, $5 on Railway. Under $20/month all-in.
- The whole thing runs forever with Jaret doing nothing except approving the occasional transaction categorization the agent wasn't sure about.

That's the goal. Build it in order. Ship each phase before starting the next.
