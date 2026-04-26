#!/usr/bin/env node
/**
 * ledger-plaid-sync.mjs — OpenClaw Ledger agent's Plaid Sandbox sync.
 *
 * Lives at:    ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs
 * Triggered by: openclaw cron edit (see PHASE_4_OPENCLAW_HANDOFF.md)
 * Modes:
 *   default     run the nightly sync
 *   --bootstrap one-time: create a Plaid sandbox item and link to first
 *               unlinked account
 *   --status    print account linkage + cursor state, no writes
 *
 * Reads from process.env (loaded by OpenClaw's standard env mechanism):
 *   LEDGER_API_URL
 *   LEDGER_AGENT_KEY
 *   PLAID_CLIENT_ID
 *   PLAID_SECRET
 *   PLAID_ENV               default "sandbox"
 *   OPENCLAW_GATEWAY_TOKEN  for transaction categorization
 *
 * No npm install needed — uses Node 18+ built-in fetch.
 */

const env = (k, fallback) => {
  const v = process.env[k] ?? fallback;
  if (!v) {
    console.error(`ERROR: ${k} not set`);
    process.exit(1);
  }
  return v;
};

const LEDGER_API_URL = env("LEDGER_API_URL");
const LEDGER_AGENT_KEY = env("LEDGER_AGENT_KEY");
const PLAID_CLIENT_ID = env("PLAID_CLIENT_ID");
const PLAID_SECRET = env("PLAID_SECRET");
const PLAID_ENV = env("PLAID_ENV", "sandbox");
const OPENCLAW_GATEWAY_TOKEN = env("OPENCLAW_GATEWAY_TOKEN");

const PLAID_BASE = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
}[PLAID_ENV];
if (!PLAID_BASE) {
  console.error(`ERROR: invalid PLAID_ENV: ${PLAID_ENV}`);
  process.exit(1);
}

// ─── Plaid REST wrapper ────────────────────────────────────────

