import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWarningCardPdf, storeWarningCard } from "../src/core/warningCard";
import type { Env, WarningCardPayload } from "../src/types";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    CACHE_KV: createMockKV(),
    RATE_LIMIT_KV: createMockKV(),
    FILES_BUCKET: {
      put: vi.fn(async () => ({})),
    } as unknown as R2Bucket,
    ENRICHMENT_QUEUE: { send: vi.fn() } as unknown as Env["ENRICHMENT_QUEUE"],
    ASSETS: {} as Fetcher,
    APP_NAME: "ScamShield MY",
    REGION: "MY",
    PROVIDER_MODE: "mock",
    WARNING_CARD_RENDER_MODE: "png",
    BROWSER_RENDERING_ACCOUNT_ID: "acct_123",
    BROWSER_RENDERING_API_BASE: "https://example.test/browser-rendering",
    CF_BROWSER_RENDERING_TOKEN: "token_123",
    JWT_SECRET: "test-jwt-secret",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "https://example.test/callback",
    ...overrides,
  };
}

const payload: WarningCardPayload = {
  verdict: "HIGH_RISK",
  headline: "Critical Scam Alert",
  identifiers: {
    wallet: "0x1234567890abcdef1234567890abcdef12345678",
  },
  reasons: ["Honeypot behavior detected", "Community reports confirmed", "Canonical mismatch observed"],
};

const realFetch = globalThis.fetch;

describe("warning card rasterization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = realFetch;
  });

  it("stores PNG output when Browser Rendering succeeds", async () => {
    const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    globalThis.fetch = vi.fn(async () =>
      new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      })) as typeof fetch;

    const env = makeEnv();
    const key = await storeWarningCard(env, "slug-1", payload);

    expect(key).toBe("warning-cards/slug-1.png");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/browser-rendering/screenshot",
      expect.objectContaining({ method: "POST" }),
    );

    const putSpy = env.FILES_BUCKET.put as unknown as ReturnType<typeof vi.fn>;
    expect(putSpy).toHaveBeenCalledWith(
      "warning-cards/slug-1.png",
      expect.any(Uint8Array),
      expect.objectContaining({
        httpMetadata: expect.objectContaining({ contentType: "image/png" }),
      }),
    );
  });

  it("falls back to SVG when Browser Rendering fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("rendering service unavailable");
    }) as typeof fetch;

    const env = makeEnv();
    const key = await storeWarningCard(env, "slug-2", payload);

    expect(key).toBe("warning-cards/slug-2.svg");
    const putSpy = env.FILES_BUCKET.put as unknown as ReturnType<typeof vi.fn>;
    expect(putSpy).toHaveBeenCalledWith(
      "warning-cards/slug-2.svg",
      expect.any(String),
      expect.objectContaining({
        httpMetadata: expect.objectContaining({ contentType: "image/svg+xml" }),
      }),
    );
  });

  it("stores SVG directly in auto mode when Browser Rendering is not configured", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("unexpected", {
        status: 500,
      })) as typeof fetch;

    const env = makeEnv({
      WARNING_CARD_RENDER_MODE: "auto",
      BROWSER_RENDERING_ACCOUNT_ID: undefined,
      BROWSER_RENDERING_API_BASE: undefined,
      CF_BROWSER_RENDERING_TOKEN: undefined,
    });

    const key = await storeWarningCard(env, "slug-3", payload);
    expect(key).toBe("warning-cards/slug-3.svg");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("uses explicit Browser Rendering API base without requiring account id", async () => {
    const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 9, 9]);
    globalThis.fetch = vi.fn(async () =>
      new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      })) as typeof fetch;

    const env = makeEnv({
      WARNING_CARD_RENDER_MODE: "auto",
      BROWSER_RENDERING_ACCOUNT_ID: undefined,
      BROWSER_RENDERING_API_BASE: "https://example.test/browser-rendering",
      CF_BROWSER_RENDERING_TOKEN: "token_123",
    });

    const key = await storeWarningCard(env, "slug-4", payload);
    expect(key).toBe("warning-cards/slug-4.png");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/browser-rendering/screenshot",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("renders PDF bytes via Browser Rendering when requested", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 mock pdf");
    globalThis.fetch = vi.fn(async () =>
      new Response(pdfBytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      })) as typeof fetch;

    const env = makeEnv();
    const pdf = await renderWarningCardPdf(env, payload);
    expect(pdf[0]).toBe(37); // %
    expect(pdf[1]).toBe(80); // P
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/browser-rendering/pdf",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
