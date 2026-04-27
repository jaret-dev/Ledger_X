# Railway CLI deploy — emergency handoff

**Audience:** OpenClaw Claude Code agent on Jaret's laptop. Bash access,
browser available for one auth click. Jaret is non-dev — assume zero
manual file editing.

**When to use this:** Railway's GitHub auto-deploy integration is stuck
and won't pull HEAD of `main` despite empty commits, branch toggles, and
disconnect-reconnect dances. The CLI bypasses GitHub entirely — uploads
the local repo state directly to Railway and triggers a build using
Railway's existing project config (env vars stay put).

**Last-known stuck state:** Railway is replaying commit `462c34e` (an
empty nudge commit from earlier in this session) on every retry instead
of advancing to `main` HEAD. Three attempts to deploy `462c34e` have
crashed because of a clerkMiddleware-globally-scoped bug. PR #9
(`fc4cec4`) on `main` fixes that bug. We need Railway to deploy any
commit ≥ `fc4cec4`.

---

## Steps

```bash
# 1. Clone the repo (or pull if a local copy exists)
git clone https://github.com/jaret-dev/Ledger_X.git /tmp/ledgerx-deploy
cd /tmp/ledgerx-deploy
git pull origin main           # ensure HEAD is the latest

# 2. Confirm we're on the right commit (should NOT be 462c34e)
git log --oneline -1
# Expect: 04a8db2 chore: push fresh SHA past fc4cec4 to unstick Railway
# Or any commit later than fc4cec4

# 3. Auth + link to Railway. First run opens a browser — Jaret approves once.
npx -y @railway/cli login
# Watch the output — it'll print a pairing code and open the browser.
# Jaret confirms in the browser; CLI returns "Logged in".

# 4. Link this directory to the Railway project
npx -y @railway/cli link
# Interactive picker — choose:
#   Workspace:  Jaret's personal workspace (only one)
#   Project:    confident-happiness (this is the Ledger_X project per Railway's UI)
#   Environment: production
#   Service:    Ledger_X  (NOT "Postgres" — that's the database)

# 5. Deploy. Uploads /tmp/ledgerx-deploy + triggers Railway's build pipeline.
npx -y @railway/cli up
# Output will stream. Build takes ~3 min. Watch for:
#   ✓ Build successful
#   ✓ Deployment live
# If it fails, the error message + log output is what you paste back into the conversation.
```

## Expected outcome

Within ~3 minutes of `railway up` completing:

1. New deployment row appears in Railway dashboard → Deployments tab → **ACTIVE**
2. The commit message will reference whatever HEAD was at clone time (`04a8db2` or later)
3. `/api/health` returns 200 with `{"status":"ok","db":"connected","..."}`
4. `/api/household` (no auth) returns 401 `{"error":"unauthenticated","message":"Sign in required"}`
   — that's the success signal. The Clerk middleware is now scoped + active.

## Verify

```bash
# Should return 200 with JSON {"status":"ok","db":"connected","timestamp":"..."}
curl -sS https://ledgerx-production.up.railway.app/api/health

# Should return 401 with {"error":"unauthenticated","message":"Sign in required"}
# This is the GOAL — different from the current "missing_household_id" response
curl -sS https://ledgerx-production.up.railway.app/api/household
```

If `/api/household` says `unauthenticated`, the deploy worked. Tell Jaret
to refresh his browser at `https://ledger-x-web.vercel.app/` — he's
already signed in via Clerk, so data populates immediately.

## If `railway up` itself fails

Most likely causes + fixes:

| Symptom | Fix |
|---|---|
| `Authentication required` on login step | `npx @railway/cli logout` then re-login |
| `Project not found` on link step | Run `npx @railway/cli list` to enumerate projects + double-check the name |
| `Service "Ledger_X" not found` | The service might be named differently — `npx @railway/cli service` lists them |
| Build fails inside Railway | Most likely a missing env var. The Railway dashboard's Variables tab is authoritative; this CLI deploy doesn't touch env vars |
| `Permission denied` on /tmp | Use `~/ledgerx-deploy` instead |

## Why not modify env vars from CLI

Railway's project Variables (`CLERK_SECRET_KEY`, `LEDGER_AGENT_KEY`,
`DATABASE_URL`, `PLAID_*`, etc.) are already correctly set in the
dashboard. `railway up` deploys code without touching env. Don't run
`railway variables set ...` — it's not needed and risks overwriting
something.

## Cleanup after success

```bash
# Optional — delete the temp checkout once the deploy is live
rm -rf /tmp/ledgerx-deploy
```

## Reporting back

After `railway up` finishes (success or failure), paste the last ~30
lines of its output into the chat with Jaret's session in this repo so
I can confirm. The poller running on my side will also catch the moment
production flips, but the CLI output is more diagnostic if anything
went sideways.
