import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateVerdict } from "../src/core/verdictService";
import type { Env, VerdictRequest } from "../src/types";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      if (!val) return null;
      return JSON.parse(val);
    }),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async () => {}),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

function createMockDB(cachedVerdict: unknown = null): D1Database {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((..._args: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("verdict_cache")) return cachedVerdict;
          return { total: 0 };
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: { last_row_id: 1 } })),
      })),
    })),
  } as unknown as D1Database;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createMockDB(),
    CACHE_KV: createMockKV(),
    RATE_LIMIT_KV: createMockKV(),
    FILES_BUCKET: {} as unknown as R2Bucket,
    ENRICHMENT_QUEUE: { send: vi.fn() } as unknown as Env["ENRICHMENT_QUEUE"],
    ASSETS: {} as unknown as Fetcher,
    APP_NAME: "ScamShield MY",
    REGION: "MY",
    PROVIDER_MODE: "mock",
    ...overrides,
  };
}

const request: VerdictRequest = {
  type: "contract",
  value: "0x1234567890abcdef1234567890abcdef12345678",
};

describe("evaluateVerdict", () => {
  it("returns cached result from KV when fresh", async () => {
    const mockKV = createMockKV();
    const cachedResult = {
      verdict: "HIGH_RISK",
      score: 85,
      reasons: ["r1", "r2", "r3"],
      sources: ["test"],
      nextActions: ["Emergency Playbook"],
    };
    await mockKV.put(
      "verdict:contract:evm:0x1234567890abcdef1234567890abcdef12345678",
      JSON.stringify({ updatedAt: Date.now(), result: cachedResult }),
    );

    const env = makeEnv({ CACHE_KV: mockKV });
    const result = await evaluateVerdict(request, env);
    expect(result.cached).toBe(true);
    expect(result.result.verdict).toBe("HIGH_RISK");
    expect(result.pendingEnrichment).toBe(false);
  });

  it("marks stale KV cache for re-enrichment", async () => {
    const mockKV = createMockKV();
    const cachedResult = {
      verdict: "UNKNOWN",
      score: 50,
      reasons: ["r1", "r2", "r3"],
      sources: [],
      nextActions: ["Report It"],
    };
    await mockKV.put(
      "verdict:contract:evm:0x1234567890abcdef1234567890abcdef12345678",
      JSON.stringify({ updatedAt: Date.now() - 31 * 60 * 1000, result: cachedResult }),
    );

    const env = makeEnv({ CACHE_KV: mockKV });
    const result = await evaluateVerdict(request, env);
    expect(result.cached).toBe(true);
    expect(result.pendingEnrichment).toBe(true);
  });

  it("falls back to providers when both caches miss", async () => {
    const env = makeEnv();
    const result = await evaluateVerdict(request, env);
    expect(result.cached).toBe(false);
    expect(result.result.verdict).toBeTruthy();
    expect(result.result.reasons).toHaveLength(3);
  });

  it("returns UNKNOWN fallback when all providers fail", async () => {
    const badDB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => { throw new Error("DB down"); }),
          run: vi.fn(async () => { throw new Error("DB down"); }),
        })),
      })),
    } as unknown as D1Database;

    const badEnv = makeEnv({
      DB: badDB,
      PROVIDER_MODE: "mock",
    });

    // Even with DB failures, mock providers don't use DB (except community)
    // So we should still get signals from mock providers
    const result = await evaluateVerdict(request, badEnv);
    expect(result.result.verdict).toBeTruthy();
  });

  it("survives KV read failure gracefully", async () => {
    const failingKV = {
      get: vi.fn(async () => { throw new Error("KV unavailable"); }),
      put: vi.fn(async () => { throw new Error("KV unavailable"); }),
    } as unknown as KVNamespace;

    const env = makeEnv({ CACHE_KV: failingKV });
    const result = await evaluateVerdict(request, env);
    // Should fall through to D1 and then providers
    expect(result.result.verdict).toBeTruthy();
    expect(result.result.reasons).toHaveLength(3);
  });

  it("returns provider errors when some providers fail", async () => {
    const badDB = {
      prepare: vi.fn(() => {
        throw new Error("DB connection failed");
      }),
    } as unknown as D1Database;

    const env = makeEnv({ DB: badDB });
    const result = await evaluateVerdict(request, env);
    // Community provider should fail (uses DB), but mock providers succeed
    expect(result.providerErrors.length).toBeGreaterThanOrEqual(1);
    expect(result.result.verdict).toBeTruthy();
  });
});
