import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("@ledger/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    household: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { createServer } = await import("../server.js");
const { prisma } = await import("@ledger/db");

describe("householdAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests missing the x-household-id header", async () => {
    const app = createServer();
    const res = await request(app).get("/api/household");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_household_id");
  });

  it("rejects non-numeric header values", async () => {
    const app = createServer();
    const res = await request(app).get("/api/household").set("x-household-id", "abc");

    expect(res.status).toBe(401);
  });

  it("404s when the household doesn't exist", async () => {
    vi.mocked(prisma.household.findUnique).mockResolvedValueOnce(null);

    const app = createServer();
    const res = await request(app).get("/api/household").set("x-household-id", "999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("household_not_found");
  });

  it("attaches the household and lets the route handler reply", async () => {
    vi.mocked(prisma.household.findUnique).mockResolvedValueOnce({
      id: 1,
      name: "Jaret & Sarah",
    } as never);

    const app = createServer();
    const res = await request(app).get("/api/household").set("x-household-id", "1");

    expect(res.status).toBe(200);
    expect(res.body.household).toEqual({ id: 1, name: "Jaret & Sarah" });
    expect(res.body.users).toEqual([]);
  });

  it("does NOT block /api/health", async () => {
    const app = createServer();
    const res = await request(app).get("/api/health");

    // No auth header sent — should still return 200 because health is mounted
    // on the unprotected branch.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
