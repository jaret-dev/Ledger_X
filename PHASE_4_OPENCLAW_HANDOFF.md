# Phase 4 — OpenClaw handoff

**Audience:** Claude Code agent running in `~/.openclaw/`. You make all
the changes, write the cron registration, edit `~/.openclaw/.env`. Jaret
is non-dev; assume zero manual file editing.

**Companion files (in this repo, `docs/`):**
- `ledger-plaid-sync.mjs` — full source for the sync script
- `ledger-soul-addendum.md` — text to append to Ledger's SOUL.md

This document is the spec; the two companion files are the artifacts
to copy verbatim.

---

## What you're connecting to

A finished personal-finance app called **LedgerX**, deployed at:

- **API:** `https://ledgerx-production.up.railway.app`
- **Web:** `https://ledger-x-web.vercel.app`
- **Source:** `https://github.com/jaret-dev/Ledger_X`

LedgerX has 5 ingest endpoints under `/api/ingest/*` plus a one-time
Plaid-link endpoint, all gated by an `x-agent-key` header. The full
contract is in `packages/shared-types/src/ingest.ts` of that repo.

You're building the laptop side: a Node ESM script that pulls from
Plaid Sandbox, classifies transactions through OpenClaw's gateway
(model `openclaw/ledger`, routed through Ledger SOUL), and POSTs to
those endpoints on a cron.

---

## Phase 4 done-when

