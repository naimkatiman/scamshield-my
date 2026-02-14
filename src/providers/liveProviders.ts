import type { Env, ProviderSignal } from "../types";
import type { Provider, RiskContext } from "./types";
import { safeFetchJson } from "./utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Map chain shorthand to GoPlus chain id */
function chainToGoPlusId(chain?: string): string {
  const map: Record<string, string> = {
    evm: "1", eth: "1", ethereum: "1",
    bsc: "56", bnb: "56",
    polygon: "137", matic: "137",
    arbitrum: "42161", arb: "42161",
    optimism: "10", op: "10",
    avalanche: "43114", avax: "43114",
    base: "8453",
    fantom: "250", ftm: "250",
  };
  return map[(chain ?? "evm").toLowerCase()] ?? "1";
}

/** Map chain shorthand to Honeypot.is chain parameter */
function chainToHoneypotParam(chain?: string): string {
  const map: Record<string, string> = {
    evm: "1", eth: "1", ethereum: "1",
    bsc: "56", bnb: "56",
    base: "8453",
  };
  return map[(chain ?? "evm").toLowerCase()] ?? "1";
}

/* ------------------------------------------------------------------ */
/*  CoinGecko – Identity Provider                                      */
/* ------------------------------------------------------------------ */

function createCoinGeckoProvider(env: Env): Provider {
  return {
    name: "identity_provider",
    external: true,
    async getSignals(ctx: RiskContext): Promise<ProviderSignal[]> {
      const { type, value, chain } = ctx.request;

      // CoinGecko is only useful for contract addresses
      if (type === "handle") {
        return [{
          source: "CoinGecko",
          score: 30,
          confidence: "low",
          evidence: "CoinGecko does not index social handles; identity unverified.",
          tags: ["handle_skip"],
          category: "identity",
        }];
      }

      const apiKey = env.COINGECKO_API_KEY;
      const baseUrl = apiKey
        ? "https://pro-api.coingecko.com"
        : "https://api.coingecko.com";

      const platform = (chain ?? "evm").toLowerCase() === "bsc"
        ? "binance-smart-chain"
        : "ethereum";
      const url = new URL(
        `/api/v3/coins/${platform}/contract/${value.toLowerCase()}`,
        baseUrl,
      );

      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) {
        headers["x-cg-pro-api-key"] = apiKey;
      }

      const json = await safeFetchJson(
        url,
        { method: "GET", headers },
        ctx.timeoutMs,
        "CoinGecko",
      );
      const data = obj(json);

      const id = str(data.id);
      const symbol = str(data.symbol);
      const name = str(data.name);

      if (id) {
        const marketData = obj(data.market_data);
        const mcapObj = obj(marketData.market_cap);
        const mcap = num(mcapObj.usd);

        return [{
          source: "CoinGecko",
          score: mcap > 1_000_000 ? 5 : 15,
          confidence: mcap > 1_000_000 ? "high" : "medium",
          evidence: `Token "${name}" (${symbol.toUpperCase()}) is listed on CoinGecko${mcap > 0 ? ` with ~$${(mcap / 1e6).toFixed(1)}M market cap` : ""}.`,
          tags: ["canonical_match"],
          category: "identity",
          canonicalMatch: true,
        }];
      }

      return [{
        source: "CoinGecko",
        score: 40,
        confidence: "medium",
        evidence: "Contract not found on CoinGecko canonical listings — token may be unlisted or fake.",
        tags: ["unlisted"],
        category: "identity",
      }];
    },
  };
}

/* ------------------------------------------------------------------ */
/*  GoPlus + Honeypot.is – Risk Provider                               */
/* ------------------------------------------------------------------ */

