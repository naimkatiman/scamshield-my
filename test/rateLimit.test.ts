import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../src/core/rateLimit";

interface CounterRow {
  count: number;
  reset_at: number;
}

function createMockDB(): D1Database {
  const counters = new Map<string, CounterRow>();

  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          if (sql.includes("INSERT INTO rate_limit_counters")) {
            const key = String(args[0]);
            const nextResetAt = Number(args[1]);
            const nowForCountReset = Number(args[2]);
            const nowForWindowReset = Number(args[3]);
            const resetAtForWindow = Number(args[4]);

            const existing = counters.get(key);
            if (!existing) {
              counters.set(key, { count: 1, reset_at: nextResetAt });
            } else {
              const expiredForCount = existing.reset_at <= nowForCountReset;
              const expiredForWindow = existing.reset_at <= nowForWindowReset;
              counters.set(key, {
                count: expiredForCount ? 1 : existing.count + 1,
                reset_at: expiredForWindow ? resetAtForWindow : existing.reset_at,
              });
            }
          }
          return { meta: { changes: 1 } };
        },
        first: async () => {
          if (sql.includes("SELECT count, reset_at FROM rate_limit_counters")) {
            const key = String(args[0]);
            const row = counters.get(key);
            return row ? { count: row.count, reset_at: row.reset_at } : null;
          }
          return null;
        },
      }),
    }),
  } as unknown as D1Database;
}

describe("checkRateLimit", () => {
  let db: D1Database;

  beforeEach(() => {
    db = createMockDB();
  });

  it("allows the first request", async () => {
    const result = await checkRateLimit(db, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("allows requests within the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(db, "test:key", 10, 60);
    }
    const result = await checkRateLimit(db, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding the limit", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(db, "test:key", 10, 60);
    }
    const result = await checkRateLimit(db, "test:key", 10, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets counter after window expires", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(db, "test:key", 10, 1);
    }

    // Simulate expiry by advancing fake clock through Date.now monkey patch.
    const originalNow = Date.now;
    Date.now = () => originalNow() + 2_000;
    try {
      const result = await checkRateLimit(db, "test:key", 10, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    } finally {
      Date.now = originalNow;
    }
  });

  it("tracks separate keys independently", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(db, "key:a", 10, 60);
    }
    const blocked = await checkRateLimit(db, "key:a", 10, 60);
    const allowed = await checkRateLimit(db, "key:b", 10, 60);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it("returns correct resetAt timestamp", async () => {
    const before = Date.now();
    const result = await checkRateLimit(db, "test:key", 10, 60);
    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60_000);
  });
});
