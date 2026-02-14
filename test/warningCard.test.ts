import { describe, it, expect } from "vitest";
import { generateSlug, renderWarningCardSvg } from "../src/core/warningCard";
import type { WarningCardPayload } from "../src/types";

describe("generateSlug", () => {
  it("produces a slug containing the seed text", () => {
    const slug = generateSlug("HIGH_RISK-Fake Token");
    expect(slug).toContain("high-risk-fake-token");
  });

  it("uses alphanumeric and hyphens only", () => {
    const slug = generateSlug("Test!! @#$ Slug");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("appends a random suffix", () => {
    const slug1 = generateSlug("test");
    const slug2 = generateSlug("test");
    // They share the prefix but have different suffixes (very high probability)
    expect(slug1.startsWith("test-")).toBe(true);
    expect(slug2.startsWith("test-")).toBe(true);
  });

  it("handles empty seed", () => {
    const slug = generateSlug("");
    expect(slug).toMatch(/^warning-[a-z0-9]+$/);
  });

  it("strips leading and trailing hyphens from the cleaned seed", () => {
    const slug = generateSlug("---test---");
    expect(slug).toMatch(/^test-[a-z0-9]+$/);
  });
});

describe("renderWarningCardSvg", () => {
  const payload: WarningCardPayload = {
    verdict: "HIGH_RISK",
    headline: "Fake Token Alert",
    identifiers: { wallet: "0x1234567890abcdef1234567890abcdef12345678" },
    reasons: ["Canonical mismatch", "Honeypot detected", "Community reports"],
  };

  it("returns valid SVG string", () => {
    const svg = renderWarningCardSvg(payload);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });

  it("contains verdict text", () => {
    const svg = renderWarningCardSvg(payload);
    expect(svg).toContain("HIGH_RISK");
  });

  it("contains headline", () => {
    const svg = renderWarningCardSvg(payload);
    expect(svg).toContain("Fake Token Alert");
  });

  it("escapes HTML entities in headline", () => {
    const xssPayload: WarningCardPayload = {
      ...payload,
      headline: "Test <script>alert('xss')</script>",
    };
    const svg = renderWarningCardSvg(xssPayload);
    // SVG renderer escapes < to &lt; which prevents script injection
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script");
  });

  it("limits reasons to 3", () => {
    const manyReasons: WarningCardPayload = {
      ...payload,
      reasons: ["One", "Two", "Three", "Four", "Five"],
    };
    const svg = renderWarningCardSvg(manyReasons);
    expect(svg).toContain("One");
    expect(svg).toContain("Two");
    expect(svg).toContain("Three");
    expect(svg).not.toContain("Four");
  });

  it("uses correct palette for HIGH_RISK", () => {
    const svg = renderWarningCardSvg({ ...payload, verdict: "HIGH_RISK" });
    expect(svg).toContain("#D9480F");
  });

  it("uses correct palette for LEGIT", () => {
    const svg = renderWarningCardSvg({ ...payload, verdict: "LEGIT" });
    expect(svg).toContain("#1C7C54");
  });

  it("uses correct palette for UNKNOWN", () => {
    const svg = renderWarningCardSvg({ ...payload, verdict: "UNKNOWN" });
    expect(svg).toContain("#334155");
  });

  it("contains ScamShield MY branding", () => {
    const svg = renderWarningCardSvg(payload);
    expect(svg).toContain("ScamShield MY");
  });
});
