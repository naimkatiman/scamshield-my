import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportPdfHtml, renderReportPdf } from "../src/core/reportPdf";
import type { Env } from "../src/types";

function createMockKV(): KVNamespace {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => { }),
    delete: vi.fn(async () => { }),
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
    BROWSER_RENDERING_API_BASE: "https://example.test/browser-rendering",
    CF_BROWSER_RENDERING_TOKEN: "token_123",
    JWT_SECRET: "test-jwt-secret",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "https://example.test/callback",
    ...overrides,
  };
}

const payload = {
  incidentTitle: "Investment Scam",
  scamType: "Crypto Scam",
  occurredAt: "2026-02-14 11:15",
  channel: "Telegram",
  suspects: ["@fake_support"],
  losses: "MYR 2,000",
  actionsTaken: ["Called bank", "Called NSRC 997"],
  severitySuggestion: "high",
  forBank: "Bank report body",
  forPolice: "Police report body",
  forPlatform: "Platform report body",
};

const realFetch = globalThis.fetch;

describe("report pdf browser rendering", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = realFetch;
  });

  it("builds expected html structure", () => {
    const html = buildReportPdfHtml(payload);
    expect(html).toContain("SCAMSHIELD MY");
    expect(html).toContain("Report for Bank / Financial Institution");
    expect(html).toContain("Report for Police / PDRM");
  });

  it("uses API base without requiring account id", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 mock");
    globalThis.fetch = vi.fn(async () =>
      new Response(pdfBytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      })) as typeof fetch;

    const env = makeEnv({ BROWSER_RENDERING_ACCOUNT_ID: undefined });
    const pdf = await renderReportPdf(env, payload);

    expect(pdf[0]).toBe(37);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/browser-rendering/pdf",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