async function plaid(path, body) {
  const res = await fetch(`${PLAID_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      ...body,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Plaid ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ─── Ledger API wrapper ────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(`${LEDGER_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-agent-key": LEDGER_AGENT_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`Ledger ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ─── Categorization via OpenClaw gateway ───────────────────────

const CATEGORIES = [
  "groceries", "gas", "dining", "entertainment", "household",
  "transport", "travel", "gifts", "medical", "subscription",
  "income", "debt_payment", "transfer", "other",
];

async function categorizeOne(txn) {
  try {
    const res = await fetch("http://localhost:18789/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openclaw/ledger",
        messages: [
          {
            role: "system",
            content:
              "Categorize this Canadian (Toronto) bank transaction per Ledger SOUL §LedgerX. JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              merchantName: txn.merchant_name,
              merchantRaw: txn.name,
              amount: txn.amount,
              date: txn.date,
            }),
          },
        ],
        max_tokens: 200,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "transaction_category",
            schema: {
              type: "object",
              required: ["category", "confidence"],
              properties: {
                category: { type: "string", enum: CATEGORIES },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reasoning: { type: "string" },
              },
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn(`Gateway ${res.status} for ${txn.transaction_id}, default other/0.5`);
      return { category: "other", confidence: 0.5 };
    }
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.warn(`Gateway error for ${txn.transaction_id}: ${err.message}, default other/0.5`);
    return { category: "other", confidence: 0.5 };
  }
}

async function categorize(transactions) {
  // Parallel batch — gateway handles concurrency, no need to throttle ourselves
  return Promise.all(transactions.map(categorizeOne));
}

// ─── Bootstrap (one-time sandbox setup) ────────────────────────

async function bootstrap() {
  if (PLAID_ENV !== "sandbox") {
    console.error("ERROR: --bootstrap is sandbox-only. Production uses Plaid Link UI (Phase 7).");
    process.exit(1);
  }
  console.log("Bootstrapping Plaid sandbox item...");

  const { accounts } = await api("GET", "/api/ingest/accounts");
  const target = accounts.find((a) => a.plaidAccessToken === null);
  if (!target) {
    console.log("All accounts already linked. Run without --bootstrap.");
    return;
  }
  console.log(`  → will link to account #${target.id} "${target.nickname}"`);

  const { public_token } = await plaid("/sandbox/public_token/create", {
    institution_id: "ins_109508", // First Platypus Bank — Plaid's main test inst
    initial_products: ["transactions"],
  });
  console.log("  ✓ sandbox public_token created");

  const { access_token, item_id } = await plaid("/item/public_token/exchange", {
    public_token,
  });
  console.log(`  ✓ exchanged for access_token (item ${item_id.slice(0, 14)}…)`);

  const { accounts: plaidAccounts } = await plaid("/accounts/get", { access_token });
  const matchByType =
    plaidAccounts.find((a) => a.type === target.type) ?? plaidAccounts[0];
  console.log(`  ✓ selected Plaid account: ${matchByType.name}`);

  const linked = await api(
    "POST",
    `/api/ingest/accounts/${target.id}/plaid-link`,
    {
      plaidAccessToken: access_token,
      plaidItemId: item_id,
      plaidAccountId: matchByType.account_id,
    },
  );
  console.log(`  ✓ linked: ${linked.nickname} ↔ ${linked.plaidAccountId}`);
  console.log("\nBootstrap complete. Run without --bootstrap to sync.");
}

// ─── Sync (the cron-triggered flow) ────────────────────────────

async function syncAccount(account) {
  console.log(`\n[${account.nickname}]`);

  // Loop /transactions/sync until has_more is false
  let cursor = account.plaidSyncCursor;
  const added = [];
  const modified = [];
  let nextCursor = cursor;
  while (true) {
    const r = await plaid("/transactions/sync", {
      access_token: account.plaidAccessToken,
      cursor: cursor || undefined,
    });
    added.push(...r.added);
    modified.push(...r.modified);
    nextCursor = r.next_cursor;
    if (!r.has_more) break;
    cursor = r.next_cursor;
  }
  console.log(`  Plaid: ${added.length} added, ${modified.length} modified`);

  const all = [...added, ...modified];
  const categories = all.length ? await categorize(all) : [];

  const myId = account.plaidAccountId;
  const transactions = all
    .map((t, i) => ({ ...t, _cat: categories[i] }))
    .filter((t) => t.account_id === myId)
    .map((t) => ({
      plaidTransactionId: t.transaction_id,
      date: t.date,
      amount: t.amount,
      merchantName: t.merchant_name ?? null,
      merchantRaw: t.name,
      description: null,
      isPending: t.pending ?? false,
      suggestedCategory: t._cat.category,
      categoryConfidence: t._cat.confidence,
    }));

  if (transactions.length > 0 || nextCursor !== cursor) {
    const r = await api("POST", "/api/ingest/transactions", {
      source: "plaid",
      accountPlaidId: myId,
      nextCursor,
      transactions,
    });
    console.log(`  → POSTed: created ${r.created}, updated ${r.updated}`);
  }

  // Balance snapshot
  const { accounts: bal } = await plaid("/accounts/balance/get", {
    access_token: account.plaidAccessToken,
  });
  const myBal = bal.find((a) => a.account_id === myId);
  if (myBal) {
    await api("POST", "/api/ingest/balances", {
      source: "plaid",
      snapshots: [
        {
          accountPlaidId: myId,
          currentBalance: myBal.balances.current ?? 0,
          availableBalance: myBal.balances.available ?? null,
          creditLimit: myBal.balances.limit ?? null,
          recordedAt: new Date().toISOString(),
        },
      ],
    });
    console.log(`  → balance: $${myBal.balances.current}`);
  }

  // Liabilities (credit cards / loans only — sandbox data is sparse)
  if (account.type === "credit" || account.type === "loan") {
    try {
      const liab = await plaid("/liabilities/get", {
        access_token: account.plaidAccessToken,
      });
      const allLiab = [
        ...(liab.liabilities?.credit ?? []),
        ...(liab.liabilities?.student ?? []),
      ];
      const my = allLiab.find((l) => l.account_id === myId);
      if (my) {
        await api("POST", "/api/ingest/liabilities", {
          source: "plaid",
          liabilities: [
            {
              accountPlaidId: myId,
              balance: my.last_statement_balance ?? myBal?.balances.current ?? 0,
              apr: Number(my.aprs?.[0]?.apr_percentage ?? 0),
              minPayment: Number(my.minimum_payment_amount ?? 0),
              dueDayOfMonth: my.next_payment_due_date
                ? new Date(my.next_payment_due_date).getUTCDate()
                : null,
            },
          ],
        });
        console.log(`  → liability updated`);
      }
    } catch (err) {
      console.warn(`  liabilities not available: ${err.message}`);
    }
  }

  return { created: transactions.length };
}

async function sync() {
  const startedAt = new Date().toISOString();
  let totalProcessed = 0;
  const errors = [];

  try {
    const { accounts } = await api("GET", "/api/ingest/accounts");
    const linked = accounts.filter((a) => a.plaidAccessToken !== null);
    if (linked.length === 0) {
      console.log("No Plaid-linked accounts. Run with --bootstrap first.");
      process.exit(0);
    }
    console.log(`Syncing ${linked.length} account(s)…`);

    for (const a of linked) {
      try {
        const r = await syncAccount(a);
        totalProcessed += r.created;
      } catch (err) {
        console.error(`  FAILED: ${a.nickname}: ${err.message}`);
        errors.push({ account: a.nickname, error: err.message });
      }
    }

    const status =
      errors.length === 0
        ? "success"
        : errors.length === linked.length
          ? "failed"
          : "partial";
    await api("POST", "/api/ingest/sync-log", {
      source: "plaid",
      status,
      itemsProcessed: totalProcessed,
      errorMessage: errors.length ? JSON.stringify(errors) : null,
      metadata: {
        accountsSynced: linked.length - errors.length,
        accountsFailed: errors.length,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
      startedAt,
      completedAt: new Date().toISOString(),
    });

    if (errors.length > 0) process.exit(1);
    console.log("\nSync complete.");
  } catch (err) {
    await api("POST", "/api/ingest/sync-log", {
      source: "plaid",
      status: "failed",
      itemsProcessed: totalProcessed,
      errorMessage: err.message,
      metadata: null,
      startedAt,
      completedAt: new Date().toISOString(),
    }).catch(() => {});
    throw err;
  }
}

// ─── Status (read-only diagnostic) ─────────────────────────────

async function status() {
  const { accounts } = await api("GET", "/api/ingest/accounts");
  console.log(`Ledger has ${accounts.length} account(s):`);
  for (const a of accounts) {
    const flag = a.plaidAccessToken ? "✓ linked" : "  unlinked";
    const cur = a.plaidSyncCursor
      ? `cursor: ${a.plaidSyncCursor.slice(0, 24)}…`
      : "no cursor";
    console.log(
      `  ${flag}  #${a.id}  ${a.nickname.padEnd(30)} ${a.type.padEnd(11)} ${cur}`,
    );
  }
}

// ─── Main ──────────────────────────────────────────────────────

const arg = process.argv[2];
if (arg === "--bootstrap") await bootstrap();
else if (arg === "--status") await status();
else await sync();
