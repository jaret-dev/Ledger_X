import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("@ledger/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    household: { findUnique: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    account: { findMany: vi.fn().mockResolvedValue([]) },
  },
  Prisma: {},
}));

const { createServer } = await import("../server.js");

describe("agentAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects /api/ingest/accounts when x-agent-key is missing", async () => {
    const app = createServer();
    const res = await request(app).get("/api/ingest/accounts");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_agent_key");
  });

  it("rejects /api/ingest/accounts with the wrong key", async () => {
    const app = createServer();
    const res = await request(app)
      .get("/api/ingest/accounts")
      .set("x-agent-key", "wrong-key-of-the-right-length-but-no-match");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("invalid_agent_key");
  });

  it("accepts the configured key (env defaults to 'dev-agent-key' under vitest)", async () => {
    const app = createServer();
    const res = await request(app)
      .get("/api/ingest/accounts")
      .set("x-agent-key", "dev-agent-key");
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  it("does NOT bleed agent auth into the user-facing /api/* routes", async () => {
    const app = createServer();
    // Sending the agent key to /api/household should NOT bypass householdAuth
    const res = await request(app)
      .get("/api/household")
      .set("x-agent-key", "dev-agent-key");
    expect(res.status).toBe(401); // still requires x-household-id
  });
});
