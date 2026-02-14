import type { Env, ProviderSignal, VerdictRequest } from "../types";
import { communityProvider } from "./communityProvider";
import { createLiveProviders } from "./liveProviders";
import { createMockProviders } from "./mockProviders";
import type { Provider } from "./types";
import { isErrorWithMessage, withTimeout } from "./utils";

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
        const result = await withTimeout(
          provider.getSignals({
            request,
            timeoutMs,
            env,
          }),
          timeoutMs,
          provider.name,
        );
        timings[provider.name] = Date.now() - start;
        return result;
      } catch (error) {
        timings[provider.name] = Date.now() - start;
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
