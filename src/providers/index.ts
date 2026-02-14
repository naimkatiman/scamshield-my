import type { Env, ProviderSignal, VerdictRequest } from "../types";
import { recordProviderOutcome } from "../core/observability";
import { communityProvider } from "./communityProvider";
import { createLiveProviders } from "./liveProviders";
import { createMockProviders } from "./mockProviders";
import { recordProviderFailure, recordProviderSuccess, shouldAllowProvider } from "./resilience";
import type { Provider } from "./types";
import { isErrorWithMessage, isProviderFetchError, ProviderFetchError, withTimeout } from "./utils";

function activeProviders(env: Env): Provider[] {
  const external = env.PROVIDER_MODE === "live"
    ? createLiveProviders(env)
    : createMockProviders();

  // Community DB provider always runs regardless of mode
  return [...external, communityProvider];
}

export interface ProviderResult {
  signals: ProviderSignal[];
  errors: string[];
  /** Per-provider timing in ms for monitoring */
  timings: Record<string, number>;
}

export async function collectProviderSignals(
  request: VerdictRequest,
  env: Env,
  timeoutMs = 4000,
): Promise<ProviderResult> {
  const providers = activeProviders(env);
  const timings: Record<string, number> = {};

  const settled = await Promise.allSettled(
    providers.map(async (provider) => {
      const start = Date.now();
      try {
        if (provider.external) {
          const circuit = await shouldAllowProvider(env.CACHE_KV, provider.name);
          if (!circuit.allowed) {
            const wait = Math.ceil(circuit.retryAfterMs / 1000);
            throw new ProviderFetchError(
              `${provider.name} circuit open (retry in ${wait}s)`,
              "circuit_open",
              { retryable: true, retryAfterMs: circuit.retryAfterMs },
            );
          }
        }

        const result = await withTimeout(
          provider.getSignals({
            request,
            timeoutMs,
            env,
          }),
          timeoutMs,
          provider.name,
        );
        const latencyMs = Date.now() - start;
        timings[provider.name] = latencyMs;
        if (provider.external) {
          await recordProviderSuccess(env.CACHE_KV, provider.name);
        }
        recordProviderOutcome(env, provider.name, "ok", latencyMs);
        return result;
      } catch (error) {
        const latencyMs = Date.now() - start;
        timings[provider.name] = latencyMs;

        const detail = isErrorWithMessage(error) ? error.message : "provider failed";
        const normalizedError = isProviderFetchError(error)
          ? error
          : new ProviderFetchError(`${provider.name} unexpected error: ${detail}`, "unknown", {
            retryable: true,
          });

        if (provider.external && normalizedError.kind !== "circuit_open") {
          await recordProviderFailure(env.CACHE_KV, provider.name, normalizedError);
        }
        const outcome = normalizedError.kind === "circuit_open" ? "circuit_open" : "error";
        recordProviderOutcome(env, provider.name, outcome, latencyMs, detail);
        throw error;
      }
    }),
  );

  const signals: ProviderSignal[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      signals.push(...result.value);
      return;
    }

    const providerName = providers[index]?.name ?? "unknown_provider";
    const message = isErrorWithMessage(result.reason)
      ? result.reason.message
      : "provider failed unexpectedly";
    errors.push(`${providerName}: ${message}`);
  });

  return { signals, errors, timings };
}