- [x] LedgerX API ingest endpoints shipped (PR #5 + #6 in jaret-dev/Ledger_X)
- [ ] `~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs` exists and runs
- [ ] `~/.openclaw/.env` has the 6 vars below
- [ ] `~/.openclaw/workspace/agents/ledger/SOUL.md` has the §LedgerX section
- [ ] Cron registered: hourly during dev, eventually 04:00 daily
- [ ] First successful sync writes rows to LedgerX production DB
- [ ] `https://ledger-x-web.vercel.app/transactions` shows new transactions

---

## Step 1 — Drop the script in place

Source file: `docs/ledger-plaid-sync.mjs` in the LedgerX repo (sibling
to this doc). Copy verbatim to:

```
~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs
chmod +x ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs
```

**Do not rewrite.** It's been verified end-to-end against a local
Postgres mirroring production. It uses Node 18+ built-in `fetch`, no
npm install needed, no Plaid SDK dependency.

The script supports three modes:

| Invocation | Effect |
|---|---|
| `node ledger-plaid-sync.mjs` | Run sync (the cron-triggered one) |
| `node ledger-plaid-sync.mjs --bootstrap` | One-time: create a Plaid sandbox item and link it to the first unlinked LedgerX account |
| `node ledger-plaid-sync.mjs --status` | Read-only diagnostic — print account linkage + cursor state |

---

## Step 2 — Add 6 env vars to `~/.openclaw/.env`

```bash
# LedgerX agent (Phase 4)
LEDGER_API_URL=https://ledgerx-production.up.railway.app
LEDGER_AGENT_KEY=48eb91d485195fe2cf14c9c73901fa2b2825242ef2b434e2bf97a9e7c9fb4b2e
PLAID_CLIENT_ID=69eaa2ba4b7336000d42de0c
PLAID_SECRET=<sandbox secret from https://dashboard.plaid.com/developers/keys>
PLAID_ENV=sandbox
PLAID_COUNTRY_CODES=CA
```

Notes:
- `LEDGER_AGENT_KEY` matches the value already set on Railway. If it
  doesn't, the sync will get 403 `invalid_agent_key`. Confirm parity
  with Railway → Ledger_X service → Variables → `LEDGER_AGENT_KEY`.
- `PLAID_CLIENT_ID` is the public client_id from Jaret's Plaid
  dashboard; it's not sensitive.
- `PLAID_SECRET` IS sensitive. Use the **Sandbox** secret (the third
  field on the Keys page), not the Production one.
- `OPENCLAW_GATEWAY_TOKEN` already exists in `~/.openclaw/.env` from
  prior agent setup; the script reads it for categorization.

Per the standing OpenClaw rule (top of `~/.openclaw/CLAUDE.md`): **no
LLM provider keys land in this codebase or env**. Categorization goes
through the local gateway at `http://localhost:18789/v1/chat/completions`
using `model: 'openclaw/ledger'`.

---

## Step 3 — Append to Ledger's SOUL

Source: `docs/ledger-soul-addendum.md` in the LedgerX repo. Append its
contents to:

```
~/.openclaw/workspace/agents/ledger/SOUL.md
```

The script's gateway call uses a system prompt that says "Categorize
per Ledger SOUL §LedgerX. JSON only." — so the section heading
(`## §LedgerX — categorization protocol`) must match exactly.

---

## Step 4 — Bootstrap (one-time, sandbox only)

```bash
node ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs --bootstrap
```

Expected output:

```
Bootstrapping Plaid sandbox item...
  → will link to account #1 "TD Chequing"
  ✓ sandbox public_token created
  ✓ exchanged for access_token (item ABC...)
  ✓ selected Plaid account: Plaid Checking
  ✓ linked: TD Chequing ↔ vXyZ...

Bootstrap complete. Run without --bootstrap to sync.
```

What this does:
1. Calls `GET /api/ingest/accounts` to find an account in LedgerX with
   no Plaid linkage yet (the first one — TD Chequing).
2. Calls Plaid `/sandbox/public_token/create` with institution
   `ins_109508` (Plaid's primary sandbox bank, "First Platypus Bank").
3. Exchanges that public token for an access token.
4. Calls Plaid `/accounts/get` to enumerate the sandbox accounts under
   that item; picks the one matching our account's type
   (depository/credit/loan/investment).
5. POSTs to `/api/ingest/accounts/1/plaid-link` with the access token,
   item ID, and Plaid's account ID — LedgerX stores these on the
   Account row.

Idempotent: if the account is already linked, prints "All accounts
already linked" and exits cleanly.

After bootstrap, only one account is linked. To link more accounts
later (Amex, RBC, etc), re-run `--bootstrap` once per account. Each
run picks the next unlinked account.

---

## Step 5 — First sync

```bash
node ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs
```

Expected output:

```
Syncing 1 account(s)…

[TD Chequing]
  Plaid: 16 added, 0 modified
  → POSTed: created 16, updated 0
  → balance: $43528.97

Sync complete.
```

(Sandbox returns ~16 fake transactions over the last 60 days.)

What ran:
1. `GET /api/ingest/accounts` to enumerate linked accounts.
2. For each linked account: Plaid `/transactions/sync` (paginated until
   `has_more === false`).
3. For each transaction: gateway categorization via
   `model: 'openclaw/ledger'`.
4. `POST /api/ingest/transactions` with the categorized batch + the
   `next_cursor` from Plaid. LedgerX writes transactions and advances
   the cursor atomically — re-running the script picks up where the
   last left off.
5. `POST /api/ingest/balances` with current/available/limit balances.
6. (For credit/loan accounts) `POST /api/ingest/liabilities` with APR,
   minimum payment, due day.
7. `POST /api/ingest/sync-log` at the end with status + duration.

---

## Step 6 — Verify

In a browser, open `https://ledger-x-web.vercel.app/transactions`. You
should see the 16 sandbox transactions appear (merchants like "United
Airlines", "McDonald's", etc — Plaid's canned data, not Toronto
merchants). Each has a category assigned by Ledger.

Or via CLI:

```bash
node ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs --status
```

```
Ledger has 11 account(s):
  ✓ linked  #1  TD Chequing                  depository  cursor: vXyZ...
    unlinked  #2  TD High-Interest Savings    depository  no cursor
  ...
```

Re-running `node ledger-plaid-sync.mjs` (sync mode) on a freshly-bootstrapped
account should produce `created 0, updated N` — the cursor advanced
on the first run, the next run only picks up new/modified rows.

---

## Step 7 — Register cron

OpenClaw cron command — adjust path if Node lives elsewhere:

```bash
openclaw cron edit \
  --agent ledger \
  --name "LedgerX Plaid Sync (hourly during dev)" \
  --schedule "0 * * * *" \
  --tz "America/Toronto" \
  --message 'Exec the LedgerX sync: exec({ command: "/opt/homebrew/bin/node /Users/jaret/.openclaw/scripts/pulls/ledger-plaid-sync.mjs" }). If exit 0: HEARTBEAT_OK. If non-zero: FAILED with last 300 chars of stderr.'
```

Hourly during Phase 4 development (so failures surface fast). Switch
to nightly once stable:

```
--schedule "0 4 * * *"
```

per `BUILD_PLAN.md §7` ("4:00 AM daily"). The launchd-run.sh wrapper
already in place across the OpenClaw fleet handles non-zero exits
(auto-files a support ticket + Slack DM to Jaret).

---

## Step 8 — Sanity check + signal back

After cron is registered, the next hour's run should leave a row in
LedgerX's `SyncLog` table. Confirm via:

```bash
curl -sS -H "x-agent-key: $LEDGER_AGENT_KEY" \
  "$LEDGER_API_URL/api/ingest/accounts" | jq '.accounts[] | select(.plaidAccessToken != null) | {nickname, plaidSyncCursor, lastSyncedAt}'
```

(or use the `--status` mode of the script).

If `lastSyncedAt` is within the last hour, you're done.

---

## Failure modes + debugging

| Symptom | Cause | Fix |
|---|---|---|
| `401 missing_agent_key` | Header not being sent | Confirm script env loaded `LEDGER_AGENT_KEY` |
| `403 invalid_agent_key` | Key mismatch | Compare local `.env` value to Railway env var, character-by-character |
| `404 account_not_found` on `/plaid-link` | Account ID doesn't exist | Run `--status` to see real account IDs; `--bootstrap` should pick automatically |
| `400 account_is_manual` on `/plaid-link` | Tried to link OSAP or other manual-only account | Pick a different account; OSAP stays manual permanently |
| Plaid `/transactions/sync` returns empty | Sandbox item only generates txns going back ~30 days; or no events yet | Run sandbox webhook to fire transactions: `curl -X POST https://sandbox.plaid.com/sandbox/item/fire_webhook -H "Content-Type: application/json" -d '{"client_id":"...","secret":"...","access_token":"...","webhook_code":"DEFAULT_UPDATE"}'` |
| Gateway returns 500 | OpenClaw gateway is down | Falls through to `{category: "other", confidence: 0.5}` per the script's catch-all; check gateway logs |
| Categorization returns wrong category | SOUL.md missing §LedgerX section, or section name doesn't match | Verify the SOUL.md addendum is in place with the exact heading |
| Script exits 0 but no rows appear in UI | Account ID mismatch — Plaid returned txns for a different sub-account | The script filters to `account_id === plaidAccountId` to avoid this; check `--status` output for the linked Plaid account ID |

The launchd wrapper handles non-zero exits automatically — if a sync
fails, Jaret gets a Slack DM with the last 300 chars of stderr.

---

## What stays in LedgerX (don't touch)

You don't need to modify anything in `jaret-dev/Ledger_X`. The 5
ingest endpoints + the Plaid-link endpoint are stable. If you find
yourself wanting to change LedgerX behaviour, stop and tell Jaret —
that's a cross-repo change that needs a Ledger_X PR.

The contract in `packages/shared-types/src/ingest.ts` is the source of
truth for request/response shapes. The script in `docs/ledger-plaid-sync.mjs`
already conforms; copy it verbatim.

---

## Phase 5+ preview (for context, not for action)

- **Phase 5:** Clerk auth replaces stub `x-household-id`. `x-agent-key`
  stays exactly as is — no agent script changes needed.
- **Phase 6:** Co-pilot chat lives on Railway, NOT on the laptop. It
  needs its own gateway access (separate from the local-laptop
  gateway). That's a future problem with three options Jaret already
  laid out: tunnel, thin proxy, or a single carve-out provider key
  for that surface.
- **Phase 7:** Production Plaid. Same agent script, but `PLAID_ENV`
  flips to `production` and `PLAID_SECRET` to the production secret.
  A web-side Plaid Link flow (in the LedgerX repo, not OpenClaw) adds
  new accounts; the agent's bootstrap mode becomes redundant.

None of those affect the agent script you're writing now.
