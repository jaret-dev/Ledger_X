/**
 * Ledger — canonical seed dataset.
 *
 * Source of truth: the 9 HTML mockups under design/mockups/. Every value
 * here is transcribed from those files (cross-referenced across pages).
 * BUILD_PLAN §3.8 calls this the "canonical mock dataset" we test against.
 *
 * Idempotency contract: running this twice must not create duplicates.
 * We use findFirst-then-update-or-create instead of upsert because most
 * entities (Account, Debt, Bill, Budget, IncomeSource, AdHoc) lack a
 * unique field beyond the synthetic primary key. Adding @@unique
 * constraints would require schema changes; this keeps the schema clean.
 *
 * For Transaction, we synthesize a deterministic plaidTransactionId
 * ("mock-<date>-<merchant>") so upsert works against the existing
 * @unique constraint, and real Plaid transactions can never collide
 * with mocks (they don't carry the "mock-" prefix).
 *
 * Today: 2026-04-25. Future-dated bills/income are projected from there.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const HOUSEHOLD_ID = 1;
const TODAY = dateOnly("2026-04-25");

/** YYYY-MM-DD → Date at UTC midnight. Prisma `@db.Date` ignores the time. */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Idempotent create-or-update for models without a usable unique constraint.
 * `match` is the natural key (e.g. `{ householdId, nickname }`); `data` is
 * everything else.
 */
async function upsertBy<T extends { id: number }>(
  model: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<T | null>;
    update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<T>;
    create: (args: { data: Record<string, unknown> }) => Promise<T>;
  },
  match: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<T> {
  const existing = await model.findFirst({ where: match });
  if (existing) {
    return model.update({ where: { id: existing.id }, data });
  }
  return model.create({ data: { ...match, ...data } });
}

