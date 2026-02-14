import { describe, it, expect } from "vitest";
import { normalizeSignals, computeScore, selectReasonBullets, computeVerdict } from "../src/core/scoring";
import type { ProviderSignal, NormalizedSignal } from "../src/types";

function makeSignal(overrides: Partial<ProviderSignal> = {}): ProviderSignal {
  return {
    source: "test",
    score: 50,
    confidence: "medium",
    evidence: "Test evidence",
    tags: [],
    category: "scanner",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  normalizeSignals                                                   */
/* ------------------------------------------------------------------ */

describe("normalizeSignals", () => {
  it("converts confidence strings to numeric values", () => {
    const signals: ProviderSignal[] = [
      makeSignal({ confidence: "high" }),
      makeSignal({ confidence: "medium" }),
      makeSignal({ confidence: "low" }),
    ];
    const result = normalizeSignals(signals);
    expect(result[0].confidence).toBe(1);
    expect(result[1].confidence).toBe(0.7);
    expect(result[2].confidence).toBe(0.4);
  });

  it("clamps risk to 0-100 range", () => {
    const signals: ProviderSignal[] = [
      makeSignal({ score: -20 }),
      makeSignal({ score: 150 }),
    ];
    const result = normalizeSignals(signals);
    expect(result[0].risk).toBe(0);
    expect(result[1].risk).toBe(100);
  });

  it("preserves boolean flags", () => {
    const signal = makeSignal({
      critical: true,
      canonicalMatch: true,
      canonicalMismatch: false,
      honeypot: true,
    });
    const [result] = normalizeSignals([signal]);
    expect(result.critical).toBe(true);
    expect(result.canonicalMatch).toBe(true);
    expect(result.canonicalMismatch).toBe(false);
    expect(result.honeypot).toBe(true);
  });

  it("defaults undefined booleans to false", () => {
    const signal = makeSignal({});
    const [result] = normalizeSignals([signal]);
    expect(result.critical).toBe(false);
    expect(result.canonicalMatch).toBe(false);
    expect(result.canonicalMismatch).toBe(false);
    expect(result.honeypot).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  computeScore                                                       */
/* ------------------------------------------------------------------ */

describe("computeScore", () => {
  it("returns 50 for empty signals", () => {
    expect(computeScore([])).toBe(50);
  });

  it("scores high for a single high-risk signal", () => {
    const signals = normalizeSignals([makeSignal({ score: 90, confidence: "high", category: "scanner" })]);
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("scores low for a single low-risk signal", () => {
    const signals = normalizeSignals([makeSignal({ score: 5, confidence: "high", category: "identity" })]);
    const score = computeScore(signals);
    expect(score).toBeLessThanOrEqual(20);
  });

  it("applies critical floor of 55", () => {
    const signals = normalizeSignals([
      makeSignal({ score: 20, confidence: "low", category: "scanner", critical: true }),
    ]);
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(55);
  });

  it("does not apply critical floor when score is already above 55", () => {
    const signals = normalizeSignals([
      makeSignal({ score: 80, confidence: "high", category: "scanner", critical: true }),
    ]);
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(55);
  });

  it("handles mixed category signals with correct weighting", () => {
    const signals = normalizeSignals([
      makeSignal({ score: 90, confidence: "high", category: "scanner" }),
      makeSignal({ score: 10, confidence: "high", category: "identity" }),
    ]);
    const score = computeScore(signals);
    // Scanner weight 0.35, identity weight 0.25
    // Weighted: (90*0.35 + 10*0.25) / (0.35+0.25) = (31.5+2.5)/0.6 = 56.67
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(80);
  });
});

/* ------------------------------------------------------------------ */
/*  selectReasonBullets                                                */
/* ------------------------------------------------------------------ */

describe("selectReasonBullets", () => {
  it("always returns exactly 3 strings", () => {
    const result = selectReasonBullets([]);
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(typeof r).toBe("string"));
  });

  it("uses fallback text when no signals exist", () => {
    const [r1, r2, r3] = selectReasonBullets([]);
    expect(r1).toContain("unverified");
    expect(r2).toContain("incomplete");
    expect(r3).toContain("Insufficient");
  });

  it("picks identity evidence for slot 1", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "identity", evidence: "CoinGecko: canonical match", score: 50, confidence: "high" }),
    ]);
    const [r1] = selectReasonBullets(signals);
    expect(r1).toContain("CoinGecko");
  });

  it("picks scanner evidence for slot 2", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "scanner", evidence: "GoPlus: honeypot detected", score: 90, confidence: "high" }),
    ]);
    const [, r2] = selectReasonBullets(signals);
    expect(r2).toContain("GoPlus");
  });

  it("picks reputation or community for slot 3", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "reputation", evidence: "Chainabuse: 5 reports", score: 60, confidence: "medium" }),
    ]);
    const [, , r3] = selectReasonBullets(signals);
    expect(r3).toContain("Chainabuse");
  });
});

/* ------------------------------------------------------------------ */
/*  computeVerdict                                                     */
/* ------------------------------------------------------------------ */

describe("computeVerdict", () => {
  it("returns HIGH_RISK when canonical mismatch", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "identity", canonicalMismatch: true, score: 85, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.verdict).toBe("HIGH_RISK");
  });

  it("returns HIGH_RISK when honeypot detected", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "scanner", honeypot: true, score: 92, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.verdict).toBe("HIGH_RISK");
  });

  it("returns HIGH_RISK when score >= 70", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "scanner", score: 95, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.verdict).toBe("HIGH_RISK");
  });

  it("returns LEGIT when score <= 20 with canonical match and no critical", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "identity", score: 5, confidence: "high", canonicalMatch: true }),
      makeSignal({ category: "scanner", score: 5, confidence: "high" }),
      makeSignal({ category: "reputation", score: 5, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.verdict).toBe("LEGIT");
  });

  it("returns UNKNOWN for ambiguous signals", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "identity", score: 30, confidence: "low" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.verdict).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for empty signals (score defaults to 50)", () => {
    const result = computeVerdict([]);
    expect(result.verdict).toBe("UNKNOWN");
  });

  it("provides correct nextActions for HIGH_RISK", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "scanner", honeypot: true, score: 92, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.nextActions).toContain("Emergency Playbook");
  });

  it("provides correct nextActions for UNKNOWN", () => {
    const result = computeVerdict([]);
    expect(result.nextActions).toContain("Report It");
  });

  it("provides correct nextActions for LEGIT", () => {
    const signals = normalizeSignals([
      makeSignal({ category: "identity", score: 5, confidence: "high", canonicalMatch: true }),
      makeSignal({ category: "scanner", score: 5, confidence: "high" }),
      makeSignal({ category: "reputation", score: 5, confidence: "high" }),
    ]);
    const result = computeVerdict(signals);
    expect(result.nextActions).toContain("Safety Checklist");
  });

  it("always returns exactly 3 reasons", () => {
    const result = computeVerdict([]);
    expect(result.reasons).toHaveLength(3);
  });

  it("returns deduplicated sources", () => {
    const signals = normalizeSignals([
      makeSignal({ source: "GoPlus", category: "scanner", score: 50 }),
      makeSignal({ source: "GoPlus", category: "scanner", score: 60 }),
      makeSignal({ source: "CoinGecko", category: "identity", score: 30 }),
    ]);
    const result = computeVerdict(signals);
    expect(result.sources).toEqual(expect.arrayContaining(["GoPlus", "CoinGecko"]));
    const goPlusCount = result.sources.filter((s) => s === "GoPlus").length;
    expect(goPlusCount).toBe(1);
  });
});
