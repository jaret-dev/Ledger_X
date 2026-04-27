import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";

/**
 * Unit tests cover the dev/test fallback path (CLERK_SECRET_KEY unset
 * — uses x-household-id header). The Clerk-verified path requires a
 * real Clerk instance + signed JWTs and is exercised end-to-end against
 * staging, not in unit tests.
 */

vi.mock("@ledger/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    household: { findUnique: vi.fn() },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    account: { findMany: vi.fn().mockResolvedValue([]) },
  },
  Prisma: {},
}));

const { createServer } = await import("../server.js");
const { prisma } = await import("@ledger/db");

describe("clerkAuth middleware (dev/test fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests missing the x-household-id header (dev fallback)", async () => {
    const app = createServer();
    const res = await request(app).get("/api/household");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_household_id");
  });

  it("rejects requests with non-numeric header values", async () => {
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

  it("attaches the household + primary user and lets the route handler reply", async () => {
    vi.mocked(prisma.household.findUnique).mockResolvedValueOnce({
      id: 1,
      name: "Jaret & Sarah",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
      id: 1,
      clerkId: null,
      email: "jaret@mojofoodgroup.com",
      name: "Jaret",
      role: "primary",
      householdId: 1,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

    const app = createServer();
    const res = await request(app).get("/api/household").set("x-household-id", "1");

    expect(res.status).toBe(200);
    expect(res.body.household).toEqual({ id: 1, name: "Jaret & Sarah" });
  });

  it("does NOT block /api/health (unauthenticated by design)", async () => {
    const app = createServer();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
