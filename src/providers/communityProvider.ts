import { getCommunityMatchCount } from "../db/repository";
import type { ProviderSignal } from "../types";
import type { Provider } from "./types";

export const communityProvider: Provider = {
  name: "community_db",
  async getSignals(ctx) {
    const matchCount = await getCommunityMatchCount(ctx.env.DB, ctx.request.value);

    if (matchCount >= 5) {
      return [{
        source: "CommunityDB",
        score: 70,
        confidence: "high" as const,
        evidence: `Community reports show ${matchCount} matching cases in the last 7 days — strong cluster signal.`,
        tags: ["community_cluster", `matches_${matchCount}`],
        category: "community" as const,
        critical: true,
      }];
    }

    if (matchCount >= 3) {
      return [{
        source: "CommunityDB",
        score: 55,
        confidence: "high" as const,
        evidence: `Community reports show ${matchCount} matching cases in the last 7 days.`,
        tags: ["community_cluster", `matches_${matchCount}`],
        category: "community" as const,
        critical: true,
      }];
    }

    if (matchCount > 0) {
      return [{
        source: "CommunityDB",
        score: 24,
        confidence: "medium" as const,
        evidence: `Community reports show ${matchCount} related case(s); caution advised.`,
        tags: ["community_hit", `matches_${matchCount}`],
        category: "community" as const,
      }];
    }

    // No community reports is actually useful info — low baseline
    return [{
      source: "CommunityDB",
      score: 5,
      confidence: "low" as const,
      evidence: "No community reports match this identifier in the last 7 days.",
      tags: ["no_community_hit"],
      category: "community" as const,
    }];
  },
};