async function seed() {
  // ────────────────────────────────────────────────────────────
  // Household + Users
  // ────────────────────────────────────────────────────────────

  const household = await prisma.household.upsert({
    where: { id: HOUSEHOLD_ID },
    update: { name: "Jaret & Sarah" },
    create: { id: HOUSEHOLD_ID, name: "Jaret & Sarah" },
  });

  const jaret = await prisma.user.upsert({
    where: { email: "jaret@mojofoodgroup.com" },
    update: { name: "Jaret", role: "primary", householdId: household.id },
    create: {
      email: "jaret@mojofoodgroup.com",
      name: "Jaret",
      role: "primary",
      householdId: household.id,
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "sarah@example.com" },
    update: { name: "Sarah", role: "member", householdId: household.id },
    create: {
      email: "sarah@example.com",
      name: "Sarah",
      role: "member",
      householdId: household.id,
    },
  });

  // ────────────────────────────────────────────────────────────
  // Accounts (11) — assets + credit + loans
  // Captured into a name → id map so later sections can reference them.
  // ────────────────────────────────────────────────────────────

  const accountSpecs: Array<
    {
      nickname: string;
      institution: string;
      type: string;
      subtype: string | null;
      currentBalance: number;
      mask?: string;
      creditLimit?: number;
      isManual?: boolean;
    }
  > = [
    // Assets
    { nickname: "TD Chequing", institution: "TD Canada Trust", mask: "8842", type: "depository", subtype: "checking", currentBalance: 6420.0 },
    { nickname: "TD High-Interest Savings", institution: "TD Canada Trust", type: "depository", subtype: "high_interest_savings", currentBalance: 12200.0 },
    { nickname: "Wealthsimple Cash", institution: "Wealthsimple", type: "depository", subtype: "cash", currentBalance: 6192.0 },
    { nickname: "Wealthsimple TFSA", institution: "Wealthsimple", type: "investment", subtype: "tfsa", currentBalance: 34820.0 },
    { nickname: "Questrade RRSP", institution: "Questrade", type: "investment", subtype: "rrsp", currentBalance: 19410.0 },
    { nickname: "Wealthsimple Crypto", institution: "Wealthsimple", type: "investment", subtype: "crypto", currentBalance: 8200.0 },
    // Credit cards
    { nickname: "TD Visa", institution: "TD Canada Trust", mask: "4291", type: "credit", subtype: "credit_card", currentBalance: 8420.0, creditLimit: 10000.0 },
    { nickname: "Amex Cobalt", institution: "American Express", mask: "0018", type: "credit", subtype: "credit_card", currentBalance: 5210.0, creditLimit: 8000.0 },
    // Lines / loans
    { nickname: "TD Line of Credit", institution: "TD Canada Trust", type: "loan", subtype: "line_of_credit", currentBalance: 12800.0, creditLimit: 20000.0 },
    { nickname: "Car loan · RBC", institution: "Royal Bank of Canada", type: "loan", subtype: "auto", currentBalance: 14200.0 },
    { nickname: "Student loan · OSAP", institution: "Ontario Student Assistance Program", type: "loan", subtype: "student_loan", currentBalance: 7690.0, isManual: true },
  ];

  const accountByNickname = new Map<string, number>();
  for (const spec of accountSpecs) {
    const acc = await upsertBy(
      prisma.account,
      { householdId: household.id, nickname: spec.nickname },
      {
        institution: spec.institution,
        mask: spec.mask ?? null,
        type: spec.type,
        subtype: spec.subtype,
        currentBalance: new Prisma.Decimal(spec.currentBalance),
        creditLimit: spec.creditLimit != null ? new Prisma.Decimal(spec.creditLimit) : null,
        currency: "CAD",
        isActive: true,
        isManual: spec.isManual ?? false,
      },
    );
    accountByNickname.set(spec.nickname, acc.id);
  }

  // ────────────────────────────────────────────────────────────
  // Debts (5)
  // ────────────────────────────────────────────────────────────

  const debtSpecs: Array<{
    name: string;
    type: string;
    balance: number;
    originalBalance?: number;
    creditLimit?: number;
    apr: number;
    minPayment: number;
    dueDayOfMonth?: number;
    payoffDate?: string;
    accountNickname?: string;
  }> = [
    { name: "TD Visa", type: "credit_card", balance: 8420.0, creditLimit: 10000.0, apr: 22.9, minPayment: 620.0, dueDayOfMonth: 28, accountNickname: "TD Visa" },
    { name: "Amex Cobalt", type: "credit_card", balance: 5210.0, creditLimit: 8000.0, apr: 21.0, minPayment: 410.0, dueDayOfMonth: 12, accountNickname: "Amex Cobalt" },
    { name: "TD Line of Credit", type: "line_of_credit", balance: 12800.0, creditLimit: 20000.0, apr: 9.4, minPayment: 350.0, dueDayOfMonth: 15, accountNickname: "TD Line of Credit" },
    { name: "Car loan · RBC", type: "loan", balance: 14200.0, originalBalance: 24000.0, apr: 6.8, minPayment: 485.0, dueDayOfMonth: 6, payoffDate: "2029-04-01", accountNickname: "Car loan · RBC" },
    { name: "Student loan · OSAP", type: "student_loan", balance: 7690.0, originalBalance: 22000.0, apr: 5.2, minPayment: 275.0, dueDayOfMonth: 22, payoffDate: "2028-12-01", accountNickname: "Student loan · OSAP" },
  ];

  const debtByName = new Map<string, number>();
  for (const spec of debtSpecs) {
    const debt = await upsertBy(
      prisma.debt,
      { householdId: household.id, name: spec.name },
      {
        accountId: spec.accountNickname ? accountByNickname.get(spec.accountNickname) : null,
        type: spec.type,
        balance: new Prisma.Decimal(spec.balance),
        originalBalance: spec.originalBalance != null ? new Prisma.Decimal(spec.originalBalance) : null,
        creditLimit: spec.creditLimit != null ? new Prisma.Decimal(spec.creditLimit) : null,
        apr: new Prisma.Decimal(spec.apr),
        minPayment: new Prisma.Decimal(spec.minPayment),
        dueDayOfMonth: spec.dueDayOfMonth ?? null,
        payoffDate: spec.payoffDate ? dateOnly(spec.payoffDate) : null,
        isActive: true,
      },
    );
    debtByName.set(spec.name, debt.id);
  }

  // ────────────────────────────────────────────────────────────
  // Recurring bills (14)
  // nextDueDate computed from dueDayOfMonth, projected to next occurrence
  // after TODAY (2026-04-25). All in 2026-05 except quarterly Domains.
  // ────────────────────────────────────────────────────────────

  const billSpecs: Array<{
    name: string;
    category: string;
    amount: number;
    amountVariable?: boolean;
    frequency: string;
    dueDayOfMonth: number;
    nextDueDate: string;
    paymentMethod: string;
    paymentAccountNickname: string;
    autopay?: boolean;
  }> = [
    { name: "Rent", category: "housing", amount: 2100.0, frequency: "monthly", dueDayOfMonth: 1, nextDueDate: "2026-05-01", paymentMethod: "TD Chq ····8842", paymentAccountNickname: "TD Chequing" },
    { name: "Hydro · Toronto Hydro", category: "utilities", amount: 142.0, amountVariable: true, frequency: "monthly", dueDayOfMonth: 3, nextDueDate: "2026-05-03", paymentMethod: "TD Chq ····8842", paymentAccountNickname: "TD Chequing" },
    { name: "Internet · Rogers", category: "utilities", amount: 95.0, frequency: "monthly", dueDayOfMonth: 4, nextDueDate: "2026-05-04", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "Phone · Bell", category: "utilities", amount: 180.0, frequency: "monthly", dueDayOfMonth: 5, nextDueDate: "2026-05-05", paymentMethod: "TD Chq ····8842", paymentAccountNickname: "TD Chequing" },
    { name: "Auto insurance · Aviva", category: "insurance", amount: 245.0, frequency: "monthly", dueDayOfMonth: 15, nextDueDate: "2026-05-15", paymentMethod: "TD Chq ····8842", paymentAccountNickname: "TD Chequing" },
    { name: "Tenant insurance · Square One", category: "insurance", amount: 28.0, frequency: "monthly", dueDayOfMonth: 8, nextDueDate: "2026-05-08", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "Life insurance · Sun Life", category: "insurance", amount: 97.0, frequency: "monthly", dueDayOfMonth: 1, nextDueDate: "2026-05-01", paymentMethod: "TD Chq ····8842", paymentAccountNickname: "TD Chequing" },
    { name: "Streaming bundle", category: "subscription", amount: 62.0, frequency: "monthly", dueDayOfMonth: 18, nextDueDate: "2026-05-18", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "Gym · GoodLife", category: "subscription", amount: 89.0, frequency: "monthly", dueDayOfMonth: 20, nextDueDate: "2026-05-20", paymentMethod: "TD Visa ····4291", paymentAccountNickname: "TD Visa" },
    { name: "Spotify Duo", category: "subscription", amount: 17.0, frequency: "monthly", dueDayOfMonth: 11, nextDueDate: "2026-05-11", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "iCloud + Google storage", category: "subscription", amount: 19.0, frequency: "monthly", dueDayOfMonth: 7, nextDueDate: "2026-05-07", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "Chat-GPT + Claude", category: "subscription", amount: 55.0, frequency: "monthly", dueDayOfMonth: 14, nextDueDate: "2026-05-14", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt" },
    { name: "Domains + hosting", category: "subscription", amount: 100.0, frequency: "quarterly", dueDayOfMonth: 1, nextDueDate: "2026-07-01", paymentMethod: "Amex ····0018", paymentAccountNickname: "Amex Cobalt", autopay: false },
  ];

  const billByName = new Map<string, number>();
  for (const spec of billSpecs) {
    const bill = await upsertBy(
      prisma.recurringBill,
      { householdId: household.id, name: spec.name },
      {
        category: spec.category,
        amount: new Prisma.Decimal(spec.amount),
        amountVariable: spec.amountVariable ?? false,
        frequency: spec.frequency,
        dueDayOfMonth: spec.dueDayOfMonth,
        nextDueDate: dateOnly(spec.nextDueDate),
        autopay: spec.autopay ?? true,
        paymentAccountId: accountByNickname.get(spec.paymentAccountNickname) ?? null,
        paymentMethod: spec.paymentMethod,
        isActive: true,
      },
    );
    billByName.set(spec.name, bill.id);
  }

  // ────────────────────────────────────────────────────────────
  // Budgets (6, all per-paycheck)
  // ────────────────────────────────────────────────────────────

  const budgetSpecs: Array<{ name: string; category: string; amount: number }> = [
    { name: "Groceries", category: "groceries", amount: 400.0 },
    { name: "Gas", category: "gas", amount: 180.0 },
    { name: "Dining · coffee", category: "dining", amount: 150.0 },
    { name: "Entertainment", category: "entertainment", amount: 120.0 },
    { name: "Household", category: "household", amount: 200.0 },
    { name: "Transport", category: "transport", amount: 100.0 },
  ];

  const budgetByCategory = new Map<string, number>();
  for (const spec of budgetSpecs) {
    const budget = await upsertBy(
      prisma.budget,
      { householdId: household.id, name: spec.name },
      {
        category: spec.category,
        amount: new Prisma.Decimal(spec.amount),
        cycleType: "paycheck",
        isActive: true,
      },
    );
    budgetByCategory.set(spec.category, budget.id);
  }

  // ────────────────────────────────────────────────────────────
  // Income sources (4)
  // ────────────────────────────────────────────────────────────

  const tdChequingId = accountByNickname.get("TD Chequing")!;

  const incomeSpecs: Array<{
    name: string;
    userId: number;
    type: string;
    amount: number;
    amountVariable?: boolean;
    frequency: string;
    payDayOfWeek?: number;
    nextPayDate?: string;
    isPrimary?: boolean;
  }> = [
    { name: "Mojo Food Group", userId: jaret.id, type: "salary", amount: 3840.0, frequency: "biweekly", payDayOfWeek: 5, nextPayDate: "2026-05-08", isPrimary: true },
    { name: "GAP Inc.", userId: sarah.id, type: "salary", amount: 2210.0, frequency: "biweekly", payDayOfWeek: 3, nextPayDate: "2026-04-29" },
    { name: "TGCS Co.", userId: jaret.id, type: "self_employed", amount: 775.0, amountVariable: true, frequency: "monthly" },
    { name: "Annual bonus · Mojo", userId: jaret.id, type: "bonus", amount: 9200.0, amountVariable: true, frequency: "annual", nextPayDate: "2026-12-15" },
  ];

  const incomeByName = new Map<string, number>();
  for (const spec of incomeSpecs) {
    const income = await upsertBy(
      prisma.incomeSource,
      { householdId: household.id, userId: spec.userId, name: spec.name },
      {
        type: spec.type,
        amount: new Prisma.Decimal(spec.amount),
        amountVariable: spec.amountVariable ?? false,
        frequency: spec.frequency,
        payDayOfWeek: spec.payDayOfWeek ?? null,
        nextPayDate: spec.nextPayDate ? dateOnly(spec.nextPayDate) : null,
        depositAccountId: tdChequingId,
        isPrimary: spec.isPrimary ?? false,
        isActive: true,
      },
    );
    incomeByName.set(spec.name, income.id);
  }

  // ────────────────────────────────────────────────────────────
  // Ad-hoc expenses (3)
  // ────────────────────────────────────────────────────────────

  const adhocSpecs: Array<{
    name: string;
    description: string;
    category: string;
    amount: number;
    dueDate: string;
    status: string;
  }> = [
    { name: "Connor's wedding · hotel", description: "Hilton Niagara · two nights · Sarah + me", category: "travel", amount: 320.0, dueDate: "2026-05-10", status: "funded" },
    { name: "Mom's birthday gift", description: "Still deciding — set aside the cash anyway", category: "gifts", amount: 150.0, dueDate: "2026-05-24", status: "planned" },
    { name: "Brake pads · Civic", description: "Quoted at Dave's shop · includes rotor turn", category: "auto", amount: 480.0, dueDate: "2026-06-05", status: "planned" },
  ];

  const adhocByName = new Map<string, number>();
  for (const spec of adhocSpecs) {
    const adhoc = await upsertBy(
      prisma.adHocExpense,
      { householdId: household.id, name: spec.name },
      {
        description: spec.description,
        category: spec.category,
        amount: new Prisma.Decimal(spec.amount),
        dueDate: dateOnly(spec.dueDate),
        paymentAccountId: tdChequingId,
        status: spec.status,
      },
    );
    adhocByName.set(spec.name, adhoc.id);
  }

  // ────────────────────────────────────────────────────────────
  // Net worth snapshot (today)
  // ────────────────────────────────────────────────────────────

  await prisma.netWorthSnapshot.upsert({
    where: { snapshotDate: TODAY },
    update: {
      totalAssets: new Prisma.Decimal(87242.0),
      totalLiabilities: new Prisma.Decimal(48320.0),
      netWorth: new Prisma.Decimal(38922.0),
      breakdown: {
        cash_and_savings: 24812.0,
        investments_tfsa_rrsp: 54230.0,
        crypto: 8200.0,
      },
    },
    create: {
      householdId: household.id,
      snapshotDate: TODAY,
      totalAssets: new Prisma.Decimal(87242.0),
      totalLiabilities: new Prisma.Decimal(48320.0),
      netWorth: new Prisma.Decimal(38922.0),
      breakdown: {
        cash_and_savings: 24812.0,
        investments_tfsa_rrsp: 54230.0,
        crypto: 8200.0,
      },
    },
  });

  // ────────────────────────────────────────────────────────────
  // Representative transactions (sample from transactions.html)
  // Positive = outflow, negative = inflow (Plaid convention).
  // plaidTransactionId uses "mock-" prefix so real Plaid syncs never collide.
  // ────────────────────────────────────────────────────────────

  const txnSpecs: Array<{
    date: string;
    amount: number;
    merchant: string;
    raw: string;
    category: string;
    accountNickname: string;
    incomeName?: string;
  }> = [
    { date: "2026-04-22", amount: 62.4, merchant: "Loblaws", raw: "LOBLAWS #1234 TORONTO", category: "groceries", accountNickname: "Amex Cobalt" },
    { date: "2026-04-22", amount: 7.8, merchant: "Starbucks", raw: "STARBUCKS QUEEN E TORONTO", category: "dining", accountNickname: "Amex Cobalt" },
    { date: "2026-04-22", amount: 14.0, merchant: "Esso", raw: "ESSO 5512 TORONTO", category: "gas", accountNickname: "TD Visa" },
    { date: "2026-04-21", amount: 142.3, merchant: "Home Depot", raw: "THE HOME DEPOT #7011", category: "household", accountNickname: "TD Visa" },
    { date: "2026-04-21", amount: 48.1, merchant: "Metro", raw: "METRO #142 LESLIEVILLE", category: "groceries", accountNickname: "Amex Cobalt" },
    { date: "2026-04-21", amount: 8.4, merchant: "Tim Hortons", raw: "TIM HORTONS #2298", category: "dining", accountNickname: "Amex Cobalt" },
    { date: "2026-04-21", amount: 16.6, merchant: "LCBO", raw: "LCBO #432 QUEEN ST E", category: "entertainment", accountNickname: "TD Visa" },
    { date: "2026-04-20", amount: 89.5, merchant: "Bell Canada", raw: "BELL CANADA AUTOPAY", category: "subscription", accountNickname: "TD Chequing" },
    { date: "2026-04-20", amount: 42.15, merchant: "Shoppers Drug Mart", raw: "SHOPPERS DRUG MART #1190", category: "household", accountNickname: "Amex Cobalt" },
    { date: "2026-04-20", amount: 22.6, merchant: "Uber", raw: "UBER *TRIP HELP.UBER.COM", category: "transport", accountNickname: "Amex Cobalt" },
    { date: "2026-04-17", amount: -3840.0, merchant: "Mojo Food Group", raw: "MOJO FOOD GROUP PAYROLL", category: "income", accountNickname: "TD Chequing", incomeName: "Mojo Food Group" },
  ];

  for (const [idx, t] of txnSpecs.entries()) {
    const accountId = accountByNickname.get(t.accountNickname);
    if (!accountId) throw new Error(`Unknown account nickname in transaction: ${t.accountNickname}`);

    const plaidTransactionId = `mock-${t.date}-${idx}-${t.merchant.toLowerCase().replace(/\s+/g, "-")}`;

    await prisma.transaction.upsert({
      where: { plaidTransactionId },
      update: {
        amount: new Prisma.Decimal(t.amount),
        merchantName: t.merchant,
        merchantRaw: t.raw,
        category: t.category,
      },
      create: {
        householdId: household.id,
        accountId,
        plaidTransactionId,
        date: dateOnly(t.date),
        amount: new Prisma.Decimal(t.amount),
        merchantName: t.merchant,
        merchantRaw: t.raw,
        category: t.category,
        categorySource: "rule",
        budgetId: budgetByCategory.get(t.category) ?? null,
        incomeSourceId: t.incomeName ? incomeByName.get(t.incomeName) ?? null : null,
        isPending: false,
        isHidden: false,
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Done
  // ────────────────────────────────────────────────────────────

  const counts = await Promise.all([
    prisma.household.count(),
    prisma.user.count(),
    prisma.account.count(),
    prisma.debt.count(),
    prisma.recurringBill.count(),
    prisma.budget.count(),
    prisma.incomeSource.count(),
    prisma.adHocExpense.count(),
    prisma.netWorthSnapshot.count(),
    prisma.transaction.count(),
  ]);

  console.log(
    `Seeded: ${counts[0]} household · ${counts[1]} users · ${counts[2]} accounts · ` +
      `${counts[3]} debts · ${counts[4]} bills · ${counts[5]} budgets · ` +
      `${counts[6]} income sources · ${counts[7]} ad-hoc · ${counts[8]} snapshots · ` +
      `${counts[9]} transactions`,
  );
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
