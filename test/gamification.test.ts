import { describe, expect, it } from "vitest";
import {
  buildPremiumState,
  computeStreakProgress,
  dayDifference,
  getUnlockedReportAchievements,
  isPremiumUnlocked,
  maskEmailForLeaderboard,
  PREMIUM_UNLOCK_POINTS,
  PREMIUM_UNLOCK_STREAK_DAYS,
} from "../src/core/gamification";

describe("gamification core", () => {
  it("computes day difference with valid ISO days", () => {
    expect(dayDifference("2026-02-14", "2026-02-15")).toBe(1);
    expect(dayDifference("2026-02-14", "2026-02-14")).toBe(0);
    expect(dayDifference("bad", "2026-02-15")).toBeNull();
  });

  it("starts streak on first tracked day", () => {
    const result = computeStreakProgress(null, 0, 0, "2026-02-14");
    expect(result.isNewDay).toBe(true);
    expect(result.nextStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(1);
    expect(result.wasReset).toBe(false);
  });

  it("does not increment streak twice on same day", () => {
    const result = computeStreakProgress("2026-02-14", 3, 5, "2026-02-14");
    expect(result.isNewDay).toBe(false);
    expect(result.nextStreakDays).toBe(3);
    expect(result.longestStreakDays).toBe(5);
  });

  it("increments streak on consecutive day", () => {
    const result = computeStreakProgress("2026-02-13", 3, 5, "2026-02-14");
    expect(result.isNewDay).toBe(true);
    expect(result.nextStreakDays).toBe(4);
    expect(result.longestStreakDays).toBe(5);
    expect(result.wasReset).toBe(false);
  });

  it("resets streak when a day is missed", () => {
    const result = computeStreakProgress("2026-02-10", 5, 6, "2026-02-14");
    expect(result.isNewDay).toBe(true);
    expect(result.nextStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(6);
    expect(result.wasReset).toBe(true);
  });

  it("unlocks report milestone achievements based on count", () => {
    const newlyUnlocked = getUnlockedReportAchievements(10, ["REPORT_MILESTONE_1", "REPORT_MILESTONE_5"]);
    expect(newlyUnlocked.map((item) => item.code)).toEqual(["REPORT_MILESTONE_10"]);
  });

  it("unlocks premium by points or streak", () => {
    expect(isPremiumUnlocked(PREMIUM_UNLOCK_POINTS, 0)).toBe(true);
    expect(isPremiumUnlocked(0, PREMIUM_UNLOCK_STREAK_DAYS)).toBe(true);
    expect(isPremiumUnlocked(PREMIUM_UNLOCK_POINTS - 1, PREMIUM_UNLOCK_STREAK_DAYS - 1)).toBe(false);
  });

  it("builds premium state with remaining requirements", () => {
    const locked = buildPremiumState(120, 2);
    expect(locked.unlocked).toBe(false);
    expect(locked.remainingPoints).toBe(PREMIUM_UNLOCK_POINTS - 120);
    expect(locked.remainingStreakDays).toBe(PREMIUM_UNLOCK_STREAK_DAYS - 2);

    const unlocked = buildPremiumState(PREMIUM_UNLOCK_POINTS, 0);
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.remainingPoints).toBe(0);
    expect(unlocked.remainingStreakDays).toBe(0);
  });

  it("masks email in leaderboard-friendly format", () => {
    expect(maskEmailForLeaderboard("analyst@example.com")).toBe("an*****@example.com");
    expect(maskEmailForLeaderboard("a@example.com")).toBe("a*@example.com");
    expect(maskEmailForLeaderboard("bad-email")).toBe("anonymous");
  });
});
