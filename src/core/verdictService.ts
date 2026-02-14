import { getCachedVerdictRecord, upsertVerdictCache } from "../db/repository";
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
const inflightForegroundEvaluations = new Map<string, Promise<EvaluatedVerdict>>();

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

  if (background) {
    return evaluateVerdictInternal(request, env, key, true);
  }

  const existing = inflightForegroundEvaluations.get(key);
  if (existing) {
    return existing;
  }

  const pending = evaluateVerdictInternal(request, env, key, false).finally(() => {
    inflightForegroundEvaluations.delete(key);
  });
  inflightForegroundEvaluations.set(key, pending);
  return pending;
}

async function evaluateVerdictInternal(
  request: VerdictRequest,
  env: Env,
  key: string,
  background: boolean,
): Promise<EvaluatedVerdict> {
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
    const cachedRecord = await getCachedVerdictRecord(env.DB, key);
    if (cachedRecord) {
      const updatedAtMs = new Date(cachedRecord.updatedAt).getTime();
      const d1Age = Number.isFinite(updatedAtMs) ? now - updatedAtMs : 0;
      const d1Stale = d1Age > D1_STALE_AFTER_MS;

      // Populate KV hot cache from D1 (best-effort)
      try {
        await env.CACHE_KV.put(
          `verdict:${key}`,
          JSON.stringify({ updatedAt: Number.isFinite(updatedAtMs) ? updatedAtMs : now, result: cachedRecord.result }),
          { expirationTtl: HOT_CACHE_TTL_SECONDS },
        );
      } catch {
        logger.warn("kv_cache_write_failed", { key });
      }
      return { key, result: cachedRecord.result, pendingEnrichment: d1Stale, providerErrors: [], timings: {}, cached: true };
    }
  } catch {
    logger.warn("d1_cache_read_failed", { key });
  }

  // --- Layer 3: Fresh provider fetch ---
  const timeoutMs = background ? BACKGROUND_PROVIDER_TIMEOUT_MS : FOREGROUND_PROVIDER_TIMEOUT_MS;
  const providerData = await collectProviderSignals(request, env, timeoutMs);

  if (providerData.signals.length === 0) {
    const fallback = unknownFallback();
    const fallbackUpdatedAt = new Date().toISOString();
    const fallbackUpdatedAtMs = new Date(fallbackUpdatedAt).getTime();
    // Best-effort cache writes
    try { await upsertVerdictCache(env.DB, key, fallback, fallbackUpdatedAt); } catch { /* ignore */ }
    try {
      await env.CACHE_KV.put(
        `verdict:${key}`,
        JSON.stringify({ updatedAt: fallbackUpdatedAtMs, result: fallback }),
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
  const updatedAt = new Date().toISOString();
  const updatedAtMs = new Date(updatedAt).getTime();

  // Persist to both cache layers (best-effort)
  try { await upsertVerdictCache(env.DB, key, result, updatedAt); } catch {
    logger.warn("d1_cache_write_failed", { key });
  }
  try {
    await env.CACHE_KV.put(
      `verdict:${key}`,
      JSON.stringify({ updatedAt: updatedAtMs, result }),
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
