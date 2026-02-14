import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "../src/core/rateLimit";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

describe("checkRateLimit", () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it("allows the first request", async () => {
    const result = await checkRateLimit(kv, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("allows requests within the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv, "test:key", 10, 60);
    }
    const result = await checkRateLimit(kv, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding the limit", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(kv, "test:key", 10, 60);
    }
    const result = await checkRateLimit(kv, "test:key", 10, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets counter after window expires", async () => {
    // Fill up the limit
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(kv, "test:key", 10, 1);
    }

    // Simulate time passing (modify stored counter to have expired resetAt)
    const stored = await kv.get("test:key");
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.resetAt = Date.now() - 1000; // expired
      await kv.put("test:key", JSON.stringify(parsed));
    }

    const result = await checkRateLimit(kv, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("handles corrupted KV data gracefully", async () => {
    await kv.put("test:key", "not-valid-json{{{");
    const result = await checkRateLimit(kv, "test:key", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("tracks separate keys independently", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(kv, "key:a", 10, 60);
    }
    const blocked = await checkRateLimit(kv, "key:a", 10, 60);
    const allowed = await checkRateLimit(kv, "key:b", 10, 60);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it("returns correct resetAt timestamp", async () => {
    const before = Date.now();
    const result = await checkRateLimit(kv, "test:key", 10, 60);
    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60_000);
  });
});
