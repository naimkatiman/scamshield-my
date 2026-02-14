import type { Verdict } from "../types";

/**
 * Single source of truth for next-action mapping per verdict state.
 * Used by both scoring (fresh computation) and repository (cached verdict hydration).
 *
 * Rule Charter: "Every verdict state must provide next actions."
 */
export function nextActionsForVerdict(verdict: Verdict): string[] {
    switch (verdict) {
        case "HIGH_RISK":
            return ["Emergency Playbook", "Generate Reports", "Create Warning Card"];
        case "LEGIT":
            return ["Safety Checklist", "Verify Official Channels", "Monitor Activity"];
        case "UNKNOWN":
        default:
            return ["Report It", "Generate Warning Card", "Safety Checklist"];
    }
}
