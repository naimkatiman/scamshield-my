import { describe, it, expect, vi } from "vitest";
import { getHeatmapGrid } from "../src/db/repository";

function createMockDB(rows: unknown[] = []): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: rows })),
        run: vi.fn(async () => ({})),
      })),
      all: vi.fn(async () => ({ results: rows })),
    })),
  } as unknown as D1Database;
}

describe("getHeatmapGrid", () => {
  it("returns fallback demo data when DB is empty", async () => {
    const db = createMockDB([]);
    const grid = await getHeatmapGrid(db);
    expect(grid.length).toBeGreaterThan(0);
    // Verify demo data structure
    expect(grid[0]).toHaveProperty("platform");
    expect(grid[0]).toHaveProperty("category");
    expect(grid[0]).toHaveProperty("count");
    expect(grid[0]).toHaveProperty("trend");
  });

  it("computes upward trend when count_7d > count_prev_7d", async () => {
    const db = createMockDB([
      { platform: "Telegram", category: "Investment", count_7d: 10, count_prev_7d: 5 },
    ]);
    const grid = await getHeatmapGrid(db);
    expect(grid[0].trend).toBe("↑");
  });

  it("computes downward trend when count_7d < count_prev_7d", async () => {
    const db = createMockDB([
      { platform: "WhatsApp", category: "Phishing", count_7d: 3, count_prev_7d: 8 },
    ]);
    const grid = await getHeatmapGrid(db);
    expect(grid[0].trend).toBe("↓");
  });

  it("computes stable trend when counts are equal", async () => {
    const db = createMockDB([
      { platform: "Instagram", category: "Impersonation", count_7d: 5, count_prev_7d: 5 },
    ]);
    const grid = await getHeatmapGrid(db);
    expect(grid[0].trend).toBe("→");
  });

  it("handles multiple platforms and categories", async () => {
    const db = createMockDB([
      { platform: "Telegram", category: "Investment", count_7d: 10, count_prev_7d: 5 },
      { platform: "WhatsApp", category: "Phishing", count_7d: 3, count_prev_7d: 8 },
      { platform: "Facebook", category: "Romance", count_7d: 4, count_prev_7d: 4 },
    ]);
    const grid = await getHeatmapGrid(db);
    expect(grid).toHaveLength(3);
    expect(grid.map((g) => g.platform)).toEqual(["Telegram", "WhatsApp", "Facebook"]);
  });

  it("uses count_7d as the count field", async () => {
    const db = createMockDB([
      { platform: "Exchange", category: "Job", count_7d: 42, count_prev_7d: 10 },
    ]);
    const grid = await getHeatmapGrid(db);
    expect(grid[0].count).toBe(42);
  });
});
