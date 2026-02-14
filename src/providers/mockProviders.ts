import type { Provider } from "./types";
import type { ProviderSignal } from "../types";

function baseIdentitySignal(value: string): ProviderSignal {
  const lower = value.toLowerCase();
  if (lower.includes("dead") || lower.includes("beef")) {
    return {
      source: "CoinGecko",
      score: 85,
      confidence: "high",
      evidence: "Contract does not match CoinGecko canonical listing for this symbol.",
      tags: ["canonical_mismatch"],
      category: "identity",
      critical: true,
      canonicalMismatch: true,
    };
  }

  if (lower.includes("safe") || lower.includes("1111")) {
    return {
      source: "CoinGecko",
      score: 5,
      confidence: "medium",
      evidence: "Contract matches known canonical token listing.",
      tags: ["canonical_match"],
      category: "identity",
      canonicalMatch: true,
    };
  }

  return {
    source: "CoinGecko",
    score: 30,
    confidence: "low",
    evidence: "Token is unlisted or ambiguous in canonical listings.",
    tags: ["unlisted"],
    category: "identity",
  };
}

function baseScannerSignal(value: string): ProviderSignal {
  const lower = value.toLowerCase();
  if (lower.endsWith("bad") || lower.includes("9999")) {
    return {
      source: "Honeypot.is",
      score: 92,
      confidence: "high",
      evidence: "High honeypot risk: sell restrictions and exit behavior look unsafe.",
      tags: ["honeypot", "sell_restriction"],
      category: "scanner",
      critical: true,
      honeypot: true,
    };
  }

  if (lower.includes("tax")) {
    return {
      source: "GoPlus",
      score: 68,
      confidence: "medium",
      evidence: "GoPlus reports critical transfer/owner permission flags.",
      tags: ["critical_flags"],
      category: "scanner",
      critical: true,
    };
  }

  return {
    source: "GoPlus",
    score: 18,
    confidence: "low",
    evidence: "No critical scanner flags detected in quick check.",
    tags: ["low_risk_scan"],
    category: "scanner",
  };
}

function baseReputationSignal(value: string): ProviderSignal {
  const lower = value.toLowerCase();
  if (lower.includes("scam") || lower.includes("fake") || lower.includes("support")) {
    return {
      source: "Chainabuse",
      score: 62,
      confidence: "medium",
      evidence: "Multiple community reports match this identifier pattern in recent activity.",
      tags: ["community_match", "reported"],
      category: "reputation",
    };
  }

  return {
    source: "CryptoScamDB",
    score: 15,
    confidence: "low",
    evidence: "No strong reputation hit found in external scam DB snapshots.",
    tags: ["no_hit"],
    category: "reputation",
  };
}

const identityProvider: Provider = {
  name: "identity_provider",
  async getSignals(ctx) {
    return [baseIdentitySignal(ctx.request.value)];
  },
};

const riskProvider: Provider = {
  name: "risk_provider",
  async getSignals(ctx) {
    return [baseScannerSignal(ctx.request.value)];
  },
};

const reputationProvider: Provider = {
  name: "reputation_provider",
  async getSignals(ctx) {
    return [baseReputationSignal(ctx.request.value)];
  },
};

export function createMockProviders(): Provider[] {
  return [identityProvider, riskProvider, reputationProvider];
}