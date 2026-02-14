import { describe, it, expect } from "vitest";
import { generateIncidentReports } from "../src/core/reportGenerator";
import type { ReportGenerateRequest } from "../src/types";

function makeRequest(overrides: Partial<ReportGenerateRequest> = {}): ReportGenerateRequest {
  return {
    incidentTitle: "Test Scam Incident",
    scamType: "Investment",
    occurredAt: "2025-01-15 14:30",
    channel: "Telegram",
    suspects: ["@scammer123"],
    losses: "RM 1000",
    actionsTaken: ["Contacted bank"],
    extraNotes: "Additional details",
    ...overrides,
  };
}

describe("generateIncidentReports", () => {
  describe("severity thresholds", () => {
    it("returns low for losses under RM 500", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 200", actionsTaken: ["done"] }));
      expect(result.severitySuggestion).toBe("low");
    });

    it("returns medium for losses RM 500-2999", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 1500", actionsTaken: ["done"] }));
      expect(result.severitySuggestion).toBe("medium");
    });

    it("returns high for losses RM 3000-9999", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 5000", actionsTaken: ["done"] }));
      expect(result.severitySuggestion).toBe("high");
    });

    it("returns critical for losses >= RM 10000", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 15000", actionsTaken: ["done"] }));
      expect(result.severitySuggestion).toBe("critical");
    });

    it("returns critical when no actions taken regardless of amount", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 100", actionsTaken: [] }));
      expect(result.severitySuggestion).toBe("critical");
    });

    it("defaults to low for non-numeric loss with actions taken", () => {
      const result = generateIncidentReports(makeRequest({ losses: "Unknown amount", actionsTaken: ["done"] }));
      expect(result.severitySuggestion).toBe("low");
    });
  });

  describe("report content", () => {
    it("generates all three report types", () => {
      const result = generateIncidentReports(makeRequest());
      expect(result.forBank).toBeTruthy();
      expect(result.forPolice).toBeTruthy();
      expect(result.forPlatform).toBeTruthy();
    });

    it("includes incident title in all reports", () => {
      const result = generateIncidentReports(makeRequest({ incidentTitle: "My Incident" }));
      expect(result.forBank).toContain("My Incident");
      expect(result.forPolice).toContain("My Incident");
      expect(result.forPlatform).toContain("My Incident");
    });

    it("includes loss amount in reports", () => {
      const result = generateIncidentReports(makeRequest({ losses: "RM 5000" }));
      expect(result.forBank).toContain("RM 5000");
    });

    it("handles empty suspects array", () => {
      const result = generateIncidentReports(makeRequest({ suspects: [] }));
      expect(result.forBank).toContain("N/A");
      expect(result.identifiers).toHaveLength(0);
    });

    it("generates timeline with 3 entries", () => {
      const result = generateIncidentReports(makeRequest());
      expect(result.timeline).toHaveLength(3);
    });

    it("returns scamType as category", () => {
      const result = generateIncidentReports(makeRequest({ scamType: "Phishing" }));
      expect(result.category).toBe("Phishing");
    });

    it("bank report includes freeze request", () => {
      const result = generateIncidentReports(makeRequest());
      expect(result.forBank).toContain("freeze");
    });

    it("police report includes fraud case", () => {
      const result = generateIncidentReports(makeRequest());
      expect(result.forPolice).toContain("fraud");
    });

    it("platform report includes remove/suspend", () => {
      const result = generateIncidentReports(makeRequest());
      expect(result.forPlatform).toContain("Remove");
    });
  });
});
