import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, ProviderSignal, VerdictRequest } from "../src/types";
import type { Provider } from "../src/providers/types";

const externalGetSignals = vi.fn(async () => {
  throw new Error("unexpected upstream payload");
});

const flakyExternalProvider: Provider = {
  name: "flaky_external",
  external: true,
  getSignals: externalGetSignals,
};

const communityProviderSignal: ProviderSignal = {
  source: "CommunityDB",
  score: 5,
  confidence: "low",
  evidence: "No community reports match this identifier in the last 7 days.",
  tags: ["no_community_hit"],
  category: "community",
};

vi.mock("../src/providers/mockProviders", () => ({
  createMockProviders: () => [flakyExternalProvider],
}));

vi.mock("../src/providers/liveProviders", () => ({
  createLiveProviders: () => [flakyExternalProvider],
}));

vi.mock("../src/providers/communityProvider", () => ({
  communityProvider: {
    name: "community_db",
    external: false,
    getSignals: vi.fn(async () => [communityProviderSignal]),
  } satisfies Provider,
}));

import { collectProviderSignals } from "../src/providers";
import { shouldAllowProvider } from "../src/providers/resilience";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    CACHE_KV: createMockKV(),
    RATE_LIMIT_KV: createMockKV(),
    FILES_BUCKET: {} as unknown as R2Bucket,
    ENRICHMENT_QUEUE: { send: vi.fn() } as unknown as Env["ENRICHMENT_QUEUE"],
    ASSETS: {} as Fetcher,
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

describe("provider circuit breaker with unknown errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens circuit after repeated non-typed upstream errors", async () => {
    const env = makeEnv();

    await collectProviderSignals(request, env, 500);
    await collectProviderSignals(request, env, 500);
    await collectProviderSignals(request, env, 500);

    expect(externalGetSignals).toHaveBeenCalledTimes(3);

    const decision = await shouldAllowProvider(env.CACHE_KV, "flaky_external");
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterMs).toBeGreaterThan(0);

    const result = await collectProviderSignals(request, env, 500);
    expect(externalGetSignals).toHaveBeenCalledTimes(3);
    expect(result.errors.some((message) => message.includes("circuit open"))).toBe(true);
  });
});
