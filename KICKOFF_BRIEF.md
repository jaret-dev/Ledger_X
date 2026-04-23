# Ledger — Claude Code Kickoff Brief

Paste this as your opening message to Claude Code in a fresh session. It references the full `BUILD_PLAN.md` which you should include in the repo root or paste after this brief.

---

You are the lead developer on **Ledger**, a personal finance PWA for Jaret and his partner Sarah. 

Before writing any code, read `BUILD_PLAN.md` in full. It defines the stack, schema, phases, and guardrails. It is the source of truth. Do not deviate without asking.

**Your immediate task: Phase 1 — Foundation.**

Build exactly what's specified in §3 of BUILD_PLAN.md:
1. Initialize the pnpm monorepo with Turborepo
2. Set up `packages/db` with Prisma and the complete schema from §4
3. Stand up `apps/api` with Express, Zod, Prisma — just the `/api/health` endpoint
4. Stand up `apps/web` with Vite + React + TS + Tailwind — just a hello-world page pulling from the API
5. Write the seed script (§3.8) with the canonical mock dataset matching the HTML mockups
6. Deploy to Vercel (web) and Railway (api + postgres) via CI from day one

Do not start Phase 2 until Phase 1 is complete, deployed, and I've confirmed it looks right.

**Design source of truth:** The HTML mockups live in `design/mockups/` (I'll paste them in). They define every color, font, spacing value, and component. Port them to React — do not redesign.

**Context about me:** I'm the Director of Operations at Mojo Food Group (a Harvey's franchisee group plus Buon Gusto). I also run TGCS Co. and I've built OpenClaw, a multi-agent automation platform for my restaurants. The Ledger agent will be a new OpenClaw agent, living in my existing OpenClaw repo — NOT inside the Ledger monorepo. For Phase 1-3 the agent doesn't exist yet; we just build the web app and API with a seeded mock dataset.

**What I'll provide:**
- The 9 HTML mockup files (paste into `design/mockups/`)
- Environment variables for Vercel/Railway once you scaffold
- Answers to any ambiguity before you start coding

**Workflow:**
- One PR per phase maximum. Smaller PRs preferred.
- Every PR must pass `pnpm lint && pnpm typecheck && pnpm test` before merge.
- Commit messages explain *why*, not just *what*.
- Ask before adding any dependency not already in BUILD_PLAN.md.
- Ask before changing the Prisma schema.
- Keep `CHANGELOG.md` updated.

**First message back to me:**
1. Confirm you've read BUILD_PLAN.md and have no blocking questions about Phase 1
2. List any clarifications you need before you start
3. Propose the first commit (empty scaffolded monorepo, no features yet)

Let's go.
