import { afterEach, describe, expect, it, vi } from "vitest";
import { recordProviderFailure, recordProviderSuccess, shouldAllowProvider } from "../src/providers/resilience";
import { ProviderFetchError, safeFetchJson } from "../src/providers/utils";

interface MockKV extends KVNamespace {
  _store: Map<string, string>;
}

function createMockKV(): MockKV {
  const store = new Map<string, string>();
  return {
    _store: store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as MockKV;
}

const realFetch = globalThis.fetch;

describe("provider fetch resilience", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = realFetch;
  });

  it("retries a 429 response and succeeds on the next attempt", async () => {
    let attempt = 0;
    globalThis.fetch = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        return new Response("{}", {
          status: 429,
          headers: {
            "retry-after": "0",
          },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as typeof fetch;

    const result = await safeFetchJson("https://example.test", { method: "GET" }, 1200, "GoPlus");
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws a typed ProviderFetchError when retries are exhausted", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("{}", {
        status: 429,
      })) as typeof fetch;

    await expect(safeFetchJson("https://example.test", { method: "GET" }, 500, "CoinGecko")).rejects.toMatchObject({
      name: "ProviderFetchError",
      kind: "rate_limit",
    });
  });
});

describe("provider circuit breaker", () => {
  it("opens the circuit after repeated failures and closes it after a success", async () => {
    const kv = createMockKV();
    const providerName = "risk_provider";

    const failure = new ProviderFetchError("upstream 502", "http", {
      status: 502,
      retryable: true,
    });

    await recordProviderFailure(kv, providerName, failure);
    await recordProviderFailure(kv, providerName, failure);
    await recordProviderFailure(kv, providerName, failure);

    const blocked = await shouldAllowProvider(kv, providerName);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    await recordProviderSuccess(kv, providerName);
    const reopened = await shouldAllowProvider(kv, providerName);
    expect(reopened.allowed).toBe(true);
  });
});