function createRiskProvider(env: Env): Provider {
  return {
    name: "risk_provider",
    external: true,
    async getSignals(ctx: RiskContext): Promise<ProviderSignal[]> {
      const { type, value, chain } = ctx.request;
      const signals: ProviderSignal[] = [];

      if (type === "handle") {
        return [{
          source: "GoPlus",
          score: 25,
          confidence: "low",
          evidence: "Contract risk scanners do not apply to social handles.",
          tags: ["handle_skip"],
          category: "scanner",
        }];
      }

      const address = value.toLowerCase();

      // --- GoPlus Token Security ---
      const goPlusBase = env.GOPLUS_API_BASE ?? "https://api.gopluslabs.io";
      const chainId = chainToGoPlusId(chain);

      try {
        const goPlusUrl = new URL(
          `/api/v1/token_security/${chainId}`,
          goPlusBase,
        );
        goPlusUrl.searchParams.set("contract_addresses", address);

        const goPlusJson = await safeFetchJson(
          goPlusUrl,
          { method: "GET" },
          ctx.timeoutMs,
          "GoPlus",
        );
        const goPlusData = obj(goPlusJson);
        const resultMap = obj(goPlusData.result);
        const tokenInfo = obj(resultMap[address]);

        const isHoneypot = bool(tokenInfo.is_honeypot);
        const cannotSellAll = bool(tokenInfo.cannot_sell_all);
        const isOpenSource = bool(tokenInfo.is_open_source);
        const isProxy = bool(tokenInfo.is_proxy);
        const isMintable = bool(tokenInfo.is_mintable);
        const hasHiddenOwner = bool(tokenInfo.hidden_owner);
        const canTakeBack = bool(tokenInfo.can_take_back_ownership);
        const ownerChangeBalance = bool(tokenInfo.owner_change_balance);
        const buyTax = parseFloat(String(tokenInfo.buy_tax ?? "0")) || 0;
        const sellTax = parseFloat(String(tokenInfo.sell_tax ?? "0")) || 0;

        let riskFlags = 0;
        const flagDetails: string[] = [];

        if (isHoneypot || cannotSellAll) { riskFlags += 3; flagDetails.push("honeypot/sell-lock"); }
        if (hasHiddenOwner) { riskFlags += 2; flagDetails.push("hidden owner"); }
        if (canTakeBack) { riskFlags += 2; flagDetails.push("ownership reclaimable"); }
        if (ownerChangeBalance) { riskFlags += 2; flagDetails.push("owner can modify balances"); }
        if (isMintable) { riskFlags += 1; flagDetails.push("mintable"); }
        if (isProxy) { riskFlags += 1; flagDetails.push("proxy contract"); }
        if (!isOpenSource) { riskFlags += 1; flagDetails.push("closed source"); }
        if (buyTax > 10 || sellTax > 10) { riskFlags += 2; flagDetails.push(`high tax (buy:${buyTax}% sell:${sellTax}%)`); }

        const goPlusScore = Math.min(100, riskFlags * 10);
        const critical = isHoneypot || cannotSellAll || hasHiddenOwner || canTakeBack || ownerChangeBalance;

        signals.push({
          source: "GoPlus",
          score: goPlusScore,
          confidence: riskFlags >= 3 ? "high" : riskFlags >= 1 ? "medium" : "low",
          evidence: flagDetails.length > 0
            ? `GoPlus detected ${flagDetails.length} risk flag(s): ${flagDetails.join(", ")}.`
            : "GoPlus found no critical risk flags for this contract.",
          tags: flagDetails.length > 0 ? ["critical_flags", ...flagDetails.slice(0, 3)] : ["low_risk_scan"],
          category: "scanner",
          critical,
          honeypot: isHoneypot || cannotSellAll,
        });
      } catch {
        // GoPlus failed — try Honeypot.is as fallback
      }

      // --- Honeypot.is fallback/supplement ---
      const honeypotBase = env.HONEYPOT_API_BASE ?? "https://api.honeypot.is";

      try {
        const hpUrl = new URL("/v2/IsHoneypot", honeypotBase);
        hpUrl.searchParams.set("address", address);
        hpUrl.searchParams.set("chainID", chainToHoneypotParam(chain));

        const hpJson = await safeFetchJson(
          hpUrl,
          { method: "GET" },
          ctx.timeoutMs,
          "Honeypot.is",
        );
        const hpData = obj(hpJson);
        const honeypotResult = obj(hpData.honeypotResult);
        const simulationResult = obj(hpData.simulationResult);

        const isHpHoneypot = bool(honeypotResult.isHoneypot);
        const hpBuyTax = num(simulationResult.buyTax);
        const hpSellTax = num(simulationResult.sellTax);

        const hpScore = isHpHoneypot
          ? 95
          : hpSellTax > 20
            ? 75
            : hpSellTax > 5
              ? 45
              : 10;

        signals.push({
          source: "Honeypot.is",
          score: hpScore,
          confidence: isHpHoneypot ? "high" : hpSellTax > 5 ? "medium" : "low",
          evidence: isHpHoneypot
            ? "Honeypot.is simulation confirms high honeypot risk — sell transactions likely blocked."
            : hpSellTax > 20
              ? `Honeypot.is reports excessive sell tax (${hpSellTax.toFixed(1)}%) — potential soft rug.`
              : hpSellTax > 5
                ? `Honeypot.is reports elevated sell tax (${hpSellTax.toFixed(1)}%).`
                : "Honeypot.is simulation shows no honeypot behavior.",
          tags: isHpHoneypot ? ["honeypot", "sell_restriction"] : hpSellTax > 5 ? ["high_tax"] : ["low_risk_scan"],
          category: "scanner",
          critical: isHpHoneypot,
          honeypot: isHpHoneypot,
        });
      } catch {
        // Honeypot.is failed — GoPlus result (if any) stands alone
      }

      if (signals.length === 0) {
        signals.push({
          source: "GoPlus",
          score: 35,
          confidence: "low",
          evidence: "Risk scanners returned no data — both GoPlus and Honeypot.is were unreachable.",
          tags: ["scanner_degraded"],
          category: "scanner",
        });
      }

      return signals;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Chainabuse + CryptoScamDB – Reputation Provider                    */
/* ------------------------------------------------------------------ */

function createReputationProvider(env: Env): Provider {
  return {
    name: "reputation_provider",
    external: true,
    async getSignals(ctx: RiskContext): Promise<ProviderSignal[]> {
      const { value } = ctx.request;
      const signals: ProviderSignal[] = [];

      // --- Chainabuse ---
      const chainabuseBase = env.CHAINABUSE_API_BASE;
      if (chainabuseBase) {
        try {
          const caUrl = new URL("/v1/reports", chainabuseBase);
          caUrl.searchParams.set("address", value.toLowerCase());

          const caJson = await safeFetchJson(
            caUrl,
            { method: "GET" },
            ctx.timeoutMs,
            "Chainabuse",
          );
          const caData = obj(caJson);
          const reports = Array.isArray(caData.reports) ? caData.reports : [];
          const hits = reports.length;

          signals.push({
            source: "Chainabuse",
            score: hits >= 5 ? 80 : hits >= 3 ? 65 : hits > 0 ? Math.min(55, 15 + hits * 13) : 8,
            confidence: hits >= 3 ? "high" : hits > 0 ? "medium" : "low",
            evidence: hits > 0
              ? `Chainabuse has ${hits} scam report(s) matching this address.`
              : "No matching scam reports found on Chainabuse.",
            tags: hits > 0 ? ["reported", `hits_${hits}`] : ["no_hit"],
            category: "reputation",
          });
        } catch {
          // Chainabuse unreachable
        }
      }

      // --- CryptoScamDB ---
      const scamDbBase = env.CRYPTOSCAMDB_API_BASE;
      if (scamDbBase) {
        try {
          const csUrl = new URL(
            `/v1/check/${encodeURIComponent(value.toLowerCase())}`,
            scamDbBase,
          );
          const csJson = await safeFetchJson(
            csUrl,
            { method: "GET" },
            ctx.timeoutMs,
            "CryptoScamDB",
          );
          const csData = obj(csJson);
          const success = bool(csData.success);
          const entries = Array.isArray(csData.result)
            ? csData.result
            : csData.result
              ? [csData.result]
              : [];
          const found = success && entries.length > 0;

          signals.push({
            source: "CryptoScamDB",
            score: found ? Math.min(75, 30 + entries.length * 15) : 10,
            confidence: found ? (entries.length >= 2 ? "high" : "medium") : "low",
            evidence: found
              ? `CryptoScamDB lists ${entries.length} record(s) linked to this identifier.`
              : "CryptoScamDB has no records for this identifier.",
            tags: found ? ["scamdb_hit", `entries_${entries.length}`] : ["no_hit"],
            category: "reputation",
          });
        } catch {
          // CryptoScamDB unreachable
        }
      }

      if (signals.length === 0) {
        signals.push({
          source: "ReputationDB",
          score: 20,
          confidence: "low",
          evidence: "No external reputation data available — providers unconfigured or unreachable.",
          tags: ["reputation_degraded"],
          category: "reputation",
        });
      }

      return signals;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export function createLiveProviders(env: Env): Provider[] {
  return [
    createCoinGeckoProvider(env),
    createRiskProvider(env),
    createReputationProvider(env),
  ];
}
