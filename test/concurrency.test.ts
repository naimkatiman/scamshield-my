import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, VerdictRequest } from "../src/types";
import { evaluateVerdict } from "../src/core/verdictService";
import { collectProviderSignals } from "../src/providers";
import { buildCacheKey } from "../src/core/validation";

vi.mock("../src/providers", () => ({
  collectProviderSignals: vi.fn(async () => ({
    signals: [
      {
        source: "MockIdentity",
        score: 22,
        confidence: "medium",
        evidence: "Mock signal for concurrency test.",
        tags: ["mock"],
        category: "identity",
      },
      {
        source: "MockScanner",
        score: 18,
        confidence: "low",
        evidence: "Mock scanner signal for concurrency test.",
        tags: ["mock"],
        category: "scanner",
      },
      {
        source: "MockCommunity",
        score: 15,
        confidence: "low",
        evidence: "Mock community signal for concurrency test.",
        tags: ["mock"],
        category: "community",
      },
    ],
    errors: [],
    timings: {
      mock: 12,
    },
  })),
}));

const mockProviderResult = {
  signals: [
    {
      source: "MockIdentity",
      score: 22,
      confidence: "medium" as const,
      evidence: "Mock signal for concurrency test.",
      tags: ["mock"],
      category: "identity" as const,
    },
    {
      source: "MockScanner",
      score: 18,
      confidence: "low" as const,
      evidence: "Mock scanner signal for concurrency test.",
      tags: ["mock"],
      category: "scanner" as const,
    },
    {
      source: "MockCommunity",
      score: 15,
      confidence: "low" as const,
      evidence: "Mock community signal for concurrency test.",
      tags: ["mock"],
      category: "community" as const,
    },
  ],
  errors: [],
  timings: {
    mock: 12,
  },
};

function createMockKV() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string, type?: "text" | "json") => {
      const raw = store.get(key);
      if (!raw) {
        return null;
      }
      if (type === "json") {
        return JSON.parse(raw);
      }
      return raw;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
  return kv;
}

function createMockDB(initialRows: Record<string, { updated_at: string; verdict: "LEGIT" | "HIGH_RISK" | "UNKNOWN"; score: number; reasons_json: string; sources_json: string }> = {}): D1Database {
  const rows = new Map(Object.entries(initialRows));

  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async () => {
          const key = String(args[0] ?? "");
          if (sql.includes("SELECT * FROM verdict_cache")) {
            return rows.get(key) ?? null;
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => {
          if (sql.includes("INSERT INTO verdict_cache")) {
            rows.set(String(args[0]), {
              verdict: args[1] as "LEGIT" | "HIGH_RISK" | "UNKNOWN",
              score: Number(args[2]),
              reasons_json: String(args[3]),
              sources_json: String(args[4]),
              updated_at: String(args[5]),
            });
          }
          return { meta: { last_row_id: 1 } };
        }),
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
    JWT_SECRET: "test-jwt-secret",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "https://example.test/callback",
    ...overrides,
  };
}

const request: VerdictRequest = {
  type: "contract",
  value: "0x1234567890abcdef1234567890abcdef12345678",
};

describe("verdict concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates in-flight foreground evaluations for the same key", async () => {
    const env = makeEnv();

    const responses = await Promise.all(
      Array.from({ length: 30 }, () => evaluateVerdict(request, env)),
    );

    expect(collectProviderSignals).toHaveBeenCalledTimes(1);
    expect(new Set(responses.map((result) => result.result.verdict)).size).toBe(1);
    expect(responses[0].result.reasons).toHaveLength(3);
  });

  it("uses D1 updated_at when warming KV to keep cache timestamps coherent", async () => {
    const key = buildCacheKey(request.type, request.value, request.chain ?? "evm");
    const updatedAt = "2026-02-14T03:25:00.000Z";
    const db = createMockDB({
      [key]: {
        verdict: "UNKNOWN",
        score: 48,
        reasons_json: JSON.stringify(["r1", "r2", "r3"]),
        sources_json: JSON.stringify(["mock"]),
        updated_at: updatedAt,
      },
    });
    const cacheKv = createMockKV();
    const env = makeEnv({ DB: db, CACHE_KV: cacheKv });

    const result = await evaluateVerdict(request, env);
    expect(result.cached).toBe(true);

    const kvRaw = cacheKv._store.get(`verdict:${key}`);
    expect(kvRaw).toBeTruthy();
    const parsed = JSON.parse(kvRaw ?? "{}") as { updatedAt?: number };
    expect(parsed.updatedAt).toBe(new Date(updatedAt).getTime());
  });

  it("holds p95 behavior under burst load with a single provider fanout", async () => {
    vi.mocked(collectProviderSignals).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return mockProviderResult;
    });

    const env = makeEnv();
    const responses = await Promise.all(
      Array.from({ length: 250 }, () => evaluateVerdict(request, env)),
    );

    expect(collectProviderSignals).toHaveBeenCalledTimes(1);
    expect(responses).toHaveLength(250);
    expect(responses.every((response) => response.result.reasons.length === 3)).toBe(true);

    const key = buildCacheKey(request.type, request.value, request.chain ?? "evm");
    const kvRaw = (env.CACHE_KV as unknown as { _store: Map<string, string> })._store.get(`verdict:${key}`);
    expect(kvRaw).toBeTruthy();
  });

  it("keeps D1->KV stale cache state coherent under high concurrency", async () => {
    const key = buildCacheKey(request.type, request.value, request.chain ?? "evm");
    const staleUpdatedAt = "2026-02-14T01:00:00.000Z";
    const db = createMockDB({
      [key]: {
        verdict: "UNKNOWN",
        score: 52,
        reasons_json: JSON.stringify(["r1", "r2", "r3"]),
        sources_json: JSON.stringify(["mock"]),
        updated_at: staleUpdatedAt,
      },
    });
    const cacheKv = createMockKV();
    const env = makeEnv({ DB: db, CACHE_KV: cacheKv });

    const responses = await Promise.all(
      Array.from({ length: 120 }, () => evaluateVerdict(request, env)),
    );

    expect(collectProviderSignals).not.toHaveBeenCalled();
    expect((db as unknown as { prepare: ReturnType<typeof vi.fn> }).prepare).toHaveBeenCalledTimes(1);
    expect(responses.every((response) => response.cached)).toBe(true);
    expect(responses.every((response) => response.pendingEnrichment)).toBe(true);

    const kvRaw = cacheKv._store.get(`verdict:${key}`);
    expect(kvRaw).toBeTruthy();
    const parsed = JSON.parse(kvRaw ?? "{}") as { updatedAt?: number };
    expect(parsed.updatedAt).toBe(new Date(staleUpdatedAt).getTime());
  });
});
