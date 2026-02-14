import type { ProviderFetchError } from "./utils";

const CIRCUIT_KEY_PREFIX = "provider:circuit:";
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;
const CIRCUIT_OPEN_MS_RATE_LIMIT = 90_000;
const STATE_TTL_SECONDS = 60 * 20;

interface CircuitState {
  consecutiveFailures: number;
  openedUntil: number;
  updatedAt: number;
  lastFailureKind?: string;
  lastFailureMessage?: string;
}

function circuitKey(providerName: string): string {
  return `${CIRCUIT_KEY_PREFIX}${providerName}`;
}

async function readState(kv: KVNamespace, providerName: string): Promise<CircuitState | null> {
  try {
    const raw = await kv.get(circuitKey(providerName));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CircuitState>;
    const consecutiveFailures = Number(parsed.consecutiveFailures ?? 0);
    const openedUntil = Number(parsed.openedUntil ?? 0);
    const updatedAt = Number(parsed.updatedAt ?? Date.now());
    if (!Number.isFinite(consecutiveFailures) || !Number.isFinite(openedUntil) || !Number.isFinite(updatedAt)) {
      return null;
    }

    return {
      consecutiveFailures,
      openedUntil,
      updatedAt,
      lastFailureKind: typeof parsed.lastFailureKind === "string" ? parsed.lastFailureKind : undefined,
      lastFailureMessage: typeof parsed.lastFailureMessage === "string" ? parsed.lastFailureMessage : undefined,
    };
  } catch {
    return null;
  }
}

async function writeState(kv: KVNamespace, providerName: string, state: CircuitState): Promise<void> {
  await kv.put(circuitKey(providerName), JSON.stringify(state), {
    expirationTtl: STATE_TTL_SECONDS,
  });
}

async function clearState(kv: KVNamespace, providerName: string): Promise<void> {
  await kv.delete(circuitKey(providerName));
}

export interface CircuitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export async function shouldAllowProvider(kv: KVNamespace, providerName: string): Promise<CircuitDecision> {
  const state = await readState(kv, providerName);
  if (!state) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const now = Date.now();
  if (state.openedUntil > now) {
    return {
      allowed: false,
      retryAfterMs: state.openedUntil - now,
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export async function recordProviderSuccess(kv: KVNamespace, providerName: string): Promise<void> {
  try {
    await clearState(kv, providerName);
  } catch {
    // ignore metrics path failures
  }
}

function openDurationMs(error: ProviderFetchError): number {
  if (error.kind === "rate_limit") {
    if (typeof error.retryAfterMs === "number" && error.retryAfterMs > 0) {
      return Math.min(error.retryAfterMs, 5 * 60_000);
    }
    return CIRCUIT_OPEN_MS_RATE_LIMIT;
  }
  return CIRCUIT_OPEN_MS;
}

export async function recordProviderFailure(
  kv: KVNamespace,
  providerName: string,
  error: ProviderFetchError,
): Promise<void> {
  try {
    const now = Date.now();
    const existing = await readState(kv, providerName);
    const failures = (existing?.consecutiveFailures ?? 0) + 1;
    const shouldOpen = error.kind === "rate_limit" || failures >= CIRCUIT_FAILURE_THRESHOLD;

    const nextState: CircuitState = {
      consecutiveFailures: failures,
      openedUntil: shouldOpen ? now + openDurationMs(error) : 0,
      updatedAt: now,
      lastFailureKind: error.kind,
      lastFailureMessage: error.message,
    };

    await writeState(kv, providerName, nextState);
  } catch {
    // ignore resilience persistence failures
  }
}
