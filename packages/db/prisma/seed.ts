/**
 * Ledger — canonical seed dataset.
 *
 * BUILD_PLAN §3.8: "the canonical mock dataset matching the HTML mockups".
 * This file is intentionally a placeholder until the mockup numbers have been
 * transcribed into structured fixtures. Running it today will create only the
 * Household + both Users (Jaret + Sarah), so the app can boot against a real
 * DB while the full seed is ported from `design/mockups/`.
 *
 * The real seed (accounts, debts, budgets, bills, income sources, ad-hoc
 * expenses, net worth snapshot, representative transactions) lands in a
 * follow-up commit on this branch once the mockup values have been extracted.
 *
 * Idempotency contract: running this script twice must not create duplicates.
 * We key on natural identifiers (User.email, Account.plaidAccountId or
 * (householdId, nickname), etc) via `upsert`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  const household = await prisma.household.upsert({
    where: { id: 1 },
    update: { name: "Jaret & Sarah" },
    create: { id: 1, name: "Jaret & Sarah" },
  });

  await prisma.user.upsert({
    where: { email: "jaret@mojofoodgroup.com" },
    update: { name: "Jaret", role: "primary", householdId: household.id },
    create: {
      email: "jaret@mojofoodgroup.com",
      name: "Jaret",
      role: "primary",
      householdId: household.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "sarah@example.com" },
    update: { name: "Sarah", role: "member", householdId: household.id },
    create: {
      email: "sarah@example.com",
      name: "Sarah",
      role: "member",
      householdId: household.id,
    },
  });

  console.log(`Seeded household ${household.id} (${household.name}) with 2 users.`);
  console.log("NOTE: placeholder seed only — accounts/debts/budgets/bills/income/adhoc");
  console.log("      will land in the next commit once mockup numbers are transcribed.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
