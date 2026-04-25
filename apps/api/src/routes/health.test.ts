import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { HealthResponse } from "@ledger/shared-types";

// Stub the Prisma client before importing the server so we don't need a
// live Postgres in CI. Phase 2+ integration tests can use a real DB.
vi.mock("@ledger/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

const { createServer } = await import("../server.js");
const { prisma } = await import("@ledger/db");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status ok with db connected when Postgres responds", async () => {
    const app = createServer();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    const parsed = HealthResponse.parse(res.body);
    expect(parsed.status).toBe("ok");
    expect(parsed.db).toBe("connected");
    expect(new Date(parsed.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("reports db disconnected when the query throws", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("boom"));

    const app = createServer();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    const parsed = HealthResponse.parse(res.body);
    expect(parsed.db).toBe("disconnected");
  });
});
