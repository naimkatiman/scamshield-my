import type { NormalizedSignal, ProviderSignal, VerdictResult } from "../types";

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */

function confidenceToNumber(conf: ProviderSignal["confidence"]): number {
  switch (conf) {
    case "high":
      return 1;
    case "medium":
      return 0.7;
    case "low":
    default:
      return 0.4;
  }
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeSignals(signals: ProviderSignal[]): NormalizedSignal[] {
  return signals.map((signal) => ({
    source: signal.source,
    risk: clamp(signal.score),
    confidence: confidenceToNumber(signal.confidence),
    evidence: signal.evidence,
    category: signal.category,
    critical: Boolean(signal.critical),
    tags: signal.tags,
    canonicalMatch: Boolean(signal.canonicalMatch),
    canonicalMismatch: Boolean(signal.canonicalMismatch),
    honeypot: Boolean(signal.honeypot),
  }));
}

/* ------------------------------------------------------------------ */
/*  Score Computation                                                  */
/* ------------------------------------------------------------------ */

/** Category weights for composite scoring */
const CATEGORY_WEIGHTS: Record<string, number> = {
  identity: 0.25,
  scanner: 0.35,
  reputation: 0.25,
  community: 0.15,
  fallback: 0.1,
};

/**
 * Compute a weighted composite risk score.
 *
 * Strategy:
 * 1. Group signals by category.
 * 2. Within each category, take the highest weighted signal.
 * 3. Combine category scores using CATEGORY_WEIGHTS.
 * 4. Apply a "critical flag" floor — if any critical signal exists, score >= 55.
 */
export function computeScore(normalizedSignals: NormalizedSignal[]): number {
  if (normalizedSignals.length === 0) {
    return 50; // no data → midpoint uncertainty
  }

  // Group by category, pick top weighted signal per category
  const categoryBest = new Map<string, number>();
  for (const signal of normalizedSignals) {
    const weighted = signal.risk * signal.confidence;
    const current = categoryBest.get(signal.category) ?? 0;
    if (weighted > current) {
      categoryBest.set(signal.category, weighted);
    }
  }

  // Weighted sum across categories
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [category, score] of categoryBest) {
    const weight = CATEGORY_WEIGHTS[category] ?? 0.1;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  let compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 50;

  // Critical floor: if any signal is critical, ensure score is at least 55
  const hasCritical = normalizedSignals.some((s) => s.critical);
  if (hasCritical && compositeScore < 55) {
    compositeScore = 55;
  }

  return clamp(compositeScore);
}

/* ------------------------------------------------------------------ */
/*  Reason Selection (exactly 3, deterministic)                        */
/* ------------------------------------------------------------------ */

/**
 * Pick the highest-weighted evidence from a category.
 * Priority order within a category: risk * confidence descending.
 */
function pickTopEvidence(
  normalizedSignals: NormalizedSignal[],
  ...categories: NormalizedSignal["category"][]
): NormalizedSignal | undefined {
  return normalizedSignals
    .filter((s) => categories.includes(s.category))
    .sort((a, b) => b.risk * b.confidence - a.risk * a.confidence)[0];
}

/**
 * Select exactly 3 reason bullets in fixed priority order:
 *   1. Identity (canonical listing status)
 *   2. Scanner (risk flags / honeypot)
 *   3. Reputation OR Community (whichever is stronger)
 *
 * Each slot has a fallback if no signal exists for that category.
 */
export function selectReasonBullets(normalizedSignals: NormalizedSignal[]): [string, string, string] {
  const identity = pickTopEvidence(normalizedSignals, "identity");
  const scanner = pickTopEvidence(normalizedSignals, "scanner");
  const repOrCommunity = pickTopEvidence(normalizedSignals, "reputation", "community");

  const reason1 = identity?.evidence ?? "Identity match is unverified: canonical listing data is limited.";
  const reason2 = scanner?.evidence ?? "Risk scanner signals are incomplete: treat this as potentially unsafe.";
  const reason3 =
    repOrCommunity?.evidence ??
    "Insufficient reputation/community data in the last 7 days; submit a report if you were targeted.";

  return [reason1, reason2, reason3];
}

/* ------------------------------------------------------------------ */
/*  Verdict Rules                                                      */
/* ------------------------------------------------------------------ */

export function computeVerdict(normalizedSignals: NormalizedSignal[]): VerdictResult {
  const score = computeScore(normalizedSignals);
  const reasons = selectReasonBullets(normalizedSignals);

  const hasCanonicalMismatch = normalizedSignals.some((s) => s.canonicalMismatch);
  const hasCanonicalMatch = normalizedSignals.some((s) => s.canonicalMatch);
  const hasHoneypot = normalizedSignals.some((s) => s.honeypot);
  const hasCritical = normalizedSignals.some((s) => s.critical);

  // Verdict decision tree:
  // 1. Instant HIGH_RISK: canonical mismatch, honeypot detection, or score >= 70
  // 2. LEGIT: low score + canonical match + no critical flags
  // 3. Everything else → UNKNOWN (safety default)
  const verdict =
    hasCanonicalMismatch || hasHoneypot || score >= 70
      ? "HIGH_RISK"
      : score <= 20 && hasCanonicalMatch && !hasCritical
        ? "LEGIT"
        : "UNKNOWN";

  const nextActions =
    verdict === "HIGH_RISK"
      ? ["Emergency Playbook", "Generate Reports", "Create Warning Card"]
      : verdict === "UNKNOWN"
        ? ["Report It", "Generate Warning Card", "Safety Checklist"]
        : ["Safety Checklist", "Verify Official Channels", "Monitor Activity"];

  const sources = Array.from(new Set(normalizedSignals.map((s) => s.source)));

  return {
    verdict,
    score,
    reasons,
    sources,
    nextActions,
  };
}
