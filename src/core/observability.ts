import type { Env } from "../types";
import { logger } from "./logger";

type ProviderOutcome = "ok" | "error" | "circuit_open";
type CureAction = "playbook_accessed" | "report_generated" | "progress_tracked" | "report_submitted" | "warning_card_created";
type CureActionStatus = "success" | "validation_error" | "failed";

function trimValue(value: string, max = 128): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function sanitizeDimension(value: string): string {
  return trimValue(value.replace(/\s+/g, "_").toLowerCase(), 64);
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function writeMetricPoint(env: Env, indexes: string[], blobs: string[], doubles: number[]): void {
  if (!env.SCAMSHIELD_METRICS) {
    return;
  }

  try {
    env.SCAMSHIELD_METRICS.writeDataPoint({
      indexes: indexes.slice(0, 20).map((item) => trimValue(item, 64)),
      blobs: blobs.slice(0, 20).map((item) => trimValue(item, 256)),
      doubles: doubles.slice(0, 20).map((value) => finiteOrZero(value)),
    });
  } catch (error) {
    logger.warn("metrics_write_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function recordProviderOutcome(
  env: Env,
  provider: string,
  outcome: ProviderOutcome,
  latencyMs: number,
  detail = "",
): void {
  writeMetricPoint(
    env,
    ["provider", sanitizeDimension(provider), sanitizeDimension(outcome)],
    [provider, outcome, trimValue(detail, 256)],
    [1, finiteOrZero(latencyMs)],
  );
}

export function recordCureAction(
  env: Env,
  action: CureAction,
  status: CureActionStatus,
  durationMs: number,
  metadata: Record<string, unknown> = {},
): void {
  logger.info("cure_action", {
    action,
    status,
    durationMs: Math.round(durationMs),
    ...metadata,
  });

  writeMetricPoint(
    env,
    ["cure_action", sanitizeDimension(action), sanitizeDimension(status)],
    [action, status],
    [1, finiteOrZero(durationMs)],
  );
}
