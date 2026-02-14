import { describe, expect, it } from "vitest";
import { renderDashboardPage, renderReportsPage } from "../src/server/pages";
import type { CommunityReportListItem, DashboardStats } from "../src/db/repository";
import type { HeatmapCell } from "../src/types";

const baseStats: DashboardStats = {
  totalReports: 1234,
  openReports: 87,
  warningPages: 14,
  cachedVerdicts: 55,
};

describe("server page rendering", () => {
  it("renders dashboard with escaped heatmap content", () => {
    const heatmap: HeatmapCell[] = [
      { platform: "Telegram", category: "<script>alert(1)</script>", count: 12, trend: "↑" },
    ];

    const html = renderDashboardPage("ScamShield MY", "MY", baseStats, heatmap);

    expect(html).toContain("ScamShield MY Dashboard");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("1,234");
    expect(html).toContain("Rising");
  });

  it("renders reports page with escaped fields and empty state", () => {
    const reports: CommunityReportListItem[] = [
      {
        id: 41,
        createdAt: "2026-02-14 10:10:00",
        platform: "WhatsApp",
        category: "Phishing",
        severity: "high",
        status: "open",
        narrativePreview: "Suspect claimed to be from bank <img src=x onerror=alert(1)>",
      },
    ];

    const html = renderReportsPage("ScamShield MY", "MY", baseStats, reports);

    expect(html).toContain("#41");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("badge badge-high");
    expect(html).toContain("badge badge-open");
  });

  it("renders empty reports state", () => {
    const html = renderReportsPage("ScamShield MY", "MY", baseStats, []);
    expect(html).toContain("No community reports captured yet.");
  });
});
