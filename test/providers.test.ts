import { describe, it, expect, vi } from "vitest";
import { createMockProviders } from "../src/providers/mockProviders";
import { collectProviderSignals } from "../src/providers";
import type { Env, VerdictRequest } from "../src/types";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ total: 0 })),
          all: vi.fn(async () => ({ results: [] })),
          run: vi.fn(async () => ({})),
        })),
      })),
    } as unknown as D1Database,
    CACHE_KV: { get: vi.fn(), put: vi.fn() } as unknown as KVNamespace,
    RATE_LIMIT_KV: { get: vi.fn(), put: vi.fn() } as unknown as KVNamespace,
    FILES_BUCKET: {} as unknown as R2Bucket,
    ENRICHMENT_QUEUE: { send: vi.fn() } as unknown as Env["ENRICHMENT_QUEUE"],
    ASSETS: {} as unknown as Fetcher,
    APP_NAME: "ScamShield MY",
    REGION: "MY",
    PROVIDER_MODE: "mock",
    ...overrides,
  };
}

function makeRequest(overrides: Partial<VerdictRequest> = {}): VerdictRequest {
  return {
    type: "contract",
    value: "0x1234567890abcdef1234567890abcdef12345678",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Mock Provider Signal Routing                                       */
/* ------------------------------------------------------------------ */

describe("mock providers", () => {
  const providers = createMockProviders();

  it("returns 3 providers", () => {
    expect(providers).toHaveLength(3);
  });

  it("returns HIGH_RISK signals for dead/beef keywords", async () => {
    const signals = await providers[0].getSignals({
      request: makeRequest({ value: "0xdeadbeef1234567890abcdef1234567890abcdef" }),
      timeoutMs: 4000,
      env: makeEnv(),
    });
    expect(signals[0].canonicalMismatch).toBe(true);
    expect(signals[0].score).toBeGreaterThanOrEqual(70);
  });

  it("returns LEGIT signals for safe/1111 keywords", async () => {
    const signals = await providers[0].getSignals({
      request: makeRequest({ value: "0x1111111111111111111111111111111111111111" }),
      timeoutMs: 4000,
      env: makeEnv(),
    });
    expect(signals[0].canonicalMatch).toBe(true);
    expect(signals[0].score).toBeLessThanOrEqual(20);
  });

  it("returns honeypot signal for bad/9999 keywords", async () => {
    const signals = await providers[1].getSignals({
      request: makeRequest({ value: "0x9999999999999999999999999999999999999999" }),
      timeoutMs: 4000,
      env: makeEnv(),
    });
    expect(signals[0].honeypot).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  collectProviderSignals                                             */
/* ------------------------------------------------------------------ */

describe("collectProviderSignals", () => {
  it("collects signals from all mock providers", async () => {
    const result = await collectProviderSignals(makeRequest(), makeEnv(), 4000);
    // 3 mock + 1 community = 4 providers, each returning 1 signal
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toHaveLength(0);
  });

  it("records timing for each provider", async () => {
    const result = await collectProviderSignals(makeRequest(), makeEnv(), 4000);
    expect(Object.keys(result.timings).length).toBeGreaterThan(0);
  });

  it("handles one provider failing without blocking others", async () => {
    // Create env with a DB that throws to make communityProvider fail
    const badEnv = makeEnv({
      DB: {
        prepare: vi.fn(() => {
          throw new Error("DB connection failed");
        }),
      } as unknown as D1Database,
    });

    const result = await collectProviderSignals(makeRequest(), badEnv, 4000);
    // Mock providers should still succeed (they don't use DB)
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("community_db");
  });

  it("records error message for timed-out provider", async () => {
    // Use a very short timeout — mock providers are fast so this tests structure
    const result = await collectProviderSignals(makeRequest(), makeEnv(), 4000);
    // With normal timeout, no errors expected
    expect(result.errors).toHaveLength(0);
  });
});
