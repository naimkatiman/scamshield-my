import type { Env, ProviderSignal, VerdictRequest } from "../types";

export interface RiskContext {
  request: VerdictRequest;
  timeoutMs: number;
  env: Env;
}

export interface Provider {
  name: string;
  getSignals(context: RiskContext): Promise<ProviderSignal[]>;
}
