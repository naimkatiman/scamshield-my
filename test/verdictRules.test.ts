import { describe, it, expect } from "vitest";
import { nextActionsForVerdict } from "../src/core/verdictRules";

describe("nextActionsForVerdict", () => {
    it("returns correct actions for HIGH_RISK", () => {
        const actions = nextActionsForVerdict("HIGH_RISK");
        expect(actions).toContain("Emergency Playbook");
        expect(actions).toContain("Generate Reports");
        expect(actions).toContain("Create Warning Card");
    });

    it("returns correct actions for UNKNOWN", () => {
        const actions = nextActionsForVerdict("UNKNOWN");
        expect(actions).toContain("Report It");
        expect(actions).toContain("Generate Warning Card");
        expect(actions).toContain("Safety Checklist");
    });

    it("returns correct actions for LEGIT", () => {
        const actions = nextActionsForVerdict("LEGIT");
        expect(actions).toContain("Safety Checklist");
        expect(actions).toContain("Verify Official Channels");
        expect(actions).toContain("Monitor Activity");
    });

    it("defaults to UNKNOWN actions for unexpected verdict values", () => {
        // TypeScript won't normally allow this, but runtime safety matters
        const actions = nextActionsForVerdict("BOGUS" as never);
        expect(actions).toContain("Report It");
    });
});
