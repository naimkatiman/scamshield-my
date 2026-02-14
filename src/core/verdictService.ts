import { getCachedVerdict, upsertVerdictCache } from "../db/repository";
import { collectProviderSignals } from "../providers";
import type { Env, VerdictRequest, VerdictResult } from "../types";
import { logger } from "./logger";
import { computeVerdict, normalizeSignals } from "./scoring";
import { nextActionsForVerdict } from "./verdictRules";
import { buildCacheKey } from "./validation";

const HOT_CACHE_TTL_SECONDS = 60 * 10;  // 10 min
const STALE_AFTER_MS = 1000 * 60 * 30;  // 30 min (KV layer)
const D1_STALE_AFTER_MS = 1000 * 60 * 60; // 60 min (D1 layer — serve stale but flag for re-enrichment)

/** Live-mode timeout budget. Leaves ~200ms for cache writes + serialization to hit <2s SLO.
 *  Applied to ALL foreground requests regardless of PROVIDER_MODE (demo must also be fast). */
const FOREGROUND_PROVIDER_TIMEOUT_MS = 1800;
/** Queue/background enrichment timeout budget. */
const BACKGROUND_PROVIDER_TIMEOUT_MS = 4000;

function unknownFallback(): VerdictResult {
  return {
    verdict: "UNKNOWN",
    score: 50,
    reasons: [
      "Identity metadata is incomplete for this input.",
      "Scanner results are delayed or unavailable.",
      "Insufficient reputation/community data; submit a report if targeted.",
    ],
    sources: [],
    nextActions: nextActionsForVerdict("UNKNOWN"),
  };
}

export interface EvaluatedVerdict {
  key: string;
  result: VerdictResult;
  pendingEnrichment: boolean;
  providerErrors: string[];
  timings: Record<string, number>;
  cached: boolean;
}

export async function evaluateVerdict(
  request: VerdictRequest,
  env: Env,
  /** Set true when called from queue/background enrichment (uses longer timeout). */
  background = false,
): Promise<EvaluatedVerdict> {
  const key = buildCacheKey(request.type, request.value, request.chain ?? "evm");
  const now = Date.now();

  // --- Layer 1: KV hot cache ---
  try {
    const hot = await env.CACHE_KV.get(`verdict:${key}`, "json");
    if (hot && typeof hot === "object") {
      const record = hot as { result?: VerdictResult; updatedAt?: number };
      if (record.result && typeof record.updatedAt === "number") {
        const age = now - record.updatedAt;
        if (age <= STALE_AFTER_MS) {
          return { key, result: record.result, pendingEnrichment: false, providerErrors: [], timings: {}, cached: true };
        }
        // Stale but present — serve stale, queue re-enrichment
        return { key, result: record.result, pendingEnrichment: true, providerErrors: [], timings: {}, cached: true };
      }
    }
  } catch {
    logger.warn("kv_cache_read_failed", { key });
  }

  // --- Layer 2: D1 persistent cache ---
  try {
    const cached = await getCachedVerdict(env.DB, key);
    if (cached) {
      // Check D1 staleness — cached row has updated_at but getCachedVerdict doesn't expose it.
      // We check via a separate lightweight query to avoid changing the return type.
      const ageRow = await env.DB.prepare(
        "SELECT updated_at FROM verdict_cache WHERE key = ?"
      ).bind(key).first<{ updated_at: string }>();
      const d1Age = ageRow ? now - new Date(ageRow.updated_at).getTime() : 0;
      const d1Stale = d1Age > D1_STALE_AFTER_MS;

      // Populate KV hot cache from D1 (best-effort)
      try {
        await env.CACHE_KV.put(
          `verdict:${key}`,
          JSON.stringify({ updatedAt: now, result: cached }),
          { expirationTtl: HOT_CACHE_TTL_SECONDS },
        );
      } catch {
        logger.warn("kv_cache_write_failed", { key });
      }
      return { key, result: cached, pendingEnrichment: d1Stale, providerErrors: [], timings: {}, cached: true };
    }
  } catch {
    logger.warn("d1_cache_read_failed", { key });
  }

  // --- Layer 3: Fresh provider fetch ---
  const timeoutMs = background ? BACKGROUND_PROVIDER_TIMEOUT_MS : FOREGROUND_PROVIDER_TIMEOUT_MS;
  const providerData = await collectProviderSignals(request, env, timeoutMs);

  if (providerData.signals.length === 0) {
    const fallback = unknownFallback();
    // Best-effort cache writes
    try { await upsertVerdictCache(env.DB, key, fallback); } catch { /* ignore */ }
    try {
      await env.CACHE_KV.put(
        `verdict:${key}`,
        JSON.stringify({ updatedAt: now, result: fallback }),
        { expirationTtl: HOT_CACHE_TTL_SECONDS },
      );
    } catch { /* ignore */ }
    return {
      key,
      result: fallback,
      pendingEnrichment: true,
      providerErrors: providerData.errors,
      timings: providerData.timings,
      cached: false,
    };
  }

  const normalized = normalizeSignals(providerData.signals);
  const result = computeVerdict(normalized);

  // Persist to both cache layers (best-effort)
  try { await upsertVerdictCache(env.DB, key, result); } catch {
    logger.warn("d1_cache_write_failed", { key });
  }
  try {
    await env.CACHE_KV.put(
      `verdict:${key}`,
      JSON.stringify({ updatedAt: now, result }),
      { expirationTtl: HOT_CACHE_TTL_SECONDS },
    );
  } catch {
    logger.warn("kv_cache_write_failed", { key });
  }

  return {
    key,
    result,
    pendingEnrichment: providerData.errors.length > 0,
    providerErrors: providerData.errors,
    timings: providerData.timings,
    cached: false,
  };
}
